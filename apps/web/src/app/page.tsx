import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1>NameStack</h1>
      <p>Decentralized domain name escrow on Stellar.</p>
      <nav style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
        <Link href="/marketplace">Marketplace</Link>
        <Link href="/dashboard/escrows">My Escrows</Link>
      </nav>
    </main>
  );
}
