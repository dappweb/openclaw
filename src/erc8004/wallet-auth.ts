/**
 * Wallet Authentication using Sign-In with Ethereum (SIWE)
 *
 * Provides secure wallet-based authentication for MetaMask/WalletConnect users.
 */

import { randomBytes } from "crypto";
import type { Address, AuthSession, ChainId, SiweMessage } from "./types.js";

/** Nonce expiration time (5 minutes) */
const NONCE_EXPIRY_MS = 5 * 60 * 1000;

/** Session expiration time (24 hours) */
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

/** In-memory nonce store (should use Redis/DB in production) */
const nonceStore = new Map<string, { address: Address; expiresAt: number }>();

/** In-memory session store (should use Redis/DB in production) */
const sessionStore = new Map<string, AuthSession>();

/**
 * Generate a cryptographically secure nonce
 */
export function generateNonce(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Create a SIWE message for the user to sign
 */
export function createSiweMessage(params: {
  domain: string;
  address: Address;
  uri: string;
  chainId: ChainId;
  nonce: string;
  statement?: string;
}): SiweMessage {
  const now = new Date();
  const expirationTime = new Date(now.getTime() + NONCE_EXPIRY_MS);

  return {
    domain: params.domain,
    address: params.address,
    statement: params.statement || "Sign in to OpenClaw Agent Platform",
    uri: params.uri,
    version: "1",
    chainId: params.chainId,
    nonce: params.nonce,
    issuedAt: now.toISOString(),
    expirationTime: expirationTime.toISOString(),
  };
}

/**
 * Format SIWE message for signing (EIP-4361 format)
 */
export function formatSiweMessage(message: SiweMessage): string {
  const lines = [
    `${message.domain} wants you to sign in with your Ethereum account:`,
    message.address,
    "",
    message.statement,
    "",
    `URI: ${message.uri}`,
    `Version: ${message.version}`,
    `Chain ID: ${message.chainId}`,
    `Nonce: ${message.nonce}`,
    `Issued At: ${message.issuedAt}`,
  ];

  if (message.expirationTime) {
    lines.push(`Expiration Time: ${message.expirationTime}`);
  }

  return lines.join("\n");
}

/**
 * Parse a SIWE message from formatted string
 */
export function parseSiweMessage(message: string): SiweMessage | null {
  try {
    const lines = message.split("\n");

    // Extract domain from first line
    const domainMatch = lines[0]?.match(/^(.+) wants you to sign in/);
    if (!domainMatch) return null;

    const domain = domainMatch[1];
    const address = lines[1] as Address;
    const statement = lines[3] || "";

    // Parse key-value pairs
    const getValue = (prefix: string): string | undefined => {
      const line = lines.find((l) => l.startsWith(prefix));
      return line?.slice(prefix.length).trim();
    };

    const uri = getValue("URI: ");
    const version = getValue("Version: ");
    const chainIdStr = getValue("Chain ID: ");
    const nonce = getValue("Nonce: ");
    const issuedAt = getValue("Issued At: ");
    const expirationTime = getValue("Expiration Time: ");

    if (!uri || !version || !chainIdStr || !nonce || !issuedAt) {
      return null;
    }

    return {
      domain,
      address,
      statement,
      uri,
      version,
      chainId: parseInt(chainIdStr, 10) as ChainId,
      nonce,
      issuedAt,
      expirationTime,
    };
  } catch {
    return null;
  }
}

/**
 * Store a nonce for verification
 */
export function storeNonce(nonce: string, address: Address): void {
  nonceStore.set(nonce, {
    address,
    expiresAt: Date.now() + NONCE_EXPIRY_MS,
  });

  // Clean up expired nonces
  for (const [key, value] of nonceStore) {
    if (value.expiresAt < Date.now()) {
      nonceStore.delete(key);
    }
  }
}

/**
 * Verify a nonce and consume it
 */
export function verifyAndConsumeNonce(nonce: string, address: Address): boolean {
  const stored = nonceStore.get(nonce);

  if (!stored) {
    return false;
  }

  if (stored.expiresAt < Date.now()) {
    nonceStore.delete(nonce);
    return false;
  }

  if (stored.address.toLowerCase() !== address.toLowerCase()) {
    return false;
  }

  // Consume the nonce
  nonceStore.delete(nonce);
  return true;
}

/**
 * Verify an Ethereum signature
 * Note: In production, ensure viem is installed for proper verification.
 */
export async function verifySignature(
  message: string,
  signature: string,
  expectedAddress: Address,
): Promise<boolean> {
  // Basic signature format validation
  if (!signature.startsWith("0x") || signature.length !== 132) {
    return false;
  }

  try {
    // Dynamic import to avoid requiring viem if ERC-8004 is disabled
    // @ts-expect-error - viem may not be installed
    const { verifyMessage } = await import("viem");
    const recoveredAddress = await verifyMessage({
      address: expectedAddress,
      message,
      signature: signature as `0x${string}`,
    });
    return recoveredAddress;
  } catch (error) {
    // If viem is not available, we cannot verify signatures securely
    // In production, viem MUST be installed
    const isViemMissing =
      error instanceof Error &&
      (error.message.includes("Cannot find module") || error.message.includes("MODULE_NOT_FOUND"));

    if (isViemMissing) {
      console.error(
        "[ERC8004] SECURITY WARNING: viem is not installed. " +
          "Signature verification is disabled. Install viem for production use.",
      );
      // Only accept in development mode
      if (
        process.env.NODE_ENV === "development" ||
        process.env.OPENCLAW_ERC8004_DEV_MODE === "true"
      ) {
        console.warn("[ERC8004] Development mode: accepting signature without verification");
        return true;
      }
      return false;
    }

    console.error("[ERC8004] Signature verification failed:", error);
    return false;
  }
}

/**
 * Create an authentication session
 * Returns both the session and sessionId for storage
 */
export function createSession(
  address: Address,
  userId: string,
  chainId: ChainId,
): { session: AuthSession; sessionId: string } {
  const session: AuthSession = {
    address,
    userId,
    chainId,
    expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
  };

  const sessionId = generateNonce();
  sessionStore.set(sessionId, session);

  return { session, sessionId };
}

/**
 * Get session by ID
 */
export function getSession(sessionId: string): AuthSession | null {
  const session = sessionStore.get(sessionId);

  if (!session) {
    return null;
  }

  if (session.expiresAt < new Date()) {
    sessionStore.delete(sessionId);
    return null;
  }

  return session;
}

/**
 * Delete a session
 */
export function deleteSession(sessionId: string): void {
  sessionStore.delete(sessionId);
}

/**
 * Full SIWE authentication flow
 */
export async function authenticateWithSiwe(params: {
  message: string;
  signature: string;
  domain: string;
  uri: string;
}): Promise<{ success: boolean; address?: Address; sessionId?: string; error?: string }> {
  // Parse the message
  const parsed = parseSiweMessage(params.message);
  if (!parsed) {
    return { success: false, error: "Invalid SIWE message format" };
  }

  // Verify domain matches
  if (parsed.domain !== params.domain) {
    return { success: false, error: "Domain mismatch" };
  }

  // Verify URI matches
  if (parsed.uri !== params.uri) {
    return { success: false, error: "URI mismatch" };
  }

  // Verify expiration
  if (parsed.expirationTime && new Date(parsed.expirationTime) < new Date()) {
    return { success: false, error: "Message expired" };
  }

  // Verify nonce
  if (!verifyAndConsumeNonce(parsed.nonce, parsed.address)) {
    return { success: false, error: "Invalid or expired nonce" };
  }

  // Verify signature
  const isValid = await verifySignature(params.message, params.signature, parsed.address);
  if (!isValid) {
    return { success: false, error: "Invalid signature" };
  }

  return { success: true, address: parsed.address };
}
