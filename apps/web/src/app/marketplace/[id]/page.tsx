"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getServer,
  getNetworkConfig,
  createEscrow as sdkCreateEscrow,
  connectWallet,
  getPublicKey,
  signTransaction,
  toTokenAmount,
  EscrowError,
} from "@namestack/sdk";

interface ListingDetail {
  id: string;
  domain: string;
  price: number;
  seller: string;
  description: string;
}

const MOCK_DETAILS: Record<string, ListingDetail> = {
  "1": {
    id: "1",
    domain: "example.stellar",
    price: 100,
    seller: "GA...XXXX",
    description: "Premium domain name for your Stellar project.",
  },
  "2": {
    id: "2",
    domain: "mydomain.stellar",
    price: 250,
    seller: "GA...YYYY",
    description: "Short and memorable domain.",
  },
  "3": {
    id: "3",
    domain: "namestack.stellar",
    price: 500,
    seller: "GA...ZZZZ",
    description: "Brandable domain for your next big idea.",
  },
};

const USDC_DECIMALS = 7;

type BuyStatus = "idle" | "connecting" | "signing" | "done" | "error";

export default function ListingPage() {
  const params = useParams();
  const id = params.id as string;
  const listing = MOCK_DETAILS[id];

  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [status, setStatus] = useState<BuyStatus>("idle");
  const [escrowId, setEscrowId] = useState<bigint | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (publicKey) return;
    setStatus("connecting");
    getPublicKey()
      .then((pk) => {
        setPublicKey(pk);
        setStatus("idle");
      })
      .catch(() => setStatus("idle"));
  }, [publicKey]);

  const handleConnect = useCallback(async () => {
    setStatus("connecting");
    setErrorMsg("");
    try {
      const pk = await connectWallet();
      setPublicKey(pk);
      setStatus("idle");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Failed to connect Freighter wallet");
    }
  }, []);

  const handleBuy = useCallback(async () => {
    if (!publicKey || !listing) return;
    setStatus("signing");
    setErrorMsg("");

    try {
      const server = getServer();
      const config = getNetworkConfig();
      const amount = toTokenAmount(String(listing.price), USDC_DECIMALS);

      const id = await sdkCreateEscrow(
        server,
        publicKey,
        listing.seller,
        config.usdcTokenContractId,
        amount,
        listing.domain,
        signTransaction,
      );

      setEscrowId(id);
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setErrorMsg(
        e instanceof EscrowError
          ? `${e.message}${e.detail ? ` (${e.detail})` : ""}`
          : e instanceof Error
            ? e.message
            : "Transaction failed",
      );
    }
  }, [publicKey, listing]);

  if (!listing) {
    return (
      <main style={{ padding: "2rem", maxWidth: 600, margin: "0 auto" }}>
        <h1>Listing not found</h1>
        <Link href="/marketplace">&larr; Back to marketplace</Link>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 600, margin: "0 auto" }}>
      <Link href="/marketplace" style={{ color: "#666", fontSize: "0.875rem" }}>
        &larr; Back to marketplace
      </Link>

      <div
        style={{
          marginTop: "1rem",
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: "1.5rem",
          background: "#fff",
        }}
      >
        <h1>{listing.domain}</h1>
        <p style={{ color: "#555", marginTop: "0.5rem" }}>{listing.description}</p>

        <div style={{ marginTop: "1rem" }}>
          <strong>Seller:</strong> {listing.seller}
        </div>
        <div style={{ marginTop: "0.25rem" }}>
          <strong>Price:</strong> ${listing.price.toFixed(2)}
        </div>

        <div style={{ marginTop: "1.5rem" }}>
          {!publicKey ? (
            <button
              onClick={handleConnect}
              disabled={status === "connecting"}
              style={{
                padding: "0.5rem 1rem",
                background: "#0066cc",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              {status === "connecting" ? "Connecting..." : "Connect Wallet"}
            </button>
          ) : status === "done" ? (
            <div>
              <p style={{ color: "green" }}>
                Escrow created successfully! ID: {escrowId?.toString()}
              </p>
              <Link
                href="/dashboard/escrows"
                style={{
                  display: "inline-block",
                  marginTop: "0.5rem",
                  padding: "0.5rem 1rem",
                  background: "#0066cc",
                  color: "#fff",
                  borderRadius: 6,
                  textDecoration: "none",
                }}
              >
                View My Escrows
              </Link>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: "0.875rem", color: "#666" }}>
                Connected as {publicKey.slice(0, 8)}...
              </p>
              <button
                onClick={handleBuy}
                disabled={status === "signing"}
                style={{
                  marginTop: "0.5rem",
                  padding: "0.5rem 1rem",
                  background: "#00a86b",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: "1rem",
                }}
              >
                {status === "signing" ? "Processing..." : `Buy $${listing.price.toFixed(2)}`}
              </button>
              {status === "error" && (
                <p style={{ color: "red", marginTop: "0.5rem", fontSize: "0.875rem" }}>
                  {errorMsg}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
