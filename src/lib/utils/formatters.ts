/**
 * Formats milliseconds into a clean readable string (e.g., "142 ms" or "1.24 s")
 * Returns fallback placeholder if undefined or null.
 */
export function formatLatency(ms?: number | null, fallback = "—"): string {
  if (ms === undefined || ms === null) return fallback;
  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  }
  return `${(ms / 1000).toFixed(2)} s`;
}

/**
 * Formats token counts into a localized integer string (e.g., "1,240")
 */
export function formatTokens(count?: number | null, fallback = "—"): string {
  if (count === undefined || count === null) return fallback;
  return count.toLocaleString();
}

/**
 * Formats decimal percentages (e.g. 0.654 -> "65.4%")
 */
export function formatPercentage(val?: number | null, fallback = "—"): string {
  if (val === undefined || val === null) return fallback;
  return `${(val * 100).toFixed(1)}%`;
}

/**
 * Formats scores (e.g. 0.892 -> "0.892")
 */
export function formatScore(score?: number | null, decimals = 3, fallback = "—"): string {
  if (score === undefined || score === null) return fallback;
  return score.toFixed(decimals);
}
