/**
 * Confidence helpers (scaffold for later detectors).
 * Phase 2: exported utilities only — no detectors call these yet.
 */

/**
 * Clamp a confidence score to 0–100.
 * @param {number} score
 * @returns {number}
 */
export function clampConfidence(score) {
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Map numeric confidence to a display label.
 * @param {number} score
 * @returns {"Confirmed" | "Detected" | "Likely" | "Possible"}
 */
export function confidenceLabel(score) {
  const n = clampConfidence(score);
  if (n >= 90) return "Confirmed";
  if (n >= 70) return "Detected";
  if (n >= 45) return "Likely";
  return "Possible";
}
