type HapticPattern = "success" | "error" | "warning" | "tap" | "mining-block" | "milestone" | "transaction" | "heavy";

const patterns: Record<HapticPattern, number | number[]> = {
  tap: 10,
  success: [10, 30, 10],
  error: [50, 30, 50],
  warning: [30, 20, 30],
  "mining-block": [15, 20, 15, 20, 40],
  milestone: [20, 30, 20, 30, 20, 30, 60],
  transaction: [10, 20, 10, 40, 80],
  heavy: [40, 30, 80],
};

export function haptic(pattern: HapticPattern = "tap") {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(patterns[pattern] ?? 10);
    }
  } catch {}
}
