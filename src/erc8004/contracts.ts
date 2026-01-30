/**
 * Smart Contract Interfaces and ABIs
 *
 * Provides TypeScript interfaces for interacting with ERC-8004 contracts:
 * - AgentNFT (ERC-721): Agent identity NFTs
 * - AgentToken (ERC-20): Utility token
 * - ReputationRegistry: Agent reputation tracking
 */

import type { Address } from "./types.js";

/**
 * AgentNFT Contract ABI (ERC-721 + Extensions)
 */
export const AGENT_NFT_ABI = [
  // ERC-721 Standard
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function approve(address to, uint256 tokenId)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function setApprovalForAll(address operator, bool approved)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function transferFrom(address from, address to, uint256 tokenId)",
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
  "function safeTransferFrom(address from, address to, uint256 tokenId, bytes data)",

  // ERC-721 Enumerable
  "function totalSupply() view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function tokenByIndex(uint256 index) view returns (uint256)",

  // Agent-specific functions
  "function mint(address to, string agentId, string metadataURI) returns (uint256)",
  "function getAgentId(uint256 tokenId) view returns (string)",
  "function getTokenByAgentId(string agentId) view returns (uint256)",
  "function setTokenURI(uint256 tokenId, string uri)",
  "function exists(uint256 tokenId) view returns (bool)",

  // Admin functions
  "function pause()",
  "function unpause()",
  "function setBaseURI(string baseURI)",

  // Events
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)",
  "event ApprovalForAll(address indexed owner, address indexed operator, bool approved)",
  "event AgentMinted(uint256 indexed tokenId, address indexed owner, string agentId)",
] as const;

/**
 * AgentToken Contract ABI (ERC-20)
 */
export const AGENT_TOKEN_ABI = [
  // ERC-20 Standard
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",

  // Minting (admin only)
  "function mint(address to, uint256 amount)",
  "function burn(uint256 amount)",

  // Reward functions
  "function rewardAgent(uint256 agentTokenId, uint256 amount)",
  "function getAgentRewards(uint256 agentTokenId) view returns (uint256)",

  // Admin functions
  "function pause()",
  "function unpause()",
  "function setRewardRate(uint256 rate)",

  // Events
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "event AgentRewarded(uint256 indexed agentTokenId, uint256 amount)",
] as const;

/**
 * ReputationRegistry Contract ABI
 */
export const REPUTATION_ABI = [
  // Core functions
  "function submitFeedback(uint256 agentTokenId, uint8 score, string comment)",
  "function getFeedback(uint256 agentTokenId, uint256 index) view returns (address reviewer, uint8 score, string comment, uint256 timestamp)",
  "function getFeedbackCount(uint256 agentTokenId) view returns (uint256)",
  "function getAverageScore(uint256 agentTokenId) view returns (uint256)",
  "function getTotalScore(uint256 agentTokenId) view returns (uint256)",

  // Validation
  "function canLeaveFeedback(address reviewer, uint256 agentTokenId) view returns (bool)",
  "function hasInteracted(address user, uint256 agentTokenId) view returns (bool)",
  "function recordInteraction(address user, uint256 agentTokenId)",

  // Admin functions
  "function setMinInteractionsRequired(uint256 count)",
  "function setAgentNFTContract(address nftContract)",

  // Events
  "event FeedbackSubmitted(uint256 indexed agentTokenId, address indexed reviewer, uint8 score)",
  "event InteractionRecorded(address indexed user, uint256 indexed agentTokenId)",
] as const;

/**
 * Contract interface for type-safe interactions
 */
export interface AgentNFTContract {
  name(): Promise<string>;
  symbol(): Promise<string>;
  tokenURI(tokenId: bigint): Promise<string>;
  balanceOf(owner: Address): Promise<bigint>;
  ownerOf(tokenId: bigint): Promise<Address>;
  totalSupply(): Promise<bigint>;
  mint(to: Address, agentId: string, metadataURI: string): Promise<bigint>;
  getAgentId(tokenId: bigint): Promise<string>;
  getTokenByAgentId(agentId: string): Promise<bigint>;
  exists(tokenId: bigint): Promise<boolean>;
}

export interface AgentTokenContract {
  name(): Promise<string>;
  symbol(): Promise<string>;
  decimals(): Promise<number>;
  totalSupply(): Promise<bigint>;
  balanceOf(account: Address): Promise<bigint>;
  transfer(to: Address, amount: bigint): Promise<boolean>;
  mint(to: Address, amount: bigint): Promise<void>;
  rewardAgent(agentTokenId: bigint, amount: bigint): Promise<void>;
  getAgentRewards(agentTokenId: bigint): Promise<bigint>;
}

export interface ReputationContract {
  submitFeedback(agentTokenId: bigint, score: number, comment: string): Promise<void>;
  getFeedbackCount(agentTokenId: bigint): Promise<bigint>;
  getAverageScore(agentTokenId: bigint): Promise<bigint>;
  getTotalScore(agentTokenId: bigint): Promise<bigint>;
  canLeaveFeedback(reviewer: Address, agentTokenId: bigint): Promise<boolean>;
  recordInteraction(user: Address, agentTokenId: bigint): Promise<void>;
}
