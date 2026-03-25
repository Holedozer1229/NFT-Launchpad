// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/Context.sol";

/**
 * @title SphinxBridge
 * @notice Gas-optimised cross-chain bridge with 5-of-9 guardian multi-sig.
 *         Supports EIP-2771 gasless bridging via SKYNTForwarder.
 *         Added: Ownable for guardian management.
 */
contract SphinxBridge is ERC2771Context, Ownable, ReentrancyGuard {

    error NotGuardian();
    error InvalidAmount();
    error InvalidStatus();
    error AlreadyProcessed();
    error AlreadySigned();
    error InsufficientLockedBalance();
    error TransferFailed();
    error InvalidGuardianAddress();
    error InvalidGuardianCount();
    error InvalidAddress();

    enum Status { Pending, Locked, Minted, Burned, Released, Failed }

    struct BridgeTransaction {
        address sender;
        address recipient;
        uint256 amount;
        string  sourceChain;
        string  destinationChain;
        Status  status;
        uint8   signatures;
        uint256 signedGuardians;
        uint256 timestamp;
    }

    mapping(bytes32 => BridgeTransaction) public transactions;
    mapping(address => uint256)           public lockedBalances;
    mapping(address => uint256)           public wrappedBalances;
    mapping(address => bool)              public guardians;
    mapping(address => uint256)           public guardianIndex;

    address[] public guardianList;
    uint8  public constant REQUIRED_SIGNATURES = 5;
    uint8  public constant TOTAL_GUARDIANS     = 9;
    uint256 public constant BRIDGE_FEE_BPS     = 10;
    uint256 private constant BPS_DENOMINATOR   = 10000;

    event TokensLocked(bytes32 indexed txHash, address indexed sender, uint256 amount, string destinationChain);
    event TokensMinted(bytes32 indexed txHash, address indexed recipient, uint256 amount);
    event TokensBurned(bytes32 indexed txHash, address indexed sender, uint256 amount, string destinationChain);
    event TokensReleased(bytes32 indexed txHash, address indexed recipient, uint256 amount);
    event GuardianSignature(bytes32 indexed txHash, address indexed guardian, uint8 totalSignatures);
    event GuardianReplaced(address indexed oldGuardian, address indexed newGuardian);

    modifier onlyGuardian() {
        if (!guardians[_msgSender()]) revert NotGuardian();
        _;
    }

    constructor(
        address[] memory _guardians,
        address _trustedForwarder
    ) ERC2771Context(_trustedForwarder) Ownable(msg.sender) {
        if (_guardians.length != TOTAL_GUARDIANS) revert InvalidGuardianCount();
        for (uint256 i; i < TOTAL_GUARDIANS;) {
            address g = _guardians[i];
            if (g == address(0)) revert InvalidGuardianAddress();
            guardians[g]      = true;
            guardianIndex[g]  = i;
            guardianList.push(g);
            unchecked { ++i; }
        }
    }

    function lockTokens(
        string calldata destinationChain,
        address recipient
    ) external payable nonReentrant returns (bytes32) {
        if (msg.value == 0) revert InvalidAmount();

        uint256 fee;
        uint256 netAmount;
        unchecked {
            fee       = (msg.value * BRIDGE_FEE_BPS) / BPS_DENOMINATOR;
            netAmount = msg.value - fee;
        }

        address sender = _msgSender();
        bytes32 txHash = keccak256(abi.encodePacked(
            sender, recipient, msg.value, destinationChain, block.timestamp, block.number
        ));

        transactions[txHash] = BridgeTransaction({
            sender:           sender,
            recipient:        recipient,
            amount:           netAmount,
            sourceChain:      "ethereum",
            destinationChain: destinationChain,
            status:           Status.Locked,
            signatures:       0,
            signedGuardians:  0,
            timestamp:        block.timestamp
        });

        lockedBalances[sender] += netAmount;
        emit TokensLocked(txHash, sender, netAmount, destinationChain);
        return txHash;
    }

    function mintTokens(bytes32 txHash) external onlyGuardian nonReentrant {
        BridgeTransaction storage bridgeTx = transactions[txHash];
        if (bridgeTx.status != Status.Locked)               revert InvalidStatus();
        if (bridgeTx.signatures >= REQUIRED_SIGNATURES)      revert AlreadyProcessed();

        address guardian    = _msgSender();
        uint256 guardianBit = 1 << guardianIndex[guardian];
        if (bridgeTx.signedGuardians & guardianBit != 0)     revert AlreadySigned();

        bridgeTx.signedGuardians |= guardianBit;
        unchecked { bridgeTx.signatures++; }

        emit GuardianSignature(txHash, guardian, bridgeTx.signatures);

        if (bridgeTx.signatures >= REQUIRED_SIGNATURES) {
            bridgeTx.status = Status.Minted;
            wrappedBalances[bridgeTx.recipient] += bridgeTx.amount;
            emit TokensMinted(txHash, bridgeTx.recipient, bridgeTx.amount);
        }
    }

    function burnTokens(
        uint256 amount,
        string calldata destinationChain,
        address recipient
    ) external nonReentrant returns (bytes32) {
        if (amount == 0) revert InvalidAmount();
        address sender = _msgSender();
        if (wrappedBalances[sender] < amount) revert InsufficientLockedBalance();

        uint256 fee;
        uint256 netAmount;
        unchecked {
            fee       = (amount * BRIDGE_FEE_BPS) / BPS_DENOMINATOR;
            netAmount = amount - fee;
        }

        wrappedBalances[sender] -= amount;

        bytes32 txHash = keccak256(abi.encodePacked(
            sender, recipient, amount, destinationChain, block.timestamp, block.number
        ));

        transactions[txHash] = BridgeTransaction({
            sender:           sender,
            recipient:        recipient,
            amount:           netAmount,
            sourceChain:      "sphinx",
            destinationChain: destinationChain,
            status:           Status.Burned,
            signatures:       0,
            signedGuardians:  0,
            timestamp:        block.timestamp
        });

        emit TokensBurned(txHash, sender, netAmount, destinationChain);
        return txHash;
    }

    function releaseTokens(bytes32 txHash) external onlyGuardian nonReentrant {
        BridgeTransaction storage bridgeTx = transactions[txHash];
        if (bridgeTx.status != Status.Burned)                revert InvalidStatus();
        if (bridgeTx.signatures >= REQUIRED_SIGNATURES)      revert AlreadyProcessed();

        address guardian    = _msgSender();
        uint256 guardianBit = 1 << guardianIndex[guardian];
        if (bridgeTx.signedGuardians & guardianBit != 0)     revert AlreadySigned();

        bridgeTx.signedGuardians |= guardianBit;
        unchecked { bridgeTx.signatures++; }

        emit GuardianSignature(txHash, guardian, bridgeTx.signatures);

        if (bridgeTx.signatures >= REQUIRED_SIGNATURES) {
            bridgeTx.status = Status.Released;
            uint256 releaseAmount = bridgeTx.amount;
            if (lockedBalances[bridgeTx.sender] < releaseAmount) revert InsufficientLockedBalance();
            lockedBalances[bridgeTx.sender] -= releaseAmount;

            (bool success,) = bridgeTx.recipient.call{value: releaseAmount}("");
            if (!success) revert TransferFailed();
            emit TokensReleased(txHash, bridgeTx.recipient, releaseAmount);
        }
    }

    // ─── Admin: guardian management ──────────────────────────────────────────
    function replaceGuardian(address oldGuardian, address newGuardian) external onlyOwner {
        if (!guardians[oldGuardian])      revert NotGuardian();
        if (newGuardian == address(0))    revert InvalidAddress();

        uint256 idx = guardianIndex[oldGuardian];
        guardians[oldGuardian]    = false;
        guardians[newGuardian]    = true;
        guardianIndex[newGuardian]= idx;
        guardianList[idx]         = newGuardian;

        emit GuardianReplaced(oldGuardian, newGuardian);
    }

    // ─── View ─────────────────────────────────────────────────────────────────
    function getTransactionStatus(bytes32 txHash) external view returns (
        address sender, address recipient, uint256 amount, Status status, uint8 signatures
    ) {
        BridgeTransaction storage bridgeTx = transactions[txHash];
        return (bridgeTx.sender, bridgeTx.recipient, bridgeTx.amount, bridgeTx.status, bridgeTx.signatures);
    }

    function hasGuardianSigned(bytes32 txHash, address guardian) external view returns (bool) {
        uint256 guardianBit = 1 << guardianIndex[guardian];
        return transactions[txHash].signedGuardians & guardianBit != 0;
    }

    function getWrappedBalance(address account) external view returns (uint256) { return wrappedBalances[account]; }
    function getLockedBalance(address account)  external view returns (uint256) { return lockedBalances[account]; }

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
