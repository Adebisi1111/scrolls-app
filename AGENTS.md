# Scrolls — USDC Research Publishing Platform

> Built with Arc Studio — money-powered apps in minutes

This is the **project memory** — what Arc Studio remembers about building this app.

---

## What This App Does

A full-stack USDC-gated research publishing platform on Arc Testnet. Writers publish papers via `/publish`; readers pay $0.50 USDC to unlock the full text at `/read/[docId]`. 98% of each payment goes to the author, 2% to the platform. Access is stored on-chain permanently.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS, react-router-dom v7
- Web3: wagmi v2, viem v2, ConnectKit
- Backend: Express v5 API server on port 3001 (proxied via Vite at `/api`)
- Database: Postgres 18 (Docker container, named volume `scrolls-pgdata`)
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, build with `bun run contracts:build`.
- Chain: Arc Testnet (Chain ID 5042002)
- Token: USDC ERC-20 (6 decimals) at `0x3600000000000000000000000000000000000000`

## Deployed Contracts

| Contract | Address | Chain | Explorer |
|---|---|---|---|
| DocumentPaywall (v1, single-author, superseded) | `0x97134d6782e23713f7edf38275b017d394ef80f3` | Arc Testnet | [link](https://explorer.testnet.arc.io/address/0x97134d6782e23713f7edf38275b017d394ef80f3) |
| ContentPaywall (v2, multi-author) | `0x29e712516f5bebbf33648b0aadbda0ea5b43724e` | Arc Testnet | [link](https://explorer.testnet.arc.io/address/0x29e712516f5bebbf33648b0aadbda0ea5b43724e) |
| ContentPaywall (v3, deployer treasury) | `0x3d695ffc1a3d4888015262408c479fba0c759704` | Arc Testnet | [link](https://explorer.testnet.arc.io/address/0x3d695ffc1a3d4888015262408c479fba0c759704) |
| ContentPaywall (v4, open registerDoc, **active**) | `0xf34fcaefbf4da587738b08df0029ffac2c9bb69e` | Arc Testnet | [link](https://explorer.testnet.arc.io/address/0xf34fcaefbf4da587738b08df0029ffac2c9bb69e) |

ContentPaywall constructor args:
- `_usdcToken`: `0x3600000000000000000000000000000000000000` (Arc Testnet USDC)
- `_platform`: `0x5B12Ce46C7194aD57d143bC22847224047b1Ef42` (platform fee wallet, 2%)
- `_owner`: `0x5B12Ce46C7194aD57d143bC22847224047b1Ef42` (owner — can call registerDoc / updateDocAuthor)

## Routes

- `/` — home; lists all published papers with abstract preview
- `/publish` — writer dashboard; form to publish a new paper (requires wallet)
- `/read/[docId]` — dynamic reader view; loads from DB, checks on-chain unlock, gated paywall

## Key Files

- `src/App.tsx` — router shell (BrowserRouter + Routes)
- `src/pages/Home.tsx` — article listing page
- `src/pages/Publish.tsx` — publish form + on-chain registerDoc call
- `src/pages/Read.tsx` — reader view with USDC approve → unlock paywall
- `src/components/NavBar.tsx` — sticky header with Scrolls brand + connect button
- `src/contract.ts` — ContentPaywall address + ABI
- `src/lib/api.ts` — fetch wrappers for /api/articles
- `server/index.ts` — Express API server
- `server/db.ts` — Postgres pool + article CRUD
- `contracts/ContentPaywall.sol` — active paywall contract (per-doc author, 98/2 split)
- `contracts/DocumentPaywall.sol` — original single-author contract (superseded)

## Notes

- The API server must be running (`bun run server`) for the app to work.
- The Postgres container must be running: `docker start scrolls-pg` after a sandbox resume if needed.
- When a writer publishes, the article is saved to DB then `registerDoc(docId, authorWallet)` is called on-chain. This requires the platform owner to sign that tx — in production this would be a backend call using the owner key.
- `updateDocAuthor(docId, newAuthor)` is available on the contract for blocklist recovery, callable by owner.
- UNLOCK_PRICE is constant at 500_000 (0.50 USDC). PLATFORM_BPS = 200 (2%).
