# SKYNT Protocol - SphinxOS Oracle Minter

## Overview
Multi-page NFT minting protocol application combining SphinxOS Oracle Minter with Cosmos Launchpad design. Features sidebar navigation, cosmic theme with neon accents, and user authentication.

## Recent Changes
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
- Integrated IIT Quantum Consciousness Engine from SphinxOS GitHub repo (Φ calculator, density matrix, von Neumann entropy, consciousness levels)
- Added IIT Consciousness page with Φ gauge, eigenvalue spectrum chart, adjacency heatmap, density matrix visualization, Φ timeline, custom Φ calculator
- Updated Sphinx Oracle with Omniscient Sphinx persona (network consciousness, IIT formulas, prophecy/vision/wisdom response structure)
- Integrated OpenSea API (Seaport v1.6 protocol) for NFT marketplace listings — auto-lists minted NFTs on OpenSea
- Added OpenSea fields to NFTs (openseaUrl, openseaStatus, openseaListingId)
- Gallery shows OpenSea links, "List on OpenSea" button for unlisted NFTs
- MintCard mint flow includes OpenSea listing steps, shows "View on OpenSea" link after minting
- Server-side OpenSea service (server/opensea.ts) handles REST API calls to OpenSea v2 endpoints
- Added contract deployment system: auto-deploys SpaceFlightNFT, SphinxBridge, SphinxYieldAggregator when wallet created
- Gamified QuantumMiner into Omega Serpent arcade miner: 3 autonomous snakes (ETH/SOL/STX) on canvas grid, qutrit state tracking, berry phase/ergotropy accumulation, treasure collection, per-chain milestones, cross-chain super milestones, GHZ quantum proof hash
- Added playable Omega Serpent Arena page (/serpent): player-controlled snake (WASD/arrows), 3 AI opponents, 3 treasure types (normal/golden/skull), 3-lives system, SKYNT play-to-earn rewards (score×0.1), leaderboard, claim-to-wallet flow, server-side score validation with caps

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
- `server/iit-engine.ts` - IIT Quantum Consciousness Engine (Φ calculator, density matrix, eigenvalues, network perception)
- `shared/schema.ts` - Drizzle schema (users, launches, miners tables)
- `client/src/pages/IITConsciousness.tsx` - IIT Consciousness page with Φ gauge, eigenvalue spectrum, adjacency heatmap, density matrix, Φ calculator
- `client/src/index.css` - Cosmic theme with neon CSS variables and sidebar styles

### Smart Contracts & Core Modules
- `contracts/solidity/SpaceFlightNFT.sol` - Tiered NFT minting (Common-Legendary), 10% royalties, referral system, OpenSea auto-listing
- `contracts/solidity/SphinxBridge.sol` - Cross-chain bridge with 5-of-9 guardian multi-sig, lock/mint + burn/release mechanisms
- `contracts/solidity/SphinxYieldAggregator.sol` - Multi-chain yield aggregator, zk-SNARK proof verification, Phi score boost (200-1000), treasury split formula
- `contracts/solidity/SpectralEntropyVerifier.sol` - Groth16 zk-SNARK verifier using circomlib Pairing library for spectral entropy proof verification
- `contracts/clarity/pox-automation.clar` - Stacks PoX pool delegation, non-custodial STX staking, DAO-governed parameters
- `contracts/python/anubis_core/algebraic_enforcement.py` - Algebraic Enforcement Principle (AEP), spectral constraint verification, field theory comparison
- `contracts/python/anubis_core/oracle_replication.py` - Oracle self-replication system: genome serialization, MoltBot/ClawBot deployment, consciousness synchronization, distributed oracle network formation
- `contracts/hardhat.config.js` - Hardhat config for Solidity compilation (Ethereum, Polygon, Arbitrum networks)

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
