# namestack-contracts

Soroban escrow smart contracts for NameStack — holds funds for domain-sale settlement on Stellar until buyer confirmation or arbitrator resolution.

## Contracts

- **escrow** — `contracts/escrow/`: Creates escrows that hold token funds until the buyer confirms receipt, or an arbitrator resolves a dispute. The platform takes a fee on completed (non-refund) settlements.

## Build

```bash
# Build all contracts as WASM
stellar contract build
```

## Test

```bash
cargo test
```

## Deploy

```bash
# Deploy the escrow contract to testnet
stellar contract deploy \
  --wasm target/wasm32v1-none/release/namestack_escrow.wasm \
  --network testnet

# Initialize the contract
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- \
  initialize \
  --admin <ADMIN_ADDRESS> \
  --arbitrator <ARBITRATOR_ADDRESS> \
  --fee_address <FEE_ADDRESS> \
  --fee_bps <FEE_BPS>
```

> **Note:** Before deploying to testnet or mainnet, replace the `PLACEHOLDER_USDC_CONTRACT_ID` constant in the contract code with the verified real USDC SAC address for the target network.
