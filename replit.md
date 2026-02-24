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
- `client/src/pages/` - MintNFT (home), Dashboard, Gallery, Analytics, Bridge, Admin, AuthPage
- `server/auth.ts` - Passport.js setup with session store
- `server/routes.ts` - API routes including /api/space-launches proxy and /api/oracle/chat
- `server/storage.ts` - Database storage interface (users, launches, miners)
- `shared/schema.ts` - Drizzle schema (users, launches, miners tables)
- `client/src/index.css` - Cosmic theme with neon CSS variables and sidebar styles

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
