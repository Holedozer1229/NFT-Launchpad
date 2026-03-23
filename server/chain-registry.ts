/**
 * Alchemy-powered multi-chain registry.
 * Covers every EVM network the Alchemy SDK exposes (excluding Solana, which is non-EVM).
 *
 * Each entry provides:
 *  - alchemySlug  — the Alchemy network slug used to build RPC URLs
 *  - chainId      — EIP-155 chain ID
 *  - explorerUrl  — base TX explorer URL (tx hash is appended)
 *  - name         — human-readable display name
 *  - mainnet      — true for production networks, false for test networks
 */

export interface ChainConfig {
  alchemySlug: string;
  chainId: number;
  explorerUrl: string;
  name: string;
  mainnet: boolean;
}

export const CHAIN_REGISTRY: Record<string, ChainConfig> = {
  // ─── Ethereum ───────────────────────────────────────────────────────────────
  ethereum:          { alchemySlug: "eth-mainnet",    chainId: 1,          explorerUrl: "https://etherscan.io/tx/",                       name: "Ethereum",               mainnet: true  },
  eth:               { alchemySlug: "eth-mainnet",    chainId: 1,          explorerUrl: "https://etherscan.io/tx/",                       name: "Ethereum",               mainnet: true  },
  ethereum_sepolia:  { alchemySlug: "eth-sepolia",    chainId: 11155111,   explorerUrl: "https://sepolia.etherscan.io/tx/",               name: "Ethereum Sepolia",       mainnet: false },
  ethereum_holesky:  { alchemySlug: "eth-holesky",    chainId: 17000,      explorerUrl: "https://holesky.etherscan.io/tx/",               name: "Ethereum Holesky",       mainnet: false },
  ethereum_hoodi:    { alchemySlug: "eth-hoodi",      chainId: 560048,     explorerUrl: "https://hoodi.ethpandaops.io/tx/",               name: "Ethereum Hoodi",         mainnet: false },

  // ─── Optimism ───────────────────────────────────────────────────────────────
  optimism:          { alchemySlug: "opt-mainnet",    chainId: 10,         explorerUrl: "https://optimistic.etherscan.io/tx/",            name: "Optimism",               mainnet: true  },
  optimism_sepolia:  { alchemySlug: "opt-sepolia",    chainId: 11155420,   explorerUrl: "https://sepolia-optimism.etherscan.io/tx/",      name: "Optimism Sepolia",       mainnet: false },

  // ─── Arbitrum ───────────────────────────────────────────────────────────────
  arbitrum:          { alchemySlug: "arb-mainnet",    chainId: 42161,      explorerUrl: "https://arbiscan.io/tx/",                        name: "Arbitrum One",           mainnet: true  },
  arbitrum_nova:     { alchemySlug: "arbnova-mainnet",chainId: 42170,      explorerUrl: "https://nova.arbiscan.io/tx/",                   name: "Arbitrum Nova",          mainnet: true  },
  arbitrum_sepolia:  { alchemySlug: "arb-sepolia",    chainId: 421614,     explorerUrl: "https://sepolia.arbiscan.io/tx/",                name: "Arbitrum Sepolia",       mainnet: false },

  // ─── Polygon ────────────────────────────────────────────────────────────────
  polygon:           { alchemySlug: "polygon-mainnet",chainId: 137,        explorerUrl: "https://polygonscan.com/tx/",                    name: "Polygon",                mainnet: true  },
  polygon_amoy:      { alchemySlug: "polygon-amoy",   chainId: 80002,      explorerUrl: "https://amoy.polygonscan.com/tx/",               name: "Polygon Amoy",           mainnet: false },
  polygon_zkevm:     { alchemySlug: "polygonzkevm-mainnet", chainId: 1101, explorerUrl: "https://zkevm.polygonscan.com/tx/",             name: "Polygon zkEVM",          mainnet: true  },
  polygon_zkevm_cardona: { alchemySlug: "polygonzkevm-cardona", chainId: 2442, explorerUrl: "https://cardona-zkevm.polygonscan.com/tx/", name: "Polygon zkEVM Cardona",  mainnet: false },

  // ─── Base ───────────────────────────────────────────────────────────────────
  base:              { alchemySlug: "base-mainnet",   chainId: 8453,       explorerUrl: "https://basescan.org/tx/",                       name: "Base",                   mainnet: true  },
  base_sepolia:      { alchemySlug: "base-sepolia",   chainId: 84532,      explorerUrl: "https://sepolia.basescan.org/tx/",               name: "Base Sepolia",           mainnet: false },

  // ─── zkSync Era ─────────────────────────────────────────────────────────────
  zksync:            { alchemySlug: "zksync-mainnet", chainId: 324,        explorerUrl: "https://explorer.zksync.io/tx/",                 name: "zkSync Era",             mainnet: true  },
  zksync_sepolia:    { alchemySlug: "zksync-sepolia", chainId: 300,        explorerUrl: "https://sepolia.explorer.zksync.io/tx/",         name: "zkSync Sepolia",         mainnet: false },

  // ─── Linea ──────────────────────────────────────────────────────────────────
  linea:             { alchemySlug: "linea-mainnet",  chainId: 59144,      explorerUrl: "https://lineascan.build/tx/",                    name: "Linea",                  mainnet: true  },
  linea_sepolia:     { alchemySlug: "linea-sepolia",  chainId: 59141,      explorerUrl: "https://sepolia.lineascan.build/tx/",            name: "Linea Sepolia",          mainnet: false },

  // ─── Blast ──────────────────────────────────────────────────────────────────
  blast:             { alchemySlug: "blast-mainnet",  chainId: 81457,      explorerUrl: "https://blastscan.io/tx/",                       name: "Blast",                  mainnet: true  },
  blast_sepolia:     { alchemySlug: "blast-sepolia",  chainId: 168587773,  explorerUrl: "https://testnet.blastscan.io/tx/",               name: "Blast Sepolia",          mainnet: false },

  // ─── Scroll ─────────────────────────────────────────────────────────────────
  scroll:            { alchemySlug: "scroll-mainnet", chainId: 534352,     explorerUrl: "https://scrollscan.com/tx/",                     name: "Scroll",                 mainnet: true  },
  scroll_sepolia:    { alchemySlug: "scroll-sepolia", chainId: 534351,     explorerUrl: "https://sepolia.scrollscan.com/tx/",             name: "Scroll Sepolia",         mainnet: false },

  // ─── BNB / BSC ──────────────────────────────────────────────────────────────
  bnb:               { alchemySlug: "bnb-mainnet",    chainId: 56,         explorerUrl: "https://bscscan.com/tx/",                        name: "BNB Chain",              mainnet: true  },
  bnb_testnet:       { alchemySlug: "bnb-testnet",    chainId: 97,         explorerUrl: "https://testnet.bscscan.com/tx/",                name: "BNB Testnet",            mainnet: false },
  opbnb:             { alchemySlug: "opbnb-mainnet",  chainId: 204,        explorerUrl: "https://opbnbscan.com/tx/",                      name: "opBNB",                  mainnet: true  },
  opbnb_testnet:     { alchemySlug: "opbnb-testnet",  chainId: 5611,       explorerUrl: "https://testnet.opbnbscan.com/tx/",              name: "opBNB Testnet",          mainnet: false },

  // ─── Avalanche ──────────────────────────────────────────────────────────────
  avalanche:         { alchemySlug: "avax-mainnet",   chainId: 43114,      explorerUrl: "https://snowtrace.io/tx/",                       name: "Avalanche C-Chain",      mainnet: true  },
  avalanche_fuji:    { alchemySlug: "avax-fuji",      chainId: 43113,      explorerUrl: "https://testnet.snowtrace.io/tx/",               name: "Avalanche Fuji",         mainnet: false },

  // ─── Fantom ─────────────────────────────────────────────────────────────────
  fantom:            { alchemySlug: "fantom-mainnet", chainId: 250,        explorerUrl: "https://ftmscan.com/tx/",                        name: "Fantom",                 mainnet: true  },
  fantom_testnet:    { alchemySlug: "fantom-testnet", chainId: 4002,       explorerUrl: "https://testnet.ftmscan.com/tx/",                name: "Fantom Testnet",         mainnet: false },

  // ─── Gnosis ─────────────────────────────────────────────────────────────────
  gnosis:            { alchemySlug: "gnosis-mainnet", chainId: 100,        explorerUrl: "https://gnosisscan.io/tx/",                      name: "Gnosis Chain",           mainnet: true  },
  gnosis_chiado:     { alchemySlug: "gnosis-chiado",  chainId: 10200,      explorerUrl: "https://gnosis-chiado.blockscout.com/tx/",       name: "Gnosis Chiado",          mainnet: false },

  // ─── Celo ───────────────────────────────────────────────────────────────────
  celo:              { alchemySlug: "celo-mainnet",   chainId: 42220,      explorerUrl: "https://celoscan.io/tx/",                        name: "Celo",                   mainnet: true  },
  celo_alfajores:    { alchemySlug: "celo-alfajores", chainId: 44787,      explorerUrl: "https://alfajores.celoscan.io/tx/",              name: "Celo Alfajores",         mainnet: false },
  celo_baklava:      { alchemySlug: "celo-baklava",   chainId: 62320,      explorerUrl: "https://baklava.celoscan.io/tx/",               name: "Celo Baklava",           mainnet: false },

  // ─── Mantle ─────────────────────────────────────────────────────────────────
  mantle:            { alchemySlug: "mantle-mainnet", chainId: 5000,       explorerUrl: "https://explorer.mantle.xyz/tx/",                name: "Mantle",                 mainnet: true  },
  mantle_sepolia:    { alchemySlug: "mantle-sepolia", chainId: 5003,       explorerUrl: "https://sepolia.mantlescan.xyz/tx/",             name: "Mantle Sepolia",         mainnet: false },

  // ─── Metis ──────────────────────────────────────────────────────────────────
  metis:             { alchemySlug: "metis-mainnet",  chainId: 1088,       explorerUrl: "https://andromeda-explorer.metis.io/tx/",        name: "Metis Andromeda",        mainnet: true  },

  // ─── Astar ──────────────────────────────────────────────────────────────────
  astar:             { alchemySlug: "astar-mainnet",  chainId: 592,        explorerUrl: "https://astar.blockscout.com/tx/",               name: "Astar",                  mainnet: true  },

  // ─── Shape ──────────────────────────────────────────────────────────────────
  shape:             { alchemySlug: "shape-mainnet",  chainId: 360,        explorerUrl: "https://shapescan.xyz/tx/",                      name: "Shape",                  mainnet: true  },
  shape_sepolia:     { alchemySlug: "shape-sepolia",  chainId: 11011,      explorerUrl: "https://sepolia.shapescan.xyz/tx/",              name: "Shape Sepolia",          mainnet: false },

  // ─── ZetaChain ──────────────────────────────────────────────────────────────
  zetachain:         { alchemySlug: "zetachain-mainnet", chainId: 7000,    explorerUrl: "https://explorer.zetachain.com/evm/tx/",         name: "ZetaChain",              mainnet: true  },
  zetachain_testnet: { alchemySlug: "zetachain-testnet", chainId: 7001,    explorerUrl: "https://athens3.explorer.zetachain.com/evm/tx/", name: "ZetaChain Athens",       mainnet: false },

  // ─── Frax ───────────────────────────────────────────────────────────────────
  frax:              { alchemySlug: "frax-mainnet",   chainId: 252,        explorerUrl: "https://fraxscan.com/tx/",                       name: "Fraxtal",                mainnet: true  },
  frax_sepolia:      { alchemySlug: "frax-sepolia",   chainId: 2522,       explorerUrl: "https://holesky.fraxscan.com/tx/",               name: "Fraxtal Sepolia",        mainnet: false },

  // ─── Unichain ───────────────────────────────────────────────────────────────
  unichain:          { alchemySlug: "unichain-mainnet", chainId: 130,      explorerUrl: "https://unichain.blockscout.com/tx/",            name: "Unichain",               mainnet: true  },
  unichain_sepolia:  { alchemySlug: "unichain-sepolia", chainId: 1301,     explorerUrl: "https://unichain-sepolia.blockscout.com/tx/",    name: "Unichain Sepolia",       mainnet: false },

  // ─── Sonic ──────────────────────────────────────────────────────────────────
  sonic:             { alchemySlug: "sonic-mainnet",  chainId: 146,        explorerUrl: "https://sonicscan.org/tx/",                      name: "Sonic",                  mainnet: true  },
  sonic_blaze:       { alchemySlug: "sonic-blaze",    chainId: 57054,      explorerUrl: "https://testnet.sonicscan.org/tx/",              name: "Sonic Blaze",            mainnet: false },

  // ─── Abstract ───────────────────────────────────────────────────────────────
  abstract:          { alchemySlug: "abstract-mainnet", chainId: 2741,     explorerUrl: "https://explorer.abstract.money/tx/",            name: "Abstract",               mainnet: true  },
  abstract_testnet:  { alchemySlug: "abstract-testnet", chainId: 11124,    explorerUrl: "https://explorer.testnet.abs.xyz/tx/",           name: "Abstract Testnet",       mainnet: false },

  // ─── Degen ──────────────────────────────────────────────────────────────────
  degen:             { alchemySlug: "degen-mainnet",  chainId: 666666666,  explorerUrl: "https://explorer.degen.tips/tx/",                name: "Degen Chain",            mainnet: true  },

  // ─── Ink ────────────────────────────────────────────────────────────────────
  ink:               { alchemySlug: "ink-mainnet",    chainId: 57073,      explorerUrl: "https://explorer.inkonchain.com/tx/",            name: "Ink",                    mainnet: true  },
  ink_sepolia:       { alchemySlug: "ink-sepolia",    chainId: 763373,     explorerUrl: "https://explorer.sepolia.inkonchain.com/tx/",    name: "Ink Sepolia",            mainnet: false },

  // ─── SEI ────────────────────────────────────────────────────────────────────
  sei:               { alchemySlug: "sei-mainnet",    chainId: 1329,       explorerUrl: "https://seitrace.com/tx/",                       name: "SEI",                    mainnet: true  },
  sei_testnet:       { alchemySlug: "sei-testnet",    chainId: 713715,     explorerUrl: "https://seitrace.com/tx/?chain=atlantic-2",      name: "SEI Atlantic",           mainnet: false },

  // ─── Ronin ──────────────────────────────────────────────────────────────────
  ronin:             { alchemySlug: "ronin-mainnet",  chainId: 2020,       explorerUrl: "https://app.roninchain.com/tx/",                 name: "Ronin",                  mainnet: true  },
  ronin_saigon:      { alchemySlug: "ronin-saigon",   chainId: 2021,       explorerUrl: "https://saigon-app.roninchain.com/tx/",          name: "Ronin Saigon",           mainnet: false },

  // ─── ApeChain ───────────────────────────────────────────────────────────────
  apechain:          { alchemySlug: "apechain-mainnet", chainId: 33139,    explorerUrl: "https://apescan.io/tx/",                         name: "ApeChain",               mainnet: true  },
  apechain_curtis:   { alchemySlug: "apechain-curtis",  chainId: 33111,    explorerUrl: "https://curtis.apescan.io/tx/",                  name: "ApeChain Curtis",        mainnet: false },

  // ─── Lens ───────────────────────────────────────────────────────────────────
  lens:              { alchemySlug: "lens-mainnet",   chainId: 232,        explorerUrl: "https://explorer.lens.xyz/tx/",                  name: "Lens",                   mainnet: true  },
  lens_sepolia:      { alchemySlug: "lens-sepolia",   chainId: 37111,      explorerUrl: "https://block-explorer.testnet.lens.dev/tx/",    name: "Lens Sepolia",           mainnet: false },

  // ─── Geist ──────────────────────────────────────────────────────────────────
  geist:             { alchemySlug: "geist-mainnet",  chainId: 63157,      explorerUrl: "https://geistscan.com/tx/",                      name: "Geist",                  mainnet: true  },
  geist_polter:      { alchemySlug: "geist-polter",   chainId: 63158,      explorerUrl: "https://polter.geistscan.com/tx/",               name: "Geist Polter",           mainnet: false },

  // ─── Lumia ──────────────────────────────────────────────────────────────────
  lumia:             { alchemySlug: "lumia-prism",    chainId: 994873017,  explorerUrl: "https://explorer.lumia.org/tx/",                 name: "Lumia Prism",            mainnet: true  },
  lumia_testnet:     { alchemySlug: "lumia-testnet",  chainId: 1952959480, explorerUrl: "https://testnet-explorer.lumia.org/tx/",         name: "Lumia Testnet",          mainnet: false },

  // ─── Polynomial ─────────────────────────────────────────────────────────────
  polynomial:        { alchemySlug: "polynomial-mainnet", chainId: 8008,   explorerUrl: "https://polynomialscan.io/tx/",                  name: "Polynomial",             mainnet: true  },
  polynomial_sepolia:{ alchemySlug: "polynomial-sepolia", chainId: 80008,  explorerUrl: "https://sepolia.polynomialscan.io/tx/",          name: "Polynomial Sepolia",     mainnet: false },

  // ─── CrossFi ────────────────────────────────────────────────────────────────
  crossfi:           { alchemySlug: "crossfi-mainnet", chainId: 4158,      explorerUrl: "https://xfiscan.com/tx/",                        name: "CrossFi",                mainnet: true  },
  crossfi_testnet:   { alchemySlug: "crossfi-testnet", chainId: 4157,      explorerUrl: "https://test.xfiscan.com/tx/",                   name: "CrossFi Testnet",        mainnet: false },

  // ─── Monad ──────────────────────────────────────────────────────────────────
  monad_testnet:     { alchemySlug: "monad-testnet",  chainId: 10143,      explorerUrl: "https://testnet.monadexplorer.com/tx/",          name: "Monad Testnet",          mainnet: false },

  // ─── Settlus ────────────────────────────────────────────────────────────────
  settlus:           { alchemySlug: "settlus-mainnet",  chainId: 5371,     explorerUrl: "https://explorer.settlus.network/tx/",           name: "Settlus",                mainnet: true  },
  settlus_testnet:   { alchemySlug: "settlus-septestnet", chainId: 5372,   explorerUrl: "https://sepolia.explorer.settlus.network/tx/",   name: "Settlus Testnet",        mainnet: false },

  // ─── Superseed ──────────────────────────────────────────────────────────────
  superseed:         { alchemySlug: "superseed-mainnet", chainId: 5330,    explorerUrl: "https://explorer.superseed.xyz/tx/",             name: "Superseed",              mainnet: true  },
  superseed_sepolia: { alchemySlug: "superseed-sepolia", chainId: 53302,   explorerUrl: "https://sepolia-explorer.superseed.xyz/tx/",     name: "Superseed Sepolia",      mainnet: false },

  // ─── Anime ──────────────────────────────────────────────────────────────────
  anime:             { alchemySlug: "anime-mainnet",  chainId: 69000,      explorerUrl: "https://animechain.blockscout.com/tx/",          name: "Anime",                  mainnet: true  },
  anime_sepolia:     { alchemySlug: "anime-sepolia",  chainId: 6900,       explorerUrl: "https://testnet.animechain.blockscout.com/tx/",  name: "Anime Sepolia",          mainnet: false },

  // ─── Story ──────────────────────────────────────────────────────────────────
  story:             { alchemySlug: "story-mainnet",  chainId: 1514,       explorerUrl: "https://storyscan.xyz/tx/",                      name: "Story",                  mainnet: true  },
  story_aeneid:      { alchemySlug: "story-aeneid",   chainId: 1513,       explorerUrl: "https://aeneid.storyscan.xyz/tx/",               name: "Story Aeneid",           mainnet: false },

  // ─── Botanix ────────────────────────────────────────────────────────────────
  botanix:           { alchemySlug: "botanix-mainnet", chainId: 3637,      explorerUrl: "https://blockscout.botanixlabs.dev/tx/",         name: "Botanix",                mainnet: true  },
  botanix_testnet:   { alchemySlug: "botanix-testnet", chainId: 3638,      explorerUrl: "https://testnet.blockscout.botanixlabs.dev/tx/", name: "Botanix Testnet",        mainnet: false },

  // ─── Humanity ───────────────────────────────────────────────────────────────
  humanity:          { alchemySlug: "humanity-mainnet", chainId: 1409,     explorerUrl: "https://explorer.humanity.org/tx/",              name: "Humanity",               mainnet: true  },

  // ─── Hyperliquid ────────────────────────────────────────────────────────────
  hyperliquid:       { alchemySlug: "hyperliquid-mainnet", chainId: 998,   explorerUrl: "https://explorer.hyperliquid.xyz/tx/",           name: "Hyperliquid",            mainnet: true  },
  hyperliquid_testnet: { alchemySlug: "hyperliquid-testnet", chainId: 999, explorerUrl: "https://explorer.hyperliquid.xyz/tx/",           name: "Hyperliquid Testnet",    mainnet: false },

  // ─── Plasma ─────────────────────────────────────────────────────────────────
  plasma:            { alchemySlug: "plasma-mainnet", chainId: 1020352220, explorerUrl: "https://plasmascan.io/tx/",                      name: "Plasma",                 mainnet: true  },
  plasma_testnet:    { alchemySlug: "plasma-testnet", chainId: 1020352221, explorerUrl: "https://testnet.plasmascan.io/tx/",              name: "Plasma Testnet",         mainnet: false },

  // ─── Gensyn ─────────────────────────────────────────────────────────────────
  gensyn_testnet:    { alchemySlug: "gensyn-testnet", chainId: 685685,     explorerUrl: "https://explorer.gensyn.ai/tx/",                 name: "Gensyn Testnet",         mainnet: false },

  // ─── Rise ───────────────────────────────────────────────────────────────────
  rise_testnet:      { alchemySlug: "rise-testnet",   chainId: 11155931,   explorerUrl: "https://explorer.riselabs.xyz/tx/",              name: "Rise Testnet",           mainnet: false },

  // ─── MegaETH ────────────────────────────────────────────────────────────────
  megaeth_testnet:   { alchemySlug: "megaeth-testnet", chainId: 6342,      explorerUrl: "https://megaexplorer.xyz/tx/",                   name: "MegaETH Testnet",        mainnet: false },

  // ─── TEA ────────────────────────────────────────────────────────────────────
  tea_sepolia:       { alchemySlug: "tea-sepolia",    chainId: 10218,      explorerUrl: "https://sepolia.tea.xyz/tx/",                    name: "TEA Sepolia",            mainnet: false },

  // ─── XMTP ───────────────────────────────────────────────────────────────────
  xmtp_testnet:      { alchemySlug: "xmtp-testnet",   chainId: 241320161,  explorerUrl: "https://explorer.xmtp.com/tx/",                  name: "XMTP Testnet",           mainnet: false },
};

/** All EVM chain keys supported by the registry. */
export const EVM_CHAIN_KEYS = new Set(Object.keys(CHAIN_REGISTRY));

/** Mainnet-only chains. */
export const MAINNET_CHAIN_KEYS = new Set(
  Object.entries(CHAIN_REGISTRY)
    .filter(([, c]) => c.mainnet)
    .map(([k]) => k)
);

/** Look up a chain by key — throws if not found. */
export function requireChain(chain: string): ChainConfig {
  const c = CHAIN_REGISTRY[chain];
  if (!c) throw new Error(`Unsupported chain: "${chain}" — see /api/chains for the full list`);
  return c;
}
