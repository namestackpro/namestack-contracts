import {
  isConnected,
  getPublicKey as freighterGetPublicKey,
  signTransaction as freighterSignTransaction,
} from "@stellar/freighter-api";
import { getNetworkConfig } from "./client";

export async function connectWallet(): Promise<string> {
  const connected = await isConnected();
  if (!connected) {
    throw new Error("Freighter is not installed or not connected");
  }
  return freighterGetPublicKey();
}

export async function getPublicKey(): Promise<string> {
  return freighterGetPublicKey();
}

export async function signTransaction(xdr: string): Promise<string> {
  const config = getNetworkConfig();
  return freighterSignTransaction(xdr, {
    networkPassphrase: config.networkPassphrase,
  });
}
