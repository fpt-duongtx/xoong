export const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
/** median, min, max and the interquartile range of the runs: the spread is part of every number we publish. */
export function summary(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p) => { const i = (s.length - 1) * p; const lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
  return { n: s.length, median: median(s), min: s[0], max: s[s.length - 1], q1: q(0.25), q3: q(0.75), runs: xs };
}
export const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
