// @ts-check
/** Edit distance between two strings (Levenshtein). */
export function distance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/**
 * The candidate closest to `ref` (case-insensitive), or undefined when nothing is close enough.
 * Used for "unknown operation ... closest: ..." messages in the runtime and in `xoong check`.
 * @param {string} ref @param {Iterable<string>} candidates
 */
export function nearest(ref, candidates) {
  let best, bestD = Infinity;
  for (const c of candidates) {
    const d = distance(ref.toLowerCase(), c.toLowerCase());
    if (d < bestD) { bestD = d; best = c; }
  }
  return bestD <= Math.max(3, Math.floor(ref.length / 3)) ? best : undefined;
}
