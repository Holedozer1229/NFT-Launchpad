// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/Context.sol";

/**
 * @title SKYNTZkEVM
 * @notice Cross-chain ZK-rollup monetization layer for the SKYNT Protocol.
 *
 * Architecture:
 *  - Sequencer batches L2 transactions and submits state roots with ZK proofs
 *  - Users deposit ETH/SKYNT to L2 and receive wrapped representations
 *  - Cross-chain messages are relayed through verified ZK proofs
 *  - Revenue is generated via sequencer fees, bridge fees, and staking yield
 *  - SKYNT token is burned on fee payments, deflationary
 *
 * Supported chains:
 *  ETH(0), Polygon(1), Arbitrum(2), Base(3), zkSync(4), Optimism(5), Solana(6), Stacks(7)
 *
 * @dev Uses ECDSAVerifier as the ZK proof gate (treasury-signed proofs act as
 *      a trusted sequencer until decentralised ZK circuits are deployed).
 */
contract SKYNTZkEVM is ERC2771Context, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── Custom Errors ────────────────────────────────────────────────────────
    error InvalidProof();
    error InvalidStateRoot();
    error BatchAlreadyFinalized();
    error InvalidChain();
    error InsufficientDeposit();
    error WithdrawalNotReady();
    error InvalidWithdrawalProof();
    error NotSequencer();
    error EmergencyExitOnly();
    error FeePaymentFailed();
    error InvalidAmount();
    error AlreadyProcessed();
    error ChallengeWindowOpen();
    error NotChallenged();
    error MaxBatchSizeExceeded();
    error DepositCapReached();
    error NotDepositor();

    // ─── Enums ────────────────────────────────────────────────────────────────
    enum Chain { ETH, Polygon, Arbitrum, Base, ZkSync, Optimism, Solana, Stacks }
    enum BatchStatus { Pending, Challenged, Finalized, Rejected }
    enum MessageStatus { Pending, Executed, Failed }

    // ─── Structs ──────────────────────────────────────────────────────────────
    struct Batch {
        uint256  batchId;
        bytes32  prevStateRoot;
        bytes32  newStateRoot;
        bytes32  txRoot;           // Merkle root of L2 transactions
        bytes32  withdrawalRoot;   // Withdrawal commitments
        uint256  timestamp;
        uint256  l1BlockNumber;
        uint128  totalFees;        // Sequencer fees collected
        uint128  depositCount;
        BatchStatus status;
        address  sequencer;
    }

    struct L2Deposit {
        address  depositor;
        uint128  amount;           // ETH in wei
        uint128  skyntAmount;      // SKYNT tokens
        uint256  l2GasLimit;
        uint256  batchId;          // Batch in which this deposit was processed
        uint64   timestamp;
        bool     processed;
    }

    struct CrossChainMessage {
        bytes32  id;
        uint8    sourceChain;
        uint8    destChain;
        address  sender;
        address  recipient;
        uint256  amount;
        bytes    payload;
        MessageStatus status;
        uint256  timestamp;
        bytes32  proofHash;
    }

    struct WithdrawalRequest {
        address  recipient;
        uint256  amount;
        uint256  batchId;
        uint256  timestamp;
        bool     claimed;
    }

    struct SequencerReward {
        uint256 totalBatches;
        uint256 totalFees;
        uint256 claimable;
    }

    struct YieldPosition {
        uint256 deposited;
        uint256 lastClaimBlock;
        uint256 accumulated;
    }

    // ─── Constants ────────────────────────────────────────────────────────────
    uint256 public constant CHALLENGE_PERIOD  = 7 days;
    uint256 public constant MIN_DEPOSIT       = 0.001 ether;
    uint256 public constant MAX_DEPOSIT_CAP   = 100_000 ether;
    uint256 public constant BRIDGE_FEE_BPS    = 10;     // 0.10%
    uint256 public constant SEQUENCER_FEE_BPS = 5;      // 0.05%
    uint256 public constant BURN_BPS          = 2000;   // 20% of fees burned
    uint256 public constant STAKER_BPS        = 5000;   // 50% to SKYNT stakers
    uint256 public constant TREASURY_BPS      = 3000;   // 30% to treasury
    uint256 public constant BPS_DENOMINATOR   = 10000;
    uint256 public constant MAX_BATCH_SIZE    = 1000;   // max txs per batch
    uint256 public constant L2_YIELD_BPS_PER_BLOCK = 1; // ~0.01% per block base APR

    // ─── Immutables ───────────────────────────────────────────────────────────
    IERC20  public immutable skyntToken;
    address public immutable zkVerifier;    // ECDSAVerifier / ZK gate

    // ─── State ────────────────────────────────────────────────────────────────
    bytes32 public currentStateRoot;
    uint256 public nextBatchId;
    uint256 public totalDeposited;          // Total ETH locked
    uint256 public totalSkyntLocked;        // Total SKYNT locked
    uint256 public totalBridgedVolume;
    uint256 public totalFeesBurned;

    address public sequencer;               // Trusted sequencer (upgradeable)
    bool    public emergencyMode;           // If true, only exits allowed

    mapping(uint256 => Batch)                  public batches;
    mapping(uint256 => L2Deposit)              public deposits;
    mapping(bytes32 => CrossChainMessage)      public messages;
    mapping(uint256 => WithdrawalRequest)      public withdrawals;
    mapping(address => SequencerReward)        public sequencerRewards;
    mapping(address => YieldPosition)          public yieldPositions;
    mapping(address => uint256[])              public userDeposits;
    mapping(address => uint256[])              public userWithdrawals;
    mapping(bytes32 => bool)                   public processedMessages;
    mapping(uint8 => uint256)                  public chainTVL;   // TVL per chain

    uint256 private _depositCounter;
    uint256 private _withdrawalCounter;

    // ─── Events ───────────────────────────────────────────────────────────────
    event BatchSubmitted(uint256 indexed batchId, bytes32 newStateRoot, address indexed sequencer, uint256 txCount);
    event BatchFinalized(uint256 indexed batchId, bytes32 stateRoot);
    event BatchChallenged(uint256 indexed batchId, address indexed challenger);
    event BatchRejected(uint256 indexed batchId);
    event ETHDeposited(uint256 indexed depositId, address indexed depositor, uint256 amount, uint256 batchId);
    event SKYNTDeposited(uint256 indexed depositId, address indexed depositor, uint256 amount);
    event WithdrawalQueued(uint256 indexed withdrawalId, address indexed recipient, uint256 amount, uint256 batchId);
    event WithdrawalClaimed(uint256 indexed withdrawalId, address indexed recipient, uint256 amount);
    event CrossChainMessageSent(bytes32 indexed id, uint8 sourceChain, uint8 destChain, address sender, uint256 amount);
    event CrossChainMessageExecuted(bytes32 indexed id, address indexed recipient, uint256 amount);
    event SequencerUpdated(address indexed oldSeq, address indexed newSeq);
    event FeesBurned(uint256 skyntAmount);
    event YieldClaimed(address indexed user, uint256 amount);
    event EmergencyModeToggled(bool active);

    // ─── Modifiers ────────────────────────────────────────────────────────────
    modifier onlySequencer() {
        if (_msgSender() != sequencer) revert NotSequencer();
        _;
    }

    modifier notEmergency() {
        if (emergencyMode) revert EmergencyExitOnly();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(
        address _skyntToken,
        address _zkVerifier,
        address _sequencer,
        address _treasury,
        address _trustedForwarder
    ) ERC2771Context(_trustedForwarder) Ownable(_treasury) {
        require(_skyntToken   != address(0), "Invalid SKYNT token");
        require(_zkVerifier   != address(0), "Invalid ZK verifier");
        require(_sequencer    != address(0), "Invalid sequencer");
        require(_treasury     != address(0), "Invalid treasury");

        skyntToken       = IERC20(_skyntToken);
        zkVerifier       = _zkVerifier;
        sequencer        = _sequencer;
        currentStateRoot = keccak256(abi.encodePacked("SKYNT_GENESIS_STATE", block.chainid));
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  BATCH SUBMISSION
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Sequencer submits a new L2 batch with ZK proof.
     * @param newStateRoot   New state root after executing all L2 txs in this batch
     * @param txRoot         Merkle root of L2 transaction hashes
     * @param withdrawalRoot Merkle root of pending L2→L1 withdrawals
     * @param txCount        Number of L2 transactions in this batch
     * @param totalFees      Total sequencer fees in wei collected in this batch
     * @param zkProof        65-byte ECDSA proof (treasury signature) over state transition
     */
    function submitBatch(
        bytes32 newStateRoot,
        bytes32 txRoot,
        bytes32 withdrawalRoot,
        uint256 txCount,
        uint128 totalFees,
        bytes calldata zkProof
    ) external onlySequencer nonReentrant notEmergency whenNotPaused {
        if (newStateRoot == bytes32(0))     revert InvalidStateRoot();
        if (txCount > MAX_BATCH_SIZE)       revert MaxBatchSizeExceeded();

        // Verify ZK proof via ECDSAVerifier gate
        _verifyZkProof(zkProof, uint256(uint160(address(this))));

        uint256 batchId = nextBatchId++;

        batches[batchId] = Batch({
            batchId:       batchId,
            prevStateRoot: currentStateRoot,
            newStateRoot:  newStateRoot,
            txRoot:        txRoot,
            withdrawalRoot:withdrawalRoot,
            timestamp:     block.timestamp,
            l1BlockNumber: block.number,
            totalFees:     totalFees,
            depositCount:  0,
            status:        BatchStatus.Pending,
            sequencer:     _msgSender()
        });

        // Accumulate sequencer reward
        SequencerReward storage reward = sequencerRewards[_msgSender()];
        reward.totalBatches++;
        reward.totalFees += totalFees;
        reward.claimable += (totalFees * SEQUENCER_FEE_BPS) / BPS_DENOMINATOR;

        emit BatchSubmitted(batchId, newStateRoot, _msgSender(), txCount);

        // Auto-finalize previous batch if challenge window passed
        if (batchId > 0) {
            Batch storage prev = batches[batchId - 1];
            if (prev.status == BatchStatus.Pending &&
                block.timestamp >= prev.timestamp + CHALLENGE_PERIOD) {
                _finalizeBatch(batchId - 1);
            }
        }
    }

    /**
     * @notice Challenge a pending batch (governance / anyone).
     *         The batch is immediately suspended pending manual review.
     */
    function challengeBatch(uint256 batchId) external nonReentrant {
        Batch storage b = batches[batchId];
        if (b.status != BatchStatus.Pending) revert BatchAlreadyFinalized();
        if (block.timestamp >= b.timestamp + CHALLENGE_PERIOD) revert ChallengeWindowOpen();

        b.status = BatchStatus.Challenged;
        emit BatchChallenged(batchId, _msgSender());
    }

    /**
     * @notice Owner resolves a challenged batch — accept or reject.
     */
    function resolveBatch(uint256 batchId, bool accept) external onlyOwner nonReentrant {
        Batch storage b = batches[batchId];
        if (b.status != BatchStatus.Challenged) revert NotChallenged();

        if (accept) {
            _finalizeBatch(batchId);
        } else {
            b.status = BatchStatus.Rejected;
            emit BatchRejected(batchId);
        }
    }

    function _finalizeBatch(uint256 batchId) internal {
        Batch storage b = batches[batchId];
        b.status = BatchStatus.Finalized;
        currentStateRoot = b.newStateRoot;
        emit BatchFinalized(batchId, b.newStateRoot);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  DEPOSITS (L1 → L2)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Deposit ETH to L2. ETH is locked in this contract and a
     *         corresponding L2 balance is credited to the depositor.
     * @param l2GasLimit Gas limit for executing the deposit on L2.
     */
    function depositETH(uint256 l2GasLimit)
        external
        payable
        nonReentrant
        notEmergency
        whenNotPaused
    {
        if (msg.value < MIN_DEPOSIT)             revert InsufficientDeposit();
        if (totalDeposited + msg.value > MAX_DEPOSIT_CAP) revert DepositCapReached();

        uint256 depositId = _depositCounter++;
        address depositor = _msgSender();

        deposits[depositId] = L2Deposit({
            depositor:   depositor,
            amount:      uint128(msg.value),
            skyntAmount: 0,
            l2GasLimit:  l2GasLimit,
            batchId:     nextBatchId,   // will be included in next batch
            timestamp:   uint64(block.timestamp),
            processed:   false
        });

        userDeposits[depositor].push(depositId);
        totalDeposited += msg.value;
        chainTVL[uint8(Chain.ETH)] += msg.value;

        // Start yield accrual
        YieldPosition storage pos = yieldPositions[depositor];
        pos.accumulated += _computeYield(pos);
        pos.deposited   += msg.value;
        pos.lastClaimBlock = block.number;

        emit ETHDeposited(depositId, depositor, msg.value, nextBatchId);
    }

    /**
     * @notice Deposit SKYNT tokens to L2.
     */
    function depositSKYNT(uint256 amount)
        external
        nonReentrant
        notEmergency
        whenNotPaused
    {
        if (amount == 0) revert InvalidAmount();
        address depositor = _msgSender();

        skyntToken.safeTransferFrom(depositor, address(this), amount);

        uint256 depositId = _depositCounter++;
        deposits[depositId] = L2Deposit({
            depositor:   depositor,
            amount:      0,
            skyntAmount: uint128(amount),
            l2GasLimit:  200_000,
            batchId:     nextBatchId,
            timestamp:   uint64(block.timestamp),
            processed:   false
        });

        userDeposits[depositor].push(depositId);
        totalSkyntLocked += amount;

        emit SKYNTDeposited(depositId, depositor, amount);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  WITHDRAWALS (L2 → L1)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Sequencer queues a withdrawal after verifying the L2 balance.
     */
    function queueWithdrawal(
        address recipient,
        uint256 amount,
        uint256 batchId
    ) external onlySequencer nonReentrant {
        if (amount == 0)                revert InvalidAmount();
        if (amount > totalDeposited)    revert InvalidAmount();

        uint256 withdrawalId = _withdrawalCounter++;
        withdrawals[withdrawalId] = WithdrawalRequest({
            recipient:  recipient,
            amount:     amount,
            batchId:    batchId,
            timestamp:  block.timestamp,
            claimed:    false
        });

        userWithdrawals[recipient].push(withdrawalId);
        emit WithdrawalQueued(withdrawalId, recipient, amount, batchId);
    }

    /**
     * @notice Claim a finalized withdrawal after challenge period.
     */
    function claimWithdrawal(uint256 withdrawalId) external nonReentrant {
        WithdrawalRequest storage w = withdrawals[withdrawalId];
        if (w.claimed)                             revert AlreadyProcessed();
        if (_msgSender() != w.recipient)           revert NotDepositor();

        Batch storage b = batches[w.batchId];
        if (b.status != BatchStatus.Finalized)    revert WithdrawalNotReady();
        if (block.timestamp < b.timestamp + CHALLENGE_PERIOD) revert WithdrawalNotReady();

        w.claimed = true;
        totalDeposited -= w.amount;

        // Distribute yield accrued
        YieldPosition storage pos = yieldPositions[w.recipient];
        uint256 yield = _computeYield(pos);
        pos.accumulated = 0;
        pos.deposited = pos.deposited > w.amount ? pos.deposited - w.amount : 0;
        pos.lastClaimBlock = block.number;

        uint256 total = w.amount + yield;

        (bool ok,) = w.recipient.call{value: total}("");
        require(ok, "ETH transfer failed");

        emit WithdrawalClaimed(withdrawalId, w.recipient, total);
    }

    /**
     * @notice Emergency exit — withdraw without waiting for challenge period.
     *         Only available when emergencyMode is active.
     */
    function emergencyExit(uint256 withdrawalId) external nonReentrant {
        if (!emergencyMode) revert EmergencyExitOnly();
        WithdrawalRequest storage w = withdrawals[withdrawalId];
        if (w.claimed)               revert AlreadyProcessed();
        if (_msgSender() != w.recipient) revert NotDepositor();

        w.claimed = true;
        totalDeposited -= w.amount;

        (bool ok,) = w.recipient.call{value: w.amount}("");
        require(ok, "ETH transfer failed");
        emit WithdrawalClaimed(withdrawalId, w.recipient, w.amount);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  CROSS-CHAIN MESSAGING
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Send a cross-chain message from this L2 to another chain.
     *         Caller pays bridge fee in ETH.
     */
    function sendCrossChain(
        uint8   destChain,
        address recipient,
        bytes   calldata payload
    ) external payable nonReentrant notEmergency whenNotPaused {
        if (destChain > uint8(Chain.Stacks)) revert InvalidChain();
        if (msg.value == 0)                  revert InvalidAmount();

        uint256 fee;
        uint256 netAmount;
        unchecked {
            fee       = (msg.value * BRIDGE_FEE_BPS) / BPS_DENOMINATOR;
            netAmount = msg.value - fee;
        }

        _distributeFees(fee);

        bytes32 id = keccak256(abi.encodePacked(
            _msgSender(), destChain, recipient, netAmount, block.timestamp, block.number
        ));

        messages[id] = CrossChainMessage({
            id:          id,
            sourceChain: uint8(Chain.ETH),
            destChain:   destChain,
            sender:      _msgSender(),
            recipient:   recipient,
            amount:      netAmount,
            payload:     payload,
            status:      MessageStatus.Pending,
            timestamp:   block.timestamp,
            proofHash:   bytes32(0)
        });

        totalBridgedVolume += netAmount;
        chainTVL[destChain] += netAmount;

        emit CrossChainMessageSent(id, uint8(Chain.ETH), destChain, _msgSender(), netAmount);
    }

    /**
     * @notice Sequencer executes an incoming cross-chain message after ZK proof.
     */
    function executeCrossChainMessage(
        bytes32   messageId,
        uint8     sourceChain,
        address   sender,
        address   recipient,
        uint256   amount,
        bytes     calldata payload,
        bytes     calldata zkProof
    ) external onlySequencer nonReentrant whenNotPaused {
        if (processedMessages[messageId]) revert AlreadyProcessed();

        _verifyZkProof(zkProof, uint256(messageId));

        processedMessages[messageId] = true;

        bytes32 proofHash = keccak256(zkProof);
        messages[messageId] = CrossChainMessage({
            id:          messageId,
            sourceChain: sourceChain,
            destChain:   uint8(Chain.ETH),
            sender:      sender,
            recipient:   recipient,
            amount:      amount,
            payload:     payload,
            status:      MessageStatus.Executed,
            timestamp:   block.timestamp,
            proofHash:   proofHash
        });

        if (amount > 0 && address(this).balance >= amount) {
            (bool ok,) = recipient.call{value: amount}(payload);
            if (!ok) {
                messages[messageId].status = MessageStatus.Failed;
            }
        }

        emit CrossChainMessageExecuted(messageId, recipient, amount);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  YIELD
    // ══════════════════════════════════════════════════════════════════════════

    function claimYield() external nonReentrant {
        address user = _msgSender();
        YieldPosition storage pos = yieldPositions[user];
        uint256 yield = pos.accumulated + _computeYield(pos);
        if (yield == 0) revert InvalidAmount();

        pos.accumulated    = 0;
        pos.lastClaimBlock = block.number;

        (bool ok,) = user.call{value: yield}("");
        require(ok, "Yield transfer failed");
        emit YieldClaimed(user, yield);
    }

    function getPendingYield(address user) external view returns (uint256) {
        YieldPosition storage pos = yieldPositions[user];
        return pos.accumulated + _computeYield(pos);
    }

    function _computeYield(YieldPosition storage pos) internal view returns (uint256) {
        if (pos.deposited == 0 || pos.lastClaimBlock == 0) return 0;
        uint256 blocks = block.number - pos.lastClaimBlock;
        return (pos.deposited * L2_YIELD_BPS_PER_BLOCK * blocks) / BPS_DENOMINATOR;
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  FEE DISTRIBUTION (sequencer fees + bridge fees)
    // ══════════════════════════════════════════════════════════════════════════

    function _distributeFees(uint256 feeEth) internal {
        if (feeEth == 0) return;
        // Convert ETH fee value to SKYNT burn equivalent (symbolic — protocol records it)
        // In production the sequencer swaps ETH→SKYNT then burns
        uint256 burnShare    = (feeEth * BURN_BPS)     / BPS_DENOMINATOR;
        uint256 stakerShare  = (feeEth * STAKER_BPS)   / BPS_DENOMINATOR;
        uint256 treasuryShare= feeEth - burnShare - stakerShare;

        // Treasury receives its cut
        (bool ok,) = owner().call{value: treasuryShare}("");
        if (!ok) { /* non-blocking — fees stay in contract */ }

        // Protocol records burn (actual SKYNT burn done by treasury offchain)
        totalFeesBurned += burnShare;
        // stakerShare stays in contract for withdrawal by stakers
    }

    function claimSequencerReward() external nonReentrant {
        SequencerReward storage r = sequencerRewards[_msgSender()];
        uint256 amount = r.claimable;
        if (amount == 0) revert InvalidAmount();
        r.claimable = 0;
        (bool ok,) = _msgSender().call{value: amount}("");
        require(ok, "Reward transfer failed");
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  ZK PROOF VERIFICATION
    // ══════════════════════════════════════════════════════════════════════════

    function _verifyZkProof(bytes calldata proof, uint256 nonce) internal view {
        (bool ok, bytes memory data) = zkVerifier.staticcall(
            abi.encodeWithSignature("verify(bytes,uint256)", proof, nonce)
        );
        if (!ok || abi.decode(data, (bool)) == false) revert InvalidProof();
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  ADMIN
    // ══════════════════════════════════════════════════════════════════════════

    function setSequencer(address newSequencer) external onlyOwner {
        emit SequencerUpdated(sequencer, newSequencer);
        sequencer = newSequencer;
    }

    function toggleEmergencyMode(bool active) external onlyOwner {
        emergencyMode = active;
        if (active) _pause(); else _unpause();
        emit EmergencyModeToggled(active);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function recoverERC20(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════════

    function getBatch(uint256 batchId) external view returns (Batch memory) {
        return batches[batchId];
    }

    function getDeposit(uint256 depositId) external view returns (L2Deposit memory) {
        return deposits[depositId];
    }

    function getWithdrawal(uint256 withdrawalId) external view returns (WithdrawalRequest memory) {
        return withdrawals[withdrawalId];
    }

    function getMessage(bytes32 id) external view returns (CrossChainMessage memory) {
        return messages[id];
    }

    function getUserDeposits(address user) external view returns (uint256[] memory) {
        return userDeposits[user];
    }

    function getUserWithdrawals(address user) external view returns (uint256[] memory) {
        return userWithdrawals[user];
    }

    function getProtocolStats() external view returns (
        uint256 totalDeposited_,
        uint256 totalSkyntLocked_,
        uint256 totalBridgedVolume_,
        uint256 totalFeesBurned_,
        uint256 totalBatches_,
        bytes32 stateRoot_
    ) {
        return (
            totalDeposited,
            totalSkyntLocked,
            totalBridgedVolume,
            totalFeesBurned,
            nextBatchId,
            currentStateRoot
        );
    }

    function getChainTVL(uint8 chain) external view returns (uint256) {
        return chainTVL[chain];
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

    receive() external payable {}
}
