// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ReputationRegistry
 * @dev Reputation tracking for OpenClaw AI Agents (ERC-8004 Reputation Registry)
 *
 * Tracks feedback and reputation scores for agents.
 * Only users who have interacted with an agent can leave feedback.
 * Stores running totals to avoid gas-intensive iterations.
 */
contract ReputationRegistry is Ownable, Pausable {
    // Feedback structure
    struct Feedback {
        address reviewer;
        uint8 score;      // 1-5
        string comment;
        uint256 timestamp;
    }

    // Aggregated reputation data
    struct ReputationData {
        uint256 totalScore;
        uint256 feedbackCount;
    }

    // Agent NFT contract address
    address public agentNFTContract;

    // Minimum interactions required before leaving feedback
    uint256 public minInteractionsRequired = 1;

    // Mapping: agentTokenId => feedback array
    mapping(uint256 => Feedback[]) private _feedbacks;

    // Mapping: agentTokenId => aggregated reputation data
    mapping(uint256 => ReputationData) private _reputationData;

    // Mapping: user => agentTokenId => interaction count
    mapping(address => mapping(uint256 => uint256)) private _interactions;

    // Mapping: user => agentTokenId => has reviewed
    mapping(address => mapping(uint256 => bool)) private _hasReviewed;

    // Events
    event FeedbackSubmitted(uint256 indexed agentTokenId, address indexed reviewer, uint8 score);
    event InteractionRecorded(address indexed user, uint256 indexed agentTokenId);
    event MinInteractionsUpdated(uint256 newMin);
    event AgentNFTContractSet(address newContract);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Submit feedback for an agent
     * @param agentTokenId The token ID of the agent NFT
     * @param score Rating from 1-5
     * @param comment Optional comment
     */
    function submitFeedback(
        uint256 agentTokenId,
        uint8 score,
        string memory comment
    ) public whenNotPaused {
        require(score >= 1 && score <= 5, "Score must be 1-5");
        require(canLeaveFeedback(msg.sender, agentTokenId), "Cannot leave feedback");
        require(!_hasReviewed[msg.sender][agentTokenId], "Already reviewed");

        _feedbacks[agentTokenId].push(Feedback({
            reviewer: msg.sender,
            score: score,
            comment: comment,
            timestamp: block.timestamp
        }));

        // Update running totals
        _reputationData[agentTokenId].totalScore += score;
        _reputationData[agentTokenId].feedbackCount++;

        _hasReviewed[msg.sender][agentTokenId] = true;

        emit FeedbackSubmitted(agentTokenId, msg.sender, score);
    }

    /**
     * @dev Get feedback at index for an agent
     */
    function getFeedback(uint256 agentTokenId, uint256 index)
        public
        view
        returns (
            address reviewer,
            uint8 score,
            string memory comment,
            uint256 timestamp
        )
    {
        require(index < _feedbacks[agentTokenId].length, "Index out of bounds");
        Feedback storage fb = _feedbacks[agentTokenId][index];
        return (fb.reviewer, fb.score, fb.comment, fb.timestamp);
    }

    /**
     * @dev Get total feedback count for an agent (O(1))
     */
    function getFeedbackCount(uint256 agentTokenId) public view returns (uint256) {
        return _reputationData[agentTokenId].feedbackCount;
    }

    /**
     * @dev Get average score for an agent (multiplied by 100 for precision, O(1))
     */
    function getAverageScore(uint256 agentTokenId) public view returns (uint256) {
        ReputationData storage data = _reputationData[agentTokenId];
        if (data.feedbackCount == 0) return 0;
        return (data.totalScore * 100) / data.feedbackCount;
    }

    /**
     * @dev Get total score for an agent (O(1))
     */
    function getTotalScore(uint256 agentTokenId) public view returns (uint256) {
        return _reputationData[agentTokenId].totalScore;
    }

    /**
     * @dev Check if a user can leave feedback for an agent
     */
    function canLeaveFeedback(address reviewer, uint256 agentTokenId) public view returns (bool) {
        return _interactions[reviewer][agentTokenId] >= minInteractionsRequired &&
               !_hasReviewed[reviewer][agentTokenId];
    }

    /**
     * @dev Check if a user has interacted with an agent
     */
    function hasInteracted(address user, uint256 agentTokenId) public view returns (bool) {
        return _interactions[user][agentTokenId] > 0;
    }

    /**
     * @dev Get interaction count for a user with an agent
     */
    function getInteractionCount(address user, uint256 agentTokenId) public view returns (uint256) {
        return _interactions[user][agentTokenId];
    }

    /**
     * @dev Record an interaction between a user and an agent
     * Can be called by authorized contracts or the owner
     */
    function recordInteraction(address user, uint256 agentTokenId) public whenNotPaused {
        require(
            msg.sender == owner() || msg.sender == agentNFTContract,
            "Not authorized"
        );

        _interactions[user][agentTokenId]++;

        emit InteractionRecorded(user, agentTokenId);
    }

    /**
     * @dev Set minimum interactions required before feedback
     */
    function setMinInteractionsRequired(uint256 count) public onlyOwner {
        minInteractionsRequired = count;
        emit MinInteractionsUpdated(count);
    }

    /**
     * @dev Set Agent NFT contract address
     */
    function setAgentNFTContract(address contractAddress) public onlyOwner {
        agentNFTContract = contractAddress;
        emit AgentNFTContractSet(contractAddress);
    }

    /**
     * @dev Pause the registry
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the registry
     */
    function unpause() public onlyOwner {
        _unpause();
    }
}
