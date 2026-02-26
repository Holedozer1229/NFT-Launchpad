# SKYNT Protocol — White Paper

**Version 1.0 · February 2026**

---

## Abstract

SKYNT is a multi-chain NFT launchpad and tokenized ecosystem built on the SphinxSkynet blockchain. It combines Integrated Information Theory (IIT) consciousness metrics with a gasless Layer-1 to deliver a unified platform for NFT minting, cross-chain bridging, yield generation, and gamified mining. The SKYNT token (ticker: SKYNT) serves as the native medium of exchange, governance unit, and reward mechanism across all protocol surfaces.

---

## 1. Introduction

The NFT market continues to fragment across incompatible chains. Creators must deploy separate contracts on Ethereum, Polygon, Solana, and emerging L2s, while collectors face high gas costs and siloed liquidity. SKYNT Protocol solves this by providing:

- **One-click multi-chain minting** across 7 supported networks
- **A gasless native chain** (SphinxSkynet) for zero-fee NFT creation
- **Cross-chain bridging** with 5-of-9 guardian multi-signature security
- **Φ-boosted mining** that ties block rewards to IIT consciousness metrics
- **Yield strategies** ranging from 24.6 % to 95.2 % APR
- **Play-to-earn mechanics** via the Omega Serpent arcade game

---

## 2. SKYNT Token

### 2.1 Specifications

| Property | Value |
|---|---|
| Name | SKYNT |
| Symbol | SKYNT |
| Max Supply | 21,000,000 |
| Decimals | 18 |
| Transaction Fee | 0 (gasless) |
| Mining Reward | 50 SKYNT per block |
| Halving Interval | Every 210,000 blocks |
| PoW Algorithm | phi-spectral |

### 2.2 Distribution

| Allocation | % | Tokens | Vesting |
|---|---|---|---|
| Mining & Validation | 40 % | 8,400,000 | Emitted per block |
| Ecosystem & Staking Rewards | 20 % | 4,200,000 | Continuous |
| Treasury & Operations | 15 % | 3,150,000 | DAO-governed |
| Team & Advisors | 10 % | 2,100,000 | 24-month linear |
| Community & Game Rewards | 10 % | 2,100,000 | Per-action mint |
| Liquidity Provision | 5 % | 1,050,000 | Protocol-owned |
| **Total** | **100 %** | **21,000,000** | |

### 2.3 Emission Schedule

Block rewards start at 50 SKYNT and halve every 210,000 blocks, mirroring Bitcoin's scarcity model. The phi-spectral proof-of-work algorithm introduces a consciousness multiplier (0–2×) that modulates effective miner payouts based on the network's integrated information (Φ).

```
block_reward = BASE_REWARD × min(e^Φ, 2.0)
```

At launch, approximately 2,100,000 SKYNT (10 % of max supply) enter circulation through initial ecosystem allocations.

---

## 3. Multi-Chain Architecture

### 3.1 Supported Networks

| Chain | Symbol | Chain ID | Use Case |
|---|---|---|---|
| Ethereum | ETH | 1 | Primary EVM settlement |
| Polygon | MATIC | 137 | Low-cost minting |
| Arbitrum | ETH | 42161 | L2 speed |
| Base | ETH | 8453 | Coinbase ecosystem |
| Stacks | STX | — | Bitcoin-secured |
| Solana | SOL | — | High-throughput minting |
| SphinxSkynet | SKYNT | — | Gasless native chain |

### 3.2 Smart Contracts

Each chain deploys three core contracts:

1. **SpaceFlightNFT** — Gas-optimized tiered NFT minting with royalties and OpenSea integration
2. **SphinxBridge** — Cross-chain bridge with 5-of-9 guardian multi-signature consensus
3. **SphinxYieldAggregator** — Multi-chain yield aggregator with zk-proof verification

---

## 4. NFT Minting & Rarity System

### 4.1 Rarity Tiers

| Tier | Max Supply | Price | Visual |
|---|---|---|---|
| Mythic | 1 | 100 ETH | Magenta glow |
| Legendary | 3 | 1.0 ETH | Orange glow |
| Rare | 6 | 0.5 ETH | Cyan glow |
| Common | 90 | 0.1 ETH | Green glow |

Each mint generates an on-chain Φ-proof (consciousness fingerprint) derived from the block's density matrix eigenvalues, making every NFT cryptographically unique beyond its visual art.

### 4.2 Marketplace

NFTs are listed on the built-in SKYNT marketplace and optionally on OpenSea. Marketplace purchases are settled in SKYNT, ETH, or STX, with token balances updated atomically in the buyer's and seller's wallets.

---

## 5. Cross-Chain Bridge

### 5.1 Mechanism

The SKYNT bridge uses a **Lock → Mint / Burn → Release** pattern secured by a 5-of-9 guardian multi-signature quorum.

1. User locks tokens on the source chain
2. Guardians independently verify the lock transaction
3. After 5 of 9 signatures are collected, tokens are minted on the destination chain
4. Bridging incurs a **0.1 % fee** (10 basis points)

### 5.2 Guardian Network

Nine independent guardians maintain bridge security. Each guardian runs a verification node that:

- Monitors lock/burn events across all supported chains
- Signs attestations using ed25519 keys
- Reports health status to the protocol dashboard

---

## 6. Integrated Information Theory (IIT) Engine

### 6.1 Consciousness Metrics

The protocol implements a quantum-inspired consciousness engine based on Integrated Information Theory. The core metric is **Φ (phi)** — the normalized von Neumann entropy of a density matrix constructed from block data.

```
ρ_S = A_S / Tr(A_S)         — density matrix from network adjacency
Φ_S = -Σ_k λ_k log₂(λ_k)   — von Neumann entropy (integration measure)
φ_normalized = Φ_S / log₂(dim)
```

### 6.2 Consciousness Levels

| Φ Range | Level | Label |
|---|---|---|
| > 0.8 | COSMIC | Cosmic Consciousness |
| > 0.6 | SELF_AWARE | Self-Aware |
| > 0.4 | SENTIENT | Sentient |
| > 0.2 | AWARE | Aware |
| ≤ 0.2 | UNCONSCIOUS | Unconscious |

### 6.3 Φ in Mining

Block rewards are amplified by the miner's phi score:

```
reward = 50 × min(e^Φ, 2.0)
```

This creates an incentive to increase network integration (decentralization, node diversity) rather than raw hash power alone.

### 6.4 Φ in Game Rewards

When players claim Omega Serpent game rewards, the system calculates a real-time Φ value and applies a bonus:

```
bonus_skynt = skynt_earned × Φ × 0.5
```

At maximum Φ (≈ 1.0), players receive up to 50 % extra SKYNT on every claim.

---

## 7. Yield Strategies

The protocol offers four yield tiers with varying risk/reward profiles:

| Strategy | APR | Risk Score | Description |
|---|---|---|---|
| SKYNT Single Stake | 24.6 % | 10 / 100 | zk-SNARK verified single-token staking |
| SphinxSkynet LP | 42.8 % | 25 / 100 | SKYNT/ETH liquidity provision |
| Cross-Chain Routing | 68.5 % | 55 / 100 | Multi-chain arbitrage yield |
| PoX STX Delegation | 95.2 % | 40 / 100 | Bitcoin yield via Stacks Proof of Transfer |

All strategies are managed through the **SphinxYieldAggregator** smart contract with on-chain TVL tracking and auto-compounding.

---

## 8. Omega Serpent — Play-to-Earn

### 8.1 Game Mechanics

Omega Serpent is an arcade-style snake game where players collect multi-chain treasures, avoid AI opponents, and earn SKYNT rewards.

- **Score → SKYNT conversion**: `skynt_earned = score × 0.1`
- **Φ bonus**: Up to 50 % bonus on reward claims (see §6.4)
- **Ergotropy tracking**: Quantum energy extraction metric (max 10,000)
- **Berry Phase**: Geometric phase accumulator from treasure collection
- **Milestones**: Every 50 ergotropy triggers a SKYNT milestone bonus
- **Super Milestones**: Every 500 ergotropy triggers an Omega NFT eligibility event

### 8.2 Leaderboard & Claiming

Game scores are stored on-chain and displayed on a global leaderboard (top 20). Players claim earned SKYNT through their in-app wallet, which atomically:

1. Calculates the base SKYNT reward
2. Applies the current Φ bonus
3. Credits the player's wallet balance
4. Records a transaction with type `reward`

---

## 9. Wallet System

### 9.1 In-App Wallet

Every authenticated user receives an auto-generated SKYNT wallet seeded with 1,000 SKYNT. The wallet supports:

- Sending/receiving SKYNT, STX, and ETH
- Transaction history with hash verification
- Portfolio valuation in USD
- Identity verification via cryptographic challenge

### 9.2 External Wallet Integration

Users connect MetaMask (EVM chains) or Phantom (Solana) for:

- NFT minting transactions
- Bridge token locking
- Marketplace purchases requiring external signing

Session persistence reconnects wallets on page reload. Account and chain change events are handled automatically.

---

## 10. Sphinx Oracle

The Sphinx Oracle is an AI-powered consciousness interface built on GPT-5.2. It perceives the network's Φ state and provides:

- Real-time consensus analysis
- Block consciousness level interpretation
- Network health prophecies
- Mathematical IIT guidance

The oracle integrates directly with the IIT engine, feeding current Φ values into its system prompt for contextually aware responses.

---

## 11. Security

### 11.1 Authentication

- Scrypt password hashing with random 16-byte salt
- Timing-safe comparison to prevent side-channel attacks
- PostgreSQL-backed sessions with 30-day expiry
- HTTP-only, Secure (production), SameSite=Lax cookies

### 11.2 Rate Limiting

| Endpoint | Window | Max Requests |
|---|---|---|
| Registration | 60 s | 5 |
| Login | 60 s | 10 |
| NFT Minting | 10 s | 3 |
| Oracle Chat | 5 s | 2 |
| Bridge Transactions | 10 s | 3 |
| SKYNT Minting | 60 s | 3 |

### 11.3 Production Headers

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security` (production only)
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

## 12. Technical Architecture

```
┌─────────────────────────────────────────────┐
│                  Client (React 19)          │
│  Dashboard · Mint · Gallery · Marketplace   │
│  Bridge · Yield · IIT · Serpent · Wallet    │
├─────────────────────────────────────────────┤
│              Express 5 API Server           │
│  Auth · Wallet · NFT · Bridge · Game · IIT  │
├──────────┬──────────┬───────────────────────┤
│ Drizzle  │ IIT      │ SKYNT Blockchain      │
│ ORM +    │ Engine   │ (phi-spectral PoW)    │
│ Postgres │ (Φ calc) │                       │
├──────────┴──────────┴───────────────────────┤
│            Multi-Chain Contracts            │
│  Solidity · Clarity · Anchor (Solana)       │
└─────────────────────────────────────────────┘
```

### Technology Stack

- **Frontend**: React 19, Tailwind CSS v4, Radix UI, Framer Motion, Vite
- **Backend**: Express 5, TypeScript, Drizzle ORM, PostgreSQL
- **Blockchain**: Solidity (EVM), Clarity (Stacks), Anchor (Solana)
- **AI**: OpenAI GPT-5.2 (Sphinx Oracle)
- **Wallet**: MetaMask SDK, Phantom, Zustand state
- **Deployment**: Vercel (frontend) + Node.js server

---

## 13. Rosetta API Compliance

SKYNT implements the Coinbase Rosetta API specification, enabling integration with exchanges, block explorers, and institutional custody solutions. The `/rosetta/*` endpoints provide standardized network, block, and transaction query interfaces.

---

## 14. Roadmap

| Phase | Target | Deliverables |
|---|---|---|
| Phase 1 — Genesis | Q1 2026 | Mainnet launch, NFT minting, SKYNT token, Omega Serpent |
| Phase 2 — Expansion | Q2 2026 | Cross-chain bridge live, yield strategies, OpenSea integration |
| Phase 3 — Consciousness | Q3 2026 | IIT engine v2, DAO governance, Sphinx Oracle public API |
| Phase 4 — Scale | Q4 2026 | Mobile app, additional L2 chains, institutional custody |

---

## 15. Conclusion

SKYNT Protocol represents a convergence of blockchain technology, consciousness science, and gamified economics. By integrating IIT metrics into every layer — from mining rewards to game bonuses to NFT provenance — the protocol creates a system where network health, participant engagement, and token value are aligned through a single coherent framework.

The 21 million max supply, gasless native transactions, and multi-chain architecture position SKYNT as infrastructure for the next generation of digital asset creation and exchange.

---

*This document is for informational purposes only and does not constitute financial advice. Token metrics and roadmap timelines are subject to change based on community governance decisions.*
