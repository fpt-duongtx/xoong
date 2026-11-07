// @ts-check
/** RFC 6901 JSON Pointer helpers (copy-on-write set). */

/** @param {string} p */
export function parsePointer(p) {
  if (p === '' ) return [];
  if (!p.startsWith('/')) throw new Error(`xoong: invalid JSON pointer "${p}" (must start with "/")`);
  return p.slice(1).split('/').map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
}

const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Return a copy of `obj` with `value` set at `pointer`. Never mutates `obj`.
 * @param {any} obj @param {string} pointer @param {any} value
 */
export function setPointer(obj, pointer, value) {
  const parts = parsePointer(pointer);
  if (parts.length === 0) return value;
  for (const part of parts) if (FORBIDDEN.has(part)) throw new Error(`xoong: forbidden pointer segment "${part}"`);
  const walk = (node, i) => {
    const key = parts[i];
    const base = Array.isArray(node) ? [...node] : { ...(node && typeof node === 'object' ? node : {}) };
    base[key] = i === parts.length - 1 ? value : walk(base[key], i + 1);
    return base;
  };
  return walk(obj, 0);
}
