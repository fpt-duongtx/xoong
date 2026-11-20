// @ts-check
/** The language of `{path}`: how a path is read from a scope, and how text with `{bindings}` is planned and evaluated. Pure functions, shared by every binder. */
import { format } from './format.js';

export const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** @typedef {{ value: () => any, parent?: Scope, vars?: Record<string, () => any> }} Scope */

/** "a.b", "a[0].b" and "$form.errors['title.vi']" as steps. */
const steps = new Map(); // a path is split once, not on every read of every row
function splitPath(path) {
  let out = steps.get(path);
  if (!out) {
    steps.set(path, out = []);
    for (const m of path.matchAll(/\[(?:'([^']*)'|"([^"]*)"|(\d+))\]|([^.[\]]+)/g)) out.push(m[1] ?? m[2] ?? m[3] ?? m[4]);
  }
  return out;
}

export function makeResolver(store) {
  const lookup = (scope, path) => {
    if (path === '.' || path === '') return store.deref(scope.value());
    const [head, ...rest] = splitPath(path);
    if (head.startsWith('$')) {
      for (let s = scope; s; s = s.parent) if (s.vars?.[head]) return walk(s.vars[head](), rest);
      return undefined;
    }
    for (let s = scope; s; s = s.parent) {
      const base = store.deref(s.value());
      if (base && typeof base === 'object' && head in base) return walk(base[head], rest);
    }
    return undefined;
  };
  const walk = (v, rest) => {
    for (const k of rest) {
      v = store.deref(v);
      if (v == null) return undefined;
      v = v[k];
    }
    return store.deref(v);
  };
  return lookup;
}

/**
 * A `{...}` is a binding when its content is a path (`name`, `a.b[0]`, `$loading`, `.`), optionally with `| format`. Braces around anything else
 * (JSON, CSS, a regex `\d{3}`, ICU text) stay as written, and so do `{{name}}` and `\{name}` (a backslash escapes one binding).
 */
const PATH = /^\.?(?:[\p{L}_$@][\p{L}\p{N}_$@-]*)?(?:\.[\p{L}\p{N}_$@-]+|\[(?:\d+|'[^']*'|"[^"]*")\])*$/u;
/** Interpolate `{path}` in a string. Returns null if there is nothing to interpolate. */
const planned = new Map();
export function parseInterpolation(text) {
  if (!text.includes('{')) return null;
  let plan = planned.get(text); // a row's text is the template's text: parsed once, not once per row
  if (plan === undefined) planned.set(text, plan = parsePlan(text));
  return plan;
}
function parsePlan(text) {
  const raw = text.split(/(\\?\{[^{}]+\})/); // the odd entries are the `{...}` candidates
  let bound = false;
  const parts = raw.map((p, i) => {
    if (i % 2 === 0) return p;
    if (p[0] === '\\') { bound = true; return p.slice(1); } // (the text changes, so it is not "nothing to interpolate")
    const [path, fmt] = p.slice(1, -1).split('|').map((s) => s.trim()); // {path} or {path | format}
    if (!path || !PATH.test(path) || (raw[i - 1].endsWith('{') && raw[i + 1].startsWith('}'))) return p;
    bound = true;
    return fmt ? { path, fmt } : { path };
  });
  return bound ? parts.filter((p) => p !== '') : null;
}
export const evalParts = (parts, scope, lookup) => {
  let text = '';
  for (const p of parts) { // no intermediate array: a binding re-runs often
    if (typeof p === 'string') text += p;
    else { const v = lookup(scope, p.path); text += p.fmt ? format(p.fmt, v) : v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); }
  }
  return text;
};
