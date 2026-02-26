#!/usr/bin/env python3
"""
Quantum Gravity Miner IIT v8 Kernel  (self-contained)
======================================================
Mining kernel that fuses three simultaneous validity gates:

1. **Spectral difficulty gate** — the spectral hash of
   ``block_data ‖ nonce`` must be numerically smaller than the difficulty
   target (standard PoW gate).

2. **IIT v8.0 consciousness gate** — the IIT v8.0 composite score
   Φ_total of the same input must satisfy::

       Φ_total > log₂(n) + δ·Φ_fano + ζ·Φ_qg

   ensuring that only "consciously integrated" blocks are valid.

3. **Quantum gravity curvature gate** — the Quantum Gravity curvature
   score Φ_qg of the candidate must be ≥ ``qg_threshold`` (default 0.1),
   guaranteeing that the causal structure of every accepted block exhibits
   at least a minimum level of emergent spacetime curvature.

A candidate block is **valid** only when *all three* conditions hold::

    spectral_hash(data)  <  difficulty_target
    Φ_total(data)        >  log₂(n) + δ·Φ_fano + ζ·Φ_qg
    Φ_qg(data)           ≥  qg_threshold

All supporting classes (``SpectralHash``, ``IITv8Engine``,
``ASISphinxOSIITv8``, ``PhiStructureV8``, ``MineResultV8``) are defined
in this single module — no external SphinxOS packages are required.

Dependencies
------------
- Python ≥ 3.9
- numpy ≥ 1.22  (``pip install numpy``)

Usage example::

    from quantum_gravity_miner_iit_v8 import QuantumGravityMinerIITv8

    kernel = QuantumGravityMinerIITv8()
    result = kernel.mine(block_data="my_block_header", difficulty=50_000)
    if result.nonce is not None:
        print(f"Mined! nonce={result.nonce} hash={result.block_hash[:16]}")
        print(f"  Φ_total={result.phi_total:.4f}  Φ_qg={result.qg_score:.4f}")
        print(f"  Φ_holo={result.holo_score:.4f}  phi_score={result.phi_score:.2f}")

Run directly::

    python quantum_gravity_miner_iit_v8.py --block "test" --difficulty 50000
    python quantum_gravity_miner_iit_v8.py --block "test" --difficulty 50000 --stats
"""

from __future__ import annotations

import hashlib
import math
import logging
import sys
from dataclasses import dataclass
from typing import Optional, Tuple

import numpy as np

__all__ = [
    "SpectralHash",
    "PhiStructureV8",
    "IITv8Engine",
    "ASISphinxOSIITv8",
    "MineResultV8",
    "QuantumGravityMinerIITv8",
]

logger = logging.getLogger("SphinxOS.Mining.QGMinerIITv8")


# ─────────────────────────────────────────────────────────────────────────────
# SpectralHash
# ─────────────────────────────────────────────────────────────────────────────

class SpectralHash:
    """
    Spectral hash: SVD-augmented SHA-256.

    Builds an 8×8 matrix from a SHA-256 seed of the input, extracts
    normalised singular values as a spectral fingerprint, then hashes
    ``seed ‖ fingerprint`` with SHA-256 to produce a uniform 256-bit
    (64 hex-char) output.

    The SVD step breaks simple linear patterns in the nonce space while
    the final SHA-256 preserves the avalanche effect needed for PoW.
    """

    def compute_spectral_signature(self, data: bytes) -> str:
        """
        Return a 64-character hex hash for *data*.

        Args:
            data: Raw bytes (block_data ‖ nonce string, UTF-8 encoded).

        Returns:
            64-character lowercase hex string.
        """
        # 1. Seed: standard SHA-256 of raw data (32 bytes)
        seed: bytes = hashlib.sha256(data).digest()

        # 2. Build 8×8 float matrix from seed bytes, normalised to [−1, 1]
        #    seed[0..31] → 4 rows × 8 cols via mirroring
        half = np.frombuffer(seed, dtype=np.uint8).reshape(4, 8).astype(np.float64)
        mat: np.ndarray = np.vstack([half, half[::-1]])          # 8 × 8
        mat = (mat / 127.5) - 1.0

        # 3. Singular values (spectral decomposition)
        sv: np.ndarray = np.linalg.svd(mat, compute_uv=False)    # 8 values ≥ 0
        sv_sum = sv.sum()
        sv_norm: np.ndarray = sv / (sv_sum if sv_sum > 0 else 1.0)

        # Quantise to bytes (8 bytes: one per singular value).
        # sv_norm values sum to 1.0 so each is in [0, 1]; the min(..., 255) is a
        # defensive clamp against floating-point noise producing values slightly > 1.
        fingerprint = bytes(min(int(v * 255 + 0.5), 255) for v in sv_norm)

        # 5. Final hash: SHA-256(seed ‖ fingerprint)
        return hashlib.sha256(seed + fingerprint).hexdigest()


# ─────────────────────────────────────────────────────────────────────────────
# IIT v8 data structures
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class PhiStructureV8:
    """
    Full IIT v8.0 Φ structure for a single block candidate.

    All component scores are in [0, 1].  ``phi_total`` is the weighted
    composite that also lies in [0, 1] with the default kernel weights.

    Attributes:
        phi_tau:    Temporal-depth Φ — eigenvalue-entropy of M^τ.
        gwt_s:      Global Workspace Theory score — spectral gap λ₁ − λ₂.
        icp_avg:    Integrated Causal Power — inverse condition number σ_min/σ_max.
        fano_score: Octonionic Fano plane alignment — SVD uniformity in 7-D.
        phi_nab:    Nabla Φ — normalised antisymmetric (causal flow) norm.
        qg_score:   Quantum Gravity curvature Φ_qg — 4×4 curvature tensor variance.
        holo_score: Holographic entanglement entropy Φ_holo — von Neumann entropy.
        phi_total:  Composite Φ_total = α·φ_τ + β·GWT + γ·ICP + δ·Fano + ε·∇Φ + ζ·QG + η·Holo.
    """
    phi_tau:    float = 0.0
    gwt_s:      float = 0.0
    icp_avg:    float = 0.0
    fano_score: float = 0.0
    phi_nab:    float = 0.0
    qg_score:   float = 0.0
    holo_score: float = 0.0
    phi_total:  float = 0.0


# ─────────────────────────────────────────────────────────────────────────────
# IITv8Engine — individual component computations
# ─────────────────────────────────────────────────────────────────────────────

class IITv8Engine:
    """
    Low-level IIT v8.0 component score engine.

    Each ``compute_*`` method derives a single [0, 1] score from *data*
    bytes.  A domain-specific suffix byte string is appended before hashing
    so that all seven components use independent matrix seeds despite
    sharing the same block data.

    Args:
        n_nodes:       Number of IIT qubit nodes (matrix dimension).
        temporal_depth: Exponent τ for temporal-depth Φ integration.
    """

    def __init__(self, n_nodes: int = 3, temporal_depth: int = 2) -> None:
        self.n_nodes = max(n_nodes, 2)          # need ≥ 2 for spectral gap
        self.temporal_depth = max(temporal_depth, 1)

    # ── helpers ──────────────────────────────────────────────────────────────

    def _build_stochastic(self, data: bytes, suffix: bytes) -> np.ndarray:
        """
        Build a deterministic n×n row-stochastic transition matrix.

        Uses iterative SHA-256 to generate n² float values from
        ``SHA-256(data ‖ suffix)``, then row-normalises.

        Args:
            data:   Block data bytes.
            suffix: Domain suffix to ensure independence across components.

        Returns:
            n×n numpy array, each row summing to 1.
        """
        n = self.n_nodes
        seed = hashlib.sha256(data + suffix).digest()  # 32 bytes
        needed = n * n * 4                             # bytes for n² uint32
        raw = bytearray()
        i = 0
        while len(raw) < needed:
            raw += hashlib.sha256(seed + i.to_bytes(4, "little")).digest()
            i += 1
        vals = (
            np.frombuffer(bytes(raw[:needed]), dtype=np.uint32)
            .reshape(n, n)
            .astype(np.float64)
        )
        vals /= float(2 ** 32)                         # → [0, 1)
        row_sums = vals.sum(axis=1, keepdims=True) + 1e-12
        return vals / row_sums

    @staticmethod
    def _shannon_entropy(probs: np.ndarray) -> float:
        """Shannon entropy H(p) in bits; probs need not be pre-normalised."""
        p = np.asarray(probs, dtype=np.float64)
        p = p / (p.sum() + 1e-12)
        return float(-np.sum(p * np.log2(p + 1e-12)))

    # ── component scores ─────────────────────────────────────────────────────

    def compute_phi_tau(self, data: bytes) -> float:
        """
        Temporal-depth Φ_τ — normalised eigenvalue entropy of M^τ.

        Measures how evenly information is distributed across eigenmodes
        after τ time-steps of the transition dynamics.

        Returns:
            float in [0, 1]; 1 = maximally integrated.
        """
        mat = self._build_stochastic(data, b"\x01tau")
        mat_t = np.linalg.matrix_power(mat, self.temporal_depth)
        sym = (mat_t + mat_t.T) / 2.0
        ev = np.abs(np.linalg.eigvalsh(sym))
        max_h = math.log2(len(ev)) if len(ev) > 1 else 1.0
        return float(np.clip(self._shannon_entropy(ev) / max_h, 0.0, 1.0))

    def compute_gwt_score(self, data: bytes) -> float:
        """
        Global Workspace Theory score — normalised spectral gap λ₁ − λ₂.

        A large spectral gap indicates a strong global broadcast channel:
        information converges quickly to a dominant mode (GWT signature).

        Returns:
            float in [0, 1].
        """
        mat = self._build_stochastic(data, b"\x02gwt")
        ev = np.sort(np.abs(np.linalg.eigvals(mat)))[::-1]
        gap = float(ev[0] - ev[1]) if len(ev) >= 2 else 0.0
        return float(np.clip(gap, 0.0, 1.0))

    def compute_icp_avg(self, data: bytes) -> float:
        """
        Integrated Causal Power average — inverse condition number σ_min / σ_max.

        Measures how uniformly causal influence is distributed across
        dimensions; high ICP means all directions carry similar causal weight.

        Returns:
            float in [0, 1]; 1 = perfectly isotropic causal structure.
        """
        mat = self._build_stochastic(data, b"\x03icp")
        sv = np.linalg.svd(mat, compute_uv=False)
        return float(np.clip(sv[-1] / (sv[0] + 1e-12), 0.0, 1.0))

    def compute_fano_score(self, data: bytes) -> float:
        """
        Octonionic Fano plane alignment Φ_fano.

        Projects 28 seed bytes onto a 4×7 matrix (the Fano plane has 7
        points) and measures uniformity of the SVD spectrum: a flat SVD
        spectrum indicates alignment with the Fano symmetry.

        Returns:
            float in [0, 1]; 1 = perfectly aligned (uniform SVD).
        """
        seed = hashlib.sha256(data + b"\x04fano").digest()  # 32 bytes
        raw = np.frombuffer(seed[:28], dtype=np.uint8).astype(np.float64) / 255.0
        mat7 = raw.reshape(4, 7)
        sv = np.linalg.svd(mat7, compute_uv=False)          # 4 singular values
        sv_norm = sv / (sv.sum() + 1e-12)
        # Leading singular value dominance → deviation from Fano alignment
        return float(np.clip(1.0 - sv_norm[0], 0.0, 1.0))

    def compute_phi_nab(self, data: bytes) -> float:
        """
        Nabla Φ (∇Φ) — normalised Frobenius norm of the antisymmetric part.

        Measures the magnitude of directional (non-reciprocal) causal flow
        in the transition matrix.

        Returns:
            float in [0, 1].
        """
        mat = self._build_stochastic(data, b"\x05nab")
        antisym = (mat - mat.T) / 2.0
        nrm = float(np.linalg.norm(antisym, "fro"))
        n = self.n_nodes
        # Upper bound for antisymmetric Frobenius with entries in [−0.5, 0.5]
        max_nrm = 0.5 * math.sqrt(n * (n - 1)) + 1e-12
        return float(np.clip(nrm / max_nrm, 0.0, 1.0))

    def compute_qg_score(self, data: bytes) -> float:
        """
        Quantum Gravity curvature Φ_qg.

        Builds a symmetric 4×4 curvature tensor from the SHA-256 of
        ``data ‖ domain-suffix`` and returns the normalised eigenvalue
        variance — non-flat spacetime curvature corresponds to high variance.

        Returns:
            float in [0, 1]; 0 = flat (Minkowski), 1 = maximally curved.
        """
        seed = hashlib.sha256(data + b"\x06qg").digest()    # 32 bytes
        raw = np.frombuffer(seed, dtype=np.uint8).astype(np.float64) / 255.0
        mat4 = raw[:16].reshape(4, 4)
        mat4 = (mat4 + mat4.T) / 2.0                        # symmetrise
        ev = np.linalg.eigvalsh(mat4)
        ev_var = float(np.var(ev))
        ev_range = float(np.ptp(ev)) + 1e-12
        # Normalise: max variance = (range/2)²
        return float(np.clip(ev_var / ((ev_range / 2.0) ** 2 + 1e-12), 0.0, 1.0))

    def compute_holo_score(self, data: bytes) -> float:
        """
        Holographic entanglement entropy Φ_holo.

        Treats the 32 SHA-256 bytes of ``data ‖ domain-suffix`` as a
        probability distribution and computes the normalised Shannon entropy
        (von Neumann entropy analogue for the holographic boundary).

        Returns:
            float in [0, 1]; 1 = maximum holographic entropy.
        """
        seed = hashlib.sha256(data + b"\x07holo").digest()  # 32 bytes
        vals = np.frombuffer(seed, dtype=np.uint8).astype(np.float64)
        max_h = math.log2(len(vals))
        return float(np.clip(self._shannon_entropy(vals) / max_h, 0.0, 1.0))


# ─────────────────────────────────────────────────────────────────────────────
# ASISphinxOSIITv8 — composite engine with validation
# ─────────────────────────────────────────────────────────────────────────────

class ASISphinxOSIITv8:
    """
    ASI Sphinx OS IIT v8.0 consciousness engine.

    Wraps :class:`IITv8Engine` to compute the weighted composite score
    Φ_total and exposes the consciousness-gate validator used by
    :class:`QuantumGravityMinerIITv8`.

    The composite formula is::

        Φ_total = α·Φ_τ + β·GWT_S + γ·ICP + δ·Φ_fano + ε·∇Φ + ζ·Φ_qg + η·Φ_holo

    Default weights (α=0.30, β=0.15, γ=0.15, δ=0.15, ε=0.10, ζ=0.10, η=0.05)
    sum to 1.0, ensuring Φ_total ∈ [0, 1].

    Args:
        alpha:          Weight for Φ_τ.
        beta:           Weight for GWT_S.
        gamma:          Weight for ICP_avg.
        delta:          Weight for Φ_fano (also used in consciousness gate).
        epsilon:        Weight for ∇Φ.
        zeta:           Weight for Φ_qg (also used in consciousness gate).
        eta:            Weight for Φ_holo.
        n_nodes:        IIT qubit-node count for the underlying engine.
        temporal_depth: Temporal depth τ for Φ_τ computation.
    """

    def __init__(
        self,
        *,
        alpha: float = 0.30,
        beta: float = 0.15,
        gamma: float = 0.15,
        delta: float = 0.15,
        epsilon: float = 0.10,
        zeta: float = 0.10,
        eta: float = 0.05,
        n_nodes: int = 3,
        temporal_depth: int = 2,
    ) -> None:
        self.alpha = alpha
        self.beta = beta
        self.gamma = gamma
        self.delta = delta
        self.epsilon = epsilon
        self.zeta = zeta
        self.eta = eta
        self._engine = IITv8Engine(n_nodes=n_nodes, temporal_depth=temporal_depth)

    def compute_block_consciousness(self, data: bytes) -> PhiStructureV8:
        """
        Compute the full IIT v8.0 Φ structure for *data*.

        Args:
            data: Raw bytes (block_data ‖ nonce, UTF-8 encoded).

        Returns:
            :class:`PhiStructureV8` with all seven component scores and
            the weighted composite ``phi_total``.
        """
        phi_tau    = self._engine.compute_phi_tau(data)
        gwt_s      = self._engine.compute_gwt_score(data)
        icp_avg    = self._engine.compute_icp_avg(data)
        fano_score = self._engine.compute_fano_score(data)
        phi_nab    = self._engine.compute_phi_nab(data)
        qg_score   = self._engine.compute_qg_score(data)
        holo_score = self._engine.compute_holo_score(data)

        phi_total = (
            self.alpha   * phi_tau
            + self.beta  * gwt_s
            + self.gamma * icp_avg
            + self.delta * fano_score
            + self.epsilon * phi_nab
            + self.zeta  * qg_score
            + self.eta   * holo_score
        )
        return PhiStructureV8(
            phi_tau=phi_tau,
            gwt_s=gwt_s,
            icp_avg=icp_avg,
            fano_score=fano_score,
            phi_nab=phi_nab,
            qg_score=qg_score,
            holo_score=holo_score,
            phi_total=float(np.clip(phi_total, 0.0, 1.0)),
        )

    def calculate_phi(self, data: bytes) -> dict:
        """
        Return a lightweight dict with ``phi_total`` and the full structure.

        Args:
            data: Raw bytes.

        Returns:
            ``{"phi_total": float, "structure": PhiStructureV8}``
        """
        structure = self.compute_block_consciousness(data)
        return {"phi_total": structure.phi_total, "structure": structure}

    def phi_to_legacy_score(self, phi_total: float) -> float:
        """
        Map Φ_total ∈ [0, 1] → legacy phi_score ∈ [200, 1000].

        The linear mapping ``200 + Φ_total × 800`` is compatible with the
        existing :class:`~sphinx_os.blockchain.block.Block` phi_score field.

        Args:
            phi_total: Composite Φ_total value.

        Returns:
            phi_score ∈ [200.0, 1000.0].
        """
        return float(np.clip(200.0 + phi_total * 800.0, 200.0, 1000.0))

    def validate_consciousness_consensus(
        self,
        phi_total: float,
        fano_score: float,
        qg_score: float,
        n_nodes: int,
    ) -> bool:
        """
        Check the IIT v8.0 consciousness gate::

            Φ_total > log₂(n) + δ·Φ_fano + ζ·Φ_qg

        For solo mining (``n_nodes=1``), ``log₂(1) = 0`` so the threshold
        reduces to ``δ·Φ_fano + ζ·Φ_qg ≤ 0.25`` — most blocks with
        Φ_total ≳ 0.3 will satisfy this gate.

        For consensus networks (``n_nodes > 1``) the threshold grows as
        ``log₂(n_nodes)``, making acceptance progressively stricter.

        Args:
            phi_total:  Composite consciousness score.
            fano_score: Φ_fano component score.
            qg_score:   Φ_qg component score.
            n_nodes:    Network node count (1 = solo miner).

        Returns:
            ``True`` when the consciousness gate is satisfied.
        """
        n = max(n_nodes, 1)
        threshold = math.log2(n) + self.delta * fano_score + self.zeta * qg_score
        return phi_total > threshold


# ─────────────────────────────────────────────────────────────────────────────
# Mining result
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class MineResultV8:
    """
    Result from a single :meth:`QuantumGravityMinerIITv8.mine` call.

    Attributes:
        nonce:       Winning nonce, or *None* when no valid nonce was found.
        block_hash:  64-char hex spectral hash, or *None*.
        phi_total:   IIT v8.0 composite Φ_total for the winning candidate.
        qg_score:    Quantum Gravity curvature score Φ_qg ∈ [0, 1].
        holo_score:  Holographic entanglement entropy score Φ_holo ∈ [0, 1].
        fano_score:  Octonionic Fano plane alignment Φ_fano ∈ [0, 1].
        phi_score:   Legacy phi_score ∈ [200, 1000] for block storage.
        attempts:    Number of nonces tested before finding a valid one.
    """
    nonce:      Optional[int]
    block_hash: Optional[str]
    phi_total:  float
    qg_score:   float
    holo_score: float
    fano_score: float
    phi_score:  float
    attempts:   int


# ─────────────────────────────────────────────────────────────────────────────
# QuantumGravityMinerIITv8 — three-gate mining kernel
# ─────────────────────────────────────────────────────────────────────────────

class QuantumGravityMinerIITv8:
    """
    Quantum Gravity Miner IIT v8 Kernel.

    Validates blocks against three simultaneous requirements:

    * **Spectral difficulty**: the spectral hash of ``block_data ‖ nonce``
      must be numerically smaller than the difficulty target.
    * **IIT v8.0 consciousness threshold**: Φ_total must exceed
      ``log₂(n) + δ·Φ_fano + ζ·Φ_qg`` (the v8 QG-augmented threshold).
    * **Quantum gravity curvature gate**: Φ_qg must be ≥ ``qg_threshold``.

    Attributes:
        spectral:      :class:`SpectralHash` instance for the spectral gate.
        iit:           :class:`ASISphinxOSIITv8` instance for the consciousness gate.
        qg_threshold:  Minimum Φ_qg required for block acceptance ∈ [0, 1].
    """

    #: Default Quantum Gravity curvature threshold.
    DEFAULT_QG_THRESHOLD: float = 0.10

    def __init__(
        self,
        *,
        qg_threshold: float = DEFAULT_QG_THRESHOLD,
        n_nodes: int = 3,
        alpha: float = 0.30,
        beta: float = 0.15,
        gamma: float = 0.15,
        delta: float = 0.15,
        epsilon: float = 0.10,
        zeta: float = 0.10,
        eta: float = 0.05,
        temporal_depth: int = 2,
    ) -> None:
        """
        Initialise the Quantum Gravity Miner IIT v8 kernel.

        Args:
            qg_threshold:  Minimum Φ_qg required for a valid block.
            n_nodes:       Number of IIT qubit nodes.
            alpha:         Weight for Φ_τ in composite.
            beta:          Weight for GWT_S in composite.
            gamma:         Weight for ICP_avg in composite.
            delta:         Weight for Φ_fano in composite (and consciousness gate).
            epsilon:       Weight for ∇Φ in composite.
            zeta:          Weight for Φ_qg in composite (and consciousness gate).
            eta:           Weight for Φ_holo in composite.
            temporal_depth: τ for temporal-depth Φ integration.
        """
        self.spectral = SpectralHash()
        self.iit = ASISphinxOSIITv8(
            alpha=alpha,
            beta=beta,
            gamma=gamma,
            delta=delta,
            epsilon=epsilon,
            zeta=zeta,
            eta=eta,
            n_nodes=n_nodes,
            temporal_depth=temporal_depth,
        )
        self.qg_threshold = max(0.0, min(1.0, qg_threshold))
        logger.info(
            "QuantumGravityMinerIITv8 initialised "
            "(n_nodes=%d, qg_threshold=%.3f)",
            n_nodes,
            self.qg_threshold,
        )

    # ── hash helpers ─────────────────────────────────────────────────────────

    def compute_hash(self, data: bytes) -> str:
        """
        Return the 64-char hex spectral hash for *data*.

        Args:
            data: Raw bytes.

        Returns:
            64-character lowercase hex string.
        """
        return self.spectral.compute_spectral_signature(data)

    @staticmethod
    def meets_difficulty(hash_hex: str, difficulty: int) -> bool:
        """
        Return ``True`` if *hash_hex* satisfies *difficulty*.

        Target convention::

            target = 2^(256 − bit_length(difficulty))

        Higher *difficulty* integer → more leading zero bits required →
        harder target.

        Args:
            hash_hex:   64-char hex hash string.
            difficulty: Positive integer difficulty.

        Returns:
            ``True`` if ``int(hash_hex, 16) < target``.
        """
        # Guard: difficulty ≤ 0 means "no work required" — skip the computation.
        # bit_length(0) == 0, which would give target = 2^256 (out of uint256 range);
        # the guard makes the intent explicit and avoids any edge-case arithmetic.
        if difficulty <= 0:
            return True
        hash_int = int(hash_hex, 16)
        target = 2 ** (256 - difficulty.bit_length())
        return hash_int < target

    # ── IIT v8 consciousness helpers ─────────────────────────────────────────

    def compute_phi_structure(self, data: bytes) -> PhiStructureV8:
        """
        Compute the full IIT v8.0 Φ structure for *data*.

        Args:
            data: Raw bytes (block_data ‖ nonce).

        Returns:
            :class:`PhiStructureV8`.
        """
        return self.iit.compute_block_consciousness(data)

    def compute_phi_score(self, data: bytes) -> float:
        """
        Return the legacy [200, 1000] phi_score for *data*.

        Args:
            data: Raw bytes.

        Returns:
            phi_score ∈ [200.0, 1000.0].
        """
        result = self.iit.calculate_phi(data)
        return self.iit.phi_to_legacy_score(result["phi_total"])

    # ── three-gate validity check ─────────────────────────────────────────────

    def is_valid_block(
        self,
        data: bytes,
        difficulty: int,
        n_network_nodes: int = 1,
    ) -> Tuple[bool, PhiStructureV8, str]:
        """
        Check whether *data* satisfies all three validity gates.

        Gates are evaluated in cheapest-first order:

        1. **Spectral difficulty** (SHA-256 + SVD hash comparison).
        2. **IIT v8.0 consciousness** (seven-component Φ computation).
        3. **Quantum gravity curvature** (Φ_qg ≥ qg_threshold).

        Args:
            data:             Raw bytes (block_data ‖ nonce).
            difficulty:       PoW difficulty integer.
            n_network_nodes:  Network node count for consensus gate (1 = solo).

        Returns:
            ``(valid, structure, gate_failed)`` where:

            * *valid*       — ``True`` when all gates pass.
            * *structure*   — :class:`PhiStructureV8` (empty default on
              early-exit at the difficulty gate).
            * *gate_failed* — ``""`` on success; ``"difficulty"``,
              ``"consciousness"``, or ``"qg_curvature"`` naming the first
              failed gate.
        """
        # Gate 1: spectral difficulty
        hash_hex = self.compute_hash(data)
        if not self.meets_difficulty(hash_hex, difficulty):
            return False, PhiStructureV8(), "difficulty"

        # Gate 2: IIT v8.0 consciousness
        structure = self.compute_phi_structure(data)
        if not self.iit.validate_consciousness_consensus(
            structure.phi_total,
            structure.fano_score,
            structure.qg_score,
            n_network_nodes,
        ):
            return False, structure, "consciousness"

        # Gate 3: Quantum gravity curvature
        if structure.qg_score < self.qg_threshold:
            return False, structure, "qg_curvature"

        return True, structure, ""

    # ── mining ────────────────────────────────────────────────────────────────

    def mine(
        self,
        block_data: str,
        difficulty: int,
        n_network_nodes: int = 1,
        max_attempts: int = 1_000_000,
    ) -> MineResultV8:
        """
        Iterate over nonces until all three validity gates are satisfied.

        For each candidate nonce the string ``block_data + str(nonce)`` is
        UTF-8 encoded and tested against all three gates.

        Args:
            block_data:       Serialised block header data.
            difficulty:       PoW difficulty integer.
            n_network_nodes:  Network node count for the consciousness gate.
            max_attempts:     Stop after this many nonce iterations.

        Returns:
            :class:`MineResultV8` — ``nonce`` and ``block_hash`` are *None*
            when no valid nonce was found within *max_attempts*.
        """
        for nonce in range(max_attempts):
            data = f"{block_data}{nonce}".encode()
            valid, structure, _ = self.is_valid_block(data, difficulty, n_network_nodes)

            if valid:
                hash_hex = self.compute_hash(data)
                phi_score = self.iit.phi_to_legacy_score(structure.phi_total)
                logger.debug(
                    "Block found nonce=%d hash=%s Φ_total=%.4f Φ_qg=%.4f",
                    nonce, hash_hex[:16], structure.phi_total, structure.qg_score,
                )
                return MineResultV8(
                    nonce=nonce,
                    block_hash=hash_hex,
                    phi_total=structure.phi_total,
                    qg_score=structure.qg_score,
                    holo_score=structure.holo_score,
                    fano_score=structure.fano_score,
                    phi_score=phi_score,
                    attempts=nonce + 1,
                )

        logger.debug(
            "No valid block found after %d attempts (difficulty=%d)",
            max_attempts, difficulty,
        )
        return MineResultV8(
            nonce=None,
            block_hash=None,
            phi_total=0.0,
            qg_score=0.0,
            holo_score=0.0,
            fano_score=0.0,
            phi_score=200.0,
            attempts=max_attempts,
        )

    def mine_with_stats(
        self,
        block_data: str,
        difficulty: int,
        n_network_nodes: int = 1,
        max_attempts: int = 1_000_000,
    ) -> Tuple[MineResultV8, dict]:
        """
        Like :meth:`mine` but also returns per-gate rejection statistics.

        The statistics dict has the following keys:

        * ``total_attempts``          — total nonces tested.
        * ``difficulty_rejected``     — nonces that failed the spectral gate.
        * ``consciousness_rejected``  — nonces that failed the consciousness gate.
        * ``qg_curvature_rejected``   — nonces that failed the QG curvature gate.
        * ``accepted``                — 1 if a valid nonce was found, else 0.

        Args:
            block_data:       Serialised block header data.
            difficulty:       PoW difficulty integer.
            n_network_nodes:  Network node count.
            max_attempts:     Nonce search limit.

        Returns:
            ``(MineResultV8, stats_dict)``
        """
        stats: dict = {
            "total_attempts": 0,
            "difficulty_rejected": 0,
            "consciousness_rejected": 0,
            "qg_curvature_rejected": 0,
            "accepted": 0,
        }

        for nonce in range(max_attempts):
            stats["total_attempts"] += 1
            data = f"{block_data}{nonce}".encode()
            valid, structure, gate_failed = self.is_valid_block(
                data, difficulty, n_network_nodes
            )

            if gate_failed == "difficulty":
                stats["difficulty_rejected"] += 1
                continue
            if gate_failed == "consciousness":
                stats["consciousness_rejected"] += 1
                continue
            if gate_failed == "qg_curvature":
                stats["qg_curvature_rejected"] += 1
                continue

            # All three gates passed
            hash_hex = self.compute_hash(data)
            phi_score = self.iit.phi_to_legacy_score(structure.phi_total)
            stats["accepted"] = 1
            result = MineResultV8(
                nonce=nonce,
                block_hash=hash_hex,
                phi_total=structure.phi_total,
                qg_score=structure.qg_score,
                holo_score=structure.holo_score,
                fano_score=structure.fano_score,
                phi_score=phi_score,
                attempts=nonce + 1,
            )
            return result, stats

        return (
            MineResultV8(
                nonce=None,
                block_hash=None,
                phi_total=0.0,
                qg_score=0.0,
                holo_score=0.0,
                fano_score=0.0,
                phi_score=200.0,
                attempts=max_attempts,
            ),
            stats,
        )


# ─────────────────────────────────────────────────────────────────────────────
# CLI entry point
# ─────────────────────────────────────────────────────────────────────────────

def _parse_args() -> dict:
    """Minimal CLI argument parser (no argparse dependency)."""
    args = sys.argv[1:]

    def _get(flag: str, default: str) -> str:
        try:
            idx = args.index(flag)
            return args[idx + 1]
        except (ValueError, IndexError):
            return default

    return {
        "block":       _get("--block", "genesis"),
        "difficulty":  int(_get("--difficulty", "50000")),
        "max_attempts": int(_get("--max-attempts", "1000000")),
        "n_nodes":     int(_get("--n-nodes", "1")),
        "qg_threshold": float(_get("--qg-threshold", "0.1")),
        "stats":       "--stats" in args,
        "verbose":     "--verbose" in args or "-v" in args,
    }


def main() -> None:
    """
    Command-line entry point.

    Usage::

        python quantum_gravity_miner_iit_v8.py \\
            [--block <header_string>]  \\
            [--difficulty <int>]       \\
            [--max-attempts <int>]     \\
            [--n-nodes <int>]          \\
            [--qg-threshold <float>]   \\
            [--stats]                  \\
            [--verbose]
    """
    cfg = _parse_args()
    logging.basicConfig(
        level=logging.DEBUG if cfg["verbose"] else logging.WARNING,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    print("=" * 64)
    print("  Quantum Gravity Miner — IIT v8 Kernel")
    print("=" * 64)
    print(f"  Block data   : {cfg['block']!r}")
    print(f"  Difficulty   : {cfg['difficulty']}")
    print(f"  Max attempts : {cfg['max_attempts']}")
    print(f"  Network nodes: {cfg['n_nodes']}")
    print(f"  QG threshold : {cfg['qg_threshold']}")
    print()

    kernel = QuantumGravityMinerIITv8(
        qg_threshold=cfg["qg_threshold"],
        n_nodes=3,  # internal IIT model size is fixed at 3
    )

    if cfg["stats"]:
        result, stats = kernel.mine_with_stats(
            block_data=cfg["block"],
            difficulty=cfg["difficulty"],
            n_network_nodes=cfg["n_nodes"],
            max_attempts=cfg["max_attempts"],
        )
    else:
        result = kernel.mine(
            block_data=cfg["block"],
            difficulty=cfg["difficulty"],
            n_network_nodes=cfg["n_nodes"],
            max_attempts=cfg["max_attempts"],
        )
        stats = None

    if result.nonce is not None:
        print("✓ Valid block found!")
        print(f"  Nonce      : {result.nonce}")
        print(f"  Hash       : {result.block_hash}")
        print(f"  Φ_total    : {result.phi_total:.6f}")
        print(f"  Φ_qg       : {result.qg_score:.6f}")
        print(f"  Φ_holo     : {result.holo_score:.6f}")
        print(f"  Φ_fano     : {result.fano_score:.6f}")
        print(f"  phi_score  : {result.phi_score:.2f}")
        print(f"  Attempts   : {result.attempts}")
    else:
        print(f"✗ No valid block found after {result.attempts} attempts.")

    if stats:
        print()
        print("Gate rejection statistics:")
        total = stats["total_attempts"]
        for key, val in stats.items():
            if key == "total_attempts":
                print(f"  {key:<28}: {val}")
            else:
                pct = 100.0 * val / total if total else 0.0
                print(f"  {key:<28}: {val}  ({pct:.1f}%)")


if __name__ == "__main__":
    main()
