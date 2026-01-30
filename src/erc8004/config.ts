/**
 * ERC-8004 Configuration
 */

import type { Address, ChainId, ContractAddresses, ERC8004Config } from "./types.js";

/** Default contract addresses for Sepolia testnet */
const SEPOLIA_CONTRACTS: ContractAddresses = {
  // These will be updated after deployment
  agentNFT: "0x0000000000000000000000000000000000000000" as Address,
  agentToken: "0x0000000000000000000000000000000000000000" as Address,
  reputation: "0x0000000000000000000000000000000000000000" as Address,
};

/** Default RPC URLs */
const DEFAULT_RPC_URLS: Record<ChainId, string> = {
  1: "https://eth.llamarpc.com",
  11155111: "https://rpc.sepolia.org",
};

/** Environment variable names */
const ENV_VARS = {
  ENABLED: "OPENCLAW_ERC8004_ENABLED",
  CHAIN_ID: "OPENCLAW_ERC8004_CHAIN_ID",
  RPC_URL: "OPENCLAW_ERC8004_RPC_URL",
  AGENT_NFT_ADDRESS: "OPENCLAW_ERC8004_AGENT_NFT",
  AGENT_TOKEN_ADDRESS: "OPENCLAW_ERC8004_AGENT_TOKEN",
  REPUTATION_ADDRESS: "OPENCLAW_ERC8004_REPUTATION",
  SERVER_PRIVATE_KEY: "OPENCLAW_ERC8004_SERVER_KEY",
} as const;

/**
 * Load ERC-8004 configuration from environment variables
 */
export function loadERC8004Config(): ERC8004Config {
  const enabled = process.env[ENV_VARS.ENABLED] === "true";
  const chainIdStr = process.env[ENV_VARS.CHAIN_ID] || "11155111";
  const chainId = parseInt(chainIdStr, 10) as ChainId;

  // Validate chain ID
  if (chainId !== 1 && chainId !== 11155111) {
    throw new Error(`Unsupported chain ID: ${chainId}. Use 1 (mainnet) or 11155111 (sepolia)`);
  }

  const rpcUrl = process.env[ENV_VARS.RPC_URL] || DEFAULT_RPC_URLS[chainId];

  // Load contract addresses from env or use defaults for Sepolia
  const contracts: ContractAddresses =
    chainId === 11155111
      ? {
          agentNFT:
            (process.env[ENV_VARS.AGENT_NFT_ADDRESS] as Address) || SEPOLIA_CONTRACTS.agentNFT,
          agentToken:
            (process.env[ENV_VARS.AGENT_TOKEN_ADDRESS] as Address) || SEPOLIA_CONTRACTS.agentToken,
          reputation:
            (process.env[ENV_VARS.REPUTATION_ADDRESS] as Address) || SEPOLIA_CONTRACTS.reputation,
        }
      : {
          agentNFT: process.env[ENV_VARS.AGENT_NFT_ADDRESS] as Address,
          agentToken: process.env[ENV_VARS.AGENT_TOKEN_ADDRESS] as Address,
          reputation: process.env[ENV_VARS.REPUTATION_ADDRESS] as Address,
        };

  return {
    enabled,
    chainId,
    rpcUrl,
    contracts,
    serverPrivateKey: process.env[ENV_VARS.SERVER_PRIVATE_KEY],
  };
}

/**
 * Validate ERC-8004 configuration
 */
export function validateERC8004Config(config: ERC8004Config): string[] {
  const errors: string[] = [];

  if (!config.enabled) {
    return errors; // No validation needed if disabled
  }

  if (!config.rpcUrl) {
    errors.push("RPC URL is required");
  }

  const zeroAddress = "0x0000000000000000000000000000000000000000";
  if (config.contracts.agentNFT === zeroAddress) {
    errors.push("Agent NFT contract address is not configured");
  }
  if (config.contracts.agentToken === zeroAddress) {
    errors.push("Agent Token contract address is not configured");
  }
  if (config.contracts.reputation === zeroAddress) {
    errors.push("Reputation contract address is not configured");
  }

  return errors;
}

/**
 * Get chain name from chain ID
 */
export function getChainName(chainId: ChainId): string {
  switch (chainId) {
    case 1:
      return "Ethereum Mainnet";
    case 11155111:
      return "Sepolia Testnet";
    default:
      return `Unknown (${chainId})`;
  }
}
