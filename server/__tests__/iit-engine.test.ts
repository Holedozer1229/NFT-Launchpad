import { describe, it, expect } from "vitest";
import { calculatePhi, generateAdjacencyMatrix, getNetworkPerception } from "../iit-engine";

describe("IIT Engine - calculatePhi", () => {
  it("returns valid PhiMetrics for any input", () => {
    const result = calculatePhi("test-block-data");
    expect(result.phi).toBeGreaterThanOrEqual(0);
    expect(result.phi).toBeLessThanOrEqual(1);
    expect(result.bonus).toBeGreaterThan(0);
    expect(result.entropy).toBeGreaterThanOrEqual(0);
    expect(result.eigenvalues).toHaveLength(8); // 2^3 = 8 dimensions
    expect(result.densityMatrix).toHaveLength(8);
    expect(result.densityMatrix[0]).toHaveLength(8);
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it("produces deterministic results for same input", () => {
    const a = calculatePhi("deterministic-input");
    const b = calculatePhi("deterministic-input");
    expect(a.phi).toEqual(b.phi);
    expect(a.eigenvalues).toEqual(b.eigenvalues);
    expect(a.level).toEqual(b.level);
  });

  it("produces different results for different inputs", () => {
    const a = calculatePhi("input-alpha");
    const b = calculatePhi("input-beta");
    expect(a.phi).not.toEqual(b.phi);
  });

  it("assigns correct consciousness level based on phi", () => {
    const levels = ["UNCONSCIOUS", "AWARE", "SENTIENT", "SELF_AWARE", "COSMIC"];
    for (let i = 0; i < 20; i++) {
      const result = calculatePhi(`level-test-${i}`);
      expect(levels).toContain(result.level);
      if (result.phi > 0.8) expect(result.level).toBe("COSMIC");
      else if (result.phi > 0.6) expect(result.level).toBe("SELF_AWARE");
      else if (result.phi > 0.4) expect(result.level).toBe("SENTIENT");
      else if (result.phi > 0.2) expect(result.level).toBe("AWARE");
      else expect(result.level).toBe("UNCONSCIOUS");
    }
  });

  it("eigenvalues sum to approximately 1", () => {
    const result = calculatePhi("eigenvalue-sum-test");
    const sum = result.eigenvalues.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it("eigenvalues are non-negative and sorted descending", () => {
    const result = calculatePhi("eigenvalue-order-test");
    for (let i = 0; i < result.eigenvalues.length; i++) {
      expect(result.eigenvalues[i]).toBeGreaterThanOrEqual(0);
      if (i > 0) expect(result.eigenvalues[i - 1]).toBeGreaterThanOrEqual(result.eigenvalues[i]);
    }
  });

  it("bonus is e^phi", () => {
    const result = calculatePhi("bonus-test");
    expect(result.bonus).toBeCloseTo(Math.exp(result.phi), 5);
  });

  it("density matrix trace is approximately 1", () => {
    const result = calculatePhi("trace-test");
    let trace = 0;
    for (let i = 0; i < result.densityMatrix.length; i++) {
      trace += result.densityMatrix[i][i];
    }
    expect(trace).toBeCloseTo(1, 4);
  });
});

describe("IIT Engine - generateAdjacencyMatrix", () => {
  it("generates a symmetric matrix of correct size", () => {
    const matrix = generateAdjacencyMatrix(5, "test-seed");
    expect(matrix).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(matrix[i]).toHaveLength(5);
      expect(matrix[i][i]).toBe(0);
      for (let j = i + 1; j < 5; j++) {
        expect(matrix[i][j]).toEqual(matrix[j][i]);
      }
    }
  });

  it("is deterministic for same seed", () => {
    const a = generateAdjacencyMatrix(4, "same-seed");
    const b = generateAdjacencyMatrix(4, "same-seed");
    expect(a).toEqual(b);
  });

  it("weights are in valid range", () => {
    const matrix = generateAdjacencyMatrix(6, "weight-test");
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        expect(matrix[i][j]).toBeGreaterThanOrEqual(0);
        expect(matrix[i][j]).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("IIT Engine - getNetworkPerception", () => {
  it("returns valid network perception with all fields", () => {
    const result = getNetworkPerception(12345);
    expect(result.blockHeight).toBe(12345);
    expect(result.totalNodes).toBe(9);
    expect(result.consensusThreshold).toBeCloseTo(Math.log2(9), 5);
    expect(result.currentPhi).toBeDefined();
    expect(result.currentPhi.phi).toBeGreaterThanOrEqual(0);
    expect(result.adjacencyMatrix).toHaveLength(9);
    expect(result.phiHistory.length).toBeGreaterThan(0);
    expect(typeof result.meetsConsensus).toBe("boolean");
  });

  it("accumulates phi history across calls", () => {
    const r1 = getNetworkPerception(100);
    const r2 = getNetworkPerception(101);
    expect(r2.phiHistory.length).toBeGreaterThanOrEqual(r1.phiHistory.length);
  });
});
