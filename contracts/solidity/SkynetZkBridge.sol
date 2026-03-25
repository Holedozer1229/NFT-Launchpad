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
 * @title SkynetZkBridge
 * @notice ZK-proof gated multi-chain mining bridge with guardian multi-sig.
 *         Supports EIP-2771 gasless proof submission via SKYNTForwarder.
 */
contract SkynetZkBridge is ERC2771Context, ReentrancyGuard, Ownable {

    error InvalidProof();
    error InvalidAmount();
    error NonceUsed();
    error MintCapReached();
    error NotGuardian();
    error AlreadySigned();

    enum MiningChain { ETH, STX, DOGE, XMR }
    enum ProofStatus { Pending, Verified, Minted, Failed }

    struct ZkMintProof {
        address     miner;
        MiningChain sourceChain;
        uint256     amount;
        bytes32     proofHash;
        ProofStatus status;
        uint8       guardianSigs;
        uint256     signedGuardians;
        uint256     blockHeight;
        uint256     timestamp;
    }

    struct BridgeMiningReward {
        uint256 totalMined;
        uint256 totalBridged;
        uint256 pendingRewards;
        uint256 proofCount;
    }

    IZKVerifier public zkVerifier;
    uint256 public tokenId;
    uint256 public totalMinted;
    uint256 public constant MAX_SUPPLY         = 21_000_000 * 1e18;
    uint8   public constant REQUIRED_SIGS      = 5;
    uint8   public constant TOTAL_GUARDIANS    = 9;

    uint256 public constant ETH_REWARD_MULTIPLIER  = 100;
    uint256 public constant STX_REWARD_MULTIPLIER  = 80;
    uint256 public constant DOGE_REWARD_MULTIPLIER = 50;
    uint256 public constant XMR_REWARD_MULTIPLIER  = 120;

    mapping(bytes32    => ZkMintProof)       public proofs;
    mapping(uint256    => bool)              public usedNonces;
    mapping(address    => BridgeMiningReward)public minerRewards;
    mapping(address    => bool)              public guardians;
    mapping(address    => uint256)           public guardianIndex;
    mapping(MiningChain => uint256)          public chainTotalMined;
    mapping(address    => uint256)           public wrappedBalances;

    address[] public guardianList;
    bytes32[] public proofHistory;

    event ZkProofSubmitted(bytes32 indexed proofHash, address indexed miner, MiningChain chain, uint256 amount);
    event ZkProofVerified(bytes32 indexed proofHash, address indexed guardian, uint8 totalSigs);
    event ZkMintCompleted(bytes32 indexed proofHash, address indexed miner, uint256 tokenId_, uint256 reward);
    event CrossChainBridgeMined(address indexed miner, MiningChain sourceChain, uint256 amount, uint256 blockHeight);

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
        for (uint256 i; i < _guardians.length;) {
            guardians[_guardians[i]]      = true;
            guardianIndex[_guardians[i]] = i;
            guardianList.push(_guardians[i]);
            unchecked { ++i; }
        }
    }

    function submitMintProof(
        uint256     nonce,
        MiningChain sourceChain,
        uint256     amount,
        uint256[2]  memory a,
        uint256[2][2] memory b,
        uint256[2]  memory c,
        uint256[]   memory publicInputs
    ) external nonReentrant returns (bytes32) {
        if (usedNonces[nonce])                    revert NonceUsed();
        if (amount == 0)                          revert InvalidAmount();
        if (totalMinted + amount > MAX_SUPPLY)    revert MintCapReached();

        bool valid = zkVerifier.verifyProof(a, b, c, publicInputs);
        if (!valid) revert InvalidProof();

        usedNonces[nonce] = true;

        address miner = _msgSender();
        bytes32 proofHash = keccak256(abi.encodePacked(
            miner, nonce, uint8(sourceChain), amount, block.timestamp, block.number
        ));

        proofs[proofHash] = ZkMintProof({
            miner:          miner,
            sourceChain:    sourceChain,
            amount:         amount,
            proofHash:      proofHash,
            status:         ProofStatus.Verified,
            guardianSigs:   0,
            signedGuardians:0,
            blockHeight:    block.number,
            timestamp:      block.timestamp
        });

        proofHistory.push(proofHash);
        emit ZkProofSubmitted(proofHash, miner, sourceChain, amount);
        return proofHash;
    }

    function guardianApproveMint(bytes32 proofHash) external onlyGuardian nonReentrant {
        ZkMintProof storage proof = proofs[proofHash];
        if (proof.status != ProofStatus.Verified) revert InvalidProof();

        uint256 guardianBit = 1 << guardianIndex[msg.sender];
        if (proof.signedGuardians & guardianBit != 0) revert AlreadySigned();

        proof.signedGuardians |= guardianBit;
        unchecked { proof.guardianSigs++; }

        emit ZkProofVerified(proofHash, msg.sender, proof.guardianSigs);

        if (proof.guardianSigs >= REQUIRED_SIGS) {
            proof.status = ProofStatus.Minted;

            uint256 multiplier = _getChainMultiplier(proof.sourceChain);
            uint256 reward;
            unchecked { reward = (proof.amount * multiplier) / 100; }

            wrappedBalances[proof.miner] += reward;
            totalMinted                  += reward;
            chainTotalMined[proof.sourceChain] += reward;

            BridgeMiningReward storage minerReward = minerRewards[proof.miner];
            minerReward.totalMined   += reward;
            minerReward.totalBridged += proof.amount;
            minerReward.proofCount++;

            unchecked { tokenId++; }

            emit ZkMintCompleted(proofHash, proof.miner, tokenId, reward);
            emit CrossChainBridgeMined(proof.miner, proof.sourceChain, reward, proof.blockHeight);
        }
    }

    function _getChainMultiplier(MiningChain chain) internal pure returns (uint256) {
        if (chain == MiningChain.ETH)  return ETH_REWARD_MULTIPLIER;
        if (chain == MiningChain.STX)  return STX_REWARD_MULTIPLIER;
        if (chain == MiningChain.DOGE) return DOGE_REWARD_MULTIPLIER;
        if (chain == MiningChain.XMR)  return XMR_REWARD_MULTIPLIER;
        return 50;
    }

    function setVerifier(address _zkVerifier) external onlyOwner { zkVerifier = IZKVerifier(_zkVerifier); }

    function getMinerRewards(address miner) external view returns (uint256, uint256, uint256, uint256) {
        BridgeMiningReward storage r = minerRewards[miner];
        return (r.totalMined, r.totalBridged, r.pendingRewards, r.proofCount);
    }

    function getProofStatus(bytes32 proofHash) external view returns (address, MiningChain, uint256, ProofStatus, uint8) {
        ZkMintProof storage p = proofs[proofHash];
        return (p.miner, p.sourceChain, p.amount, p.status, p.guardianSigs);
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
