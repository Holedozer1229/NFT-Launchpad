# SKYNT Protocol — NFT Launchpad

A multi-chain NFT launchpad and tokenized ecosystem powered by the SphinxSkynet blockchain. Mint NFTs across 7 networks, bridge assets with guardian-secured transfers, earn yield, and play the Omega Serpent arcade miner — all unified by the SKYNT token and IIT consciousness metrics.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Features

- **Multi-Chain NFT Minting** — Deploy across Ethereum, Polygon, Arbitrum, Base, Stacks, Solana, and SphinxSkynet
- **Gasless Native Chain** — Zero-fee minting on SphinxSkynet with phi-spectral proof-of-work
- **Cross-Chain Bridge** — Lock → Mint / Burn → Release with 5-of-9 guardian multi-sig (0.1 % fee)
- **Yield Strategies** — Four tiers from 24.6 % to 95.2 % APR with on-chain TVL tracking
- **Omega Serpent** — Play-to-earn arcade game with SKYNT rewards and Φ bonus multipliers
- **IIT Engine** — Quantum-inspired consciousness metrics that modulate mining and game rewards
- **Marketplace** — Built-in NFT trading with OpenSea integration
- **Sphinx Oracle** — AI-powered network consciousness interface (GPT-5.2)
- **Wallet System** — In-app SKYNT wallet + MetaMask / Phantom external wallet support

---

## SKYNT Token

| Property | Value |
|---|---|
| Max Supply | 21,000,000 |
| Mining Reward | 50 SKYNT / block (halving every 210 K blocks) |
| Transaction Fee | 0 (gasless) |
| Bridge Fee | 0.1 % |
| Algorithm | phi-spectral PoW |

### Distribution

| Allocation | % |
|---|---|
| Mining & Validation | 40 % |
| Ecosystem & Staking | 20 % |
| Treasury | 15 % |
| Team & Advisors (24-mo vest) | 10 % |
| Community & Game Rewards | 10 % |
| Liquidity | 5 % |

See [WHITEPAPER.md](WHITEPAPER.md) for full tokenomics, IIT mechanics, and architecture details.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS v4, Radix UI, Framer Motion, Vite |
| Backend | Express 5, TypeScript, Drizzle ORM, PostgreSQL |
| Contracts | Solidity (EVM), Clarity (Stacks), Anchor (Solana) |
| AI | OpenAI GPT-5.2 (Sphinx Oracle) |
| Wallet | MetaMask SDK, Phantom, Zustand |
| Testing | Vitest |

---

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+

### Setup

```bash
# Clone
git clone https://github.com/Holedozer1229/NFT-Launchpad.git
cd NFT-Launchpad

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL, SESSION_SECRET, and optional API keys

# Push database schema
npm run db:push

# Start development server (API + client on port 5000)
npm run dev
```

### Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run dev:client` | Start Vite dev server only |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run check` | TypeScript type check |
| `npm test` | Run Vitest test suite |
| `npm run db:push` | Push Drizzle schema to database |

---

## Project Structure

```
├── client/                  # React frontend
│   └── src/
│       ├── pages/           # Route pages (Dashboard, Mint, Gallery, etc.)
│       ├── components/      # Shared UI components
│       ├── hooks/           # Custom React hooks
│       └── lib/             # Utilities & wallet store
├── server/                  # Express API server
│   ├── routes.ts            # All API endpoints
│   ├── auth.ts              # Authentication (Passport + scrypt)
│   ├── storage.ts           # Database access layer
│   ├── iit-engine.ts        # IIT Φ calculation engine
│   ├── skynt-blockchain.ts  # SKYNT L1 blockchain
│   ├── opensea.ts           # OpenSea integration
│   └── rosetta/             # Rosetta API compliance
├── shared/
│   └── schema.ts            # Database schema & tokenomics constants
├── contracts/
│   ├── solidity/            # EVM smart contracts
│   ├── clarity/             # Stacks contracts
│   └── circuits/            # ZK circuits
├── anchor-program/          # Solana Anchor program
├── miners/
│   ├── python-miner/        # Python mining client
│   └── rust-miner/          # Rust mining client
└── WHITEPAPER.md            # Full protocol specification
```

---

## API Overview

### Core Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/register` | Create account |
| `POST` | `/api/login` | Authenticate |
| `GET` | `/api/launches` | List NFT launches |
| `POST` | `/api/nfts` | Mint NFT (deducts ETH) |
| `GET` | `/api/prices` | Token prices (ETH, SOL, STX, SKYNT) |

### Wallet

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/wallet/list` | User wallets |
| `POST` | `/api/wallet/create` | Create wallet |
| `POST` | `/api/wallet/:id/send` | Send tokens |

### Bridge

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/bridge/transactions` | Bridge tokens (0.1 % fee) |
| `GET` | `/api/bridge/guardians` | Guardian status |

### Game

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/game/score` | Submit game score |
| `GET` | `/api/game/leaderboard` | Top 20 scores |
| `POST` | `/api/game/claim/:id` | Claim SKYNT reward (+ Φ bonus) |

### IIT

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/iit/phi` | Current Φ value |
| `GET` | `/api/iit/network` | Network perception state |
| `POST` | `/api/iit/compute` | Compute Φ from custom data |

---

## Multi-Chain Support

| Chain | Minting | Bridge | Marketplace |
|---|---|---|---|
| Ethereum | ✅ | ✅ | ✅ |
| Polygon | ✅ | ✅ | ✅ |
| Arbitrum | ✅ | ✅ | ✅ |
| Base | ✅ | ✅ | ✅ |
| Stacks | ✅ | ✅ | ✅ |
| Solana | ✅ | ✅ | ✅ |
| SphinxSkynet | ✅ (gasless) | ✅ | ✅ |

---

## Environment Variables

```env
DATABASE_URL=postgresql://user:pass@host:5432/skynt
SESSION_SECRET=<random-32-char-hex>
AI_INTEGRATIONS_OPENAI_API_KEY=sk-...    # Optional: Sphinx Oracle
OPENSEA_API_KEY=...                       # Optional: OpenSea listing
VITE_INFURA_API_KEY=...                   # Optional: MetaMask RPC
```

---

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

Tests cover:
- IIT engine (Φ calculation, eigenvalues, density matrix, network perception)
- Schema validation (chain configs, fee calculations, rarity tiers)
- Business logic (reward formulas, bridge fees, minting costs)

---

## License

MIT

---

## Documentation

- [WHITEPAPER.md](WHITEPAPER.md) — Full protocol specification, tokenomics, and architecture
