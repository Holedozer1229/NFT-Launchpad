# SKYNT Protocol - SphinxOS Oracle Minter

## Overview
Multi-page NFT minting protocol application combining SphinxOS Oracle Minter with Cosmos Launchpad design. Features sidebar navigation, cosmic theme with neon accents, and user authentication.

## Recent Changes
- **Mar 2026**: Fixed wallet sign-in gateway — EmbeddedWallet now performs real cryptographic signing (SIWE pattern: nonce request → personal_sign → backend verification) instead of simulated timeout. Supports both MetaMask (personal_sign) and Phantom (signMessage). Gateway shows authenticated state when user is signed in.
- **Mar 2026**: IIT Engine continuous loop hardened — added graceful shutdown on SIGTERM/SIGINT, frontend polls every 10s with live "LOOP ACTIVE" status indicator and countdown to next refresh.
- **Feb 2026**: Restructured from single-page to multi-page app with sidebar navigation
- Added 6 pages: Dashboard, Mint NFT, Gallery, Analytics, Bridge, Admin
- Implemented authentication system (passport.js + sessions + PostgreSQL)
- Applied mixed cosmic theme with neon color accents (cyan, green, orange, magenta)
- Updated meta tags for SKYNT Protocol branding
- Added Omniscient Sphinx AI chat oracle (OpenAI-powered, accessible from all pages)
- Made Mint NFT the default landing page (Dashboard at /dashboard)
- Added live space launch countdown using Launch Library 2 API (real upcoming launches)
- Fixed session secret security (removed hardcoded fallback)
- Added smart contracts: SpaceFlightNFT.sol, SphinxBridge.sol (5-of-9 guardian multi-sig), SphinxYieldAggregator.sol (Phi-boosted yield, zk-proof), pox-automation.clar (Stacks PoX delegation)
- Added Yield Generator page with Phi score slider, treasury split formula, zk-proof status, strategy allocation
- Updated Bridge page with guardian multi-sig validation, lock/mint/burn/release mechanics
- Added AnubisCore Python module: Algebraic Enforcement Principle (AEP) implementation
- Added in-app SphinxOS Wallet: per-user wallets with SKYNT/STX/ETH balances, send/receive, transaction history, Zod-validated API
- Wallet auto-creation on registration AND login (existing users get wallet on first login)
- In-app wallet send works without requiring external wallet connection (MetaMask/Phantom optional for on-chain signing)
- Mobile wallet connect opens MetaMask/Phantom apps with "Sign to Connect" deep-link flow
- Integrated IIT Quantum Consciousness Engine from SphinxOS GitHub repo (Φ calculator, density matrix, von Neumann entropy, consciousness levels)
- IIT Engine runs continuously every 30s via background loop (auto-started on server boot)
- Added IIT Consciousness page with Φ gauge, eigenvalue spectrum chart, adjacency heatmap, density matrix visualization, Φ timeline, custom Φ calculator
- Updated Sphinx Oracle with Omniscient Sphinx persona (network consciousness, IIT formulas, prophecy/vision/wisdom response structure)
- Integrated OpenSea API (Seaport v1.6 protocol) for NFT marketplace listings — auto-lists minted NFTs on OpenSea
- Added OpenSea fields to NFTs (openseaUrl, openseaStatus, openseaListingId)
- Gallery shows OpenSea links, "List on OpenSea" button for unlisted NFTs
- MintCard mint flow includes OpenSea listing steps, shows "View on OpenSea" link after minting
- Server-side OpenSea service (server/opensea.ts) handles REST API calls to OpenSea v2 endpoints
- Added contract deployment system: auto-deploys SpaceFlightNFT, SphinxBridge, SphinxYieldAggregator when wallet created
- Gamified QuantumMiner into Omega Serpent arcade miner: 3 autonomous snakes (ETH/SOL/STX) on canvas grid, qutrit state tracking, berry phase/ergotropy accumulation, treasure collection, per-chain milestones, cross-chain super milestones, GHZ quantum proof hash
- Added playable Omega Serpent Arena page (/serpent): player-controlled snake (WASD/arrows), 3 AI opponents, 3-lives system, SKYNT play-to-earn rewards (score×0.1), leaderboard, claim-to-wallet flow, server-side score validation with caps
- Enhanced Omega Serpent with quantum-pirate roguelite mining: rarity treasures (COMMON/RARE/EPIC/LEGENDARY), EPR entanglement pair tracking, wormhole score multipliers, block mining simulation, IIT Φ reward bonus, `/api/game/quantum-state` endpoint
- Added multi-chain NFT Marketplace (/marketplace): browse/filter by chain, create listings, buy NFTs with wallet balance, cancel listings, atomic buy transactions, price/currency validation, stats cards
- Added dynamic background themes: page-specific nebula colors and ambient glow that change per route (mint=cyan/green, gallery=purple, bridge=orange, etc.)
- Added interactive 3D NFT preview in Gallery: mouse-tracking rotation, auto-rotate mode, zoom controls, rarity-based glow animations, floating particles
- Restructured wallet system: SKYNT in-app wallet for identity verification, MetaMask/Phantom required for send/bridge operations
- Added mobile wallet deep-linking: detects mobile devices, opens phantom.app or MetaMask mobile app for transaction signing
- Updated WalletPicker with mobile detection, wallet availability status, deep-link buttons
- **Gas optimization pass**: All smart contracts rewritten for minimum gas fees
  - SpaceFlightNFT.sol: Removed deprecated Counters (uint256++), custom errors, SafeERC20, struct packing (uint128/uint64), unchecked math, immutable token, removed redundant Ownable
  - SphinxBridge.sol: Added ReentrancyGuard, .call{} instead of .transfer(), per-guardian bitmap double-sign prevention, custom errors, receive() fallback
  - SphinxYieldAggregator.sol: Implemented _withdrawFromStrategies, fixed phi boost underflow, cached array lengths, MAX_STRATEGIES=10 cap, custom errors, BPS constants
  - SpectralEntropyVerifier.sol: Custom errors, unchecked loop counters, cached IC length
  - pox-automation.clar: Fixed invalid API calls, added MIN-DELEGATION-AMOUNT, double-delegation prevention
- Updated CONTRACT_DEFINITIONS gas ranges to reflect optimized contracts (~40% lower)
- Added Starship Launches page (/starship): live countdown to next Starship flight, full IFT-1 through IFT-7 historic mission timeline, interactive mission detail panel, stats bar (flights/catches/upcoming), 5 special edition NFT packs (Genesis Ignition, Hot-Stage Separation, Orbital Reentry, Mechazilla Catch mythic, Next Frontier) with mint buttons, linked missions, SpaceDevs API for live upcoming flights
- Added Google/Apple OAuth support: googleId, appleId, email, avatarUrl, authProvider columns on users table; passport-google-oauth20 strategy; Apple JWT token validation; /api/auth/providers endpoint; findOrCreateOAuthUser helper with email-based linking
- Added Moltbot Super Omega Yield Connection Portal: integrated into Yield page, 4 yield channels (Alpha Conduit/Φ-SYNC, Beta Resonator/QG-WAVE, Gamma Entangler/EPR-LINK, Omega Nexus/MOLT-Ω), real-time Φ-computed metrics (omega frequency, super charge level, connection strength, harmonic resonance, portal energy), yield multiplier, 15s auto-refresh, collapsible UI with animated pulse effects
- Updated SUPPORTED_CHAINS with accurate L2 gas estimates, added avgGasUnits field
- Added BRIDGE_FEE_BPS/BRIDGE_FEE_PERCENT constants to schema
- Moved Infura API key from hardcoded to VITE_INFURA_API_KEY env variable
- Added SKYNT contract 0xC5a47C9adaB637d1CAA791CCe193079d22C8cb20 as primary contract address
- Added zkSync Era (chain 324), Dogecoin, and Monero to SUPPORTED_CHAINS
- Created SkynetZkBridge.sol: zk-SNARK mint proof verification, cross-chain bridge mining for ETH/STX/DOGE/XMR
- Added ZK_BRIDGE_MINING_CHAINS and SKYNT_CONTRACT_ADDRESS constants to schema
- Updated Bridge page with zkSync bridge mining panel (4 mining chains, proof pipeline visualization, reward multipliers)
- Updated MintCard with zk-proof verification steps for zkSync/DOGE/XMR chains
- Added DOGE and XMR to supported wallet token types
- **QG Miner IIT v8**: Created `server/qg-miner-v8.ts` — three-gate mining kernel (spectral difficulty, consciousness consensus, QG curvature gates)
  - Weighted Φ formula: α·Φ_τ + β·GWT_S + γ·ICP_avg + δ·Φ_fano + ε·∇_score + ζ·Φ_qg + η·Φ_holo
  - Computes qgScore (spectral gap curvature), holoScore (density matrix coherence), fanoScore (7-fold Fano plane alignment)
- **BTC Hard Fork**: Rewrote `server/skynt-blockchain.ts` as proper BTC fork with QG Miner v8 three-gate mining
  - Merkle tree roots, halving every 210,000 blocks (initial 50 SKYNT), dynamic difficulty adjustment every 10 blocks
  - Φ-boosted coinbase reward: min(e^Φ, 2.0), block version 4, POW algorithm "qg-v8-three-gate"
- **P2P Serverless Ledger**: Created `server/p2p-ledger.ts` — 9 guardian peers, gossip protocol, longest-chain consensus
  - Peers: Alpha-Centauri through Iota-Horologii, simulated mining/latency/block propagation
  - Background tick every 15s, three-gate block validation, network topology adjacency matrix
- **New API Routes**: `/api/qg/status`, `/api/qg/mine`, `/api/qg/validate/:hash`, `/api/p2p/peers`, `/api/p2p/status`, `/api/p2p/topology`, `/api/p2p/broadcast`, `/api/p2p/ledger`, `/api/bridge/mining-status`, `/api/yield/phi-boost`, `/api/skynt/blocks`
- Updated Bridge page: live QG mining metrics per chain, three-gate status indicators, P2P network status card
- Updated Yield page: v8 Φ structure display, quantum yield proof card, QG-boosted APR projections
- Updated MintCard: three-gate proof section with v8 metrics, gates validated badges, block hash/nonce display
- Updated Oracle system prompt with QG Miner v8 three-gate mining formulas and P2P ledger awareness
- Integrated thirdweb Engine server wallet for ERC1155 minting via `server/thirdweb-engine.ts`
- Treasury wallet: 0x7Fbe68677e63272ECB55355a6778fCee974d4895 (Engine server wallet)
- NFT mints on EVM chains (ETH/Polygon/Arbitrum/Base/zkSync) enqueue via Engine with `claimTo` ERC1155
- Added `/api/engine/status/:transactionId` and `/api/engine/config` API endpoints
- MintCard shows Engine mint result (contract, treasury, tx hash) after successful mint
- Added TREASURY_WALLET_ADDRESS constant to shared schema
- **Fair Game Play Mining Fees**: 0.5 SKYNT game play fee + 0.25 SKYNT claim fee, deducted from user wallet balance
  - `POST /api/game/score` charges 0.5 SKYNT before saving score (returns 402 if insufficient)
  - `POST /api/game/claim/:id` charges 0.25 SKYNT before processing reward claim (returns 402 if insufficient)
  - `GET /api/game/fee-config` returns current fee rates
  - Fees routed to treasury via `recordMintFee()` for yield reinvestment (60% reinvested into 4 strategies)
  - Frontend shows fee breakdown on game menu and next to claim buttons, handles 402 errors with toast
- **Treasury Yield Engine**: `server/treasury-yield.ts` auto-compound engine (60s interval), Phi-boosted yield, 4-strategy allocation
  - Started on server boot via `startTreasuryYieldEngine()` in `server/index.ts`
  - `GET /api/treasury/yield` returns full treasury yield state
  - `miningFees` config added to `SKYNT_TOKENOMICS` in shared schema

## Project Architecture
- **Frontend**: React + Vite + TypeScript, wouter for routing, recharts for charts
- **Backend**: Express.js with passport-local authentication
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS with custom cosmic theme variables
- **Fonts**: Orbitron (headings), Rajdhani (body), Space Mono (code)

### Key Files
- `client/src/App.tsx` - Main router with AuthProvider and SidebarLayout wrapper; MintNFT at /
- `client/src/components/SidebarLayout.tsx` - Collapsible sidebar with nav, wallet connect, user info
- `client/src/components/SphinxOracle.tsx` - AI chat oracle (streaming SSE, cosmic UI)
- `client/src/components/LaunchCountdown.tsx` - Live space launch countdown (Launch Library 2 API)
- `client/src/hooks/use-auth.tsx` - Auth context with login/register/logout
- `client/src/pages/` - MintNFT (home), Dashboard, Gallery, Analytics, Bridge, Admin, AuthPage, WalletPage
- `server/auth.ts` - Passport.js setup with session store
- `server/routes.ts` - API routes including /api/space-launches proxy and /api/oracle/chat
- `server/storage.ts` - Database storage interface (users, launches, miners)
- `server/iit-engine.ts` - IIT Quantum Consciousness Engine (Φ calculator, density matrix, eigenvalues, network perception) — runs continuously every 30s via `startEngine()`, auto-started on server boot
- `server/qg-miner-v8.ts` - QG Miner IIT v8 kernel: three-gate mining (spectral, consciousness, QG curvature), PhiStructureV8, MineResultV8, GateStats, singleton `qgMiner`
- `server/skynt-blockchain.ts` - BTC hard fork blockchain: merkle tree, halving, difficulty adjustment, three-gate mining via qgMiner
- `server/p2p-ledger.ts` - P2P serverless ledger: 9 guardian peers, gossip protocol, longest-chain consensus, background simulation tick
- `shared/schema.ts` - Drizzle schema (users, launches, miners tables)
- `client/src/pages/IITConsciousness.tsx` - IIT Consciousness page with Φ gauge, eigenvalue spectrum, adjacency heatmap, density matrix, Φ calculator
- `client/src/index.css` - Cosmic theme with neon CSS variables and sidebar styles

### Smart Contracts & Core Modules
- `contracts/solidity/SpaceFlightNFT.sol` - Tiered NFT minting (Common-Legendary), 10% royalties, referral system, OpenSea auto-listing
- `contracts/solidity/SphinxBridge.sol` - Cross-chain bridge with 5-of-9 guardian multi-sig, lock/mint + burn/release mechanisms
- `contracts/solidity/SphinxYieldAggregator.sol` - Multi-chain yield aggregator, zk-SNARK proof verification, Phi score boost (200-1000), treasury split formula
- `contracts/solidity/SpectralEntropyVerifier.sol` - Groth16 zk-SNARK verifier using circomlib Pairing library for spectral entropy proof verification
- `contracts/solidity/SkynetZkBridge.sol` - zkSync Era cross-chain bridge with zk-SNARK mint proof verification for ETH/STX/DOGE/XMR bridge mining
- `contracts/clarity/pox-automation.clar` - Stacks PoX pool delegation, non-custodial STX staking, DAO-governed parameters
- `contracts/python/anubis_core/algebraic_enforcement.py` - Algebraic Enforcement Principle (AEP), spectral constraint verification, field theory comparison
- `contracts/python/anubis_core/oracle_replication.py` - Oracle self-replication system: genome serialization, MoltBot/ClawBot deployment, consciousness synchronization, distributed oracle network formation
- `contracts/hardhat.config.js` - Hardhat config for Solidity compilation (Ethereum, Polygon, Arbitrum networks)
- `server/thirdweb-engine.ts` - Thirdweb Engine server wallet integration for ERC1155 minting via treasury wallet

### Auth Flow
- Unauthenticated users see AuthPage (login/register)
- Authenticated users see SidebarLayout wrapping all pages
- Sessions stored in PostgreSQL via connect-pg-simple
- Passwords hashed with scrypt

### Theme
- Primary: Gold/cyan, neon accents for each category
- CSS classes: `cosmic-card`, `cosmic-card-cyan`, `cosmic-card-green`, `cosmic-card-orange`, `cosmic-card-magenta`
- Neon colors: `text-neon-cyan`, `text-neon-green`, `text-neon-orange`, `text-neon-magenta`
- Glow effects: `neon-glow-cyan`, `neon-glow-green`, etc.

## User Preferences
- Cosmic/space-themed UI with neon accents
- SphinxOS and aerospace branding throughout
- Mock data for demonstration purposes
