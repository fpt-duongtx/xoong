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
function filter(css) {
  const lines = [];
  for (const b of blocks(css)) {
    if (b.comment !== undefined) continue; // the kit's comments are about the kit
    if (b.body === null) { lines.push(`${b.head};`); continue; }
    if (b.head.startsWith('@media') || b.head.startsWith('@container') || b.head.startsWith('@supports')) {
      const inner = filter(b.body);
      if (inner.trim()) lines.push(`${b.head} {\n${inner.split('\n').map((l) => `  ${l}`).join('\n')}\n}`);
      continue;
    }
    if (b.head.startsWith('@')) { lines.push(`${b.head} {${b.body}}`); continue; } // @font-face, @keyframes
    if (isChrome(b.head)) { dropped.push(b.head); continue; }
    const kept = keepSelector(b.head);
    if (kept.length !== b.head.split(',').filter((s) => s.trim()).length) dropped.push(b.head.split(',').map((s) => s.trim()).filter((s) => !kept.includes(s)).join(', '));
    lines.push(`${kept.join(', ')} {${b.body}}`);
  }
  return lines.join('\n');
}

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
  ['standard', filter(read('controls.css'))],
  ['icons', filter(read('icons.css'))],
  ['components', filter(read('components.css'))],
  ['states', filter(read('states.css'))],
  ['new controls', filter(read('controls-new.css'))],
  ['skin', filter(read('mist.css'))],
  ['admin shell', filter(read('admin-shell.css'))],
];
const body = parts.map(([name, css]) => `/* ---- ${name} ---- */\n${css.trim()}`).join('\n\n');
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
