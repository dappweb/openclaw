/**
 * Reputation System
 *
 * Tracks and manages Agent reputation based on user feedback.
 * Implements the ERC-8004 Reputation Registry interface.
 */

import { randomUUID } from "crypto";
import type { Address, AgentReputation, ReputationRecord, TxHash } from "./types.js";
import { getNFTByTokenId } from "./agent-nft.js";

/** In-memory reputation store */
const reputationStore = new Map<string, ReputationRecord[]>();

/** Interaction tracking: user -> agent token IDs */
const interactionStore = new Map<string, Set<string>>();

/** Minimum score value */
const MIN_SCORE = 1;

/** Maximum score value */
const MAX_SCORE = 5;

/**
 * Submit feedback for an Agent
 */
export async function submitFeedback(params: {
  agentTokenId: bigint;
  fromAddress: Address;
  score: number;
  comment?: string;
}): Promise<ReputationRecord> {
  // Validate score
  if (params.score < MIN_SCORE || params.score > MAX_SCORE) {
    throw new Error(`Score must be between ${MIN_SCORE} and ${MAX_SCORE}`);
  }

  // Verify agent exists
  const nft = getNFTByTokenId(params.agentTokenId);
  if (!nft) {
    throw new Error(`Agent NFT not found: ${params.agentTokenId}`);
  }

  // Check if user has already reviewed
  if (hasUserReviewed(params.fromAddress, params.agentTokenId)) {
    throw new Error("User has already reviewed this agent");
  }

  // Check if user can leave feedback (has interacted with agent)
  const canFeedback = await canLeaveFeedback(params.fromAddress, params.agentTokenId);
  if (!canFeedback) {
    throw new Error("Must interact with agent before leaving feedback");
  }

  // Create feedback record with proper 32-byte mock tx hash
  const mockTxHash = `0x${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}`.slice(
    0,
    66,
  ) as TxHash;

  const record: ReputationRecord = {
    agentTokenId: params.agentTokenId,
    fromAddress: params.fromAddress.toLowerCase() as Address,
    score: Math.round(params.score),
    comment: params.comment?.slice(0, 500), // Limit comment to 500 characters
    timestamp: new Date(),
    txHash: mockTxHash,
  };

  // Store feedback
  const tokenKey = params.agentTokenId.toString();
  if (!reputationStore.has(tokenKey)) {
    reputationStore.set(tokenKey, []);
  }
  reputationStore.get(tokenKey)!.push(record);

  console.log(
    `[ERC8004] Feedback submitted: agentTokenId=${params.agentTokenId}, score=${params.score}, from=${params.fromAddress}`,
  );

  return record;
}

/**
 * Check if a user can leave feedback for an agent
 */
export async function canLeaveFeedback(reviewer: Address, agentTokenId: bigint): Promise<boolean> {
  const userKey = reviewer.toLowerCase();
  const tokenKey = agentTokenId.toString();

  const interactions = interactionStore.get(userKey);
  return interactions?.has(tokenKey) ?? false;
}

/**
 * Record an interaction between a user and an agent
 */
export async function recordInteraction(user: Address, agentTokenId: bigint): Promise<void> {
  const userKey = user.toLowerCase();
  const tokenKey = agentTokenId.toString();

  if (!interactionStore.has(userKey)) {
    interactionStore.set(userKey, new Set());
  }
  interactionStore.get(userKey)!.add(tokenKey);

  console.log(`[ERC8004] Interaction recorded: user=${user}, agentTokenId=${agentTokenId}`);
}

/**
 * Get all feedback for an agent
 */
export function getFeedback(agentTokenId: bigint): ReputationRecord[] {
  const tokenKey = agentTokenId.toString();
  return reputationStore.get(tokenKey) || [];
}

/**
 * Get feedback count for an agent
 */
export function getFeedbackCount(agentTokenId: bigint): number {
  const tokenKey = agentTokenId.toString();
  return reputationStore.get(tokenKey)?.length || 0;
}

/**
 * Get aggregated reputation for an agent
 */
export function getAgentReputation(agentTokenId: bigint): AgentReputation {
  const feedback = getFeedback(agentTokenId);

  if (feedback.length === 0) {
    return {
      tokenId: agentTokenId,
      totalScore: 0,
      reviewCount: 0,
      averageScore: 0,
    };
  }

  const totalScore = feedback.reduce((sum, r) => sum + r.score, 0);
  const averageScore = totalScore / feedback.length;

  return {
    tokenId: agentTokenId,
    totalScore,
    reviewCount: feedback.length,
    averageScore: Math.round(averageScore * 100) / 100, // Round to 2 decimal places
  };
}

/**
 * Get average score for an agent
 */
export function getAverageScore(agentTokenId: bigint): number {
  const rep = getAgentReputation(agentTokenId);
  return rep.averageScore;
}

/**
 * Get total score for an agent
 */
export function getTotalScore(agentTokenId: bigint): number {
  const rep = getAgentReputation(agentTokenId);
  return rep.totalScore;
}

/**
 * Get top-rated agents
 */
export function getTopAgents(limit: number = 10): AgentReputation[] {
  const allTokenKeys = Array.from(reputationStore.keys());

  const reputations = allTokenKeys.map((key) => getAgentReputation(BigInt(key)));

  return reputations
    .filter((r) => r.reviewCount >= 3) // Minimum reviews threshold
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, limit);
}

/**
 * Get recent feedback across all agents
 */
export function getRecentFeedback(limit: number = 20): ReputationRecord[] {
  const allFeedback: ReputationRecord[] = [];

  for (const records of reputationStore.values()) {
    allFeedback.push(...records);
  }

  return allFeedback.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit);
}

/**
 * Get feedback from a specific user
 */
export function getUserFeedback(userAddress: Address): ReputationRecord[] {
  const normalizedAddress = userAddress.toLowerCase();
  const allFeedback: ReputationRecord[] = [];

  for (const records of reputationStore.values()) {
    allFeedback.push(...records.filter((r) => r.fromAddress.toLowerCase() === normalizedAddress));
  }

  return allFeedback.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/**
 * Check if user has already reviewed an agent
 */
export function hasUserReviewed(userAddress: Address, agentTokenId: bigint): boolean {
  const feedback = getFeedback(agentTokenId);
  const normalizedAddress = userAddress.toLowerCase();
  return feedback.some((r) => r.fromAddress.toLowerCase() === normalizedAddress);
}

/**
 * Reputation statistics
 */
export interface ReputationStats {
  totalReviews: number;
  totalAgentsReviewed: number;
  averageOverallScore: number;
  scoreDistribution: Record<number, number>;
}

/**
 * Get reputation statistics
 */
export function getReputationStats(): ReputationStats {
  const allFeedback: ReputationRecord[] = [];

  for (const records of reputationStore.values()) {
    allFeedback.push(...records);
  }

  const scoreDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalScore = 0;

  for (const record of allFeedback) {
    scoreDistribution[record.score] = (scoreDistribution[record.score] || 0) + 1;
    totalScore += record.score;
  }

  return {
    totalReviews: allFeedback.length,
    totalAgentsReviewed: reputationStore.size,
    averageOverallScore:
      allFeedback.length > 0 ? Math.round((totalScore / allFeedback.length) * 100) / 100 : 0,
    scoreDistribution,
  };
}
