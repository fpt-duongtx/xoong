// @ts-check
/**
 * Default invalidation rule, derived from REST path structure.
 *
 * A mutation on `/users/42/disable` invalidates cached queries whose concrete
 * path is a segment-prefix of it or that it is a segment-prefix of:
 *   GET /users            (prefix of the mutation)        -> invalidated
 *   GET /users/42         (prefix of the mutation)        -> invalidated
 *   GET /users/42/posts   (neither is a prefix)           -> kept
 *   GET /users/43         (differs at a segment)          -> kept
 */
const segments = (p) => p.split('/').filter(Boolean);

/** @param {string} a concrete path @param {string} b concrete path */
export function pathsOverlap(a, b) {
  const x = segments(a), y = segments(b);
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) if (x[i] !== y[i]) return false;
  return true;
}

/** Fill `{param}` placeholders and encode values. Throws naming a missing param (`undefined`, `null` and `''`: a path with an empty segment is another resource). */
export function fillPath(template, params = {}, opId = template) {
  return template.replace(/\{([^}]+)\}/g, (_, name) => {
    const v = params[name];
    if (v === undefined || v === null || v === '') throw new Error(`xoong: operation "${opId}" needs path parameter "${name}"`);
    return encodeURIComponent(String(v));
  });
}
