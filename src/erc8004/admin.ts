/**
 * Admin Dashboard API
 *
 * Provides administrative endpoints for managing users, agents, and platform statistics.
 */

import type { Address, AgentNFT, AgentReputation, User } from "./types.js";
import {
  getUserStats,
  getAllUsers,
  suspendUser,
  activateUser,
  deleteUser,
} from "./user-registry.js";
import { getNFTStats, getAllNFTs, getNFTsByOwner } from "./agent-nft.js";
import { getReputationStats, getTopAgents, getRecentFeedback } from "./reputation.js";

/**
 * Platform overview statistics
 */
export interface PlatformStats {
  users: {
    total: number;
    active: number;
    suspended: number;
    pending: number;
  };
  nfts: {
    totalMinted: number;
    uniqueOwners: number;
  };
  reputation: {
    totalReviews: number;
    totalAgentsReviewed: number;
    averageOverallScore: number;
  };
  timestamp: string;
}

/**
 * Get platform overview statistics
 */
export function getPlatformStats(): PlatformStats {
  const userStats = getUserStats();
  const nftStats = getNFTStats();
  const repStats = getReputationStats();

  return {
    users: userStats,
    nfts: {
      totalMinted: nftStats.totalMinted,
      uniqueOwners: nftStats.uniqueOwners,
    },
    reputation: {
      totalReviews: repStats.totalReviews,
      totalAgentsReviewed: repStats.totalAgentsReviewed,
      averageOverallScore: repStats.averageOverallScore,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Admin user management
 */
export interface AdminUserListResult {
  users: User[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * List users with pagination
 */
export function listUsers(params: {
  page?: number;
  pageSize?: number;
  status?: string;
}): AdminUserListResult {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;

  let users = getAllUsers();

  // Filter by status if specified
  if (params.status) {
    users = users.filter((u) => u.status === params.status);
  }

  // Sort by creation date (newest first)
  users.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Paginate
  const start = (page - 1) * pageSize;
  const paginatedUsers = users.slice(start, start + pageSize);

  return {
    users: paginatedUsers,
    total: users.length,
    page,
    pageSize,
  };
}

/**
 * Admin user actions
 */
export function adminSuspendUser(userId: string): User | null {
  return suspendUser(userId);
}

export function adminActivateUser(userId: string): User | null {
  return activateUser(userId);
}

export function adminDeleteUser(userId: string): boolean {
  return deleteUser(userId);
}

/**
 * Admin NFT management
 */
export interface AdminNFTListResult {
  nfts: AgentNFT[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * List NFTs with pagination
 */
export function listNFTs(params: {
  page?: number;
  pageSize?: number;
  owner?: Address;
}): AdminNFTListResult {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;

  let nfts = params.owner ? getNFTsByOwner(params.owner) : getAllNFTs();

  // Sort by mint date (newest first)
  nfts.sort((a, b) => b.mintedAt.getTime() - a.mintedAt.getTime());

  // Paginate
  const start = (page - 1) * pageSize;
  const paginatedNFTs = nfts.slice(start, start + pageSize);

  return {
    nfts: paginatedNFTs,
    total: nfts.length,
    page,
    pageSize,
  };
}

/**
 * Admin reputation management
 */
export interface AdminReputationResult {
  topAgents: AgentReputation[];
  recentFeedback: Array<{
    agentTokenId: string;
    score: number;
    comment?: string;
    fromAddress: string;
    timestamp: string;
  }>;
  stats: {
    totalReviews: number;
    averageScore: number;
    scoreDistribution: Record<number, number>;
  };
}

/**
 * Get reputation dashboard data
 */
export function getReputationDashboard(): AdminReputationResult {
  const topAgents = getTopAgents(10);
  const recentFeedback = getRecentFeedback(20).map((f) => ({
    agentTokenId: f.agentTokenId.toString(),
    score: f.score,
    comment: f.comment,
    fromAddress: f.fromAddress,
    timestamp: f.timestamp.toISOString(),
  }));
  const stats = getReputationStats();

  return {
    topAgents,
    recentFeedback,
    stats: {
      totalReviews: stats.totalReviews,
      averageScore: stats.averageOverallScore,
      scoreDistribution: stats.scoreDistribution,
    },
  };
}

/**
 * Admin action log entry
 */
export interface AdminAction {
  id: string;
  adminAddress: Address;
  action: string;
  targetType: "user" | "nft" | "reputation" | "system";
  targetId?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

/** In-memory admin action log */
const adminActionLog: AdminAction[] = [];

/**
 * Log an admin action
 */
export function logAdminAction(params: {
  adminAddress: Address;
  action: string;
  targetType: AdminAction["targetType"];
  targetId?: string;
  details?: Record<string, unknown>;
}): void {
  const entry: AdminAction = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    adminAddress: params.adminAddress,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    details: params.details,
    timestamp: new Date(),
  };

  adminActionLog.push(entry);

  // Keep only last 1000 entries
  if (adminActionLog.length > 1000) {
    adminActionLog.shift();
  }

  console.log(
    `[ERC8004:Admin] ${params.action} by ${params.adminAddress} on ${params.targetType}:${params.targetId || "N/A"}`,
  );
}

/**
 * Get recent admin actions
 */
export function getAdminActions(limit: number = 50): AdminAction[] {
  return adminActionLog.slice(-limit).reverse();
}

/**
 * Admin role management
 */
const adminAddresses = new Set<string>();

/**
 * Check if address is an admin
 */
export function isAdmin(address: Address): boolean {
  return adminAddresses.has(address.toLowerCase());
}

/**
 * Add admin address
 */
export function addAdmin(address: Address): void {
  adminAddresses.add(address.toLowerCase());
  console.log(`[ERC8004:Admin] Added admin: ${address}`);
}

/**
 * Remove admin address
 */
export function removeAdmin(address: Address): void {
  adminAddresses.delete(address.toLowerCase());
  console.log(`[ERC8004:Admin] Removed admin: ${address}`);
}

/**
 * Get all admin addresses
 */
export function getAdminAddresses(): Address[] {
  return Array.from(adminAddresses) as Address[];
}

/**
 * Initialize with default admin from environment
 */
export function initializeAdmins(): void {
  const defaultAdmin = process.env.OPENCLAW_ERC8004_DEFAULT_ADMIN;
  if (defaultAdmin) {
    addAdmin(defaultAdmin as Address);
  }
}

// Initialize admins on module load
initializeAdmins();
