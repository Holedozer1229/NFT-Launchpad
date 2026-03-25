// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/Context.sol";

interface IZKVerifier {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[] memory publicInputs
    ) external view returns (bool);
}

/**
 * @title ZkWormhole
 * @notice ZK-proof gated cross-chain wormhole bridge.
 *         Supports EIP-2771 gasless portal opening / transfers via SKYNTForwarder.
 */
contract ZkWormhole is ERC2771Context, ReentrancyGuard, Ownable {

    error InvalidProof();
    error InvalidChain();
    error InvalidAmount();
    error WormholeNotOpen();
    error NotPortalOwner();
    error NotGuardian();
    error AlreadySigned();
    error AlreadyProcessed();
    error NonceUsed();
    error TransferFailed();
    error WormholeFull();
    error InvalidGuardianCount();
    error InvalidGuardianAddress();

    enum Chain          { ETH, Polygon, PolygonZkEVM, Arbitrum, Base, ZkSync, Solana, Stacks, DOGE, XMR }
    enum WormholeStatus { Dormant, Charging, Open, Bridging, Sealed }
    enum TransferStatus { Pending, Verified, Completed, Failed }

    struct WormholePortal {
        address        owner;
        bytes32        wormholeId;
        Chain          sourceChain;
        Chain          destChain;
        WormholeStatus status;
        uint128        capacity;
        uint128        totalTransferred;
        uint64         transferCount;
        uint64         phiBoost;
        bytes32        zkProofHash;
        uint256        timestamp;
    }

    struct WormholeTransfer {
        address        sender;
        bytes32        transferId;
        bytes32        wormholeId;
        Chain          sourceChain;
        Chain          destChain;
        uint256        amount;
        TransferStatus status;
        bytes32        zkProofHash;
        uint8          guardianSigs;
        uint256        signedGuardians;
        uint256        timestamp;
    }

    uint256 public constant MAX_CAPACITY       = 1_000_000 ether;
    uint256 public constant TRANSFER_FEE_BPS   = 10;
    uint256 private constant BPS_DENOMINATOR   = 10000;
    uint8   public constant REQUIRED_SIGNATURES = 5;
    uint8   public constant TOTAL_GUARDIANS     = 9;

    IZKVerifier public immutable zkVerifier;

    mapping(bytes32 => WormholePortal)  public portals;
    mapping(bytes32 => WormholeTransfer)public transfers;
    mapping(address => bytes32[])       public userPortals;
    mapping(address => bool)            public guardians;
    mapping(address => uint256)         public guardianIndex;
    mapping(uint256 => bool)            public usedNonces;

    address[] public guardianList;

    event WormholeOpened(bytes32 indexed wormholeId, address indexed owner, Chain source, Chain dest);
    event WormholeClosed(bytes32 indexed wormholeId, address indexed owner);
    event TransferInitiated(bytes32 indexed transferId, bytes32 indexed wormholeId, address indexed sender, uint256 amount);
    event TransferApproved(bytes32 indexed transferId, address indexed guardian, uint8 currentSigs);
    event TransferCompleted(bytes32 indexed transferId, address indexed recipient, uint256 amount);

    modifier onlyPortalOwner(bytes32 wormholeId) {
        if (portals[wormholeId].owner != _msgSender()) revert NotPortalOwner();
        _;
    }

    modifier onlyGuardian() {
        if (!guardians[msg.sender]) revert NotGuardian();
        _;
    }

    constructor(
        address _zkVerifier,
        address[] memory _guardians,
        address _trustedForwarder
    ) ERC2771Context(_trustedForwarder) Ownable(msg.sender) {
        zkVerifier = IZKVerifier(_zkVerifier);
        if (_guardians.length != TOTAL_GUARDIANS) revert InvalidGuardianCount();
        for (uint256 i = 0; i < TOTAL_GUARDIANS;) {
            address g = _guardians[i];
            if (g == address(0)) revert InvalidGuardianAddress();
            guardians[g]     = true;
            guardianIndex[g] = i;
            guardianList.push(g);
            unchecked { ++i; }
        }
    }

    function openWormhole(
        Chain sourceChain,
        Chain destChain,
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[] memory publicInputs
    ) external nonReentrant returns (bytes32) {
        if (!zkVerifier.verifyProof(a, b, c, publicInputs)) revert InvalidProof();

        bytes32 zkProofHash = keccak256(abi.encode(a, b, c, publicInputs));
        address sender      = _msgSender();
        bytes32 wormholeId  = keccak256(abi.encodePacked(sender, sourceChain, destChain, block.timestamp));

        WormholePortal storage portal = portals[wormholeId];
        portal.owner       = sender;
        portal.wormholeId  = wormholeId;
        portal.sourceChain = sourceChain;
        portal.destChain   = destChain;
        portal.status      = WormholeStatus.Open;
        portal.capacity    = uint128(MAX_CAPACITY);
        portal.zkProofHash = zkProofHash;
        portal.timestamp   = block.timestamp;

        userPortals[sender].push(wormholeId);

        emit WormholeOpened(wormholeId, sender, sourceChain, destChain);
        return wormholeId;
    }

    function closeWormhole(bytes32 wormholeId) external onlyPortalOwner(wormholeId) nonReentrant {
        portals[wormholeId].status = WormholeStatus.Sealed;
        emit WormholeClosed(wormholeId, _msgSender());
    }

    function initiateTransfer(
        bytes32 wormholeId,
        uint256 amount,
        uint256 nonce,
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[] memory publicInputs
    ) external payable nonReentrant returns (bytes32) {
        if (usedNonces[nonce])                          revert NonceUsed();
        if (amount == 0 || msg.value < amount)          revert InvalidAmount();

        WormholePortal storage portal = portals[wormholeId];
        if (portal.status != WormholeStatus.Open)                       revert WormholeNotOpen();
        if (portal.totalTransferred + amount > portal.capacity)         revert WormholeFull();
        if (!zkVerifier.verifyProof(a, b, c, publicInputs))            revert InvalidProof();

        usedNonces[nonce] = true;
        bytes32 zkProofHash = keccak256(abi.encode(a, b, c, publicInputs));
        address sender      = _msgSender();
        bytes32 transferId  = keccak256(abi.encodePacked(wormholeId, sender, amount, nonce, block.timestamp));

        transfers[transferId] = WormholeTransfer({
            sender:          sender,
            transferId:      transferId,
            wormholeId:      wormholeId,
            sourceChain:     portal.sourceChain,
            destChain:       portal.destChain,
            amount:          amount,
            status:          TransferStatus.Pending,
            zkProofHash:     zkProofHash,
            guardianSigs:    0,
            signedGuardians: 0,
            timestamp:       block.timestamp
        });

        unchecked {
            portal.totalTransferred += uint128(amount);
            portal.transferCount++;
        }

        emit TransferInitiated(transferId, wormholeId, sender, amount);
        return transferId;
    }

    function approveTransfer(bytes32 transferId) external onlyGuardian nonReentrant {
        WormholeTransfer storage transfer = transfers[transferId];
        if (transfer.status != TransferStatus.Pending) revert AlreadyProcessed();

        uint256 guardianBit = 1 << guardianIndex[msg.sender];
        if (transfer.signedGuardians & guardianBit != 0) revert AlreadySigned();

        transfer.signedGuardians |= guardianBit;
        unchecked { transfer.guardianSigs++; }

        emit TransferApproved(transferId, msg.sender, transfer.guardianSigs);

        if (transfer.guardianSigs >= REQUIRED_SIGNATURES) {
            _completeTransfer(transferId);
        }
    }

    function _completeTransfer(bytes32 transferId) internal {
        WormholeTransfer storage transfer = transfers[transferId];
        transfer.status = TransferStatus.Completed;

        uint256 fee;
        uint256 netAmount;
        unchecked {
            fee       = (transfer.amount * TRANSFER_FEE_BPS) / BPS_DENOMINATOR;
            netAmount = transfer.amount - fee;
        }

        (bool success,) = payable(transfer.sender).call{value: netAmount}("");
        if (!success) {
            transfer.status = TransferStatus.Failed;
            revert TransferFailed();
        }

        emit TransferCompleted(transferId, transfer.sender, netAmount);
    }

    function setPhiBoost(bytes32 wormholeId, uint64 boost) external onlyPortalOwner(wormholeId) {
        portals[wormholeId].phiBoost = boost;
    }

    function getUserWormholes(address user) external view returns (bytes32[] memory) { return userPortals[user]; }
    function getWormholeInfo(bytes32 wormholeId)  external view returns (WormholePortal memory)  { return portals[wormholeId]; }
    function getTransferInfo(bytes32 transferId)  external view returns (WormholeTransfer memory) { return transfers[transferId]; }

    // ─── ERC2771 overrides ────────────────────────────────────────────────────
    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }
    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }
    function _contextSuffixLength() internal view override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }

    receive() external payable {}
}
