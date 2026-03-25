// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/Context.sol";

interface IZKVerifier {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[] memory input
    ) external view returns (bool);
}

/**
 * @title SphinxYieldAggregator
 * @notice Gas-optimised multi-chain yield aggregator with ZK-proof verification.
 *         Supports EIP-2771 gasless deposits/withdrawals via SKYNTForwarder.
 * @dev Removed: deprecated Address.isContract() — use address(0) check instead.
 *      Fixed:   rateLimit modifier uses _msgSender() for gasless compatibility.
 */
contract SphinxYieldAggregator is ERC2771Context, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    error InvalidTreasury();
    error InvalidAmount();
    error InvalidPhiScore();
    error TokenNotSupported();
    error TokenAlreadySupported();
    error NoDeposit();
    error InsufficientBalance();
    error NoYieldAvailable();
    error ProofAlreadyUsed();
    error InvalidProof();
    error EmergencyActive();
    error NotInEmergency();
    error RateLimitExceeded();
    error InvalidStrategyContract();
    error TooManyStrategies();
    error InvalidTreasuryShare();

    struct YieldStrategy {
        address strategyContract;
        uint256 totalDeposited;
        uint128 currentAPR;
        uint64  riskScore;
        bool    active;
        string  name;
    }

    struct UserPosition {
        uint256 depositedAmount;
        uint128 phiScore;
        uint64  lastClaimTime;
        uint256 accumulatedYield;
    }

    struct YieldProof {
        uint256[2]   a;
        uint256[2][2]b;
        uint256[2]   c;
        uint256[]    publicInputs;
        uint256      timestamp;
    }

    bytes32 public constant ADMIN_ROLE    = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    uint256 public constant MAX_STRATEGIES  = 10;
    uint256 public constant ACTION_COOLDOWN = 1 minutes;
    uint256 constant PHI_MIN = 200;
    uint256 constant PHI_MAX = 1000;

    bool    public emergencyShutdown;
    mapping(address => uint256) public lastActionTime;
    mapping(address => bool)    public supportedTokens;
    address[] public tokenList;

    YieldStrategy[] public strategies;

    mapping(address => mapping(address => UserPosition)) public userPositions;

    address public treasury;
    uint256 public treasuryShareBPS = 500;
    uint256 public constant MAX_TREASURY_BPS = 3000;
    uint256 private constant BPS_DENOMINATOR = 10000;

    IZKVerifier public immutable zkVerifier;
    mapping(bytes32 => bool) public usedProofs;

    event Deposited(address indexed user, address indexed token, uint256 amount, uint256 phiScore);
    event Withdrawn(address indexed user, address indexed token, uint256 amount, uint256 yieldAmount);
    event YieldClaimed(address indexed user, address indexed token, uint256 userAmount, uint256 treasuryAmount);
    event StrategyAdded(uint256 indexed strategyId, string name, address strategyContract);
    event ProofVerified(bytes32 indexed proofHash, address indexed user);
    event EmergencyToggled(bool active, address indexed admin);

    constructor(
        address _treasury,
        address _zkVerifier,
        address _trustedForwarder
    ) ERC2771Context(_trustedForwarder) {
        if (_treasury == address(0)) revert InvalidTreasury();
        treasury   = _treasury;
        zkVerifier = IZKVerifier(_zkVerifier);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    modifier notShutdown() {
        if (emergencyShutdown) revert EmergencyActive();
        _;
    }

    modifier rateLimit() {
        address sender = _msgSender();
        if (block.timestamp < lastActionTime[sender] + ACTION_COOLDOWN) revert RateLimitExceeded();
        lastActionTime[sender] = block.timestamp;
        _;
    }

    function deposit(
        address token,
        uint256 amount,
        uint256 phiScore
    ) external nonReentrant whenNotPaused notShutdown rateLimit {
        if (!supportedTokens[token])                        revert TokenNotSupported();
        if (amount == 0)                                    revert InvalidAmount();
        if (phiScore < PHI_MIN || phiScore > PHI_MAX)       revert InvalidPhiScore();

        address sender = _msgSender();
        IERC20(token).safeTransferFrom(sender, address(this), amount);

        UserPosition storage position = userPositions[sender][token];
        position.depositedAmount += amount;
        position.phiScore         = uint128(phiScore);
        position.lastClaimTime    = uint64(block.timestamp);

        _allocateToStrategies(amount);
        emit Deposited(sender, token, amount, phiScore);
    }

    function withdraw(address token, uint256 amount) external nonReentrant notShutdown rateLimit {
        address sender = _msgSender();
        UserPosition storage position = userPositions[sender][token];
        if (position.depositedAmount == 0)              revert NoDeposit();
        if (amount == 0) amount = position.depositedAmount;
        if (amount > position.depositedAmount)          revert InsufficientBalance();

        uint256 yieldAmount = _calculateYield(sender, token);
        position.depositedAmount  -= amount;
        position.accumulatedYield  = 0;
        position.lastClaimTime     = uint64(block.timestamp);

        _withdrawFromStrategies(amount);

        IERC20(token).safeTransfer(sender, amount);
        if (yieldAmount > 0) _distributeYield(sender, token, yieldAmount);
        emit Withdrawn(sender, token, amount, yieldAmount);
    }

    function claimYield(address token) external nonReentrant notShutdown rateLimit {
        address sender = _msgSender();
        UserPosition storage position = userPositions[sender][token];
        if (position.depositedAmount == 0) revert NoDeposit();
        uint256 yieldAmount = _calculateYield(sender, token);
        if (yieldAmount == 0) revert NoYieldAvailable();
        position.accumulatedYield = 0;
        position.lastClaimTime    = uint64(block.timestamp);
        _distributeYield(sender, token, yieldAmount);
    }

    function verifyYieldProof(YieldProof calldata proof) external returns (bool) {
        bytes32 proofHash = keccak256(abi.encode(proof.a, proof.b, proof.c, proof.publicInputs));
        if (usedProofs[proofHash]) revert ProofAlreadyUsed();
        bool valid = zkVerifier.verifyProof(proof.a, proof.b, proof.c, proof.publicInputs);
        if (!valid) revert InvalidProof();
        usedProofs[proofHash] = true;
        emit ProofVerified(proofHash, _msgSender());
        return true;
    }

    function _allocateToStrategies(uint256 amount) internal {
        uint256 len = strategies.length;
        if (len == 0) return;

        uint256 activeCount;
        for (uint256 i; i < len;) {
            if (strategies[i].active) unchecked { ++activeCount; }
            unchecked { ++i; }
        }
        if (activeCount == 0) return;

        uint256 perStrategy = amount / (activeCount > 3 ? 3 : activeCount);
        uint256 allocated;

        for (uint256 i; i < len && allocated < 3;) {
            if (strategies[i].active) {
                strategies[i].totalDeposited += perStrategy;
                unchecked { ++allocated; }
            }
            unchecked { ++i; }
        }
    }

    function _withdrawFromStrategies(uint256 amount) internal {
        uint256 len = strategies.length;
        if (len == 0) return;
        uint256 remaining = amount;
        for (uint256 i; i < len && remaining > 0;) {
            if (strategies[i].active && strategies[i].totalDeposited > 0) {
                uint256 withdrawable = strategies[i].totalDeposited < remaining
                    ? strategies[i].totalDeposited : remaining;
                strategies[i].totalDeposited -= withdrawable;
                unchecked { remaining -= withdrawable; }
            }
            unchecked { ++i; }
        }
    }

    function _calculateYield(address user, address token) internal view returns (uint256) {
        UserPosition storage position = userPositions[user][token];
        uint256 timeElapsed = block.timestamp - uint256(position.lastClaimTime);
        if (timeElapsed == 0) return position.accumulatedYield;

        uint256 baseYield;
        uint256 len            = strategies.length;
        uint256 depositedAmount= position.depositedAmount;

        for (uint256 i; i < len;) {
            if (strategies[i].active) {
                unchecked {
                    uint256 yearlyYield = (depositedAmount * uint256(strategies[i].currentAPR)) / BPS_DENOMINATOR;
                    baseYield += (yearlyYield * timeElapsed) / 365 days;
                }
            }
            unchecked { ++i; }
        }

        uint256 phiBoost = _calculatePhiBoost(uint256(position.phiScore));
        unchecked {
            return (baseYield * phiBoost) / BPS_DENOMINATOR + position.accumulatedYield;
        }
    }

    function _calculatePhiBoost(uint256 phiScore) internal pure returns (uint256) {
        if (phiScore < PHI_MIN) phiScore = PHI_MIN;
        if (phiScore > PHI_MAX) phiScore = PHI_MAX;
        unchecked {
            if (phiScore >= 500) {
                return BPS_DENOMINATOR + (phiScore - 500) * 5;
            } else {
                return BPS_DENOMINATOR - (500 - phiScore) * 5;
            }
        }
    }

    function _distributeYield(address user, address token, uint256 amount) internal {
        UserPosition storage position = userPositions[user][token];
        uint256 phiTreasuryBonus;
        unchecked { phiTreasuryBonus = uint256(position.phiScore) / 2; }
        uint256 effectiveTreasuryBPS = treasuryShareBPS + phiTreasuryBonus;
        if (effectiveTreasuryBPS > MAX_TREASURY_BPS) effectiveTreasuryBPS = MAX_TREASURY_BPS;

        uint256 treasuryAmount;
        uint256 userAmount;
        unchecked {
            treasuryAmount = (amount * effectiveTreasuryBPS) / BPS_DENOMINATOR;
            userAmount     = amount - treasuryAmount;
        }

        if (treasuryAmount > 0) IERC20(token).safeTransfer(treasury, treasuryAmount);
        if (userAmount > 0)     IERC20(token).safeTransfer(user, userAmount);

        emit YieldClaimed(user, token, userAmount, treasuryAmount);
    }

    function activateEmergencyShutdown() external onlyRole(ADMIN_ROLE) {
        if (emergencyShutdown) revert EmergencyActive();
        emergencyShutdown = true;
        _pause();
        emit EmergencyToggled(true, msg.sender);
    }

    function deactivateEmergencyShutdown() external onlyRole(ADMIN_ROLE) {
        if (!emergencyShutdown) revert NotInEmergency();
        emergencyShutdown = false;
        _unpause();
        emit EmergencyToggled(false, msg.sender);
    }

    function addToken(address token) external onlyRole(ADMIN_ROLE) {
        if (supportedTokens[token]) revert TokenAlreadySupported();
        supportedTokens[token] = true;
        tokenList.push(token);
    }

    function addStrategy(
        string calldata name,
        address strategyContract,
        uint256 apr,
        uint256 riskScore
    ) external onlyRole(ADMIN_ROLE) {
        // Removed deprecated Address.isContract() — use address(0) check
        if (strategyContract == address(0)) revert InvalidStrategyContract();
        if (strategies.length >= MAX_STRATEGIES) revert TooManyStrategies();

        strategies.push(YieldStrategy({
            name:             name,
            strategyContract: strategyContract,
            totalDeposited:   0,
            currentAPR:       uint128(apr),
            riskScore:        uint64(riskScore),
            active:           true
        }));

        uint256 strategyId;
        unchecked { strategyId = strategies.length - 1; }
        emit StrategyAdded(strategyId, name, strategyContract);
    }

    function setTreasury(address _treasury) external onlyRole(ADMIN_ROLE) {
        if (_treasury == address(0)) revert InvalidTreasury();
        treasury = _treasury;
    }

    function setTreasuryShare(uint256 bps) external onlyRole(ADMIN_ROLE) {
        if (bps > MAX_TREASURY_BPS) revert InvalidTreasuryShare();
        treasuryShareBPS = bps;
    }

    function pause()   external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }

    function getUserPosition(address user, address token) external view returns (UserPosition memory) { return userPositions[user][token]; }
    function getPendingYield(address user, address token) external view returns (uint256) { return _calculateYield(user, token); }
    function getStrategyCount() external view returns (uint256) { return strategies.length; }

    function getTotalTVL() external view returns (uint256) {
        uint256 total;
        uint256 len = strategies.length;
        for (uint256 i; i < len;) { total += strategies[i].totalDeposited; unchecked { ++i; } }
        return total;
    }

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
}
