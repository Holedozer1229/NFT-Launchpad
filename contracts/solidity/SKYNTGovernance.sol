// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/Context.sol";

/**
 * @title SKYNTGovernance
 * @notice On-chain governance for SKYNT Protocol.
 *         SKYNT token holders create and vote on proposals.
 *         Supports EIP-2771 gasless voting via SKYNTForwarder.
 *
 * @dev Proposal lifecycle:
 *   1. Any holder with >= PROPOSAL_THRESHOLD SKYNT creates a proposal
 *   2. Voting is open for VOTING_PERIOD blocks
 *   3. If forVotes >= QUORUM and forVotes > againstVotes, proposal passes
 *   4. Owner executes passed proposals
 */
contract SKYNTGovernance is ERC2771Context, Ownable, ReentrancyGuard {
    IERC20 public immutable skynt;

    // ─── Governance Config ────────────────────────────────────────────────────
    uint256 public votingPeriod      = 40_320;   // ~7 days at 15s blocks
    uint256 public quorum            = 100_000 * 1e18;  // 100k SKYNT
    uint256 public proposalThreshold = 10_000  * 1e18;  // 10k SKYNT to propose

    // ─── Proposal State ───────────────────────────────────────────────────────
    enum ProposalStatus { Active, Passed, Defeated, Executed, Cancelled }

    struct Proposal {
        uint256 id;
        address proposer;
        string  description;
        bytes   executionPayload; // encoded call for owner to execute
        address target;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 startBlock;
        uint256 endBlock;
        ProposalStatus status;
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal)                public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => bool)) public voteDirection; // true = for

    // ─── Events ──────────────────────────────────────────────────────────────
    event ProposalCreated(uint256 indexed id, address indexed proposer, string description, uint256 endBlock);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed id);
    event ProposalCancelled(uint256 indexed id);
    event GovernanceConfigUpdated(uint256 votingPeriod, uint256 quorum, uint256 threshold);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error BelowProposalThreshold();
    error ProposalNotActive();
    error AlreadyVoted();
    error VotingNotEnded();
    error ProposalNotPassed();
    error QuorumNotMet();
    error ExecutionFailed();

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(
        address _skynt,
        address _trustedForwarder
    ) ERC2771Context(_trustedForwarder) Ownable(msg.sender) {
        require(_skynt != address(0), "Invalid SKYNT address");
        skynt = IERC20(_skynt);
    }

    // ─── Core Governance ─────────────────────────────────────────────────────

    function createProposal(
        string  calldata description,
        address target,
        bytes   calldata executionPayload
    ) external nonReentrant returns (uint256) {
        address proposer = _msgSender();
        if (skynt.balanceOf(proposer) < proposalThreshold) revert BelowProposalThreshold();

        uint256 id = ++proposalCount;
        proposals[id] = Proposal({
            id:               id,
            proposer:         proposer,
            description:      description,
            executionPayload: executionPayload,
            target:           target,
            forVotes:         0,
            againstVotes:     0,
            startBlock:       block.number,
            endBlock:         block.number + votingPeriod,
            status:           ProposalStatus.Active
        });

        emit ProposalCreated(id, proposer, description, block.number + votingPeriod);
        return id;
    }

    function castVote(uint256 proposalId, bool support) external nonReentrant {
        Proposal storage p = proposals[proposalId];
        if (p.status != ProposalStatus.Active || block.number > p.endBlock) revert ProposalNotActive();
        if (hasVoted[proposalId][_msgSender()]) revert AlreadyVoted();

        address voter  = _msgSender();
        uint256 weight = skynt.balanceOf(voter);

        hasVoted[proposalId][voter]     = true;
        voteDirection[proposalId][voter] = support;

        if (support) {
            p.forVotes += weight;
        } else {
            p.againstVotes += weight;
        }

        emit VoteCast(proposalId, voter, support, weight);
    }

    function finalizeProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        if (p.status != ProposalStatus.Active) revert ProposalNotActive();
        if (block.number <= p.endBlock)        revert VotingNotEnded();

        if (p.forVotes >= quorum && p.forVotes > p.againstVotes) {
            p.status = ProposalStatus.Passed;
        } else {
            p.status = ProposalStatus.Defeated;
        }
    }

    function executeProposal(uint256 proposalId) external onlyOwner nonReentrant {
        Proposal storage p = proposals[proposalId];
        if (p.status != ProposalStatus.Passed) revert ProposalNotPassed();

        p.status = ProposalStatus.Executed;

        if (p.target != address(0) && p.executionPayload.length > 0) {
            (bool success,) = p.target.call(p.executionPayload);
            if (!success) revert ExecutionFailed();
        }

        emit ProposalExecuted(proposalId);
    }

    function cancelProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        address caller = _msgSender();
        require(
            caller == p.proposer || caller == owner(),
            "Not proposer or owner"
        );
        if (p.status != ProposalStatus.Active) revert ProposalNotActive();
        p.status = ProposalStatus.Cancelled;
        emit ProposalCancelled(proposalId);
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }

    function getVotingPower(address voter) external view returns (uint256) {
        return skynt.balanceOf(voter);
    }

    function isProposalActive(uint256 proposalId) external view returns (bool) {
        Proposal storage p = proposals[proposalId];
        return p.status == ProposalStatus.Active && block.number <= p.endBlock;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setGovernanceConfig(
        uint256 _votingPeriod,
        uint256 _quorum,
        uint256 _proposalThreshold
    ) external onlyOwner {
        votingPeriod      = _votingPeriod;
        quorum            = _quorum;
        proposalThreshold = _proposalThreshold;
        emit GovernanceConfigUpdated(_votingPeriod, _quorum, _proposalThreshold);
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
