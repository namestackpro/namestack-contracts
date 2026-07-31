"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getServer,
  getNetworkConfig,
  getEscrow,
  confirmReceipt,
  raiseDispute,
  connectWallet,
  signTransaction,
  getPublicKey as getSdkPublicKey,
  EscrowError,
} from "@namestack/sdk";
import type { EscrowData, EscrowStatus } from "@namestack/sdk";

interface EscrowWithId {
  id: bigint;
  data: EscrowData;
}

type ActionState = "loading" | "done" | "error";

const USDC_DECIMALS = 7;

function formatTokenAmount(amount: bigint, decimals: number): string {
  const scale = 10n ** BigInt(decimals);
  const whole = amount / scale;
  const fraction = (amount % scale).toString().padStart(decimals, "0");
  return `${whole.toString()}.${fraction}`;
}

function errorMessage(e: unknown): string {
  if (e instanceof EscrowError) {
    return `${e.message}${e.detail ? ` (${e.detail})` : ""}`;
  }
  return e instanceof Error ? e.message : "Unexpected error";
}

export default function EscrowsPage() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [escrowIdInput, setEscrowIdInput] = useState("");
  const [escrows, setEscrows] = useState<EscrowWithId[]>([]);
  const [actionStatus, setActionStatus] = useState<Record<string, ActionState>>({});
  const [errorMsg, setErrorMsg] = useState("");

  const connect = useCallback(async () => {
    setErrorMsg("");
    try {
      setPublicKey(await connectWallet());
    } catch (e) {
      setErrorMsg(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    getSdkPublicKey()
      .then((pk) => setPublicKey(pk))
      .catch(() => {});
  }, []);

  const handleLookup = useCallback(async () => {
    if (!escrowIdInput.trim()) return;
    setErrorMsg("");

    try {
      const server = getServer();
      const config = getNetworkConfig();
      const id = BigInt(escrowIdInput.trim());
      const data = await getEscrow(server, config.escrowContractId, id);
      setEscrows((prev) => {
        const exists = prev.find((e) => e.id === id);
        if (exists) return prev;
        return [...prev, { id, data }];
      });
      setEscrowIdInput("");
    } catch (e) {
      setErrorMsg(errorMessage(e));
    }
  }, [escrowIdInput]);

  const handleConfirm = useCallback(
    async (id: bigint) => {
      if (!publicKey) return;
      const key = `confirm-${id}`;
      setActionStatus((p) => ({ ...p, [key]: "loading" }));
      setErrorMsg("");
      try {
        const server = getServer();
        await confirmReceipt(server, publicKey, id, signTransaction);
        setActionStatus((p) => ({ ...p, [key]: "done" }));
        setEscrows((prev) =>
          prev.map((e) =>
            e.id === id ? { ...e, data: { ...e.data, status: "Released" as EscrowStatus } } : e,
          ),
        );
      } catch (e) {
        setActionStatus((p) => ({ ...p, [key]: "error" }));
        setErrorMsg(errorMessage(e));
      }
    },
    [publicKey],
  );

  const handleDispute = useCallback(
    async (id: bigint) => {
      if (!publicKey) return;
      const key = `dispute-${id}`;
      setActionStatus((p) => ({ ...p, [key]: "loading" }));
      setErrorMsg("");
      try {
        const server = getServer();
        await raiseDispute(server, publicKey, id, signTransaction);
        setActionStatus((p) => ({ ...p, [key]: "done" }));
        setEscrows((prev) =>
          prev.map((e) =>
            e.id === id ? { ...e, data: { ...e.data, status: "Disputed" as EscrowStatus } } : e,
          ),
        );
      } catch (e) {
        setActionStatus((p) => ({ ...p, [key]: "error" }));
        setErrorMsg(errorMessage(e));
      }
    },
    [publicKey],
  );

  const statusBadge = (s: EscrowStatus) => {
    const colors: Record<EscrowStatus, string> = {
      Funded: "#0066cc",
      Disputed: "#cc6600",
      Released: "#00a86b",
      Refunded: "#888",
    };
    return (
      <span
        style={{
          display: "inline-block",
          padding: "0.125rem 0.5rem",
          borderRadius: 4,
          background: colors[s],
          color: "#fff",
          fontSize: "0.75rem",
          fontWeight: 600,
        }}
      >
        {s}
      </span>
    );
  };

  return (
    <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1>My Escrows</h1>

      {!publicKey ? (
        <div style={{ marginTop: "1rem" }}>
          <p>Connect your wallet to view and manage escrows.</p>
          <button
            onClick={connect}
            style={{
              padding: "0.5rem 1rem",
              background: "#0066cc",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              marginTop: "0.5rem",
            }}
          >
            Connect Wallet
          </button>
        </div>
      ) : (
        <>
          <p style={{ color: "#666", fontSize: "0.875rem" }}>
            Connected: {publicKey.slice(0, 8)}...
          </p>

          <div
            style={{
              marginTop: "1rem",
              display: "flex",
              gap: "0.5rem",
              alignItems: "flex-end",
            }}
          >
            <div>
              <label
                htmlFor="escrowId"
                style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.25rem" }}
              >
                Look up escrow by ID
              </label>
              <input
                id="escrowId"
                type="text"
                value={escrowIdInput}
                onChange={(e) => setEscrowIdInput(e.target.value)}
                placeholder="e.g. 42"
                style={{
                  padding: "0.375rem 0.5rem",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  fontSize: "0.875rem",
                }}
              />
            </div>
            <button
              onClick={handleLookup}
              disabled={!escrowIdInput.trim()}
              style={{
                padding: "0.375rem 0.75rem",
                background: "#0066cc",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Look up
            </button>
          </div>

          {errorMsg && (
            <p style={{ color: "red", fontSize: "0.875rem", marginTop: "0.5rem" }}>{errorMsg}</p>
          )}

          <section style={{ marginTop: "1.5rem" }}>
            {escrows.length === 0 ? (
              <p style={{ color: "#888", fontSize: "0.875rem" }}>
                No escrows loaded. Enter an escrow ID above to look one up.
              </p>
            ) : (
              escrows.map((escrow) => {
                const confirmKey = `confirm-${escrow.id}`;
                const disputeKey = `dispute-${escrow.id}`;
                const confirmState = actionStatus[confirmKey];
                const disputeState = actionStatus[disputeKey];
                const isBuyer = publicKey === escrow.data.buyer;
                const isSeller = publicKey === escrow.data.seller;
                const isMyEscrow = isBuyer || isSeller;

                return (
                  <div
                    key={escrow.id.toString()}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      padding: "1rem",
                      marginBottom: "0.75rem",
                      background: "#fff",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong>Escrow #{escrow.id.toString()}</strong>
                      {statusBadge(escrow.data.status)}
                    </div>
                    <div style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#555" }}>
                      <div>Domain: {escrow.data.domainRef}</div>
                      <div>Buyer: {escrow.data.buyer.slice(0, 8)}...</div>
                      <div>Seller: {escrow.data.seller.slice(0, 8)}...</div>
                      <div>
                        Amount: {formatTokenAmount(escrow.data.amount, USDC_DECIMALS)} USDC
                      </div>
                      {isMyEscrow && (
                        <div style={{ color: "#333", marginTop: "0.25rem" }}>
                          {isBuyer ? "You are the buyer" : "You are the seller"}
                        </div>
                      )}
                    </div>
                    {isMyEscrow && escrow.data.status === "Funded" && (
                      <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                        {isBuyer && (
                          <button
                            onClick={() => handleConfirm(escrow.id)}
                            disabled={confirmState === "loading"}
                            style={{
                              padding: "0.375rem 0.75rem",
                              background: "#00a86b",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              cursor: "pointer",
                              fontSize: "0.875rem",
                            }}
                          >
                            {confirmState === "loading" ? "Confirming..." : "Confirm Receipt"}
                          </button>
                        )}
                        <button
                          onClick={() => handleDispute(escrow.id)}
                          disabled={disputeState === "loading"}
                          style={{
                            padding: "0.375rem 0.75rem",
                            background: "#cc6600",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: "0.875rem",
                          }}
                        >
                          {disputeState === "loading" ? "Raising..." : "Raise Dispute"}
                        </button>
                        {confirmState === "done" && (
                          <span style={{ color: "green", fontSize: "0.875rem" }}>Confirmed!</span>
                        )}
                        {disputeState === "done" && (
                          <span style={{ color: "green", fontSize: "0.875rem" }}>
                            Dispute raised!
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </section>
        </>
      )}

      <Link
        href="/"
        style={{ display: "inline-block", marginTop: "1rem", color: "#666", fontSize: "0.875rem" }}
      >
        &larr; Back home
      </Link>
    </main>
  );
}
