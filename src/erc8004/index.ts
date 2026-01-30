/**
 * ERC-8004 Trustless Agents Integration
 *
 * This module provides blockchain integration for OpenClaw agents using the
 * ERC-8004 standard for decentralized agent identity, reputation, and validation.
 *
 * Features:
 * - Wallet authentication (MetaMask/WalletConnect via SIWE)
 * - Agent NFT minting (ERC-721)
 * - Utility token (ERC-20)
 * - Reputation system
 * - User registration
 * - Admin dashboard
 */

export * from "./types.js";
export * from "./config.js";
export * from "./wallet-auth.js";
export * from "./contracts.js";
export * from "./user-registry.js";
export * from "./agent-nft.js";
export * from "./reputation.js";
export * from "./admin.js";
export { createERC8004Router, authMiddleware, adminMiddleware } from "./api.js";
