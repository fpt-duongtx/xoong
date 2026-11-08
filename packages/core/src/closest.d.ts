// Types for @xoong/core/closest: "did you mean" helpers.

/** Edit distance (Levenshtein) between two strings. */
export function distance(a: string, b: string): number;

/** The candidate closest to `ref` (case-insensitive), or undefined when nothing is close enough. */
export function nearest(ref: string, candidates: Iterable<string>): string | undefined;
