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
- **Cross-Chain PoW Mining** — Three-gate IIT v8 mining kernel with Solana on-chain verification and EVM extension points

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
| Mining | Python IIT v8 kernel (numpy), Rust miner, TypeScript cross-chain adapter |
| Testing | Vitest (server), pytest (Python miner) |

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
│   └── programs/skynt_anchor/
│       └── src/
│           ├── lib.rs       # init_genesis, submit_pow, create_challenge, submit_challenge_solution
│           ├── pow.rs       # recursive_pow, verify_pow
│           └── difficulty.rs # halving difficulty schedule
├── miners/
│   ├── python-miner/
│   │   ├── quantum_gravity_miner_iit_v8.py  # self-contained IIT v8 kernel
│   │   ├── miner.py                         # original Python miner
│   │   ├── requirements.txt
│   │   └── tests/
│   │       └── test_quantum_gravity_miner_iit_v8.py  # 53 pytest tests
│   └── rust-miner/          # Rust mining client
├── scripts/
│   └── pow-mining-adapter.ts  # TypeScript cross-chain PoW adapter
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

### PoW Challenge

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/pow/challenge` | Fetch active PoW challenge (seed, difficulty, expiry) |
| `POST` | `/api/pow/challenge` | Create new challenge — admin only |
| `POST` | `/api/pow/submit` | Miner submits a solution (server-side SHA-256 verification) |
| `GET` | `/api/pow/submissions/:challengeId` | List solutions for a challenge |
| `PATCH` | `/api/pow/submissions/:id/confirm` | Confirm on-chain Solana tx (authenticated) |

---

## Cross-Chain PoW Mining

SKYNT supports a three-gate Proof-of-Work model where miners can submit
solutions from any source chain and have them recorded on Solana.

### Quick start (Python miner)

```bash
cd miners/python-miner
pip install -r requirements.txt     # numpy>=1.22

# Mine against a running local server
python quantum_gravity_miner_iit_v8.py \
  --block "my_block_header" --difficulty 50000 --stats
```

### Quick start (TypeScript cross-chain adapter)

```bash
# 1. Create a challenge (admin)
curl -X POST http://localhost:5000/api/pow/challenge \
  -H "Content-Type: application/json" \
  -d '{"expiresAt":"2026-12-31T00:00:00Z"}'

# 2. Run the adapter (mines & submits automatically)
MINER_ADDRESS=<your_pubkey> npx tsx scripts/pow-mining-adapter.ts
```

### Three validity gates

| Gate | Formula | Default |
|---|---|---|
| Spectral difficulty | `hash < 2^(256 − bit_length(difficulty))` | difficulty=50 000 |
| IIT v8.0 consciousness | `Φ_total > log₂(n) + δ·Φ_fano + ζ·Φ_qg` | n=1 (solo), δ=0.15, ζ=0.10 |
| QG curvature | `Φ_qg ≥ qg_threshold` | threshold=0.10 |

See [docs/POW_MINING.md](docs/POW_MINING.md) for full deployment, configuration, and cross-chain extension documentation.

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
- PoW challenge schema, hash computation, difficulty check, replay protection

```bash
# Python IIT v8 miner tests (53 tests, ~0.3 s)
cd miners/python-miner
pip install numpy pytest
python -m pytest tests/test_quantum_gravity_miner_iit_v8.py -v
```

---

## License

MIT

---

## Documentation

- [WHITEPAPER.md](WHITEPAPER.md) — Full protocol specification, tokenomics, and architecture
- [docs/DEPLOY_DIGITALOCEAN.md](docs/DEPLOY_DIGITALOCEAN.md) — Deploy on a Digital Ocean Ubuntu droplet (auto-bootstrap)
- [docs/POW_MINING.md](docs/POW_MINING.md) — Cross-chain PoW mining guide (Anchor program, Python kernel, TypeScript adapter, extension points)
