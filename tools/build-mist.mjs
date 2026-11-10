// Builds `packages/ui/src/mist.css`: the Mist look (the Rainlet design system) as ONE self-sufficient stylesheet for an app.
//   node tools/build-mist.mjs          write the file (it is committed; test/mist.test.mjs checks it is up to date and self-contained)
// An app loads xoong.css + controls.css + richtext.css + mist.css and nothing else. The source of truth for the look is the design kit
// (design/brand-kit/css); this script takes the component part of it and leaves the documentation site's own chrome out:
//   - mist-tokens.css   the Rainlet tokens verbatim, plus the derived dark scheme
//   - a direct map      --xo-* from those tokens (the kit's xo-map.css goes through the site's palette names; this does not)
//   - controls.css      the control standard (buttons, fields, field rhythm, badges, chips, tabs, menu, tables, notices, toast)
//   - icons.css         the icons as CSS masks (needs `img-src data:` in a strict CSP)
//   - components.css    the look of xo-tabs, xo-menu, xo-combobox, xo-carousel, .xo-table, .xo-form, dialogs, xo-richtext
//   - states.css        skeleton, empty and error states
//   - controls-new.css  the look of the controls of the Mist spec (switch, slider, segmented, progress, ...; some need no script, the rest comes with their logic)
//   - mist.css          the Mist shape on top, WITHOUT page chrome (header, shell, rail, hero, prose, brand type)
//   - admin-shell.css   the app shell for admin screens (.xo-app, .xo-side, .xo-nav, .xo-topbar, .xo-page-head, ...)
// Everything is in one cascade layer, `xoong-mist`, declared after the framework's layers: your own CSS (unlayered, or in a later layer) wins.
import { readFileSync, writeFileSync } from 'node:fs';

const kit = new URL('../design/brand-kit/css/', import.meta.url);
const out = new URL('../packages/ui/src/mist.css', import.meta.url);
const read = (name) => readFileSync(new URL(name, kit), 'utf8');

/** Selectors of the documentation site's own chrome and global element styles: not part of the look an app adopts. */
const CHROME = [/^body\b/, /^html\b/, /^h[1-3]$/, /^h[1-3],?$/, /^a(:hover)?$/, /^code$/, /^kbd$/, /^code, kbd$/, /^:not\(pre\) > code$/, /^\.content\b/, /^\.page-head\b/, /^\.eyebrow\b/, /^\.lede\b/, /^header\.top\b/, /^footer\.foot\b/,
  /^\.shell\b/, /^\.rail\b/, /^\.crumbs\b/, /^\.hero\b/, /^\.grid\b/, /^\.band\b/, /^\.recipe\b/, /^\.cta\b/, /^\.card\b/, /^\.brand\b/, /^\.pot-badge\b/, /^\.wrap\b/, /^\.prose\b/, /^\.head\b/, /^\.docs-menu\b/,
  /^\.pills\b/, /^\.stage\b/, /^\.window\b/, /^\.lockup\b/, /^\.logo-grid\b/, /^\.tile\b/, /^\.swatches\b/, /^\.type-row\b/, /^\.dodont\b/, /^\.example\b/, /^\.preview\b/, /^\.palette-toggle\b/, /^\.carousel\b/, /^\.thumbs\b/, /^\.sprite\b/, /^\.icon-grid\b/, /^\.icon-cell\b/, /^\.std-/, /^\.actions\b/, /^\.btn\b/, /^\.dl\b/, /^\.cards-/, /^\.person\b/, /^\.avatar\b/, /^\.pager\b/, /^\.lost\b/, /^\.demo\b/, /^\.note\b/, /^\.callout\b/, /^\.force-/, /^\.focus-/, /^\.bg-/, /^\.dialog-stage\b/, /^\.stage-gap\b/, /^\.control-cards\b/, /^\.ctl-icon\b/];

/** The top-level blocks of some CSS: [{ head, body }] for rules and at-rules (body null for a statement such as @import or @layer a, b;). */
function blocks(css) {
  const result = [];
  let i = 0;
  while (i < css.length) {
    while (/\s/.test(css[i] ?? '')) i++;
    if (i >= css.length) break;
    if (css.startsWith('/*', i)) { const end = css.indexOf('*/', i); result.push({ comment: css.slice(i, end + 2) }); i = end + 2; continue; }
    let j = i, depth = 0, quote = '', head = '';
    for (; j < css.length; j++) {
      const c = css[j];
      if (quote) { if (c === '\\') j++; else if (c === quote) quote = ''; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === '{') { depth++; if (depth === 1) head = css.slice(i, j).trim(); }
      else if (c === '}') { depth--; if (depth === 0) { result.push({ head, body: css.slice(css.indexOf('{', i) + 1, j) }); j++; break; } }
      else if (c === ';' && depth === 0) { result.push({ head: css.slice(i, j).trim(), body: null }); j++; break; }
    }
    i = j;
  }
  return result;
}

const dropped = [];
const isChrome = (selectorList) => selectorList.split(',').map((s) => s.trim()).filter(Boolean).every((s) => CHROME.some((re) => re.test(s)));
const keepSelector = (selectorList) => selectorList.split(',').map((s) => s.trim()).filter((s) => s && !CHROME.some((re) => re.test(s)));
const norm = (s) => s.replace(/\s+/g, ' ').trim();
function filter(css) {
  const lines = [];
  const seen = new Set(); // the kit repeats a chunk (the same rule, then the same rule again): emit it once
  const emit = (line) => { const key = norm(line); if (seen.has(key)) return; seen.add(key); lines.push(line); };
  for (const b of blocks(css)) {
    if (b.comment !== undefined) continue; // the kit's comments are about the kit
    if (b.body === null) { emit(`${b.head};`); continue; }
    if (b.head.startsWith('@media') || b.head.startsWith('@container') || b.head.startsWith('@supports')) {
      const inner = filter(b.body);
      if (inner.trim()) emit(`${b.head} {\n${inner.split('\n').map((l) => `  ${l}`).join('\n')}\n}`);
      continue;
    }
    if (b.head.startsWith('@')) { emit(`${b.head} {${b.body}}`); continue; } // @font-face, @keyframes
    if (isChrome(b.head)) { dropped.push(b.head); continue; }
    const kept = keepSelector(b.head);
    if (kept.length !== b.head.split(',').filter((s) => s.trim()).length) dropped.push(b.head.split(',').map((s) => s.trim()).filter((s) => !kept.includes(s)).join(', '));
    emit(`${kept.join(', ')} {${b.body}}`);
  }
  return lines.join('\n');
}

/**
 * The labelled-button metrics (centering, nowrap, the 40px minimum) apply to every `button`. That collapses an empty
 * child inside a tile (align-items: center, white-space: nowrap) and turns a 44×24 switch into a 40px square (min-height
 * beats the switch's own height). They move to a zero-specificity rule that skips [role="switch"], so any author rule
 * (even `button { min-height: 0 }` in this same layer) can opt out, and a switch keeps the height it sets.
 */
function relaxButtons(css) {
  return css.replace(/button, \.button \{([^}]*)\}/, (full, body) => {
    if (!/\balign-items:\s*center\b/.test(body) || !/\bmin-height:\s*var\(--xo-control-height\)/.test(body)) return full;
    const rest = body
      .replace(/\balign-items:\s*center;\s*/g, '')
      .replace(/\bmin-height:\s*var\(--xo-control-height\);\s*/g, '')
      .replace(/\bwhite-space:\s*nowrap;\s*/g, '');
    return `button, .button {${rest}}\n:where(button:not([role="switch"]), .button:not([role="switch"])) { align-items: center; white-space: nowrap; min-height: var(--xo-control-height); }`;
  });
}

/** A raw hex in a component rule does not follow the theme. Mix against the text token instead (dark mode included). Token definitions stay hex. */
function themeMixes(css) {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf('color-mix(', i);
    if (at < 0) { out += css.slice(i); break; }
    let depth = 0;
    let j = at;
    for (; j < css.length; j++) {
      if (css[j] === '(') depth++;
      else if (css[j] === ')' && --depth === 0) { j++; break; }
    }
    out += css.slice(i, at) + css.slice(at, j).replace(/#1f2a33\b/gi, 'var(--text)').replace(/#000\b/g, 'var(--text)');
    i = j;
  }
  return out;
}

/** Same stroke as the kit's masks (1.75, round caps, 24 viewBox). */
function iconUrl(inner) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'>${inner}</svg>`;
  return `url("data:image/svg+xml,${svg.replace(/[<>#]/g, (c) => ({ '<': '%3C', '>': '%3E', '#': '%23' }[c]))}")`;
}
const EXTRA_ICONS = `
:root {
  --ic-grid: ${iconUrl("<rect x='3.5' y='3.5' width='7' height='7' rx='1.5'/><rect x='13.5' y='3.5' width='7' height='7' rx='1.5'/><rect x='3.5' y='13.5' width='7' height='7' rx='1.5'/><rect x='13.5' y='13.5' width='7' height='7' rx='1.5'/>")};
  --ic-file: ${iconUrl("<path d='M14 3.5H7.2A1.7 1.7 0 0 0 5.5 5.2v13.6A1.7 1.7 0 0 0 7.2 20.5h9.6a1.7 1.7 0 0 0 1.7-1.7V8z'/><path d='M14 3.5V8h4.5'/><path d='M8.5 12.5h7M8.5 16h4.5'/>")};
  --ic-layers: ${iconUrl("<path d='m12 3.5 8.5 4.25L12 12 3.5 7.75z'/><path d='m3.5 12 8.5 4.25L20.5 12'/><path d='m3.5 16.25 8.5 4.25 8.5-4.25'/>")};
  --ic-sliders: ${iconUrl("<path d='M4 7h2.5M11 7h9M4 12h7.5M16 12h4M4 17h4.5M13 17h7'/><circle cx='8.5' cy='7' r='2'/><circle cx='14' cy='12' r='2'/><circle cx='10.5' cy='17' r='2'/>")};
}
.ic[data-ic="grid"] { --ic: var(--ic-grid); }
.ic[data-ic="file"] { --ic: var(--ic-file); }
.ic[data-ic="layers"] { --ic: var(--ic-layers); }
.ic[data-ic="sliders"] { --ic: var(--ic-sliders); }`;

/** The sidebar is 264px from 768px up. A 560px flex-basis wraps the main column under it until the row is about 824px. */
const SHELL_FIX = `
/* one row whenever the sidebar is showing: the main column takes whatever width is left (below 768px the sidebar is hidden) */
.xo-app { flex-wrap: nowrap; }
.xo-main { flex: 1 1 0%; }`;

const MAP = `/* xoong: the framework's --xo-* tokens, mapped straight from the Rainlet tokens above */
:root {
  --xo-color-bg: var(--bg);
  --xo-color-surface: var(--card);
  --xo-color-text: var(--text);
  --xo-color-text-2: var(--text-2);
  --xo-color-muted: var(--text-3);
  --xo-color-border: var(--line);
  --xo-color-control-border: var(--line-strong);
  --xo-color-accent: var(--accent);
  --xo-color-accent-strong: var(--accent-strong);
  --xo-color-accent-soft: var(--accent-tint);
  --xo-color-accent-text: var(--primary-text);
  --xo-color-primary: var(--primary);
  --xo-color-primary-text: var(--primary-text);
  --xo-color-subtle: var(--sunken);
  --xo-color-success: var(--ok);
  --xo-color-warning: var(--warn);
  --xo-color-danger: var(--danger);
  --xo-color-inverse: light-dark(#1f2a33, #2f4252); /* tooltip and toast: ink in light, a lighter slate than the page in dark */
  --xo-color-inverse-text: #fff;
  --xo-font: var(--f-body);
  --xo-font-mono: var(--f-mono);
  --xo-radius: var(--r);
  /* names the kit's rules use */
  --font: var(--f-body);
  --mono: var(--f-mono);
  --radius: var(--r-lg);
}`;

const parts = [
  ['tokens', read('mist-tokens.css').replace(/^\/\*[\s\S]*?\*\/\n/, '')],
  ['map', MAP],
  ['standard', relaxButtons(filter(read('controls.css')))],
  ['icons', filter(read('icons.css')) + EXTRA_ICONS],
  ['components', filter(read('components.css'))],
  ['states', filter(read('states.css'))],
  ['new controls', filter(read('controls-new.css'))],
  ['skin', filter(read('mist.css'))],
  ['admin shell', filter(read('admin-shell.css')) + SHELL_FIX],
];
const body = themeMixes(parts.map(([name, css]) => `/* ---- ${name} ---- */\n${css.trim()}`).join('\n\n'));
const text = `/*
 * xoong Mist: the Rainlet design system as one stylesheet. Generated by tools/build-mist.mjs from design/brand-kit/css (do not edit).
 * Load after xoong.css, controls.css and richtext.css. It sets the tokens (--text, --card, --accent, ..., a dark scheme for
 * prefers-color-scheme or data-theme="dark"), maps the framework's --xo-* tokens from them, and skins the components.
 * The icons are CSS masks made of data: images: a strict CSP needs \`img-src 'self' data:\`.
 * Everything is in the layer xoong-mist: your own CSS, unlayered or in a later layer, wins.
 */
@layer xoong-mist {
${body.split('\n').map((l) => (l ? `  ${l}` : l)).join('\n')}
}
`;
export const build = () => text;
export const droppedSelectors = () => dropped;
if (process.argv[1] === new URL(import.meta.url).pathname) {
  writeFileSync(out, text);
  console.log(`wrote packages/ui/src/mist.css (${(text.length / 1024).toFixed(1)} KB); left out ${dropped.length} site rules`);
  if (process.argv.includes('--list')) console.log([...new Set(dropped)].join('\n'));
}
