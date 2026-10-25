# Research Paywall — USDC-Gated Document Viewer

A minimalist paywall for independent researchers to monetize single papers. Readers pay $0.50 USDC once to permanently unlock a document; the payment goes directly to the creator onchain.

Built with [Arc Studio](https://studio.arc.io)

---

## What it does

- Shows a research article with a free 2-paragraph abstract
- Blurs the full body behind a paywall box showing title, author, price, and wallet balance
- On "Pay $0.50 USDC to Unlock": approves USDC spend, then calls `unlockDocument` on the smart contract
- On confirmation, removes the blur and shows a success banner with an explorer link
- Returning readers who already paid see the full text immediately (checked from the contract on connect)

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, wagmi v2, viem, ConnectKit
- **Smart contracts**: Solidity 0.8.28, Foundry, OpenZeppelin 5.6.1
- **Chain**: Arc Testnet (Chain ID 5042002)
- **Token**: USDC ERC-20 (6 decimals) at `0x3600000000000000000000000000000000000000`

## Contracts

| Contract | Address | Explorer |
|---|---|---|
| DocumentPaywall | `0x97134d6782e23713f7edf38275b017d394ef80f3` | [View](https://explorer.testnet.arc.io/address/0x97134d6782e23713f7edf38275b017d394ef80f3) |

Constructor args: `_usdcToken` = Arc Testnet USDC, `_creator` = deployer wallet, `initialOwner` = deployer wallet.

## Development

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- [Foundry](https://getfoundry.sh/) (for contract work)

### Install

```bash
bun install
```

### Environment Variables

None required for local development. The app reads all chain/contract facts from generated modules.

| Variable | Purpose | Required |
|---|---|---|
| `RPC_PROXY_BASE_URL` | RPC proxy base URL (optional, provided by Arc Studio) | No |
| `RPC_PROXY_TOKEN` | RPC proxy auth token (optional, provided by Arc Studio) | No |

### Run

```bash
bun run dev
```

### Build

```bash
bun run build
```

### Test

```bash
# Lint and typecheck
bun run check

# Contract unit tests
cd contracts && forge test
```

## How to try it

1. Open the app in preview
2. Click **Connect Wallet** and connect MetaMask (or any injected wallet)
3. Switch to Arc Testnet (Chain ID 5042002)
4. Use the **Get test USDC** button in the Arc Studio sidebar to fund your wallet
5. Click **Pay $0.50 USDC to Unlock** — approve USDC, then confirm the unlock transaction
6. The blur lifts and the full article text appears
