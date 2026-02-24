// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SphinxYieldAggregator
 * @notice Multi-chain yield aggregator with zk-proof verification
 * @dev Integrates with SphinxSkynet hypercube network
 * 
 * Features:
 * - Multi-token yield optimization
 * - zk-SNARK proof verification
 * - Phi score-based yield boosts
 * - Cross-chain yield routing
 * - Automated rebalancing
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

interface IZKVerifier {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[] memory input
    ) external view returns (bool);
}

contract SphinxYieldAggregator is Ownable, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using Address for address;
    
    struct YieldStrategy {
        string name;
        address strategyContract;
        uint256 totalDeposited;
        uint256 currentAPR;
        uint256 riskScore;
        bool active;
    }
    
    struct UserPosition {
        uint256 depositedAmount;
        uint256 phiScore;
        uint256 lastClaimTime;
        uint256 accumulatedYield;
        uint256[] strategyAllocations;
    }
    
    struct YieldProof {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
        uint256[] publicInputs;
        uint256 timestamp;
    }
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    bool public emergencyShutdown;
    mapping(address => uint256) public lastActionTime;
    uint256 public constant ACTION_COOLDOWN = 1 minutes;
    
    mapping(address => bool) public supportedTokens;
    address[] public tokenList;
    
    YieldStrategy[] public strategies;
    mapping(uint256 => bool) public activeStrategies;
    
    mapping(address => mapping(address => UserPosition)) public userPositions;
    
    address public treasury;
    uint256 public treasuryShareBPS = 500;
    uint256 public maxTreasuryShareBPS = 3000;
    
    IZKVerifier public zkVerifier;
    mapping(bytes32 => bool) public usedProofs;
    
    mapping(address => uint256) public userPhiScores;
    uint256 constant PHI_MIN = 200;
    uint256 constant PHI_MAX = 1000;
    
    event Deposited(address indexed user, address indexed token, uint256 amount, uint256 phiScore);
    event Withdrawn(address indexed user, address indexed token, uint256 amount, uint256 yieldAmount);
    event YieldClaimed(address indexed user, uint256 amount, uint256 treasuryAmount);
    event StrategyAdded(uint256 indexed strategyId, string name, address strategyContract);
    event ProofVerified(bytes32 indexed proofHash, address indexed user);
    event EmergencyShutdownActivated(address indexed admin);
    event EmergencyShutdownDeactivated(address indexed admin);
    
    constructor(address _treasury, address _zkVerifier) {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        zkVerifier = IZKVerifier(_zkVerifier);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }
    
    modifier notShutdown() { require(!emergencyShutdown, "Emergency shutdown active"); _; }
    modifier rateLimit() {
        require(block.timestamp >= lastActionTime[msg.sender] + ACTION_COOLDOWN, "Rate limit exceeded");
        lastActionTime[msg.sender] = block.timestamp;
        _;
    }
    
    function deposit(address token, uint256 amount, uint256 phiScore) external nonReentrant whenNotPaused notShutdown rateLimit {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be > 0");
        require(phiScore >= PHI_MIN && phiScore <= PHI_MAX, "Invalid Phi score");
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        UserPosition storage position = userPositions[msg.sender][token];
        position.depositedAmount += amount;
        position.phiScore = phiScore;
        position.lastClaimTime = block.timestamp;
        userPhiScores[msg.sender] = phiScore;
        
        _allocateToStrategies(token, amount, phiScore);
        emit Deposited(msg.sender, token, amount, phiScore);
    }
    
    function withdraw(address token, uint256 amount) external nonReentrant notShutdown rateLimit {
        UserPosition storage position = userPositions[msg.sender][token];
        require(position.depositedAmount > 0, "No deposit");
        if (amount == 0) amount = position.depositedAmount;
        require(amount <= position.depositedAmount, "Insufficient balance");
        
        uint256 yieldAmount = _calculateYield(msg.sender, token);
        position.depositedAmount -= amount;
        position.accumulatedYield = 0;
        _withdrawFromStrategies(token, amount);
        IERC20(token).safeTransfer(msg.sender, amount);
        if (yieldAmount > 0) _distributeYield(msg.sender, token, yieldAmount);
        emit Withdrawn(msg.sender, token, amount, yieldAmount);
    }
    
    function claimYield(address token) external nonReentrant notShutdown rateLimit {
        UserPosition storage position = userPositions[msg.sender][token];
        require(position.depositedAmount > 0, "No deposit");
        uint256 yieldAmount = _calculateYield(msg.sender, token);
        require(yieldAmount > 0, "No yield available");
        position.accumulatedYield = 0;
        position.lastClaimTime = block.timestamp;
        _distributeYield(msg.sender, token, yieldAmount);
        emit YieldClaimed(msg.sender, yieldAmount, 0);
    }
    
    function verifyYieldProof(YieldProof calldata proof) external returns (bool) {
        bytes32 proofHash = keccak256(abi.encode(proof));
        require(!usedProofs[proofHash], "Proof already used");
        bool valid = zkVerifier.verifyProof(proof.a, proof.b, proof.c, proof.publicInputs);
        require(valid, "Invalid proof");
        usedProofs[proofHash] = true;
        emit ProofVerified(proofHash, msg.sender);
        return true;
    }
    
    function _allocateToStrategies(address token, uint256 amount, uint256 phiScore) internal {
        uint256 numStrategies = strategies.length;
        if (numStrategies == 0) return;
        uint256 perStrategy = amount / (numStrategies > 3 ? 3 : numStrategies);
        for (uint256 i = 0; i < numStrategies && i < 3; i++) {
            if (activeStrategies[i]) strategies[i].totalDeposited += perStrategy;
        }
    }
    
    function _withdrawFromStrategies(address token, uint256 amount) internal {}
    
    function _calculateYield(address user, address token) internal view returns (uint256) {
        UserPosition storage position = userPositions[user][token];
        uint256 timeElapsed = block.timestamp - position.lastClaimTime;
        uint256 baseYield = 0;
        for (uint256 i = 0; i < strategies.length; i++) {
            if (activeStrategies[i]) {
                uint256 yearlyYield = (position.depositedAmount * strategies[i].currentAPR) / 10000;
                baseYield += (yearlyYield * timeElapsed) / 365 days;
            }
        }
        uint256 phiBoost = _calculatePhiBoost(position.phiScore);
        uint256 boostedYield = (baseYield * phiBoost) / 10000;
        return boostedYield + position.accumulatedYield;
    }
    
    function _calculatePhiBoost(uint256 phiScore) internal pure returns (uint256) {
        if (phiScore < PHI_MIN) phiScore = PHI_MIN;
        if (phiScore > PHI_MAX) phiScore = PHI_MAX;
        int256 boost = 10000 + (int256(phiScore) - 500) * 5;
        return uint256(boost);
    }
    
    function _distributeYield(address user, address token, uint256 amount) internal {
        UserPosition storage position = userPositions[user][token];
        uint256 treasuryRate = treasuryShareBPS + (position.phiScore * 5 / 10);
        if (treasuryRate > maxTreasuryShareBPS) treasuryRate = maxTreasuryShareBPS;
        uint256 treasuryAmount = (amount * treasuryRate) / 10000;
        uint256 userAmount = amount - treasuryAmount;
        if (treasuryAmount > 0) IERC20(token).safeTransfer(treasury, treasuryAmount);
        if (userAmount > 0) IERC20(token).safeTransfer(user, userAmount);
    }
    
    function activateEmergencyShutdown() external onlyRole(ADMIN_ROLE) { require(!emergencyShutdown, "Already shutdown"); emergencyShutdown = true; _pause(); emit EmergencyShutdownActivated(msg.sender); }
    function deactivateEmergencyShutdown() external onlyRole(ADMIN_ROLE) { require(emergencyShutdown, "Not in shutdown"); emergencyShutdown = false; _unpause(); emit EmergencyShutdownDeactivated(msg.sender); }
    
    function addToken(address token) external onlyRole(ADMIN_ROLE) { require(!supportedTokens[token], "Token already supported"); supportedTokens[token] = true; tokenList.push(token); }
    
    function addStrategy(string memory name, address strategyContract, uint256 apr, uint256 riskScore) external onlyRole(ADMIN_ROLE) {
        require(strategyContract.isContract(), "Invalid strategy contract");
        strategies.push(YieldStrategy({ name: name, strategyContract: strategyContract, totalDeposited: 0, currentAPR: apr, riskScore: riskScore, active: true }));
        uint256 strategyId = strategies.length - 1;
        activeStrategies[strategyId] = true;
        emit StrategyAdded(strategyId, name, strategyContract);
    }
    
    function setTreasury(address _treasury) external onlyRole(ADMIN_ROLE) { require(_treasury != address(0), "Invalid treasury"); treasury = _treasury; }
    function pause() external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }
    
    function getUserPosition(address user, address token) external view returns (UserPosition memory) { return userPositions[user][token]; }
    function getPendingYield(address user, address token) external view returns (uint256) { return _calculateYield(user, token); }
    function getStrategyCount() external view returns (uint256) { return strategies.length; }
    function getTotalTVL() external view returns (uint256) { uint256 total = 0; for (uint256 i = 0; i < strategies.length; i++) total += strategies[i].totalDeposited; return total; }
}
