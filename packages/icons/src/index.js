// @xoong/icons: the icon set as data and the CSS built from it. No DOM, no dependency: it runs in Node (the build and the subset tool) and in a browser.
// The source of truth is the SVG files in src/svg (24px grid): `svg/<name>.svg` is the outline (stroke, 1.75), `svg/fill/<name>.svg` the filled drawing.
// The bold weight is the outline with a heavier stroke (BOLD_STROKE), so it needs no file. A filled icon that has no drawing of its own (a plain
// plus, an arrow) uses the bold outline for `xi-fill`. `src/icons.json` is generated from the files (tools/build-icons.mjs; a test checks it).
import data from './icons.json' with { type: 'json' };

export const VARIANTS = ['regular', 'fill', 'bold'];
/** The stroke of the regular outline and of the bold weight. */
export const STROKE = 1.75;
export const BOLD_STROKE = 2.5;
/** The classes after `xi-` that are not icon names: sizes, motion and the two variants. No icon may take one of these names. */
export const MODIFIERS = ['sm', 'lg', 'xl', '2x', '3x', 'spin', 'fw', 'fill', 'bold'];

/** @type {Record<string, { category: string, tags: string[], regular: string, fill?: string }>} */
export const icons = data.icons;
export const names = Object.keys(icons);
/** The names `.ic[data-ic]` knew before this set, and the icon each one is now (a name missing here is the same name). */
export const LEGACY = data.legacy;

/** The SVG of an icon as a standalone file: `currentColor`, 24px grid. `variant` is 'regular', 'fill' or 'bold'. */
export function svgOf(name, variant = 'regular') {
  const ic = icons[name];
  if (!ic) throw new Error(`unknown icon "${name}"`);
  if (variant === 'regular') return ic.regular;
  if (variant === 'bold') return ic.regular.replace(`stroke-width="${STROKE}"`, `stroke-width="${BOLD_STROKE}"`);
  if (variant === 'fill') return ic.fill ?? svgOf(name, 'bold');
  throw new Error(`unknown variant "${variant}"`);
}

/** The `url("data:...")` of an icon, for `mask-image`: black, single quotes, `<`, `>`, `#`, `(` and `)` escaped (a build that follows `url(...)` in a stylesheet must not find the `url(#mask)` inside). */
export function maskUrl(name, variant = 'regular') {
  const svg = svgOf(name, variant).trim().replace(/"/g, "'").replace(/currentColor/g, 'black');
  return `url("data:image/svg+xml,${svg.replace(/[<>#()]/g, (c) => ({ '<': '%3C', '>': '%3E', '#': '%23', '(': '%28', ')': '%29' })[c])}")`;
}

const SUFFIX = { regular: '', fill: '-fill', bold: '-bold' };
const VAR = { regular: 'ic', fill: 'icf', bold: 'icb' };

/** The rules every icon needs: the box (1em, currentColor), the sizes, the spin, and the old `.ic` box (1.25rem or --xo-icon). */
export const BASE_CSS = `.xi { display: inline-block; flex: none; width: 1em; height: 1em; font-style: normal; line-height: 1; vertical-align: -0.125em; background: currentColor; -webkit-mask: var(--ic) center / contain no-repeat; mask: var(--ic) center / contain no-repeat; }
.xi-sm { font-size: 0.875em; }
.xi-lg { font-size: 1.25em; }
.xi-xl { font-size: 1.5em; }
.xi-2x { font-size: 2em; }
.xi-3x { font-size: 3em; }
.xi-fw { width: 1.25em; }
.xi-spin { animation: xi-spin 1s linear infinite; }
@keyframes xi-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .xi-spin { animation-duration: 3s; } }`;
export const LEGACY_BASE_CSS = `.ic { display: inline-block; flex: none; width: var(--xo-icon, 1.25rem); height: var(--xo-icon, 1.25rem); vertical-align: -0.2em; background: currentColor; -webkit-mask: var(--ic) center / contain no-repeat; mask: var(--ic) center / contain no-repeat; }`;

/**
 * The stylesheet for some icons.
 * @param {{ names?: string[], variants?: string[], base?: boolean, legacy?: boolean, layer?: string }} [o]
 *   names: which icons (default all); variants: which of 'regular' | 'fill' | 'bold' (default all); base: the `.xi` box and modifiers (default true);
 *   legacy: also `.ic[data-ic]` and the old `--ic-<name>` variables; layer: wrap in `@layer <name>`.
 */
export function buildCss({ names: wanted = names, variants = VARIANTS, base = true, legacy = false, layer = '' } = {}) {
  const list = names.filter((n) => wanted.includes(n)); // the set's own order, whatever order the caller gave
  const vars = [], rules = [];
  for (const n of list) {
    for (const v of VARIANTS.filter((x) => variants.includes(x))) vars.push(`  --${VAR[v]}-${n}: ${maskUrl(n, v)};`);
    rules.push(`.xi-${n} { --ic: var(--ic-${n}); }`);
    if (variants.includes('fill')) rules.push(`.xi-fill.xi-${n} { --ic: var(--icf-${n}); }`);
    if (variants.includes('bold')) rules.push(`.xi-bold.xi-${n} { --ic: var(--icb-${n}); }`);
  }
  const out = [];
  if (base) out.push(BASE_CSS);
  if (vars.length) out.push(`:root {\n${vars.join('\n')}\n}`, rules.join('\n'));
  if (legacy) {
    const pairs = [...list.map((n) => [n, n]), ...Object.entries(LEGACY).filter(([was, now]) => was !== now && list.includes(now))];
    const aliases = pairs.filter(([was, now]) => was !== now).map(([was, now]) => `  --ic-${was}: var(--ic-${now});`);
    out.push(LEGACY_BASE_CSS, pairs.map(([was, now]) => `.ic[data-ic="${was}"] { --ic: var(--ic-${now}); }`).join('\n'));
    if (aliases.length) out.push(`:root {\n${aliases.join('\n')}\n}`);
  }
  const css = out.join('\n');
  return layer ? `@layer ${layer} {\n${css}\n}\n` : `${css}\n`;
}

/**
 * The icons a piece of source uses: `xi-<name>` classes, `data-ic="<name>"` (the old API) and which variants are asked for (`xi-fill`, `xi-bold`).
 * Names built at run time (`'xi-' + kind`) cannot be seen: list them with `include`.
 */
export function scan(text) {
  const found = new Set(), unknown = new Set(), variants = new Set(['regular']);
  for (const [, n] of text.matchAll(/(?<![\w-])xi-([a-z0-9][a-z0-9-]*)/g)) {
    if (n === 'fill' || n === 'bold') variants.add(n);
    else if (MODIFIERS.includes(n)) continue;
    else (n in icons ? found : unknown).add(n);
  }
  for (const [, kind, n] of text.matchAll(/var\(--ic([fb]?)-([a-z0-9][a-z0-9-]*)\)/g)) { // a stylesheet that takes the mask itself: var(--ic-check), var(--icf-star)
    if (kind) variants.add(kind === 'f' ? 'fill' : 'bold');
    (n in icons ? found : unknown).add(n);
  }
  for (const [, n] of text.matchAll(/data-ic=["']?([a-z0-9][a-z0-9-]*)/g)) {
    const now = LEGACY[n] ?? n;
    (now in icons ? found : unknown).add(now in icons ? now : n);
  }
  return { names: [...found].sort(), unknown: [...unknown].sort(), variants: [...variants] };
}
