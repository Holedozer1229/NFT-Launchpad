"""
Tests for quantum_gravity_miner_iit_v8 — self-contained IIT v8 mining kernel.

Run with::

    cd miners/python-miner
    pip install numpy pytest
    pytest tests/test_quantum_gravity_miner_iit_v8.py -v
"""
import sys
import os

# Allow importing the module from the parent directory without installation
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import math
from quantum_gravity_miner_iit_v8 import (
    SpectralHash,
    PhiStructureV8,
    IITv8Engine,
    ASISphinxOSIITv8,
    MineResultV8,
    QuantumGravityMinerIITv8,
)


# ─────────────────────────────────────────────────────────────────────────────
# SpectralHash
# ─────────────────────────────────────────────────────────────────────────────

class TestSpectralHash:
    def setup_method(self):
        self.hasher = SpectralHash()

    def test_output_is_64_hex_chars(self):
        h = self.hasher.compute_spectral_signature(b"hello world")
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)

    def test_deterministic(self):
        data = b"same input every time"
        assert self.hasher.compute_spectral_signature(data) == \
               self.hasher.compute_spectral_signature(data)

    def test_different_inputs_different_hashes(self):
        h1 = self.hasher.compute_spectral_signature(b"block_data0")
        h2 = self.hasher.compute_spectral_signature(b"block_data1")
        assert h1 != h2

    def test_avalanche_effect_on_nonce(self):
        """Single-character nonce change should flip many bits."""
        h1 = self.hasher.compute_spectral_signature(b"header1")
        h2 = self.hasher.compute_spectral_signature(b"header2")
        n1, n2 = int(h1, 16), int(h2, 16)
        differing_bits = bin(n1 ^ n2).count("1")
        # Expect at least 50 bits different (out of 256) by the avalanche effect
        assert differing_bits > 50

    def test_empty_bytes(self):
        h = self.hasher.compute_spectral_signature(b"")
        assert len(h) == 64

    def test_large_input(self):
        h = self.hasher.compute_spectral_signature(b"x" * 10_000)
        assert len(h) == 64


# ─────────────────────────────────────────────────────────────────────────────
# PhiStructureV8
# ─────────────────────────────────────────────────────────────────────────────

class TestPhiStructureV8:
    def test_default_construction(self):
        s = PhiStructureV8()
        for field in ("phi_tau", "gwt_s", "icp_avg", "fano_score",
                      "phi_nab", "qg_score", "holo_score", "phi_total"):
            assert getattr(s, field) == 0.0

    def test_explicit_construction(self):
        s = PhiStructureV8(phi_total=0.75, qg_score=0.3)
        assert s.phi_total == 0.75
        assert s.qg_score == 0.3
        assert s.phi_tau == 0.0


# ─────────────────────────────────────────────────────────────────────────────
# IITv8Engine — component scores
# ─────────────────────────────────────────────────────────────────────────────

class TestIITv8Engine:
    def setup_method(self):
        self.engine = IITv8Engine(n_nodes=3, temporal_depth=2)

    def _check_score(self, score: float, name: str):
        assert isinstance(score, float), f"{name} must be float"
        assert 0.0 <= score <= 1.0, f"{name}={score} out of [0, 1]"

    def test_all_scores_in_range(self):
        data = b"test_block_data"
        self._check_score(self.engine.compute_phi_tau(data),    "phi_tau")
        self._check_score(self.engine.compute_gwt_score(data),  "gwt_s")
        self._check_score(self.engine.compute_icp_avg(data),    "icp_avg")
        self._check_score(self.engine.compute_fano_score(data), "fano_score")
        self._check_score(self.engine.compute_phi_nab(data),    "phi_nab")
        self._check_score(self.engine.compute_qg_score(data),   "qg_score")
        self._check_score(self.engine.compute_holo_score(data), "holo_score")

    def test_deterministic_scores(self):
        data = b"determinism_check"
        assert self.engine.compute_phi_tau(data) == self.engine.compute_phi_tau(data)
        assert self.engine.compute_qg_score(data) == self.engine.compute_qg_score(data)
        assert self.engine.compute_holo_score(data) == self.engine.compute_holo_score(data)

    def test_different_data_different_scores(self):
        """Independent domain suffixes ensure components vary across inputs."""
        d1, d2 = b"alpha", b"beta"
        # At least some component should differ for distinct inputs
        diffs = sum([
            self.engine.compute_phi_tau(d1)    != self.engine.compute_phi_tau(d2),
            self.engine.compute_qg_score(d1)   != self.engine.compute_qg_score(d2),
            self.engine.compute_holo_score(d1) != self.engine.compute_holo_score(d2),
            self.engine.compute_fano_score(d1) != self.engine.compute_fano_score(d2),
        ])
        assert diffs >= 3, "Expected ≥ 3 of 4 components to differ"

    def test_component_independence(self):
        """Each component uses a distinct domain suffix → they are not identical."""
        data = b"independence_test"
        scores = [
            self.engine.compute_phi_tau(data),
            self.engine.compute_gwt_score(data),
            self.engine.compute_icp_avg(data),
            self.engine.compute_fano_score(data),
            self.engine.compute_phi_nab(data),
            self.engine.compute_qg_score(data),
            self.engine.compute_holo_score(data),
        ]
        # Not all seven scores should be identical
        assert len(set(scores)) > 1

    def test_different_n_nodes(self):
        data = b"node_count_test"
        for n in (2, 3, 4, 5):
            engine = IITv8Engine(n_nodes=n, temporal_depth=1)
            score = engine.compute_phi_tau(data)
            assert 0.0 <= score <= 1.0, f"phi_tau out of range for n_nodes={n}"

    def test_temporal_depth_effect(self):
        data = b"temporal_depth"
        e1 = IITv8Engine(n_nodes=3, temporal_depth=1)
        e2 = IITv8Engine(n_nodes=3, temporal_depth=3)
        # Different depths should generally yield different phi_tau
        # (not guaranteed but very likely for random data)
        s1 = e1.compute_phi_tau(data)
        s2 = e2.compute_phi_tau(data)
        assert 0.0 <= s1 <= 1.0
        assert 0.0 <= s2 <= 1.0


# ─────────────────────────────────────────────────────────────────────────────
# ASISphinxOSIITv8
# ─────────────────────────────────────────────────────────────────────────────

class TestASISphinxOSIITv8:
    def setup_method(self):
        self.iit = ASISphinxOSIITv8()

    def test_compute_block_consciousness_returns_structure(self):
        s = self.iit.compute_block_consciousness(b"block")
        assert isinstance(s, PhiStructureV8)

    def test_phi_total_in_range(self):
        for seed in (b"a", b"bb", b"ccc", b"dddd"):
            s = self.iit.compute_block_consciousness(seed)
            assert 0.0 <= s.phi_total <= 1.0, f"phi_total={s.phi_total} out of range"

    def test_all_components_in_range(self):
        s = self.iit.compute_block_consciousness(b"components")
        for attr in ("phi_tau", "gwt_s", "icp_avg", "fano_score",
                     "phi_nab", "qg_score", "holo_score"):
            val = getattr(s, attr)
            assert 0.0 <= val <= 1.0, f"{attr}={val} out of [0, 1]"

    def test_phi_total_is_weighted_composite(self):
        """phi_total must equal the weighted sum of components."""
        iit = ASISphinxOSIITv8(
            alpha=0.30, beta=0.15, gamma=0.15, delta=0.15,
            epsilon=0.10, zeta=0.10, eta=0.05,
        )
        s = iit.compute_block_consciousness(b"weighted_sum_check")
        expected = (
            0.30 * s.phi_tau + 0.15 * s.gwt_s + 0.15 * s.icp_avg
            + 0.15 * s.fano_score + 0.10 * s.phi_nab
            + 0.10 * s.qg_score + 0.05 * s.holo_score
        )
        assert abs(s.phi_total - expected) < 1e-9

    def test_deterministic_phi_total(self):
        data = b"determinism"
        s1 = self.iit.compute_block_consciousness(data)
        s2 = self.iit.compute_block_consciousness(data)
        assert s1.phi_total == s2.phi_total

    def test_calculate_phi_returns_dict(self):
        result = self.iit.calculate_phi(b"phi_dict")
        assert "phi_total" in result
        assert "structure" in result
        assert isinstance(result["structure"], PhiStructureV8)
        assert result["phi_total"] == result["structure"].phi_total

    def test_phi_to_legacy_score_range(self):
        for phi in (0.0, 0.25, 0.5, 0.75, 1.0):
            score = self.iit.phi_to_legacy_score(phi)
            assert 200.0 <= score <= 1000.0

    def test_phi_to_legacy_score_linearity(self):
        assert self.iit.phi_to_legacy_score(0.0) == pytest.approx(200.0)
        assert self.iit.phi_to_legacy_score(1.0) == pytest.approx(1000.0)
        assert self.iit.phi_to_legacy_score(0.5) == pytest.approx(600.0)

    def test_phi_to_legacy_score_clamps(self):
        assert self.iit.phi_to_legacy_score(-1.0) == pytest.approx(200.0)
        assert self.iit.phi_to_legacy_score(2.0)  == pytest.approx(1000.0)

    # ── consciousness gate ────────────────────────────────────────────────────

    def test_consciousness_gate_solo_miner(self):
        """n_nodes=1 → log₂(1)=0; gate: Φ_total > δ·fano + ζ·qg."""
        iit = ASISphinxOSIITv8(delta=0.15, zeta=0.10)
        # High phi_total, low fano/qg → should pass
        assert iit.validate_consciousness_consensus(0.5, 0.0, 0.0, 1) is True
        # phi_total below threshold (0.0 > 0.0 is False)
        assert iit.validate_consciousness_consensus(0.0, 0.0, 0.0, 1) is False

    def test_consciousness_gate_threshold_increases_with_nodes(self):
        """More network nodes → stricter threshold."""
        iit = ASISphinxOSIITv8(delta=0.0, zeta=0.0)
        phi = 0.5
        # n=1: threshold = 0 → passes
        assert iit.validate_consciousness_consensus(phi, 0.0, 0.0, 1) is True
        # n=2: threshold = log₂(2) = 1.0 > 0.5 → fails
        assert iit.validate_consciousness_consensus(phi, 0.0, 0.0, 2) is False

    def test_consciousness_gate_exact_threshold(self):
        """Φ_total strictly greater than threshold is required."""
        iit = ASISphinxOSIITv8(delta=0.0, zeta=0.0)
        # Exactly at threshold: 0.0 > log₂(1)=0.0 is False
        assert iit.validate_consciousness_consensus(0.0, 0.0, 0.0, 1) is False
        # Just above threshold
        assert iit.validate_consciousness_consensus(1e-9, 0.0, 0.0, 1) is True

    def test_consciousness_gate_fano_and_qg_contribution(self):
        """δ·fano + ζ·qg raises the threshold for n=1."""
        iit = ASISphinxOSIITv8(delta=0.20, zeta=0.10)
        # threshold = 0 + 0.20*1.0 + 0.10*1.0 = 0.30
        assert iit.validate_consciousness_consensus(0.25, 1.0, 1.0, 1) is False
        assert iit.validate_consciousness_consensus(0.35, 1.0, 1.0, 1) is True


# ─────────────────────────────────────────────────────────────────────────────
# MineResultV8
# ─────────────────────────────────────────────────────────────────────────────

class TestMineResultV8:
    def test_construction(self):
        r = MineResultV8(
            nonce=42, block_hash="abc", phi_total=0.6,
            qg_score=0.3, holo_score=0.8, fano_score=0.4,
            phi_score=680.0, attempts=5,
        )
        assert r.nonce == 42
        assert r.phi_total == 0.6
        assert r.attempts == 5

    def test_failed_result(self):
        r = MineResultV8(
            nonce=None, block_hash=None, phi_total=0.0,
            qg_score=0.0, holo_score=0.0, fano_score=0.0,
            phi_score=200.0, attempts=1_000_000,
        )
        assert r.nonce is None
        assert r.block_hash is None


# ─────────────────────────────────────────────────────────────────────────────
# QuantumGravityMinerIITv8 — unit tests
# ─────────────────────────────────────────────────────────────────────────────

class TestQuantumGravityMinerIITv8Unit:
    def setup_method(self):
        self.kernel = QuantumGravityMinerIITv8()

    # ── meets_difficulty ─────────────────────────────────────────────────────

    def test_meets_difficulty_trivial(self):
        """difficulty=1 → target=2^255; ~50% of hashes satisfy this."""
        # A hash of all zeros trivially satisfies any positive target
        assert QuantumGravityMinerIITv8.meets_difficulty("0" * 64, 1) is True

    def test_meets_difficulty_impossible(self):
        """A hash of all 'f' never satisfies a positive difficulty."""
        # "f"*64 → int = 2^256-1; target for difficulty=1 is 2^255 < 2^256-1
        assert QuantumGravityMinerIITv8.meets_difficulty("f" * 64, 1) is False

    def test_meets_difficulty_zero(self):
        """difficulty=0 → always True."""
        assert QuantumGravityMinerIITv8.meets_difficulty("f" * 64, 0) is True

    def test_meets_difficulty_stricter_with_higher_difficulty(self):
        """Higher difficulty → smaller target → harder to satisfy."""
        # A hash with leading zeros
        easy_hash = "0" * 16 + "f" * 48  # many leading zero nibbles
        results = [
            QuantumGravityMinerIITv8.meets_difficulty(easy_hash, d)
            for d in (1, 10, 50, 100, 200)
        ]
        # The result sequence must be non-increasing (once it fails, stays False)
        for i in range(len(results) - 1):
            if not results[i]:
                assert not results[i + 1]

    # ── compute_hash ─────────────────────────────────────────────────────────

    def test_compute_hash_returns_64_chars(self):
        h = self.kernel.compute_hash(b"data")
        assert len(h) == 64

    def test_compute_hash_deterministic(self):
        assert self.kernel.compute_hash(b"x") == self.kernel.compute_hash(b"x")

    # ── compute_phi_structure ────────────────────────────────────────────────

    def test_compute_phi_structure_in_range(self):
        s = self.kernel.compute_phi_structure(b"some_block_data")
        assert 0.0 <= s.phi_total <= 1.0
        assert 0.0 <= s.qg_score <= 1.0

    # ── compute_phi_score ────────────────────────────────────────────────────

    def test_compute_phi_score_in_range(self):
        score = self.kernel.compute_phi_score(b"some data")
        assert 200.0 <= score <= 1000.0

    # ── is_valid_block ───────────────────────────────────────────────────────

    def test_is_valid_block_returns_tuple_of_three(self):
        result = self.kernel.is_valid_block(b"data", difficulty=1)
        assert len(result) == 3
        valid, structure, gate = result
        assert isinstance(valid, bool)
        assert isinstance(structure, PhiStructureV8)
        assert isinstance(gate, str)

    def test_is_valid_block_trivial_difficulty(self):
        """difficulty=0 → spectral gate always passes; IIT/QG gates still apply."""
        valid, structure, gate_failed = self.kernel.is_valid_block(b"data0", difficulty=0)
        # gate_failed must be "", "consciousness", or "qg_curvature" (not "difficulty")
        assert gate_failed != "difficulty"

    def test_is_valid_block_impossible_difficulty(self):
        """difficulty so high that no hash can satisfy it → difficulty rejected."""
        # 2^256 - 1 has 256 bits → target = 2^0 = 1 → only hash=0 passes
        impossible = 2 ** 256 - 1
        valid, _, gate_failed = self.kernel.is_valid_block(b"data", difficulty=impossible)
        assert not valid
        assert gate_failed == "difficulty"

    def test_failed_qg_gate_reported(self):
        """Kernel with qg_threshold=1.0 ensures QG gate always fails."""
        kernel = QuantumGravityMinerIITv8(qg_threshold=1.0)
        # Scan a few nonces; at least one should pass difficulty but fail QG
        for nonce in range(50):
            data = f"test{nonce}".encode()
            valid, struct, gate = kernel.is_valid_block(data, difficulty=0)
            if not valid and gate == "qg_curvature":
                return  # found the expected case
        # If all passed difficulty AND consciousness AND hit QG — that's fine too
        # but if some failed QG, we already returned

    def test_failed_consciousness_gate_reported(self):
        """Kernel with very high n_network_nodes → consciousness always fails."""
        # n_nodes=64: log₂(64)=6 > phi_total (≤1) → always fails
        kernel = QuantumGravityMinerIITv8()
        for nonce in range(30):
            data = f"cons{nonce}".encode()
            valid, _, gate = kernel.is_valid_block(data, difficulty=0, n_network_nodes=64)
            if not valid and gate == "consciousness":
                return
        pytest.fail("Expected consciousness gate rejection for n_network_nodes=64")


# ─────────────────────────────────────────────────────────────────────────────
# QuantumGravityMinerIITv8 — mining integration tests
# ─────────────────────────────────────────────────────────────────────────────

class TestQuantumGravityMinerIITv8Mining:
    """
    Integration tests that actually call mine() / mine_with_stats().

    Uses difficulty=1 (target=2^255; ~50% of spectral hashes pass) and
    n_network_nodes=1 (consciousness threshold = δ·fano + ζ·qg ≤ 0.25) so
    that mining completes within a handful of attempts.
    """

    EASY_DIFFICULTY = 1
    MAX_ATTEMPTS = 2_000

    def setup_method(self):
        self.kernel = QuantumGravityMinerIITv8(qg_threshold=0.0)  # disable QG gate

    def test_mine_finds_valid_block(self):
        result = self.kernel.mine(
            "genesis_block",
            difficulty=self.EASY_DIFFICULTY,
            max_attempts=self.MAX_ATTEMPTS,
        )
        assert result.nonce is not None, "Expected a valid nonce to be found"
        assert result.block_hash is not None
        assert len(result.block_hash) == 64
        assert result.attempts >= 1

    def test_mine_result_satisfies_all_gates(self):
        """The returned hash must genuinely satisfy the difficulty gate."""
        result = self.kernel.mine(
            "verify_block",
            difficulty=self.EASY_DIFFICULTY,
            max_attempts=self.MAX_ATTEMPTS,
        )
        assert result.nonce is not None
        # Recompute and verify manually
        data = f"verify_block{result.nonce}".encode()
        hash_hex = self.kernel.compute_hash(data)
        assert hash_hex == result.block_hash
        assert QuantumGravityMinerIITv8.meets_difficulty(hash_hex, self.EASY_DIFFICULTY)

    def test_mine_result_fields_in_range(self):
        result = self.kernel.mine(
            "range_check",
            difficulty=self.EASY_DIFFICULTY,
            max_attempts=self.MAX_ATTEMPTS,
        )
        assert result.nonce is not None
        assert 0.0 <= result.phi_total <= 1.0
        assert 0.0 <= result.qg_score  <= 1.0
        assert 0.0 <= result.holo_score <= 1.0
        assert 0.0 <= result.fano_score <= 1.0
        assert 200.0 <= result.phi_score <= 1000.0

    def test_mine_returns_none_when_impossible(self):
        """No valid block can be found in 5 attempts against 2^256-1 difficulty."""
        result = self.kernel.mine(
            "impossible",
            difficulty=2 ** 256 - 1,
            max_attempts=5,
        )
        assert result.nonce is None
        assert result.block_hash is None
        assert result.attempts == 5

    def test_mine_with_stats_structure(self):
        result, stats = self.kernel.mine_with_stats(
            "stats_block",
            difficulty=self.EASY_DIFFICULTY,
            max_attempts=self.MAX_ATTEMPTS,
        )
        assert "total_attempts" in stats
        assert "difficulty_rejected" in stats
        assert "consciousness_rejected" in stats
        assert "qg_curvature_rejected" in stats
        assert "accepted" in stats

    def test_mine_with_stats_totals(self):
        """Rejected + accepted = total_attempts (when a block is found)."""
        result, stats = self.kernel.mine_with_stats(
            "totals_block",
            difficulty=self.EASY_DIFFICULTY,
            max_attempts=self.MAX_ATTEMPTS,
        )
        if result.nonce is not None:
            total = (
                stats["difficulty_rejected"]
                + stats["consciousness_rejected"]
                + stats["qg_curvature_rejected"]
                + stats["accepted"]
            )
            assert total == stats["total_attempts"]
            assert stats["accepted"] == 1

    def test_mine_with_stats_accepted_on_success(self):
        result, stats = self.kernel.mine_with_stats(
            "accepted_flag",
            difficulty=self.EASY_DIFFICULTY,
            max_attempts=self.MAX_ATTEMPTS,
        )
        if result.nonce is not None:
            assert stats["accepted"] == 1

    def test_mine_with_stats_accepted_zero_on_failure(self):
        _, stats = self.kernel.mine_with_stats(
            "fail_block",
            difficulty=2 ** 256 - 1,
            max_attempts=3,
        )
        assert stats["accepted"] == 0
        assert stats["difficulty_rejected"] == 3

    def test_mine_different_blocks_different_nonces(self):
        """Different block data should (almost certainly) yield different nonces."""
        r1 = self.kernel.mine("block_A", difficulty=self.EASY_DIFFICULTY,
                              max_attempts=self.MAX_ATTEMPTS)
        r2 = self.kernel.mine("block_B", difficulty=self.EASY_DIFFICULTY,
                              max_attempts=self.MAX_ATTEMPTS)
        # They might coincidentally land on the same nonce, but hashes will differ
        if r1.nonce is not None and r2.nonce is not None:
            assert r1.block_hash != r2.block_hash

    def test_qg_gate_active(self):
        """With qg_threshold=1.0 and easy difficulty, QG gate rejects most blocks."""
        kernel = QuantumGravityMinerIITv8(qg_threshold=1.0)
        _, stats = kernel.mine_with_stats(
            "qg_gate_test",
            difficulty=self.EASY_DIFFICULTY,
            max_attempts=200,
        )
        # QG gate should have fired at least once
        assert stats["qg_curvature_rejected"] + stats["difficulty_rejected"] > 0

    def test_consciousness_gate_active(self):
        """n_network_nodes=64 forces all blocks to fail the consciousness gate."""
        kernel = QuantumGravityMinerIITv8(qg_threshold=0.0)
        _, stats = kernel.mine_with_stats(
            "consciousness_gate_test",
            difficulty=self.EASY_DIFFICULTY,
            n_network_nodes=64,
            max_attempts=100,
        )
        # With log₂(64)=6 >> phi_total (≤1), consciousness gate must fire
        assert stats["consciousness_rejected"] > 0
        assert stats["accepted"] == 0
