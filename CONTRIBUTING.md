# Contributing to namestack-contracts

Thanks for your interest in contributing. This repo contains the Soroban smart
contracts powering NameStack's domain escrow marketplace on Stellar.

## Getting started

1. Fork the repo and clone your fork.
2. Install Rust via [rustup](https://rustup.rs) (1.84+) and add the Soroban target:
   ```bash
   rustup target add wasm32v1-none
   ```
3. Install the Stellar CLI:
   ```bash
   cargo install --locked stellar-cli
   ```
4. Build and test:
   ```bash
   stellar contract build
   cd contracts/escrow && cargo test
   ```

## Making changes

- Open an issue first for anything beyond a small fix, so we can discuss the
  approach before you put in the work.
- One logical change per commit, with a clear commit message
  (`type(scope): description`, e.g. `fix(escrow): correct fee rounding`).
- Every new function needs at least one passing-case test and one failing-case test.
- Run `cargo test` and `stellar contract build` locally before opening a PR — CI will
  also run these, but catching it locally is faster for you.
- Open PRs against `main`. Direct pushes to `main` are disabled.

## Code style

- No `unwrap()` outside test code.
- No floating-point math — all amounts are `i128`, fee math uses basis points with
  `checked_mul`/`checked_div`.
- Every fallible function returns `Result<T, Error>`, using the `Error` enum defined
  in `errors.rs` — no bare `panic!()` for expected error conditions.

## Questions

Open an issue, or reach out on Discord: **ciscokwiz**.
