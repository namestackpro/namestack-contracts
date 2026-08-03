Security Policy
Audit status

This contract has not undergone a third-party security audit. It has been tested against Stellar testnet with real transactions (create, confirm, dispute, and resolve flows), but no formal audit has been performed. Use on mainnet with real funds is at your own risk until an audit is completed.

Scope

This policy covers the Soroban smart contracts in contracts/escrow. It does not cover the namestack application repository, which has its own security considerations (wallet integration, frontend, API).

Reporting a vulnerability

If you find a security issue — anything from an incorrect authorization check to a fund-draining bug — please report it privately rather than opening a public issue.

Contact: Discord ciscokwiz, or open a private security advisory via GitHub's "Report a vulnerability" feature under this repo's Security tab.

Please include:

A description of the issue and its potential impact
Steps to reproduce, ideally against testnet
Any suggested fix, if you have one

We'll acknowledge reports within a reasonable timeframe and keep you updated as the issue is addressed. Please give us time to release a fix before disclosing publicly.

Supported versions

Only the contract currently deployed on Stellar testnet (see the latest release tag for the exact contract address) is actively maintained. Older deployed versions are not patched — a new version is deployed and initialized instead.
