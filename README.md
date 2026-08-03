# NameStack Escrow Contracts

Soroban smart contracts for [NameStack](https://github.com/namestackpro/namestack) —
a domain portfolio manager for resellers, with on-chain escrow settlement for
domain sales on Stellar.

A single escrow contract holds funds for a domain sale until the buyer confirms
receipt, or a dispute is raised and an arbitrator resolves it. The platform takes a
small fee (basis points, configurable) on completed sales — none on refunds.

## Maintainer

| | |
|---|---|
| **cisco_91** | [GitHub](https://github.com/ciscokwiz) · Discord: **ciscokwiz** |

Questions or security concerns: open an issue, or reach out on Discord.

## Contents

- [How it works](#how-it-works)
- [Installing Rust](#installing-rust)
- [Install the Stellar CLI](#install-the-stellar-cli)
- [Build and test](#build-and-test)
- [Deploy to testnet](#deploy-to-testnet)
- [Contributing](#contributing)

## How it works

1. A buyer calls `create_escrow`, locking payment (USDC on Stellar) in the contract.
2. The buyer calls `confirm_receipt` once the domain transfer is done — funds release
   to the seller, minus the platform fee.
3. If either party disputes, `raise_dispute` freezes the escrow. An arbitrator then
   calls `resolve_dispute` to release funds to either party.

See [`contracts/escrow/src/lib.rs`](contracts/escrow/src/lib.rs) for the full
function signatures and [`SECURITY.md`](SECURITY.md) for audit status.

## Installing Rust

If you're on macOS, Linux, or another Unix-like system:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

On Windows, download and run `rustup-init.exe`, or see the
[official Rust guide](https://www.rust-lang.org/tools/install).

Then add the Soroban target:

```bash
rustup target add wasm32v1-none
```

## Install the Stellar CLI

```bash
cargo install --locked stellar-cli
```

Confirm it installed:

```bash
stellar --version
```

## Build and test

```bash
stellar contract build
cd contracts/escrow
cargo test
```

A successful build prints the exported function list and produces a `.wasm` file
under `target/wasm32v1-none/release/`.

## Deploy to testnet

Create and fund a deployer identity:

```bash
stellar keys generate --fund my-deployer --network testnet
```

Build, deploy, and initialize:

```bash
stellar contract build

stellar contract deploy \
  --wasm target/wasm32v1-none/release/namestack_escrow.wasm \
  --source my-deployer \
  --network testnet

stellar contract invoke \
  --id <CONTRACT_ID_FROM_DEPLOY> \
  --source my-deployer \
  --network testnet \
  -- initialize \
  --admin <YOUR_ADDRESS> \
  --arbitrator <YOUR_ADDRESS> \
  --fee_address <YOUR_ADDRESS> \
  --fee_bps 100
```

`fee_bps` is in basis points — `100` = 1%.

The currently deployed testnet contract address is in the
[latest release](../../releases/latest).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for setup, coding standards, and PR
guidelines.

## Contributors

<a href="https://github.com/namestackpro/namestack-contracts/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=namestackpro/namestack-contracts" />
</a>
