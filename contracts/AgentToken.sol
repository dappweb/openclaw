// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

// Interface to check agent NFT ownership
interface IAgentNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    function exists(uint256 tokenId) external view returns (bool);
}

/**
 * @title AgentToken
 * @dev ERC-20 utility token for the OpenClaw Agent Platform
 *
 * This token is used for:
 * - Rewarding agents for good performance
 * - Paying for premium features
 * - Staking for reputation
 * - Governance (future)
 */
contract AgentToken is ERC20, ERC20Burnable, Ownable, Pausable {
    // Reward rate per reputation point
    uint256 public rewardRate = 10 * 10**18; // 10 tokens per point

    // Mapping from agent token ID to accumulated rewards
    mapping(uint256 => uint256) private _agentRewards;

    // Agent NFT contract address (for verification)
    IAgentNFT public agentNFTContract;

    // Events
    event AgentRewarded(uint256 indexed agentTokenId, uint256 amount);
    event RewardRateUpdated(uint256 newRate);
    event AgentNFTContractSet(address newContract);

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }

    /**
     * @dev Mint new tokens (owner only)
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Reward an agent with tokens
     * @param agentTokenId The token ID of the agent NFT
     * @param amount Amount of tokens to reward
     */
    function rewardAgent(uint256 agentTokenId, uint256 amount) public onlyOwner whenNotPaused {
        require(address(agentNFTContract) != address(0), "Agent NFT contract not set");
        require(agentNFTContract.exists(agentTokenId), "Agent does not exist");

        _agentRewards[agentTokenId] += amount;
        emit AgentRewarded(agentTokenId, amount);
    }

    /**
     * @dev Get accumulated rewards for an agent
     */
    function getAgentRewards(uint256 agentTokenId) public view returns (uint256) {
        return _agentRewards[agentTokenId];
    }

    /**
     * @dev Claim rewards for an agent (must be called by NFT owner)
     */
    function claimRewards(uint256 agentTokenId) public whenNotPaused {
        require(address(agentNFTContract) != address(0), "Agent NFT contract not set");
        require(agentNFTContract.ownerOf(agentTokenId) == msg.sender, "Not agent owner");

        uint256 rewards = _agentRewards[agentTokenId];
        require(rewards > 0, "No rewards to claim");

        _agentRewards[agentTokenId] = 0;
        _mint(msg.sender, rewards);
    }

    /**
     * @dev Set reward rate
     */
    function setRewardRate(uint256 rate) public onlyOwner {
        rewardRate = rate;
        emit RewardRateUpdated(rate);
    }

    /**
     * @dev Set Agent NFT contract address
     */
    function setAgentNFTContract(address contractAddress) public onlyOwner {
        agentNFTContract = IAgentNFT(contractAddress);
        emit AgentNFTContractSet(contractAddress);
    }

    /**
     * @dev Pause token operations
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause token operations
     */
    function unpause() public onlyOwner {
        _unpause();
    }

    /**
     * @dev Override transfer to check pause state
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override whenNotPaused {
        super._update(from, to, value);
    }
}
