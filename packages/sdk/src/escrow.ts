import {
  Account,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  rpc,
  xdr,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import { getNetworkConfig } from "./client";

// ── Types ─────────────────────────────────────────────────────

export type EscrowStatus = "Funded" | "Disputed" | "Released" | "Refunded";

export interface EscrowData {
  buyer: string;
  seller: string;
  token: string;
  amount: bigint;
  domainRef: string;
  status: EscrowStatus;
  createdLedger: number;
}

// ── Errors ────────────────────────────────────────────────────

export class EscrowError extends Error {
  constructor(
    public readonly phase: "simulate" | "submit" | "confirm",
    message: string,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = "EscrowError";
  }
}

const CONTRACT_ERROR_VARIANTS: Readonly<Record<number, string>> = {
  1: "NotInitialized",
  2: "AlreadyInitialized",
  3: "EscrowNotFound",
  4: "InvalidStatus",
  5: "Unauthorized",
  6: "InvalidReleaseTarget",
  7: "Overflow",
};

// ── Amount conversion ─────────────────────────────────────────

function pow10(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

/**
 * Convert a decimal token amount (e.g. "100.00") to the token's smallest
 * unit as a bigint. The source value must be a plain decimal string so no
 * precision is lost in JS number math.
 */
export function toTokenAmount(amount: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(amount)) {
    throw new Error(`Invalid token amount: "${amount}"`);
  }
  if (decimals < 0) {
    throw new Error(`Invalid token decimals: ${decimals}`);
  }
  const [intPart, fracPart = ""] = amount.split(".");
  const frac = fracPart.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(intPart) * pow10(decimals) + BigInt(frac || "0");
}

// ── On-chain error decoding ───────────────────────────────────

function contractErrorVariant(
  events: xdr.DiagnosticEvent[] | undefined,
): string | undefined {
  if (!events) return undefined;
  for (const diagnostic of events) {
    const event = diagnostic.event();
    if (event.body().switch() !== 0) continue;
    const v0 = event.body().v0();
    const firstTopic = v0.topics()[0];
    if (!firstTopic || firstTopic.switch() !== xdr.ScValType.scvSymbol()) {
      continue;
    }
    if (firstTopic.sym().toString() !== "error") continue;
    const data = v0.data();
    if (data.switch() !== xdr.ScValType.scvError()) continue;
    const error = data.error();
    if (error.switch() !== xdr.ScErrorType.sceContract()) continue;
    const code = error.contractCode();
    return CONTRACT_ERROR_VARIANTS[code] ?? `ContractError(${code})`;
  }
  return undefined;
}

// ── Transaction pipeline ──────────────────────────────────────

const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 30;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollTransaction(
  server: rpc.Server,
  hash: string,
): Promise<rpc.Api.GetSuccessfulTransactionResponse> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const result = await server.getTransaction(hash);
    if (result.status === "NOT_FOUND") {
      await delay(POLL_INTERVAL_MS);
      continue;
    }
    if (result.status === "FAILED") {
      const variant = contractErrorVariant(result.diagnosticEventsXdr);
      throw new EscrowError(
        "confirm",
        variant !== undefined
          ? `Transaction failed on-chain: ${variant}`
          : "Transaction failed on-chain",
        result.resultXdr.toXDR("base64"),
      );
    }
    return result;
  }
  throw new EscrowError(
    "confirm",
    "Timed out waiting for transaction confirmation",
    hash,
  );
}

async function buildAndSendTx(
  server: rpc.Server,
  contractId: string,
  sourcePublicKey: string,
  method: string,
  params: xdr.ScVal[],
  signTransaction: (xdr: string) => Promise<string>,
  networkPassphrase: string,
): Promise<rpc.Api.GetSuccessfulTransactionResponse> {
  const contract = new Contract(contractId);

  let account: Account;
  try {
    account = await server.getAccount(sourcePublicKey);
  } catch (e) {
    throw new EscrowError("simulate", "Failed to load source account", String(e));
  }

  let preparedTx;
  try {
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(contract.call(method, ...params))
      .setTimeout(30)
      .build();
    preparedTx = await server.prepareTransaction(tx);
  } catch (e) {
    throw new EscrowError("simulate", "Transaction simulation failed", String(e));
  }

  let signedXdr: string;
  try {
    signedXdr = await signTransaction(preparedTx.toXDR());
  } catch (e) {
    throw new EscrowError("submit", "User rejected signing", String(e));
  }

  let sendResponse: rpc.Api.SendTransactionResponse;
  try {
    const signedTx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
    sendResponse = await server.sendTransaction(signedTx);
  } catch (e) {
    throw new EscrowError("submit", "Failed to submit transaction", String(e));
  }

  if (sendResponse.status === "PENDING" || sendResponse.status === "DUPLICATE") {
    return pollTransaction(server, sendResponse.hash);
  }

  throw new EscrowError(
    "submit",
    `Transaction submission rejected: ${sendResponse.status}`,
    sendResponse.errorResult?.toXDR("base64"),
  );
}

// ── Contract functions ────────────────────────────────────────

export async function createEscrow(
  server: rpc.Server,
  buyerPublicKey: string,
  sellerAddress: string,
  tokenAddress: string,
  amount: bigint,
  domainRef: string,
  signTransaction: (xdr: string) => Promise<string>,
): Promise<bigint> {
  const config = getNetworkConfig();
  const result = await buildAndSendTx(
    server,
    config.escrowContractId,
    buyerPublicKey,
    "create_escrow",
    [
      nativeToScVal(buyerPublicKey, { type: "address" }),
      nativeToScVal(sellerAddress, { type: "address" }),
      nativeToScVal(tokenAddress, { type: "address" }),
      nativeToScVal(amount, { type: "i128" }),
      nativeToScVal(domainRef, { type: "string" }),
    ],
    signTransaction,
    config.networkPassphrase,
  );

  if (!result.returnValue) {
    throw new EscrowError("confirm", "No return value from create_escrow");
  }
  const value = scValToNative(result.returnValue);
  return typeof value === "bigint" ? value : BigInt(value as number);
}

export async function confirmReceipt(
  server: rpc.Server,
  buyerPublicKey: string,
  escrowId: bigint,
  signTransaction: (xdr: string) => Promise<string>,
): Promise<void> {
  const config = getNetworkConfig();
  await buildAndSendTx(
    server,
    config.escrowContractId,
    buyerPublicKey,
    "confirm_receipt",
    [nativeToScVal(escrowId, { type: "u64" })],
    signTransaction,
    config.networkPassphrase,
  );
}

export async function raiseDispute(
  server: rpc.Server,
  callerPublicKey: string,
  escrowId: bigint,
  signTransaction: (xdr: string) => Promise<string>,
): Promise<void> {
  const config = getNetworkConfig();
  await buildAndSendTx(
    server,
    config.escrowContractId,
    callerPublicKey,
    "raise_dispute",
    [
      nativeToScVal(escrowId, { type: "u64" }),
      nativeToScVal(callerPublicKey, { type: "address" }),
    ],
    signTransaction,
    config.networkPassphrase,
  );
}

export async function resolveDispute(
  server: rpc.Server,
  arbitratorPublicKey: string,
  escrowId: bigint,
  releaseTo: string,
  signTransaction: (xdr: string) => Promise<string>,
): Promise<void> {
  const config = getNetworkConfig();
  await buildAndSendTx(
    server,
    config.escrowContractId,
    arbitratorPublicKey,
    "resolve_dispute",
    [
      nativeToScVal(escrowId, { type: "u64" }),
      nativeToScVal(releaseTo, { type: "address" }),
    ],
    signTransaction,
    config.networkPassphrase,
  );
}
