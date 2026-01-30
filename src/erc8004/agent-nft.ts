/**
 * Agent NFT Minting
 *
 * Handles minting and management of Agent NFTs (ERC-721).
 * Each Agent gets a unique NFT representing its on-chain identity.
 */

import { randomUUID } from "crypto";
import type { Address, AgentMetadata, AgentNFT, TxHash } from "./types.js";

/** In-memory NFT store (should use database in production) */
const nftStore = new Map<string, AgentNFT>();

/** Token ID counter (simulated, real value comes from chain) */
let nextTokenId = BigInt(1);

/** Agent ID to token ID mapping */
const agentIdToToken = new Map<string, bigint>();

/** Owner to token IDs mapping */
const ownerTokens = new Map<string, Set<bigint>>();

/**
 * Create Agent metadata
 */
export function createAgentMetadata(params: {
  name: string;
  description: string;
  image?: string;
  capabilities?: string[];
  version?: string;
}): AgentMetadata {
  const attributes: AgentMetadata["attributes"] = [];

  if (params.capabilities) {
    params.capabilities.forEach((cap, i) => {
      attributes.push({ trait_type: `capability_${i + 1}`, value: cap });
    });
  }

  if (params.version) {
    attributes.push({ trait_type: "version", value: params.version });
  }

  attributes.push({ trait_type: "created_at", value: new Date().toISOString() });

  return {
    name: params.name,
    description: params.description,
    image: params.image,
    attributes,
  };
}

/**
 * Generate metadata URI (IPFS or centralized storage)
 */
export function generateMetadataURI(tokenId: bigint, _metadata: AgentMetadata): string {
  // In production, this would upload to IPFS and return ipfs:// URI
  // For now, return a placeholder that the contract can resolve
  const baseURI =
    process.env.OPENCLAW_METADATA_BASE_URI || "https://api.openclaw.ai/metadata/agent/";
  return `${baseURI}${tokenId.toString()}`;
}

/**
 * Mint a new Agent NFT
 *
 * In production, this would call the smart contract.
 * For now, it simulates the minting process.
 */
export async function mintAgentNFT(params: {
  owner: Address;
  agentId: string;
  metadata: AgentMetadata;
}): Promise<AgentNFT> {
  // Config is loaded for future use when calling the actual contract
  // const config = loadERC8004Config();

  // Check if agent already has an NFT
  const existingTokenId = agentIdToToken.get(params.agentId);
  if (existingTokenId !== undefined) {
    const existing = nftStore.get(existingTokenId.toString());
    if (existing) {
      throw new Error(`Agent ${params.agentId} already has an NFT (token ID: ${existingTokenId})`);
    }
  }

  // Generate token ID (in production, this comes from the contract)
  const tokenId = nextTokenId++;

  // Simulate transaction hash
  const txHash = `0x${randomUUID().replace(/-/g, "")}${"0".repeat(32)}`.slice(0, 66) as TxHash;

  const nft: AgentNFT = {
    tokenId,
    owner: params.owner.toLowerCase() as Address,
    agentId: params.agentId,
    metadata: params.metadata,
    mintedAt: new Date(),
    txHash,
  };

  // Store the NFT
  nftStore.set(tokenId.toString(), nft);
  agentIdToToken.set(params.agentId, tokenId);

  // Update owner index
  const ownerAddr = params.owner.toLowerCase();
  if (!ownerTokens.has(ownerAddr)) {
    ownerTokens.set(ownerAddr, new Set());
  }
  ownerTokens.get(ownerAddr)!.add(tokenId);

  console.log(
    `[ERC8004] Minted Agent NFT: tokenId=${tokenId}, agentId=${params.agentId}, owner=${params.owner}`,
  );

  // In production, call the smart contract:
  // const contract = getAgentNFTContract(config);
  // const tx = await contract.mint(params.owner, params.agentId, generateMetadataURI(tokenId, params.metadata));
  // const receipt = await tx.wait();
  // nft.txHash = receipt.transactionHash;
  // nft.tokenId = receipt.events?.find(e => e.event === 'AgentMinted')?.args?.tokenId;

  return nft;
}

/**
 * Get NFT by token ID
 */
export function getNFTByTokenId(tokenId: bigint): AgentNFT | null {
  return nftStore.get(tokenId.toString()) || null;
}

/**
 * Get NFT by agent ID
 */
export function getNFTByAgentId(agentId: string): AgentNFT | null {
  const tokenId = agentIdToToken.get(agentId);
  if (tokenId === undefined) {
    return null;
  }
  return nftStore.get(tokenId.toString()) || null;
}

/**
 * Get all NFTs owned by an address
 */
export function getNFTsByOwner(owner: Address): AgentNFT[] {
  const tokenIds = ownerTokens.get(owner.toLowerCase());
  if (!tokenIds) {
    return [];
  }

  return Array.from(tokenIds)
    .map((id) => nftStore.get(id.toString()))
    .filter((nft): nft is AgentNFT => nft !== undefined);
}

/**
 * Transfer NFT ownership
 */
export async function transferNFT(tokenId: bigint, from: Address, to: Address): Promise<AgentNFT> {
  const nft = nftStore.get(tokenId.toString());
  if (!nft) {
    throw new Error(`NFT not found: ${tokenId}`);
  }

  const fromAddr = from.toLowerCase() as Address;
  const toAddr = to.toLowerCase() as Address;

  if (nft.owner.toLowerCase() !== fromAddr) {
    throw new Error(`Not the owner of token ${tokenId}`);
  }

  // Update owner
  nft.owner = toAddr;

  // Update indices
  ownerTokens.get(fromAddr)?.delete(tokenId);
  if (!ownerTokens.has(toAddr)) {
    ownerTokens.set(toAddr, new Set());
  }
  ownerTokens.get(toAddr)!.add(tokenId);

  nftStore.set(tokenId.toString(), nft);

  console.log(`[ERC8004] Transferred NFT: tokenId=${tokenId}, from=${from}, to=${to}`);

  return nft;
}

/**
 * Get total supply of Agent NFTs
 */
export function getTotalSupply(): bigint {
  return BigInt(nftStore.size);
}

/**
 * Get all Agent NFTs (admin function)
 */
export function getAllNFTs(): AgentNFT[] {
  return Array.from(nftStore.values());
}

/**
 * Check if an agent has an NFT
 */
export function hasNFT(agentId: string): boolean {
  return agentIdToToken.has(agentId);
}

/**
 * Update NFT metadata
 */
export function updateNFTMetadata(
  tokenId: bigint,
  metadata: Partial<AgentMetadata>,
): AgentNFT | null {
  const nft = nftStore.get(tokenId.toString());
  if (!nft) {
    return null;
  }

  nft.metadata = {
    ...nft.metadata,
    ...metadata,
    attributes: metadata.attributes || nft.metadata.attributes,
  };

  nftStore.set(tokenId.toString(), nft);
  return nft;
}

/**
 * NFT statistics
 */
export interface NFTStats {
  totalMinted: number;
  uniqueOwners: number;
  recentMints: AgentNFT[];
}

/**
 * Get NFT statistics
 */
export function getNFTStats(): NFTStats {
  const allNFTs = Array.from(nftStore.values());
  const uniqueOwners = new Set(allNFTs.map((nft) => nft.owner.toLowerCase())).size;

  // Get recent mints (last 10)
  const recentMints = allNFTs
    .sort((a, b) => b.mintedAt.getTime() - a.mintedAt.getTime())
    .slice(0, 10);

  return {
    totalMinted: allNFTs.length,
    uniqueOwners,
    recentMints,
  };
}
