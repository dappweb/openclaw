/**
 * ERC-8004 Type Definitions
 */

/** Ethereum address (0x-prefixed hex string) */
export type Address = `0x${string}`;

/** Transaction hash */
export type TxHash = `0x${string}`;

/** Chain ID for supported networks */
export type ChainId = 1 | 11155111; // Mainnet | Sepolia

/** User registration status */
export type UserStatus = "pending" | "active" | "suspended";

/** Agent NFT metadata */
export interface AgentMetadata {
  name: string;
  description: string;
  image?: string;
  attributes: AgentAttribute[];
}

export interface AgentAttribute {
  trait_type: string;
  value: string | number;
}

/** Registered user */
export interface User {
  id: string;
  address: Address;
  nonce: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Agent NFT record */
export interface AgentNFT {
  tokenId: bigint;
  owner: Address;
  agentId: string;
  metadata: AgentMetadata;
  mintedAt: Date;
  txHash: TxHash;
}

/** Reputation record */
export interface ReputationRecord {
  agentTokenId: bigint;
  fromAddress: Address;
  score: number; // 1-5
  comment?: string;
  timestamp: Date;
  txHash?: TxHash;
}

/** Aggregated reputation */
export interface AgentReputation {
  tokenId: bigint;
  totalScore: number;
  reviewCount: number;
  averageScore: number;
}

/** Wallet authentication message */
export interface SiweMessage {
  domain: string;
  address: Address;
  statement: string;
  uri: string;
  version: string;
  chainId: ChainId;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
}

/** Authentication session */
export interface AuthSession {
  address: Address;
  userId: string;
  chainId: ChainId;
  expiresAt: Date;
}

/** Contract addresses for a network */
export interface ContractAddresses {
  agentNFT: Address;
  agentToken: Address;
  reputation: Address;
}

/** ERC-8004 module configuration */
export interface ERC8004Config {
  enabled: boolean;
  chainId: ChainId;
  rpcUrl: string;
  contracts: ContractAddresses;
  /** Private key for server-side signing (optional, for gasless minting) */
  serverPrivateKey?: string;
}
