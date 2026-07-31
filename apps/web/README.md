# NameStack Web

Next.js dashboard for the NameStack domain-escrow marketplace on Stellar/Soroban. It connects to the
Freighter wallet and drives the deployed `EscrowContract` through the `@namestack/sdk` package.

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in the values:

| Variable | Purpose | Current value |
|---|---|---|
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Soroban RPC endpoint | `https://soroban-testnet.stellar.org` (testnet) |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | Network passphrase | `Test SDF Network ; September 2015` (testnet) |
| `NEXT_PUBLIC_ESCROW_CONTRACT_ID` | Escrow contract address | `PLACEHOLDER_ESCROW_CONTRACT_ID` — replace once the escrow contract is deployed |
| `NEXT_PUBLIC_USDC_TOKEN_CONTRACT_ID` | USDC SAC token contract address | `PLACEHOLDER_USDC_CONTRACT_ID` — must match the value used in the contracts repo |

The two contract-ID placeholders are intentionally not real addresses. The app builds and runs with
them, but on-chain calls (creating an escrow, looking one up, confirming receipt, raising a dispute)
fail at runtime until the placeholders are replaced with the deployed addresses after the Phase 8
contract deployment.

> Mainnet: confirm the production Soroban RPC URL and network passphrase before any production
> deploy — do not assume the testnet values carry over.

`NEXT_PUBLIC_*` variables are inlined by Next.js at build time, so they must be present in
`.env.local` (or the environment) before running `pnpm build` / `pnpm dev`.

## Running

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000, connect Freighter on testnet, then browse `/marketplace` to buy domains
or `/dashboard/escrows` to manage escrows.

## Worker environment

The Cloudflare Worker uses the same RPC/contract configuration. Its vars are defined in
`apps/worker/wrangler.toml` under `[vars]` (same `NEXT_PUBLIC_*` names and placeholder values).
`wrangler.toml` is gitignored, so create or update it locally.
