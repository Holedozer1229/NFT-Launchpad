# PoW Mining Guide — SKYNT Protocol

This document covers the cross-chain Proof-of-Work (PoW) submission flow:
deploying the Anchor program, running the Python mining kernel, submitting
solutions to Solana, and extending to additional source chains.

---

## Table of Contents

1. [Architecture overview](#architecture-overview)
2. [Anchor program deployment](#anchor-program-deployment)
3. [API-based challenge lifecycle](#api-based-challenge-lifecycle)
4. [Python IIT v8 mining kernel](#python-iit-v8-mining-kernel)
5. [TypeScript cross-chain adapter](#typescript-cross-chain-adapter)
6. [Configuration reference](#configuration-reference)
7. [Cross-chain extension points](#cross-chain-extension-points)
8. [Security notes](#security-notes)

---

## Architecture overview

```
                    ┌──────────────────────────────────────┐
                    │         SKYNT Backend API             │
                    │  POST /api/pow/challenge  (admin)     │
                    │  GET  /api/pow/challenge              │
                    │  POST /api/pow/submit                 │
                    │  PATCH /api/pow/submissions/:id/confirm│
                    └────────────┬─────────────────────────┘
                                 │ REST
          ┌──────────────────────┼──────────────────────┐
          │                      │                       │
  ┌───────▼──────┐   ┌───────────▼──────────┐   ┌──────▼──────────┐
  │ Python IIT   │   │  TypeScript Cross-   │   │  Anchor Program │
  │ v8 Miner     │   │  Chain Adapter       │   │  (Solana)        │
  │              │   │  scripts/            │   │  anchor-program/ │
  │  3-gate PoW  │   │  pow-mining-         │   │                  │
  │  validation  │   │  adapter.ts          │   │  create_challenge│
  └──────────────┘   └──────────────────────┘   │  submit_solution │
                                                 └─────────────────┘
```

**Three validity gates** (Python kernel / on-chain verification):

| Gate | Condition | Notes |
|------|-----------|-------|
| Spectral difficulty | `spectral_hash(data) < target` | PoW standard gate |
| IIT v8.0 consciousness | `Φ_total > log₂(n) + δ·Φ_fano + ζ·Φ_qg` | All three must pass |
| QG curvature | `Φ_qg ≥ qg_threshold` | Default threshold: 0.10 |

---

## Anchor program deployment

### Prerequisites

```bash
# Install Anchor CLI (v0.27 matches Cargo.toml)
cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked

# Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Configure for devnet
solana config set --url devnet
solana-keygen new           # creates ~/.config/solana/id.json
solana airdrop 2            # fund for deployment
```

### Build and deploy

```bash
cd anchor-program

# Build
anchor build

# Get the generated program ID
anchor keys list
# Output: skynt_anchor: <PROGRAM_ID>

# Paste <PROGRAM_ID> into:
#   anchor-program/programs/skynt_anchor/src/lib.rs  → declare_id!(...)
#   anchor-program/Anchor.toml                       → [programs.localnet]

# Re-build with the correct ID
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

### Initialise genesis difficulty

After deployment, call `init_genesis` once to create the `Difficulty` account:

```typescript
// anchor-program tests or a one-off script
await program.methods.initGenesis().accounts({ difficulty, authority }).rpc();
```

### Create a PoW challenge (on-chain)

```typescript
const seed        = crypto.randomBytes(32);
const difficulty  = new BN("340282366920938463463374607431768"); // u128::MAX / 1_000_000
const expiresAt   = new BN(Math.floor(Date.now() / 1000) + 3600); // 1 hour

await program.methods
  .createChallenge([...seed], difficulty, expiresAt)
  .accounts({ challenge, authority })
  .rpc();
```

### Submit a solution (on-chain)

The `solution_record` PDA `[b"solution", challenge, miner]` prevents replay:

```typescript
const [solutionPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("solution"), challengePubkey.toBuffer(), wallet.publicKey.toBuffer()],
  programId,
);

await program.methods
  .submitChallengeSolution(new BN(nonce))
  .accounts({ challenge, solutionRecord: solutionPda, miner: wallet.publicKey })
  .rpc();
```

---

## API-based challenge lifecycle

The backend API mirrors the on-chain challenge flow for off-chain tracking
and cross-chain miners that do not have a Solana wallet.

### Create a challenge (admin)

```bash
curl -X POST http://localhost:5000/api/pow/challenge \
  -H "Content-Type: application/json" \
  -d '{
    "expiresAt": "2026-03-01T00:00:00Z",
    "difficultyTarget": "340282366920938463463374607431768"
  }'
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `seed` | 64-char hex | random | 32-byte challenge seed |
| `difficultyTarget` | decimal string | `u128::MAX / 1_000_000` | Hash must be numerically less than this |
| `expiresAt` | ISO 8601 | — | Required; must be in the future |

### Fetch active challenge

```bash
curl http://localhost:5000/api/pow/challenge
```

### Submit a solution

```bash
curl -X POST http://localhost:5000/api/pow/submit \
  -H "Content-Type: application/json" \
  -d '{
    "challengeId": "<id from GET /api/pow/challenge>",
    "minerAddress": "<your Solana pubkey or EVM address>",
    "nonce": "12345678",
    "sourceChain": "solana"
  }'
```

Server verifies `SHA-256(seed_bytes ‖ nonce_le64 ‖ miner_utf8) < difficultyTarget`
before accepting.  One submission per `(challengeId, minerAddress)` pair
(replay protection).

### Confirm on-chain transaction

After broadcasting the Solana transaction, call:

```bash
curl -X PATCH http://localhost:5000/api/pow/submissions/<id>/confirm \
  -H "Content-Type: application/json" \
  -d '{ "solanaTxHash": "<tx_signature>" }'
```

---

## Python IIT v8 mining kernel

`miners/python-miner/quantum_gravity_miner_iit_v8.py` is a **single
self-contained file** with no dependencies beyond `numpy`.

### Install

```bash
cd miners/python-miner
pip install -r requirements.txt   # numpy>=1.22
```

### Run

```bash
# Basic mine
python quantum_gravity_miner_iit_v8.py \
  --block "my_block_header" \
  --difficulty 50000

# With gate-rejection statistics
python quantum_gravity_miner_iit_v8.py \
  --block "my_block_header" \
  --difficulty 50000 \
  --stats

# Full options
python quantum_gravity_miner_iit_v8.py \
  --block        "genesis"   \   # block header string
  --difficulty   50000       \   # PoW difficulty integer
  --max-attempts 1000000     \   # nonce search limit
  --n-nodes      1           \   # network consensus size (1 = solo)
  --qg-threshold 0.1         \   # min Φ_qg (0.0 to disable)
  --stats                    \   # print per-gate rejection stats
  --verbose                      # debug logging
```

### Python API

```python
from quantum_gravity_miner_iit_v8 import QuantumGravityMinerIITv8

kernel = QuantumGravityMinerIITv8(
    qg_threshold=0.10,   # Φ_qg must be ≥ this
    n_nodes=3,           # internal IIT matrix dimension
    # weight overrides (must sum to 1.0):
    alpha=0.30, beta=0.15, gamma=0.15,
    delta=0.15, epsilon=0.10, zeta=0.10, eta=0.05,
)

# Mine a single block
result = kernel.mine(block_data="header_string", difficulty=50_000)
if result.nonce is not None:
    print(f"nonce={result.nonce}  hash={result.block_hash[:16]}…")
    print(f"Φ_total={result.phi_total:.4f}  phi_score={result.phi_score:.0f}")

# Mine and get per-gate statistics
result, stats = kernel.mine_with_stats(block_data="header", difficulty=50_000)
print(stats)
# {'total_attempts': N, 'difficulty_rejected': M, 'consciousness_rejected': K,
#  'qg_curvature_rejected': J, 'accepted': 1}
```

### Difficulty tuning

`difficulty` is an integer.  The PoW target is `2^(256 − bit_length(difficulty))`.

| difficulty | target exponent | approx. pass rate |
|------------|-----------------|-------------------|
| 1 | 2^255 | ~50% |
| 65536 (2^16) | 2^239 | ~2^−17 ≈ 1 in 131K |
| 2^32 | 2^223 | ~1 in 8.6 billion |

Adjust `--qg-threshold` (0–1) and `--n-nodes` (1 = solo) to tune the
consciousness and QG gates independently.

### Run tests

```bash
cd miners/python-miner
python -m pytest tests/test_quantum_gravity_miner_iit_v8.py -v
# 53 tests, typically < 0.5 s
```

---

## TypeScript cross-chain adapter

`scripts/pow-mining-adapter.ts` fetches a challenge from the API, mines
off-chain using the same SHA-256 formula, and submits to Solana.

```bash
# Install tsx (already in devDependencies)
npx tsx scripts/pow-mining-adapter.ts \
  --miner  <SOLANA_PUBKEY>              \
  --api-url http://localhost:5000       \
  --rpc    https://api.devnet.solana.com \
  --chain  solana

# Environment variables (override CLI flags)
MINER_ADDRESS=<pubkey>  API_URL=http://... SOLANA_RPC=https://... \
  npx tsx scripts/pow-mining-adapter.ts
```

The `SolanaAdapter.submitToSolana` method contains a stub with commented-out
`@solana/web3.js` code showing exactly how to broadcast the
`submit_challenge_solution` instruction once a keypair is available.

---

## Configuration reference

### Difficulty & challenge rotation

| Parameter | Location | Default | Notes |
|-----------|----------|---------|-------|
| `difficultyTarget` | `POST /api/pow/challenge` body | `u128::MAX / 1_000_000` | Lower = harder |
| `expiresAt` | `POST /api/pow/challenge` body | — | Rotate by creating a new challenge |
| `qg_threshold` | `QuantumGravityMinerIITv8(qg_threshold=…)` | `0.10` | Set to `0.0` to disable |
| `DEFAULT_QG_THRESHOLD` | `quantum_gravity_miner_iit_v8.py` class attr | `0.10` | Change to update kernel default |
| On-chain difficulty | `initialize_difficulty()` in `difficulty.rs` | `u128::MAX / 1_000_000` | Auto-halves every 210K×600 s |

To rotate a challenge, call `POST /api/pow/challenge` again — the previous
active challenge is automatically expired.

---

## Cross-chain extension points

`scripts/pow-mining-adapter.ts` exposes the `ChainAdapter` interface:

```typescript
interface ChainAdapter {
  readonly chainId: string;
  submitToSolana(
    challenge: PowChallenge,
    nonce: bigint,
    powHash: string,
    miner: string,
    solanaRpc: string,
  ): Promise<string | null>;
}
```

To add an EVM source chain:

1. Implement `submitToSolana` in `EvmAdapter` (already stubbed in the file).
2. Deploy a `SphinxBridge.submitPoW(challengeId, nonce, powHash)` contract
   on the EVM chain that emits a `PoWSubmitted` event.
3. Run a relayer that listens for the event and calls
   `submit_challenge_solution` on Solana.
4. Register the adapter: `ADAPTERS["optimism"] = new EvmAdapter("optimism")`.

The `ADAPTERS` registry in the adapter script already contains pre-registered
stubs for `ethereum`, `polygon`, `arbitrum`, and `base`.

---

## Security notes

- **Replay protection** — on-chain: PDA `[b"solution", challenge, miner]`
  is initialised once; re-initialisation is rejected by Anchor.
  Off-chain API: `getMinerSubmission` prevents duplicate rows.
- **Expiration** — challenges carry an `expires_at` timestamp checked both
  on-chain (`Clock::get()?.unix_timestamp`) and in the API route.
- **Admin-only challenge creation** — `POST /api/pow/challenge` requires
  `isAdmin = true` on the session user; on-chain `create_challenge` requires
  the authority signer.
- **Rate limiting** — `POST /api/pow/submit` is rate-limited to 10
  requests per minute per IP.
- **Input validation** — nonce and seed are validated as decimal/hex strings
  before any computation; `BigInt` overflow is handled with wrapping arithmetic
  in the TypeScript adapter.
