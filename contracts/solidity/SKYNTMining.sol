// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SKYNTMining
 * @notice On-chain Proof-of-Work mining contract for SKYNT token rewards.
 *         Miners iterate nonces off-chain, submit valid ones on-chain, and
 *         accumulate pendingRewards which can be claimed at any time.
 *
 * @dev Flow:
 *   1. Miner reads challengeNumber + difficulty off-chain
 *   2. Miner computes: hash = keccak256(msg.sender, nonce, challengeNumber)
 *   3. Miner submits nonce if uint256(hash) < difficulty
 *   4. Contract validates, credits pendingRewards[msg.sender]
 *   5. Miner calls claimReward() to receive SKYNT tokens
 */
contract SKYNTMining is Ownable, ReentrancyGuard {
    IERC20 public immutable skynt;

    // ─── Challenge State ─────────────────────────────────────────────────────

    bytes32 public challengeNumber;
    uint256 public difficulty;
    uint256 public challengeEpoch;
    uint256 public challengeRotateInterval = 120; // rotate every 120 blocks (~24 min)
    uint256 public lastChallengeBlock;

    // ─── Reward Config ────────────────────────────────────────────────────────

    uint256 public baseReward = 50 * 1e18;         // 50 SKYNT per block (pre-halving)
    uint256 public halvingInterval = 210_000;       // blocks between halvings
    uint256 public totalBlocksMined;
    uint256 public maxSupply = 8_400_000 * 1e18;   // 8.4M SKYNT mining allocation

    // ─── Per-Miner State ─────────────────────────────────────────────────────

    mapping(address => uint256) public pendingRewards;
    mapping(address => uint256) public totalClaimed;
    mapping(address => uint256) public blocksMined;
    mapping(address => uint256) public lastMineBlock;
    mapping(bytes32 => bool) public usedNonces;

    uint256 public cooldownBlocks = 3; // minimum blocks between submissions per wallet

    // ─── Global Stats ────────────────────────────────────────────────────────

    uint256 public totalRewardsClaimed;
    uint256 public totalRewardsAccrued;

    // ─── Events ──────────────────────────────────────────────────────────────

    event WorkSubmitted(
        address indexed miner,
        uint256 nonce,
        bytes32 hash,
        uint256 reward,
        uint256 blockNumber
    );
    event RewardClaimed(address indexed miner, uint256 amount);
    event ChallengeRotated(bytes32 newChallenge, uint256 newDifficulty, uint256 epoch);
    event DifficultyAdjusted(uint256 oldDifficulty, uint256 newDifficulty);
    event BaseRewardUpdated(uint256 oldReward, uint256 newReward);
    event ContractFunded(address indexed funder, uint256 amount);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _skynt, uint256 _initialDifficulty) Ownable(msg.sender) {
        require(_skynt != address(0), "Invalid SKYNT address");
        skynt = IERC20(_skynt);
        difficulty = _initialDifficulty == 0
            ? 2**234  // ~reasonable starting difficulty (~1 in a billion hashes)
            : _initialDifficulty;
        lastChallengeBlock = block.number;
        _rotateChallenge();
    }

    // ─── Mining ───────────────────────────────────────────────────────────────

    /**
     * @notice Submit a valid proof-of-work nonce to earn SKYNT rewards.
     * @param nonce  The nonce the miner found that satisfies difficulty.
     */
    function submitWork(uint256 nonce) external nonReentrant {
        // Cooldown: prevent spamming from same wallet
        require(
            block.number >= lastMineBlock[msg.sender] + cooldownBlocks,
            "Cooldown: wait before next submission"
        );

        // Rotate challenge if enough blocks have passed
        if (block.number >= lastChallengeBlock + challengeRotateInterval) {
            _rotateChallenge();
        }

        // Compute hash
        bytes32 hash = keccak256(abi.encodePacked(msg.sender, nonce, challengeNumber));

        // Validate difficulty: hash must be less than difficulty target
        require(uint256(hash) < difficulty, "Invalid proof-of-work");

        // Prevent replay: each (miner, nonce, challenge) combination can only be used once
        bytes32 nonceKey = keccak256(abi.encodePacked(msg.sender, nonce, challengeNumber));
        require(!usedNonces[nonceKey], "Nonce already used");
        usedNonces[nonceKey] = true;

        // Calculate reward with halving
        uint256 reward = currentReward();

        // Check contract has enough SKYNT to pay reward
        uint256 contractBalance = skynt.balanceOf(address(this));
        require(contractBalance >= reward, "Contract underfunded: no SKYNT to distribute");

        // Credit miner
        pendingRewards[msg.sender] += reward;
        totalRewardsAccrued += reward;
        totalBlocksMined++;
        blocksMined[msg.sender]++;
        lastMineBlock[msg.sender] = block.number;

        emit WorkSubmitted(msg.sender, nonce, hash, reward, block.number);

        // Optionally auto-adjust difficulty
        _adjustDifficulty();
    }

    /**
     * @notice Claim all pending SKYNT rewards.
     */
    function claimReward() external nonReentrant {
        uint256 amount = pendingRewards[msg.sender];
        require(amount > 0, "No pending rewards");

        pendingRewards[msg.sender] = 0;
        totalClaimed[msg.sender] += amount;
        totalRewardsClaimed += amount;

        require(skynt.transfer(msg.sender, amount), "SKYNT transfer failed");

        emit RewardClaimed(msg.sender, amount);
    }

    // ─── View Functions ──────────────────────────────────────────────────────

    /**
     * @notice Returns the current block reward after halving schedule.
     */
    function currentReward() public view returns (uint256) {
        uint256 halvings = totalBlocksMined / halvingInterval;
        if (halvings >= 64) return 0;
        return baseReward >> halvings;
    }

    /**
     * @notice Returns the current challenge parameters for miners.
     */
    function getChallengeParams() external view returns (
        bytes32 _challengeNumber,
        uint256 _difficulty,
        uint256 _epoch,
        uint256 _reward,
        uint256 _cooldownBlocks,
        uint256 _contractBalance
    ) {
        return (
            challengeNumber,
            difficulty,
            challengeEpoch,
            currentReward(),
            cooldownBlocks,
            skynt.balanceOf(address(this))
        );
    }

    /**
     * @notice Returns mining stats for a specific address.
     */
    function getMinerStats(address miner) external view returns (
        uint256 _pendingRewards,
        uint256 _totalClaimed,
        uint256 _blocksMined,
        uint256 _lastMineBlock,
        uint256 _cooldownUntil
    ) {
        return (
            pendingRewards[miner],
            totalClaimed[miner],
            blocksMined[miner],
            lastMineBlock[miner],
            lastMineBlock[miner] + cooldownBlocks
        );
    }

    /**
     * @notice Check if a given nonce would be valid for msg.sender.
     */
    function verifyNonce(address miner, uint256 nonce) external view returns (bool, bytes32) {
        bytes32 hash = keccak256(abi.encodePacked(miner, nonce, challengeNumber));
        bytes32 nonceKey = keccak256(abi.encodePacked(miner, nonce, challengeNumber));
        bool valid = uint256(hash) < difficulty && !usedNonces[nonceKey];
        return (valid, hash);
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _rotateChallenge() internal {
        challengeNumber = keccak256(abi.encodePacked(
            blockhash(block.number - 1),
            block.timestamp,
            challengeEpoch,
            msg.sender
        ));
        lastChallengeBlock = block.number;
        challengeEpoch++;
        emit ChallengeRotated(challengeNumber, difficulty, challengeEpoch);
    }

    function _adjustDifficulty() internal {
        // Every 100 blocks found, re-target difficulty to ~60s solve time estimate
        if (totalBlocksMined > 0 && totalBlocksMined % 100 == 0) {
            uint256 elapsed = block.number - lastChallengeBlock;
            uint256 target = challengeRotateInterval;

            uint256 oldDifficulty = difficulty;
            if (elapsed < target / 2) {
                difficulty = difficulty * 110 / 100; // harder
            } else if (elapsed > target * 2) {
                difficulty = difficulty * 90 / 100; // easier
                if (difficulty == 0) difficulty = 2**200;
            }

            if (difficulty != oldDifficulty) {
                emit DifficultyAdjusted(oldDifficulty, difficulty);
            }
        }
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function fundContract(uint256 amount) external {
        require(skynt.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit ContractFunded(msg.sender, amount);
    }

    function setDifficulty(uint256 _difficulty) external onlyOwner {
        uint256 old = difficulty;
        difficulty = _difficulty;
        emit DifficultyAdjusted(old, _difficulty);
    }

    function setBaseReward(uint256 _reward) external onlyOwner {
        uint256 old = baseReward;
        baseReward = _reward;
        emit BaseRewardUpdated(old, _reward);
    }

    function setCooldownBlocks(uint256 _blocks) external onlyOwner {
        cooldownBlocks = _blocks;
    }

    function setChallengeRotateInterval(uint256 _blocks) external onlyOwner {
        challengeRotateInterval = _blocks;
    }

    function setHalvingInterval(uint256 _blocks) external onlyOwner {
        halvingInterval = _blocks;
    }

    function rotateChallenge() external onlyOwner {
        _rotateChallenge();
    }

    /**
     * @notice Emergency withdrawal of SKYNT back to owner.
     */
    function withdrawSkynt(uint256 amount) external onlyOwner {
        require(skynt.transfer(owner(), amount), "Transfer failed");
    }
}
