import { rpc } from "@stellar/stellar-sdk";

export interface NetworkConfig {
  rpcUrl: string;
  networkPassphrase: string;
  escrowContractId: string;
  usdcTokenContractId: string;
}

/**
 * Read an environment variable from the runtime environment.
 * In Node, reads from process.env. In Vite/Next.js, reads from import.meta.env.
 * Falls back to the provided placeholder when neither is available.
 */
function readEnv(key: string, placeholder: string): string {
  if (typeof process !== "undefined" && typeof process.env === "object") {
    const val = (process.env as Record<string, string | undefined>)[key];
    if (val) return val;
  }
  return placeholder;
}

export function getNetworkConfig(): NetworkConfig {
  return {
    rpcUrl: readEnv(
      "NEXT_PUBLIC_SOROBAN_RPC_URL",
      "https://soroban-testnet.stellar.org",
    ),
    networkPassphrase: readEnv(
      "NEXT_PUBLIC_NETWORK_PASSPHRASE",
      "Test SDF Network ; September 2015",
    ),
    escrowContractId: readEnv(
      "NEXT_PUBLIC_ESCROW_CONTRACT_ID",
      "PLACEHOLDER_ESCROW_CONTRACT_ID",
    ),
    usdcTokenContractId: readEnv(
      "NEXT_PUBLIC_USDC_TOKEN_CONTRACT_ID",
      "PLACEHOLDER_USDC_CONTRACT_ID",
    ),
  };
}

export function getServer(): rpc.Server {
  const config = getNetworkConfig();
  return new rpc.Server(config.rpcUrl);
}
