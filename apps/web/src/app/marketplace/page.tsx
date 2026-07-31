"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { connectWallet, getPublicKey } from "@namestack/sdk";

interface DomainListing {
  id: string;
  domain: string;
  price: number;
  seller: string;
}

const INITIAL_LISTINGS: DomainListing[] = [
  { id: "1", domain: "example.stellar", price: 100, seller: "GA...XXXX" },
  { id: "2", domain: "mydomain.stellar", price: 250, seller: "GA...YYYY" },
  { id: "3", domain: "namestack.stellar", price: 500, seller: "GA...ZZZZ" },
];

const PRICE_PATTERN = /^\d+(\.\d+)?$/;

export default function MarketplacePage() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [listings, setListings] = useState<DomainListing[]>(INITIAL_LISTINGS);
  const [domain, setDomain] = useState("");
  const [price, setPrice] = useState("");
  const [formError, setFormError] = useState("");
  const [connectError, setConnectError] = useState("");

  useEffect(() => {
    getPublicKey()
      .then((pk) => setPublicKey(pk))
      .catch(() => setPublicKey(null));
  }, []);

  const handleConnect = useCallback(async () => {
    setConnectError("");
    try {
      setPublicKey(await connectWallet());
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : "Failed to connect Freighter");
    }
  }, []);

  const handleListDomain = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFormError("");

      const trimmedDomain = domain.trim();
      const trimmedPrice = price.trim();
      if (!trimmedDomain) {
        setFormError("Enter a domain name");
        return;
      }
      if (!PRICE_PATTERN.test(trimmedPrice)) {
        setFormError("Enter a valid price");
        return;
      }

      const newListing: DomainListing = {
        id: String(listings.length + 1),
        domain: trimmedDomain,
        price: Number(trimmedPrice),
        seller: publicKey ?? "GA...XXXX",
      };
      setListings((prev) => [newListing, ...prev]);
      setDomain("");
      setPrice("");
    },
    [domain, price, listings.length, publicKey],
  );

  return (
    <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1>Marketplace</h1>
      <p>Browse domain names available for purchase.</p>

      {publicKey ? (
        <p style={{ color: "green", fontSize: "0.875rem" }}>
          Connected: {publicKey.slice(0, 8)}...
        </p>
      ) : (
        <div>
          <p style={{ color: "#888", fontSize: "0.875rem" }}>
            Connect Freighter to buy or list domains
          </p>
          <button
            onClick={handleConnect}
            style={{
              marginTop: "0.5rem",
              padding: "0.375rem 0.75rem",
              background: "#0066cc",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Connect Wallet
          </button>
          {connectError && (
            <p style={{ color: "red", fontSize: "0.875rem", marginTop: "0.5rem" }}>
              {connectError}
            </p>
          )}
        </div>
      )}

      <section
        style={{
          marginTop: "1.5rem",
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: "1rem",
          background: "#fff",
        }}
      >
        <h2 style={{ fontSize: "1.125rem" }}>List a Domain for Sale</h2>
        <form
          onSubmit={handleListDomain}
          style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
        >
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="yourdomain.stellar"
            aria-label="Domain name"
            style={{
              padding: "0.375rem 0.5rem",
              borderRadius: 6,
              border: "1px solid #ccc",
              fontSize: "0.875rem",
              flex: "1 1 220px",
            }}
          />
          <input
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price in USDC"
            aria-label="Price"
            style={{
              padding: "0.375rem 0.5rem",
              borderRadius: 6,
              border: "1px solid #ccc",
              fontSize: "0.875rem",
              width: 140,
            }}
          />
          <button
            type="submit"
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
            List for Sale
          </button>
        </form>
        {formError && (
          <p style={{ color: "red", fontSize: "0.875rem", marginTop: "0.5rem" }}>{formError}</p>
        )}
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        {listings.map((l) => (
          <div
            key={l.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: "1rem",
              marginBottom: "0.75rem",
              background: "#fff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong style={{ fontSize: "1.125rem" }}>{l.domain}</strong>
                <br />
                <span style={{ color: "#666", fontSize: "0.875rem" }}>
                  Seller: {l.seller}
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                  ${l.price.toFixed(2)}
                </div>
                <Link
                  href={`/marketplace/${l.id}`}
                  style={{
                    display: "inline-block",
                    marginTop: "0.25rem",
                    padding: "0.375rem 0.75rem",
                    background: "#0066cc",
                    color: "#fff",
                    borderRadius: 6,
                    textDecoration: "none",
                    fontSize: "0.875rem",
                  }}
                >
                  Buy
                </Link>
              </div>
            </div>
          </div>
        ))}
      </section>

      <Link href="/" style={{ display: "inline-block", marginTop: "1rem", color: "#666" }}>
        &larr; Back home
      </Link>
    </main>
  );
}
