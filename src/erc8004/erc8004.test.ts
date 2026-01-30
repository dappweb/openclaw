/**
 * ERC-8004 Module Tests
 */

import { describe, it, expect } from "vitest";

import {
  generateNonce,
  createSiweMessage,
  formatSiweMessage,
  parseSiweMessage,
  storeNonce,
  verifyAndConsumeNonce,
} from "./wallet-auth.js";

import {
  createUser,
  getUserById,
  getUserByAddress,
  getOrCreateUser,
  updateUserStatus,
} from "./user-registry.js";

import {
  createAgentMetadata,
  mintAgentNFT,
  getNFTByAgentId,
  getNFTByTokenId,
  getNFTsByOwner,
} from "./agent-nft.js";

import {
  recordInteraction,
  submitFeedback,
  canLeaveFeedback,
  getAgentReputation,
} from "./reputation.js";

import type { Address, ChainId } from "./types.js";

describe("ERC-8004 Wallet Auth", () => {
  describe("generateNonce", () => {
    it("should generate unique nonces", () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();

      expect(nonce1).toBeTruthy();
      expect(nonce2).toBeTruthy();
      expect(nonce1).not.toBe(nonce2);
      expect(nonce1.length).toBe(32); // 16 bytes hex = 32 chars
    });
  });

  describe("SIWE message", () => {
    it("should create and format SIWE message", () => {
      const address = "0x1234567890123456789012345678901234567890" as Address;
      const nonce = generateNonce();

      const message = createSiweMessage({
        domain: "example.com",
        address,
        uri: "https://example.com",
        chainId: 11155111 as ChainId,
        nonce,
      });

      expect(message.domain).toBe("example.com");
      expect(message.address).toBe(address);
      expect(message.chainId).toBe(11155111);
      expect(message.nonce).toBe(nonce);

      const formatted = formatSiweMessage(message);
      expect(formatted).toContain("example.com wants you to sign in");
      expect(formatted).toContain(address);
      expect(formatted).toContain("Chain ID: 11155111");
    });

    it("should parse SIWE message", () => {
      const address = "0x1234567890123456789012345678901234567890" as Address;
      const nonce = generateNonce();

      const message = createSiweMessage({
        domain: "example.com",
        address,
        uri: "https://example.com",
        chainId: 11155111 as ChainId,
        nonce,
      });

      const formatted = formatSiweMessage(message);
      const parsed = parseSiweMessage(formatted);

      expect(parsed).not.toBeNull();
      expect(parsed!.domain).toBe("example.com");
      expect(parsed!.address).toBe(address);
      expect(parsed!.nonce).toBe(nonce);
    });
  });

  describe("nonce verification", () => {
    it("should store and verify nonce", () => {
      const address = "0x1234567890123456789012345678901234567890" as Address;
      const nonce = generateNonce();

      storeNonce(nonce, address);
      const result = verifyAndConsumeNonce(nonce, address);

      expect(result).toBe(true);
    });

    it("should consume nonce after verification", () => {
      const address = "0x1234567890123456789012345678901234567890" as Address;
      const nonce = generateNonce();

      storeNonce(nonce, address);
      verifyAndConsumeNonce(nonce, address);

      // Second attempt should fail
      const result = verifyAndConsumeNonce(nonce, address);
      expect(result).toBe(false);
    });

    it("should reject wrong address", () => {
      const address1 = "0x1234567890123456789012345678901234567890" as Address;
      const address2 = "0xabcdef0123456789012345678901234567890abc" as Address;
      const nonce = generateNonce();

      storeNonce(nonce, address1);
      const result = verifyAndConsumeNonce(nonce, address2);

      expect(result).toBe(false);
    });
  });
});

describe("ERC-8004 User Registry", () => {
  describe("createUser", () => {
    it("should create a new user", () => {
      const address = `0x${Date.now().toString(16).padStart(40, "0")}` as Address;
      const user = createUser(address);

      expect(user.id).toBeTruthy();
      expect(user.address.toLowerCase()).toBe(address.toLowerCase());
      expect(user.status).toBe("active");
      expect(user.nonce).toBeTruthy();
    });

    it("should return existing user on duplicate address", () => {
      const address = `0x${Date.now().toString(16).padStart(40, "a")}` as Address;
      const user1 = createUser(address);
      const user2 = createUser(address);

      expect(user1.id).toBe(user2.id);
    });
  });

  describe("getOrCreateUser", () => {
    it("should create user if not exists", () => {
      const address = `0x${Date.now().toString(16).padStart(40, "b")}` as Address;
      const user = getOrCreateUser(address);

      expect(user).toBeTruthy();
      expect(user.address.toLowerCase()).toBe(address.toLowerCase());
    });

    it("should return existing user", () => {
      const address = `0x${Date.now().toString(16).padStart(40, "c")}` as Address;
      const user1 = createUser(address);
      const user2 = getOrCreateUser(address);

      expect(user1.id).toBe(user2.id);
    });
  });

  describe("getUserById / getUserByAddress", () => {
    it("should retrieve user by ID", () => {
      const address = `0x${Date.now().toString(16).padStart(40, "d")}` as Address;
      const created = createUser(address);
      const retrieved = getUserById(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
    });

    it("should retrieve user by address", () => {
      const address = `0x${Date.now().toString(16).padStart(40, "e")}` as Address;
      const created = createUser(address);
      const retrieved = getUserByAddress(address);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
    });
  });

  describe("updateUserStatus", () => {
    it("should update user status", () => {
      const address = `0x${Date.now().toString(16).padStart(40, "f")}` as Address;
      const user = createUser(address);

      const updated = updateUserStatus(user.id, "suspended");

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe("suspended");
    });
  });
});

describe("ERC-8004 Agent NFT", () => {
  describe("createAgentMetadata", () => {
    it("should create metadata with attributes", () => {
      const metadata = createAgentMetadata({
        name: "Test Agent",
        description: "A test agent",
        capabilities: ["chat", "code"],
        version: "1.0.0",
      });

      expect(metadata.name).toBe("Test Agent");
      expect(metadata.description).toBe("A test agent");
      expect(metadata.attributes.length).toBeGreaterThan(0);
      expect(metadata.attributes.some((a) => a.trait_type === "version")).toBe(true);
    });
  });

  describe("mintAgentNFT", () => {
    it("should mint a new agent NFT", async () => {
      const owner = `0x${Date.now().toString(16).padStart(40, "1")}` as Address;
      const agentId = `agent-${Date.now()}`;

      const metadata = createAgentMetadata({
        name: "Mint Test Agent",
        description: "Testing minting",
      });

      const nft = await mintAgentNFT({
        owner,
        agentId,
        metadata,
      });

      expect(nft.tokenId).toBeTruthy();
      expect(nft.owner.toLowerCase()).toBe(owner.toLowerCase());
      expect(nft.agentId).toBe(agentId);
      expect(nft.txHash).toBeTruthy();
    });

    it("should reject duplicate agent IDs", async () => {
      const owner = `0x${Date.now().toString(16).padStart(40, "2")}` as Address;
      const agentId = `agent-dup-${Date.now()}`;

      const metadata = createAgentMetadata({
        name: "Duplicate Test",
        description: "Testing duplicates",
      });

      await mintAgentNFT({ owner, agentId, metadata });

      await expect(mintAgentNFT({ owner, agentId, metadata })).rejects.toThrow(
        "already has an NFT",
      );
    });
  });

  describe("getNFTByAgentId / getNFTByTokenId", () => {
    it("should retrieve NFT by agent ID", async () => {
      const owner = `0x${Date.now().toString(16).padStart(40, "3")}` as Address;
      const agentId = `agent-get-${Date.now()}`;

      const metadata = createAgentMetadata({
        name: "Get Test Agent",
        description: "Testing retrieval",
      });

      const minted = await mintAgentNFT({ owner, agentId, metadata });
      const retrieved = getNFTByAgentId(agentId);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.tokenId).toBe(minted.tokenId);
    });

    it("should retrieve NFT by token ID", async () => {
      const owner = `0x${Date.now().toString(16).padStart(40, "4")}` as Address;
      const agentId = `agent-token-${Date.now()}`;

      const metadata = createAgentMetadata({
        name: "Token Test Agent",
        description: "Testing token retrieval",
      });

      const minted = await mintAgentNFT({ owner, agentId, metadata });
      const retrieved = getNFTByTokenId(minted.tokenId);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.agentId).toBe(agentId);
    });
  });

  describe("getNFTsByOwner", () => {
    it("should list NFTs by owner", async () => {
      const owner = `0x${Date.now().toString(16).padStart(40, "5")}` as Address;

      for (let i = 0; i < 3; i++) {
        await mintAgentNFT({
          owner,
          agentId: `agent-owner-${Date.now()}-${i}`,
          metadata: createAgentMetadata({ name: `Agent ${i}`, description: "Test" }),
        });
      }

      const nfts = getNFTsByOwner(owner);
      expect(nfts.length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe("ERC-8004 Reputation", () => {
  describe("recordInteraction", () => {
    it("should record interaction", async () => {
      const user = `0x${Date.now().toString(16).padStart(40, "6")}` as Address;
      const owner = `0x${Date.now().toString(16).padStart(40, "7")}` as Address;
      const agentId = `agent-interact-${Date.now()}`;

      await mintAgentNFT({
        owner,
        agentId,
        metadata: createAgentMetadata({ name: "Interact Agent", description: "Test" }),
      });

      const nft = getNFTByAgentId(agentId)!;

      await recordInteraction(user, nft.tokenId);

      const canFeedback = await canLeaveFeedback(user, nft.tokenId);
      expect(canFeedback).toBe(true);
    });
  });

  describe("submitFeedback", () => {
    it("should submit feedback after interaction", async () => {
      const user = `0x${Date.now().toString(16).padStart(40, "8")}` as Address;
      const owner = `0x${Date.now().toString(16).padStart(40, "9")}` as Address;
      const agentId = `agent-feedback-${Date.now()}`;

      await mintAgentNFT({
        owner,
        agentId,
        metadata: createAgentMetadata({ name: "Feedback Agent", description: "Test" }),
      });

      const nft = getNFTByAgentId(agentId)!;
      await recordInteraction(user, nft.tokenId);

      const record = await submitFeedback({
        agentTokenId: nft.tokenId,
        fromAddress: user,
        score: 5,
        comment: "Great agent!",
      });

      expect(record.score).toBe(5);
      expect(record.comment).toBe("Great agent!");
    });

    it("should reject feedback without interaction", async () => {
      const user = `0x${Date.now().toString(16).padStart(40, "a")}` as Address;
      const owner = `0x${Date.now().toString(16).padStart(40, "b")}` as Address;
      const agentId = `agent-no-interact-${Date.now()}`;

      await mintAgentNFT({
        owner,
        agentId,
        metadata: createAgentMetadata({ name: "No Interact Agent", description: "Test" }),
      });

      const nft = getNFTByAgentId(agentId)!;

      await expect(
        submitFeedback({
          agentTokenId: nft.tokenId,
          fromAddress: user,
          score: 5,
        }),
      ).rejects.toThrow("Must interact");
    });
  });

  describe("getAgentReputation", () => {
    it("should calculate reputation correctly", async () => {
      const owner = `0x${Date.now().toString(16).padStart(40, "c")}` as Address;
      const agentId = `agent-rep-${Date.now()}`;

      await mintAgentNFT({
        owner,
        agentId,
        metadata: createAgentMetadata({ name: "Rep Agent", description: "Test" }),
      });

      const nft = getNFTByAgentId(agentId)!;

      // Multiple users leave feedback
      for (let i = 0; i < 5; i++) {
        const user = `0x${(Date.now() + i).toString(16).padStart(40, "d")}` as Address;
        await recordInteraction(user, nft.tokenId);
        await submitFeedback({
          agentTokenId: nft.tokenId,
          fromAddress: user,
          score: i + 1, // 1, 2, 3, 4, 5
        });
      }

      const rep = getAgentReputation(nft.tokenId);

      expect(rep.reviewCount).toBe(5);
      expect(rep.totalScore).toBe(15); // 1+2+3+4+5
      expect(rep.averageScore).toBe(3); // 15/5
    });
  });
});
