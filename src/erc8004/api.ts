/**
 * ERC-8004 HTTP API Endpoints
 *
 * REST API for the multi-user Agent token platform.
 * Integrates with the OpenClaw Gateway HTTP server.
 */

import type { Request, Response, NextFunction, Router } from "express";
import type { Address } from "./types.js";
import { loadERC8004Config, validateERC8004Config, getChainName } from "./config.js";
import {
  generateNonce,
  createSiweMessage,
  formatSiweMessage,
  authenticateWithSiwe,
  createSession,
  getSession,
  deleteSession,
  storeNonce,
} from "./wallet-auth.js";
import { getOrCreateUser, getUserById, isUserActive } from "./user-registry.js";
import { mintAgentNFT, createAgentMetadata, getNFTByAgentId, hasNFT } from "./agent-nft.js";
import {
  submitFeedback,
  recordInteraction,
  getAgentReputation,
  getFeedback,
} from "./reputation.js";
import {
  getPlatformStats,
  listUsers,
  listNFTs,
  getReputationDashboard,
  isAdmin,
  logAdminAction,
  adminSuspendUser,
  adminActivateUser,
} from "./admin.js";

/**
 * Session cookie name
 */
const SESSION_COOKIE = "openclaw_erc8004_session";

/**
 * Extract session from request
 */
function getSessionFromRequest(req: Request): { address: Address; userId: string } | null {
  const sessionId = req.cookies?.[SESSION_COOKIE] || req.headers["x-session-id"];
  if (!sessionId || typeof sessionId !== "string") {
    return null;
  }

  const session = getSession(sessionId);
  if (!session) {
    return null;
  }

  return { address: session.address, userId: session.userId };
}

/**
 * Authentication middleware
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const session = getSessionFromRequest(req);

  if (!session) {
    res.status(401).json({ error: "Unauthorized", message: "Please sign in with your wallet" });
    return;
  }

  // Attach session to request
  (req as Request & { walletSession: { address: Address; userId: string } }).walletSession =
    session;
  next();
}

/**
 * Admin middleware
 */
export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  const session = getSessionFromRequest(req);

  if (!session) {
    res.status(401).json({ error: "Unauthorized", message: "Please sign in with your wallet" });
    return;
  }

  if (!isAdmin(session.address)) {
    res.status(403).json({ error: "Forbidden", message: "Admin access required" });
    return;
  }

  (req as Request & { walletSession: { address: Address; userId: string } }).walletSession =
    session;
  next();
}

/**
 * Create ERC-8004 API router
 */
export function createERC8004Router(router: Router): Router {
  const config = loadERC8004Config();
  const validationErrors = validateERC8004Config(config);

  // Health check endpoint
  router.get("/erc8004/health", (_req, res) => {
    res.json({
      enabled: config.enabled,
      chainId: config.chainId,
      chainName: getChainName(config.chainId),
      validationErrors,
    });
  });

  if (!config.enabled) {
    // Return disabled status for all other endpoints
    router.all("/erc8004/*", (_req, res) => {
      res.status(503).json({ error: "ERC-8004 module is disabled" });
    });
    return router;
  }

  // ========== Authentication Endpoints ==========

  /**
   * GET /erc8004/auth/nonce
   * Get a nonce for SIWE authentication
   */
  router.get("/erc8004/auth/nonce", (req, res) => {
    const address = req.query.address as string;

    if (!address || !address.startsWith("0x")) {
      res.status(400).json({ error: "Invalid address" });
      return;
    }

    const nonce = generateNonce();
    storeNonce(nonce, address as Address);

    const message = createSiweMessage({
      domain: req.hostname,
      address: address as Address,
      uri: `${req.protocol}://${req.get("host")}`,
      chainId: config.chainId,
      nonce,
      statement: "Sign in to OpenClaw Agent Platform",
    });

    res.json({
      nonce,
      message: formatSiweMessage(message),
    });
  });

  /**
   * POST /erc8004/auth/verify
   * Verify SIWE signature and create session
   */
  router.post("/erc8004/auth/verify", async (req, res) => {
    try {
      const { message, signature } = req.body;

      if (!message || !signature) {
        res.status(400).json({ error: "Missing message or signature" });
        return;
      }

      const result = await authenticateWithSiwe({
        message,
        signature,
        domain: req.hostname,
        uri: `${req.protocol}://${req.get("host")}`,
      });

      if (!result.success || !result.address) {
        res.status(401).json({ error: result.error || "Authentication failed" });
        return;
      }

      // Get or create user
      const user = getOrCreateUser(result.address);

      if (!isUserActive(user.id)) {
        res.status(403).json({ error: "Account suspended" });
        return;
      }

      // Create session (stored for later verification)
      const { sessionId } = createSession(result.address, user.id, config.chainId);

      res.cookie(SESSION_COOKIE, sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          address: user.address,
          status: user.status,
        },
      });
    } catch (error) {
      console.error("[ERC8004] Auth error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /erc8004/auth/logout
   * End session
   */
  router.post("/erc8004/auth/logout", (req, res) => {
    const sessionId = req.cookies?.[SESSION_COOKIE];
    if (sessionId) {
      deleteSession(sessionId);
    }
    res.clearCookie(SESSION_COOKIE);
    res.json({ success: true });
  });

  /**
   * GET /erc8004/auth/me
   * Get current user info
   */
  router.get("/erc8004/auth/me", authMiddleware, (req, res) => {
    const session = (req as Request & { walletSession: { address: Address; userId: string } })
      .walletSession;
    const user = getUserById(session.userId);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      id: user.id,
      address: user.address,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    });
  });

  // ========== Agent NFT Endpoints ==========

  /**
   * POST /erc8004/agents/mint
   * Mint a new Agent NFT
   */
  router.post("/erc8004/agents/mint", authMiddleware, async (req, res) => {
    try {
      const session = (req as Request & { walletSession: { address: Address; userId: string } })
        .walletSession;
      const { agentId, name, description, capabilities } = req.body;

      if (!agentId || !name) {
        res.status(400).json({ error: "Missing required fields: agentId, name" });
        return;
      }

      // Check if agent already has NFT
      if (hasNFT(agentId)) {
        res.status(409).json({ error: "Agent already has an NFT" });
        return;
      }

      const metadata = createAgentMetadata({
        name,
        description: description || `AI Agent: ${name}`,
        capabilities: capabilities || [],
      });

      const nft = await mintAgentNFT({
        owner: session.address,
        agentId,
        metadata,
      });

      res.status(201).json({
        success: true,
        nft: {
          tokenId: nft.tokenId.toString(),
          owner: nft.owner,
          agentId: nft.agentId,
          metadata: nft.metadata,
          txHash: nft.txHash,
        },
      });
    } catch (error) {
      console.error("[ERC8004] Mint error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Mint failed" });
    }
  });

  /**
   * GET /erc8004/agents/:agentId
   * Get Agent NFT by agent ID
   */
  router.get("/erc8004/agents/:agentId", (req, res) => {
    const nft = getNFTByAgentId(req.params.agentId);

    if (!nft) {
      res.status(404).json({ error: "Agent NFT not found" });
      return;
    }

    const reputation = getAgentReputation(nft.tokenId);

    res.json({
      tokenId: nft.tokenId.toString(),
      owner: nft.owner,
      agentId: nft.agentId,
      metadata: nft.metadata,
      mintedAt: nft.mintedAt.toISOString(),
      reputation: {
        averageScore: reputation.averageScore,
        reviewCount: reputation.reviewCount,
      },
    });
  });

  /**
   * GET /erc8004/agents
   * List Agent NFTs (optionally filtered by owner)
   */
  router.get("/erc8004/agents", (req, res) => {
    const owner = req.query.owner as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const result = listNFTs({
      page,
      pageSize,
      owner: owner as Address | undefined,
    });

    res.json({
      agents: result.nfts.map((nft) => ({
        tokenId: nft.tokenId.toString(),
        owner: nft.owner,
        agentId: nft.agentId,
        name: nft.metadata.name,
        mintedAt: nft.mintedAt.toISOString(),
      })),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  });

  // ========== Reputation Endpoints ==========

  /**
   * POST /erc8004/reputation/interact
   * Record an interaction with an agent (required before leaving feedback)
   */
  router.post("/erc8004/reputation/interact", authMiddleware, async (req, res) => {
    try {
      const session = (req as Request & { walletSession: { address: Address; userId: string } })
        .walletSession;
      const { agentId } = req.body;

      if (!agentId) {
        res.status(400).json({ error: "Missing agentId" });
        return;
      }

      const nft = getNFTByAgentId(agentId);
      if (!nft) {
        res.status(404).json({ error: "Agent NFT not found" });
        return;
      }

      await recordInteraction(session.address, nft.tokenId);

      res.json({ success: true });
    } catch (error) {
      console.error("[ERC8004] Interaction error:", error);
      res.status(500).json({ error: "Failed to record interaction" });
    }
  });

  /**
   * POST /erc8004/reputation/feedback
   * Submit feedback for an agent
   */
  router.post("/erc8004/reputation/feedback", authMiddleware, async (req, res) => {
    try {
      const session = (req as Request & { walletSession: { address: Address; userId: string } })
        .walletSession;
      const { agentId, score, comment } = req.body;

      if (!agentId || score === undefined) {
        res.status(400).json({ error: "Missing required fields: agentId, score" });
        return;
      }

      // Validate score is a valid number
      const parsedScore = typeof score === "number" ? score : parseInt(String(score), 10);
      if (Number.isNaN(parsedScore) || parsedScore < 1 || parsedScore > 5) {
        res.status(400).json({ error: "Score must be a number between 1 and 5" });
        return;
      }

      const nft = getNFTByAgentId(agentId);
      if (!nft) {
        res.status(404).json({ error: "Agent NFT not found" });
        return;
      }

      const record = await submitFeedback({
        agentTokenId: nft.tokenId,
        fromAddress: session.address,
        score: parsedScore,
        comment,
      });

      res.status(201).json({
        success: true,
        feedback: {
          agentTokenId: record.agentTokenId.toString(),
          score: record.score,
          comment: record.comment,
          timestamp: record.timestamp.toISOString(),
        },
      });
    } catch (error) {
      console.error("[ERC8004] Feedback error:", error);
      res
        .status(500)
        .json({ error: error instanceof Error ? error.message : "Failed to submit feedback" });
    }
  });

  /**
   * GET /erc8004/reputation/:agentId
   * Get agent reputation and feedback
   */
  router.get("/erc8004/reputation/:agentId", (req, res) => {
    const nft = getNFTByAgentId(req.params.agentId);

    if (!nft) {
      res.status(404).json({ error: "Agent NFT not found" });
      return;
    }

    const reputation = getAgentReputation(nft.tokenId);
    const feedback = getFeedback(nft.tokenId);

    res.json({
      agentId: req.params.agentId,
      tokenId: nft.tokenId.toString(),
      reputation: {
        averageScore: reputation.averageScore,
        totalScore: reputation.totalScore,
        reviewCount: reputation.reviewCount,
      },
      recentFeedback: feedback.slice(0, 10).map((f) => ({
        score: f.score,
        comment: f.comment,
        fromAddress: f.fromAddress.slice(0, 6) + "..." + f.fromAddress.slice(-4),
        timestamp: f.timestamp.toISOString(),
      })),
    });
  });

  // ========== Admin Endpoints ==========

  /**
   * GET /erc8004/admin/stats
   * Get platform statistics
   */
  router.get("/erc8004/admin/stats", adminMiddleware, (_req, res) => {
    const stats = getPlatformStats();
    res.json(stats);
  });

  /**
   * GET /erc8004/admin/users
   * List users (admin only)
   */
  router.get("/erc8004/admin/users", adminMiddleware, (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const status = req.query.status as string | undefined;

    const result = listUsers({ page, pageSize, status });
    res.json(result);
  });

  /**
   * POST /erc8004/admin/users/:userId/suspend
   * Suspend a user
   */
  router.post("/erc8004/admin/users/:userId/suspend", adminMiddleware, (req, res) => {
    const session = (req as Request & { walletSession: { address: Address; userId: string } })
      .walletSession;
    const userId = req.params.userId as string;
    const user = adminSuspendUser(userId);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    logAdminAction({
      adminAddress: session.address,
      action: "suspend_user",
      targetType: "user",
      targetId: userId,
    });

    res.json({ success: true, user });
  });

  /**
   * POST /erc8004/admin/users/:userId/activate
   * Activate a suspended user
   */
  router.post("/erc8004/admin/users/:userId/activate", adminMiddleware, (req, res) => {
    const session = (req as Request & { walletSession: { address: Address; userId: string } })
      .walletSession;
    const userId = req.params.userId as string;
    const user = adminActivateUser(userId);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    logAdminAction({
      adminAddress: session.address,
      action: "activate_user",
      targetType: "user",
      targetId: userId,
    });

    res.json({ success: true, user });
  });

  /**
   * GET /erc8004/admin/reputation
   * Get reputation dashboard data
   */
  router.get("/erc8004/admin/reputation", adminMiddleware, (_req, res) => {
    const dashboard = getReputationDashboard();
    res.json(dashboard);
  });

  return router;
}
