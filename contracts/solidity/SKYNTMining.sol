// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/Context.sol";

/**
 * @title SKYNTMining
 * @notice On-chain Proof-of-Work mining contract for SKYNT token rewards.
 *         Supports EIP-2771 gasless work submission via SKYNTForwarder.
 *         Miners iterate nonces off-chain using their address, submit on-chain.
 *
 * @dev Flow:
 *   1. Miner reads challengeNumber + difficulty off-chain
 *   2. Miner computes: hash = keccak256(_msgSender(), nonce, challengeNumber)
 *   3. Miner submits nonce (directly or via gasless relay)
 *   4. Contract validates, credits pendingRewards[_msgSender()]
 *   5. Miner calls claimReward() to receive SKYNT tokens
 */
contract SKYNTMining is ERC2771Context, Ownable, ReentrancyGuard {
    IERC20 public immutable skynt;

    // ─── Challenge State ──────────────────────────────────────────────────────
    bytes32 public challengeNumber;
    uint256 public difficulty;
    uint256 public challengeEpoch;
    uint256 public challengeRotateInterval = 120;
    uint256 public lastChallengeBlock;

    // ─── Reward Config ────────────────────────────────────────────────────────
    uint256 public baseReward       = 50 * 1e18;
    uint256 public halvingInterval  = 210_000;
    uint256 public totalBlocksMined;
    uint256 public maxSupply        = 8_400_000 * 1e18;

    // ─── Per-Miner State ─────────────────────────────────────────────────────
    mapping(address => uint256)  public pendingRewards;
    mapping(address => uint256)  public totalClaimed;
    mapping(address => uint256)  public blocksMined;
    mapping(address => uint256)  public lastMineBlock;
    mapping(bytes32  => bool)    public usedNonces;

    uint256 public cooldownBlocks = 3;

    // ─── Global Stats ─────────────────────────────────────────────────────────
    uint256 public totalRewardsClaimed;
    uint256 public totalRewardsAccrued;

    // ─── Events ──────────────────────────────────────────────────────────────
    event WorkSubmitted(address indexed miner, uint256 nonce, bytes32 hash, uint256 reward, uint256 blockNumber);
    event RewardClaimed(address indexed miner, uint256 amount);
    event ChallengeRotated(bytes32 newChallenge, uint256 newDifficulty, uint256 epoch);
    event DifficultyAdjusted(uint256 oldDifficulty, uint256 newDifficulty);
    event BaseRewardUpdated(uint256 oldReward, uint256 newReward);
    event ContractFunded(address indexed funder, uint256 amount);

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(
        address _skynt,
        uint256 _initialDifficulty,
        address _trustedForwarder
    ) ERC2771Context(_trustedForwarder) Ownable(msg.sender) {
        require(_skynt != address(0), "Invalid SKYNT address");
        skynt      = IERC20(_skynt);
        difficulty = _initialDifficulty == 0 ? 2**234 : _initialDifficulty;
        lastChallengeBlock = block.number;
        _rotateChallenge();
    }

    // ─── Mining ───────────────────────────────────────────────────────────────

    function submitWork(uint256 nonce) external nonReentrant {
        address miner = _msgSender();

        require(
            block.number >= lastMineBlock[miner] + cooldownBlocks,
            "Cooldown: wait before next submission"
        );

        if (block.number >= lastChallengeBlock + challengeRotateInterval) {
            _rotateChallenge();
        }

        // Hash uses _msgSender() so gasless submissions are credited to the actual miner
        bytes32 hash = keccak256(abi.encodePacked(miner, nonce, challengeNumber));
        require(uint256(hash) < difficulty, "Invalid proof-of-work");

        bytes32 nonceKey = keccak256(abi.encodePacked(miner, nonce, challengeNumber));
        require(!usedNonces[nonceKey], "Nonce already used");
        usedNonces[nonceKey] = true;

        uint256 reward          = currentReward();
        uint256 contractBalance = skynt.balanceOf(address(this));
        require(contractBalance >= reward, "Contract underfunded: no SKYNT to distribute");

        pendingRewards[miner] += reward;
        totalRewardsAccrued   += reward;
        totalBlocksMined++;
        blocksMined[miner]++;
        lastMineBlock[miner] = block.number;

        emit WorkSubmitted(miner, nonce, hash, reward, block.number);
        _adjustDifficulty();
    }

    function claimReward() external nonReentrant {
        address miner  = _msgSender();
        uint256 amount = pendingRewards[miner];
        require(amount > 0, "No pending rewards");

        pendingRewards[miner] = 0;
        totalClaimed[miner]  += amount;
        totalRewardsClaimed  += amount;

        require(skynt.transfer(miner, amount), "SKYNT transfer failed");
        emit RewardClaimed(miner, amount);
    }

    // ─── View Functions ───────────────────────────────────────────────────────
    function currentReward() public view returns (uint256) {
        uint256 halvings = totalBlocksMined / halvingInterval;
        if (halvings >= 64) return 0;
        return baseReward >> halvings;
    }

    function getChallengeParams() external view returns (
        bytes32 _challengeNumber, uint256 _difficulty, uint256 _epoch,
        uint256 _reward, uint256 _cooldownBlocks, uint256 _contractBalance
    ) {
        return (challengeNumber, difficulty, challengeEpoch, currentReward(), cooldownBlocks, skynt.balanceOf(address(this)));
    }

    function getMinerStats(address miner) external view returns (
        uint256 _pendingRewards, uint256 _totalClaimed, uint256 _blocksMined,
        uint256 _lastMineBlock, uint256 _cooldownUntil
    ) {
        return (pendingRewards[miner], totalClaimed[miner], blocksMined[miner],
                lastMineBlock[miner], lastMineBlock[miner] + cooldownBlocks);
    }

    function verifyNonce(address miner, uint256 nonce) external view returns (bool, bytes32) {
        bytes32 hash     = keccak256(abi.encodePacked(miner, nonce, challengeNumber));
        bytes32 nonceKey = keccak256(abi.encodePacked(miner, nonce, challengeNumber));
        bool valid = uint256(hash) < difficulty && !usedNonces[nonceKey];
        return (valid, hash);
    }

    // ─── Quantum Genesis Primitives ───────────────────────────────────────────
    // Binary genesis seeds mirror the SKYNT BTC Quantum PoW daemon v3.
    // 32-bit genesis  = 0x01234567 (Valknut xi seed, no feedback)
    // 36-bit genesis  = 0x012345678 (extended with 4-bit feedback nibble 1000)
    // feedbackLoop XORs the low nibble of the 5th byte with 0x08 (bit 3) to
    // toggle the quantum feedback path, matching the off-chain Valknut xi gate.

    /// @notice Returns 32-bit Binary Genesis as binary string (Valknut seed, no feedback)
    function getGenesis32() external pure returns (string memory) {
        return "00000001001000110100010101100111";
    }

    /// @notice Returns 36-bit Binary Genesis with feedback extension as binary string
    function getGenesis36() external pure returns (string memory) {
        return "000000010010001101000101011001111000";
    }

    /// @notice Symbolic quantum feedback toggle — XORs low nibble of byte 5 with 0x08
    /// @dev    Mirrors the off-chain Valknut xi feedback path toggle in btc-zk-daemon.
    ///         Input: any 5-byte seed value; output: same seed with feedback bit flipped.
    /// @param  _input  5-byte seed value (e.g. extranonce1 from the mining session)
    /// @return         Seed with quantum feedback bit toggled
    function feedbackLoop(bytes5 _input) external pure returns (bytes5) {
        // XOR low nibble of byte 5 (bit 3) with 1000₂ to toggle feedback path
        return _input ^ 0x0000000008;
    }

    /// @notice Derive challenge seed by combining genesis32 with current on-chain entropy
    /// @dev    Useful for validating that off-chain nonce candidates were seeded correctly.
    ///         Returns keccak256(genesis32 || challengeNumber || difficulty).
    function getGenesisSeed() external view returns (bytes32) {
        return keccak256(abi.encodePacked(
            bytes32("00000001001000110100010101100111"),
            challengeNumber,
            difficulty
        ));
    }

    // ─── Internal ─────────────────────────────────────────────────────────────
    function _rotateChallenge() internal {
        challengeNumber = keccak256(abi.encodePacked(
            blockhash(block.number - 1),
            block.timestamp,
            challengeEpoch,
            _msgSender() // _msgSender() respects ERC2771 forwarder for gasless rotations
        ));
        lastChallengeBlock = block.number;
        challengeEpoch++;
        emit ChallengeRotated(challengeNumber, difficulty, challengeEpoch);
    }

    function _adjustDifficulty() internal {
        if (totalBlocksMined > 0 && totalBlocksMined % 100 == 0) {
            uint256 elapsed = block.number - lastChallengeBlock;
            uint256 target  = challengeRotateInterval;
            uint256 oldDiff = difficulty;

            if (elapsed < target / 2) {
                difficulty = difficulty * 110 / 100;
            } else if (elapsed > target * 2) {
                difficulty = difficulty * 90 / 100;
                if (difficulty == 0) difficulty = 2**200;
            }

            if (difficulty != oldDiff) emit DifficultyAdjusted(oldDiff, difficulty);
        }
    }

    // ─── Admin ────────────────────────────────────────────────────────────────
    function fundContract(uint256 amount) external {
        require(skynt.transferFrom(_msgSender(), address(this), amount), "Transfer failed");
        emit ContractFunded(_msgSender(), amount);
    }

    function setDifficulty(uint256 _difficulty)               external onlyOwner { uint256 old = difficulty; difficulty = _difficulty; emit DifficultyAdjusted(old, _difficulty); }
    function setBaseReward(uint256 _reward)                   external onlyOwner { uint256 old = baseReward; baseReward = _reward; emit BaseRewardUpdated(old, _reward); }
    function setCooldownBlocks(uint256 _blocks)               external onlyOwner { cooldownBlocks = _blocks; }
    function setChallengeRotateInterval(uint256 _blocks)      external onlyOwner { challengeRotateInterval = _blocks; }
    function setHalvingInterval(uint256 _blocks)              external onlyOwner { halvingInterval = _blocks; }
    function rotateChallenge()                                external onlyOwner { _rotateChallenge(); }
    function withdrawSkynt(uint256 amount)                    external onlyOwner { require(skynt.transfer(owner(), amount), "Transfer failed"); }

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
