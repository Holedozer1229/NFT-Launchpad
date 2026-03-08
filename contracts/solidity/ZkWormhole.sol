// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IZKVerifier {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[] memory publicInputs
    ) external view returns (bool);
}

contract ZkWormhole is ReentrancyGuard, Ownable {
    // --- Custom Errors ---
    error InvalidProof();
    error InvalidChain();
    error InvalidAmount();
    error WormholeNotOpen();
    error NotOwner();
    error NotGuardian();
    error AlreadySigned();
    error AlreadyProcessed();
    error NonceUsed();
    error TransferFailed();
    error WormholeFull();
    error InvalidGuardianCount();
    error InvalidGuardianAddress();

    // --- Enums ---
    enum Chain { ETH, Polygon, PolygonZkEVM, Arbitrum, Base, ZkSync, Solana, Stacks, DOGE, XMR }
    enum WormholeStatus { Dormant, Charging, Open, Bridging, Sealed }
    enum TransferStatus { Pending, Verified, Completed, Failed }

    // --- Structs ---
    struct WormholePortal {
        address owner;
        bytes32 wormholeId;
        Chain sourceChain;
        Chain destChain;
        WormholeStatus status;
        uint128 capacity;
        uint128 totalTransferred;
        uint64 transferCount;
        uint64 phiBoost;
        bytes32 zkProofHash;
        uint256 timestamp;
    }

    struct WormholeTransfer {
        address sender;
        bytes32 transferId;
        bytes32 wormholeId;
        Chain sourceChain;
        Chain destChain;
        uint256 amount;
        TransferStatus status;
        bytes32 zkProofHash;
        uint8 guardianSigs;
        uint256 signedGuardians; // bitmap
        uint256 timestamp;
    }

    // --- Constants ---
    uint256 public constant MAX_CAPACITY = 1_000_000 ether;
    uint256 public constant TRANSFER_FEE_BPS = 10;
    uint256 private constant BPS_DENOMINATOR = 10000;
    uint8 public constant REQUIRED_SIGNATURES = 5;
    uint8 public constant TOTAL_GUARDIANS = 9;

    // --- State Variables ---
    IZKVerifier public immutable zkVerifier;
    
    mapping(bytes32 => WormholePortal) public portals;
    mapping(bytes32 => WormholeTransfer) public transfers;
    mapping(address => bytes32[]) public userPortals;
    mapping(address => bool) public guardians;
    mapping(address => uint256) public guardianIndex;
    mapping(uint256 => bool) public usedNonces;

    address[] public guardianList;

    // --- Events ---
    event WormholeOpened(bytes32 indexed wormholeId, address indexed owner, Chain source, Chain dest);
    event WormholeClosed(bytes32 indexed wormholeId, address indexed owner);
    event TransferInitiated(bytes32 indexed transferId, bytes32 indexed wormholeId, address indexed sender, uint256 amount);
    event TransferApproved(bytes32 indexed transferId, address indexed guardian, uint8 currentSigs);
    event TransferCompleted(bytes32 indexed transferId, address indexed recipient, uint256 amount);

    // --- Modifiers ---
    modifier onlyPortalOwner(bytes32 wormholeId) {
        if (portals[wormholeId].owner != msg.sender) revert NotOwner();
        _;
    }

    modifier onlyGuardian() {
        if (!guardians[msg.sender]) revert NotGuardian();
        _;
    }

    // --- Constructor ---
    constructor(address _zkVerifier, address[] memory _guardians) Ownable(msg.sender) {
        zkVerifier = IZKVerifier(_zkVerifier);
        if (_guardians.length != TOTAL_GUARDIANS) revert InvalidGuardianCount();

        for (uint256 i = 0; i < TOTAL_GUARDIANS; ) {
            address g = _guardians[i];
            if (g == address(0)) revert InvalidGuardianAddress();
            guardians[g] = true;
            guardianIndex[g] = i;
            guardianList.push(g);
            unchecked { ++i; }
        }
    }

    // --- Core Functions ---

    /**
     * @notice Opens a new wormhole portal for the user
     */
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
        bytes32 wormholeId = keccak256(abi.encodePacked(msg.sender, sourceChain, destChain, block.timestamp));

        WormholePortal storage portal = portals[wormholeId];
        portal.owner = msg.sender;
        portal.wormholeId = wormholeId;
        portal.sourceChain = sourceChain;
        portal.destChain = destChain;
        portal.status = WormholeStatus.Open;
        portal.capacity = uint128(MAX_CAPACITY);
        portal.zkProofHash = zkProofHash;
        portal.timestamp = block.timestamp;

        userPortals[msg.sender].push(wormholeId);

        emit WormholeOpened(wormholeId, msg.sender, sourceChain, destChain);
        return wormholeId;
    }

    /**
     * @notice Closes an existing wormhole portal
     */
    function closeWormhole(bytes32 wormholeId) external onlyPortalOwner(wormholeId) nonReentrant {
        portals[wormholeId].status = WormholeStatus.Sealed;
        emit WormholeClosed(wormholeId, msg.sender);
    }

    /**
     * @notice Initiates a cross-chain transfer through a wormhole
     */
    function initiateTransfer(
        bytes32 wormholeId,
        uint256 amount,
        uint256 nonce,
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[] memory publicInputs
    ) external payable nonReentrant returns (bytes32) {
        if (usedNonces[nonce]) revert NonceUsed();
        if (amount == 0 || msg.value < amount) revert InvalidAmount();
        
        WormholePortal storage portal = portals[wormholeId];
        if (portal.status != WormholeStatus.Open) revert WormholeNotOpen();
        if (portal.totalTransferred + amount > portal.capacity) revert WormholeFull();

        if (!zkVerifier.verifyProof(a, b, c, publicInputs)) revert InvalidProof();

        usedNonces[nonce] = true;
        bytes32 zkProofHash = keccak256(abi.encode(a, b, c, publicInputs));
        bytes32 transferId = keccak256(abi.encodePacked(wormholeId, msg.sender, amount, nonce, block.timestamp));

        transfers[transferId] = WormholeTransfer({
            sender: msg.sender,
            transferId: transferId,
            wormholeId: wormholeId,
            sourceChain: portal.sourceChain,
            destChain: portal.destChain,
            amount: amount,
            status: TransferStatus.Pending,
            zkProofHash: zkProofHash,
            guardianSigs: 0,
            signedGuardians: 0,
            timestamp: block.timestamp
        });

        unchecked {
            portal.totalTransferred += uint128(amount);
            portal.transferCount++;
        }

        emit TransferInitiated(transferId, wormholeId, msg.sender, amount);
        return transferId;
    }

    /**
     * @notice Guardian approval for a transfer
     */
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

    /**
     * @notice Internal function to complete a transfer after threshold reached
     */
    function _completeTransfer(bytes32 transferId) internal {
        WormholeTransfer storage transfer = transfers[transferId];
        transfer.status = TransferStatus.Completed;

        uint256 fee = (transfer.amount * TRANSFER_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netAmount;
        unchecked { netAmount = transfer.amount - fee; }

        (bool success, ) = payable(transfer.sender).call{value: netAmount}("");
        if (!success) {
            transfer.status = TransferStatus.Failed;
            revert TransferFailed();
        }

        emit TransferCompleted(transferId, transfer.sender, netAmount);
    }

    /**
     * @notice Sets the phi boost multiplier for a portal
     */
    function setPhiBoost(bytes32 wormholeId, uint64 boost) external onlyPortalOwner(wormholeId) {
        portals[wormholeId].phiBoost = boost;
    }

    // --- View Functions ---

    function getUserWormholes(address user) external view returns (bytes32[] memory) {
        return userPortals[user];
    }

    function getWormholeInfo(bytes32 wormholeId) external view returns (WormholePortal memory) {
        return portals[wormholeId];
    }

    function getTransferInfo(bytes32 transferId) external view returns (WormholeTransfer memory) {
        return transfers[transferId];
    }

    receive() external payable {}
}
