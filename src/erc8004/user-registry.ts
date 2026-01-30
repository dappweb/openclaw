/**
 * User Registry
 *
 * Manages user registration and authentication for the multi-user Agent platform.
 * Users are identified by their Ethereum wallet address.
 */

import { randomUUID } from "crypto";
import type { Address, User, UserStatus } from "./types.js";
import { generateNonce } from "./wallet-auth.js";

/** In-memory user store (should use database in production) */
const userStore = new Map<string, User>();

/** Address to user ID mapping */
const addressIndex = new Map<string, string>();

/**
 * Create a new user
 */
export function createUser(address: Address): User {
  const normalizedAddress = address.toLowerCase() as Address;

  // Check if user already exists
  const existingId = addressIndex.get(normalizedAddress);
  if (existingId) {
    const existing = userStore.get(existingId);
    if (existing) {
      return existing;
    }
  }

  const user: User = {
    id: randomUUID(),
    address: normalizedAddress,
    nonce: generateNonce(),
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  userStore.set(user.id, user);
  addressIndex.set(normalizedAddress, user.id);

  return user;
}

/**
 * Get user by ID
 */
export function getUserById(id: string): User | null {
  return userStore.get(id) || null;
}

/**
 * Get user by wallet address
 */
export function getUserByAddress(address: Address): User | null {
  const normalizedAddress = address.toLowerCase() as Address;
  const userId = addressIndex.get(normalizedAddress);

  if (!userId) {
    return null;
  }

  return userStore.get(userId) || null;
}

/**
 * Get or create user by wallet address
 */
export function getOrCreateUser(address: Address): User {
  const existing = getUserByAddress(address);
  if (existing) {
    return existing;
  }
  return createUser(address);
}

/**
 * Update user status
 */
export function updateUserStatus(userId: string, status: UserStatus): User | null {
  const user = userStore.get(userId);
  if (!user) {
    return null;
  }

  user.status = status;
  user.updatedAt = new Date();
  userStore.set(userId, user);

  return user;
}

/**
 * Regenerate user nonce (for security after failed auth attempts)
 */
export function regenerateNonce(userId: string): string | null {
  const user = userStore.get(userId);
  if (!user) {
    return null;
  }

  user.nonce = generateNonce();
  user.updatedAt = new Date();
  userStore.set(userId, user);

  return user.nonce;
}

/**
 * Get all users (admin function)
 */
export function getAllUsers(): User[] {
  return Array.from(userStore.values());
}

/**
 * Get users by status
 */
export function getUsersByStatus(status: UserStatus): User[] {
  return Array.from(userStore.values()).filter((u) => u.status === status);
}

/**
 * Get user count
 */
export function getUserCount(): number {
  return userStore.size;
}

/**
 * Delete user (admin function)
 */
export function deleteUser(userId: string): boolean {
  const user = userStore.get(userId);
  if (!user) {
    return false;
  }

  addressIndex.delete(user.address.toLowerCase());
  userStore.delete(userId);

  return true;
}

/**
 * Suspend user
 */
export function suspendUser(userId: string): User | null {
  return updateUserStatus(userId, "suspended");
}

/**
 * Activate user
 */
export function activateUser(userId: string): User | null {
  return updateUserStatus(userId, "active");
}

/**
 * Check if user is active
 */
export function isUserActive(userId: string): boolean {
  const user = userStore.get(userId);
  return user?.status === "active";
}

/**
 * User statistics
 */
export interface UserStats {
  total: number;
  active: number;
  suspended: number;
  pending: number;
}

/**
 * Get user statistics
 */
export function getUserStats(): UserStats {
  const users = Array.from(userStore.values());
  return {
    total: users.length,
    active: users.filter((u) => u.status === "active").length,
    suspended: users.filter((u) => u.status === "suspended").length,
    pending: users.filter((u) => u.status === "pending").length,
  };
}
