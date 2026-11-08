// Helpers of the documentation site generator: the layout, a small syntax highlighter and the "example" block.
// An example is written once: its markup runs as the live preview and is shown, highlighted, in the code tabs, so the two cannot drift apart.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../..', import.meta.url).pathname;
export const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Remove the common indentation and the blank lines around a snippet. */
export const dedent = (s) => {
  const lines = s.replace(/^\n+|\s+$/g, '').split('\n');
  const pad = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return lines.map((l) => l.slice(pad)).join('\n');
};

// ---- highlighter: one pass, ordered rules, classes tok-* (colours live in site.css) ---------------------------------------------
const KEYWORDS = /^(?:import|from|export|const|let|var|function|return|if|else|for|of|in|await|async|new|class|extends|default|true|false|null|undefined|this|typeof|throw|try|catch)\b/;
const RULES = {
  js: [[/\/\/.*|\/\*[\s\S]*?\*\//y, 'c'], [/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/y, 's'], [KEYWORDS, 'k'], [/(?<![\w$.])\d+(?:\.\d+)?/y, 'n']],
  css: [[/\/\*[\s\S]*?\*\//y, 'c'], [/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/y, 's'], [/--[\w-]+/y, 'a'], [/@[\w-]+/y, 'k'], [/(?<![\w-])(?:#[0-9a-fA-F]{3,8}\b|\d+(?:\.\d+)?(?:rem|px|em|%|vh|vw|ms|s)?)/y, 'n']],
  json: [[/"(?:\\.|[^"\\\n])*"(?=\s*:)/y, 'a'], [/"(?:\\.|[^"\\\n])*"/y, 's'], [/\b(?:true|false|null)\b/y, 'k'], [/-?\d+(?:\.\d+)?/y, 'n']],
  bash: [[/#.*/y, 'c'], [/'[^'\n]*'|"[^"\n]*"/y, 's'], [/(?<=\s)--?[\w-]+/y, 'a']],
};

function run(src, rules) {
  let out = '';
  for (let i = 0; i < src.length;) {
    let hit = null;
    for (const [re, cls] of rules) {
      re.lastIndex = i;
      if (!re.sticky && /\w/.test(src[i - 1] ?? '')) continue; // a keyword only at a word start
      const m = re.sticky ? re.exec(src) : src.slice(i).match(re);
      if (m && (re.sticky || m.index === 0) && m[0]) { hit = [m[0], cls]; break; }
    }
    if (hit) { out += `<span class="tok-${hit[1]}">${esc(hit[0])}</span>`; i += hit[0].length; } else { out += esc(src[i]); i++; }
  }
  return out;
}

function htmlTag(tag) {
  const m = tag.match(/^(<\/?)([\w-]+)([\s\S]*?)(\/?>)$/);
  if (!m) return esc(tag);
  const attrs = m[3].replace(/(\s+)([^\s=]+)(?:(=)("[^"]*"|'[^']*'|[^\s"'>]+))?/g, (_, sp, name, eq, val) =>
    `${sp}<span class="tok-a">${esc(name)}</span>${eq ? `=<span class="tok-s">${esc(val).replace(/\{[^}]*\}/g, '<span class="tok-i">$&</span>')}</span>` : ''}`);
  return `${esc(m[1])}<span class="tok-t">${m[2]}</span>${attrs}${esc(m[4])}`;
}

function html(src) {
  let out = '';
  const re = /<!--[\s\S]*?-->|<\/?[A-Za-z][\w-]*(?:"[^"]*"|'[^']*'|[^'">])*>|\{[^}\n]*\}|<script[\s\S]*?<\/script>/g;
  let last = 0, m;
  while ((m = re.exec(src))) {
    out += esc(src.slice(last, m.index));
    const t = m[0];
    out += t.startsWith('<!--') ? `<span class="tok-c">${esc(t)}</span>` : t[0] === '{' ? `<span class="tok-i">${esc(t)}</span>` : htmlTag(t);
    last = m.index + t.length;
  }
  return out + esc(src.slice(last));
}

export const highlight = (lang, src) => (lang === 'html' ? html(src) : RULES[lang] ? run(src, RULES[lang]) : esc(src));

// ---- blocks ---------------------------------------------------------------------------------------------------------------------
export const code = (lang, src) => `<pre data-lang="${lang}"><code>${highlight(lang, dedent(src))}</code></pre>`;

const LANG_LABEL = { html: 'HTML', js: 'JavaScript', css: 'CSS', json: 'JSON', bash: 'Terminal' };

/** Code tabs. Each tab is [label, lang, source] or [label, lang, { file }] to show a file of the repository. */
export const tabs = (label, items) => `<xo-tabs label="${esc(label)}" class="code-tabs">
${items.map(([name, lang, src]) => `  <section xo-tab="${esc(name)}">${code(lang, typeof src === 'object' ? readFileSync(join(root, src.file), 'utf8') : src)}</section>`).join('\n')}
</xo-tabs>`;

/** A live example: Preview first (the markup really runs), then the markup and any extra files as tabs. */
export const example = ({ label, preview, extra = [], note = '' }) => `<xo-tabs label="${esc(label)}" class="code-tabs example">
  <section xo-tab="Preview"><div class="demo">
${dedent(preview).replace(/^/gm, '    ')}
  </div>${note}</section>
  <section xo-tab="HTML">${code('html', preview)}</section>
${extra.map(([name, lang, src]) => `  <section xo-tab="${esc(name)}">${code(lang, typeof src === 'object' ? readFileSync(join(root, src.file), 'utf8') : src)}</section>`).join('\n')}
</xo-tabs>`;

export const callout = (kind, body) => `<aside class="callout ${kind}">${body}</aside>`;
export const lang = LANG_LABEL;

// ---- layout ---------------------------------------------------------------------------------------------------------------------
export function layout({ pages, page }) {
  const link = (p) => `<a href="${p.file}"${p.file === page.file ? ' aria-current="page"' : ''}>${esc(p.nav)}</a>`;
  const groups = [...new Set(pages.map((p) => p.group))];
  const side = groups.map((g) => `<h2>${esc(g)}</h2>\n${pages.filter((p) => p.group === g).map(link).join('\n')}`).join('\n');
  const i = pages.indexOf(page);
  const prev = pages[i - 1], next = pages[i + 1];
  const pager = `<nav class="pager" aria-label="Pages">${prev ? `<a rel="prev" href="${prev.file}"><small>Previous</small><span>${esc(prev.nav)}</span></a>` : '<span></span>'}${next ? `<a rel="next" href="${next.file}"><small>Next</small><span>${esc(next.nav)}</span></a>` : '<span></span>'}</nav>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(page.title)} · xoong</title>
  <meta name="description" content="${esc(page.description)}">
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
  <link rel="stylesheet" href="/@xoong/controls/controls.css">${page.richtext ? '\n  <link rel="stylesheet" href="/@xoong/richtext/richtext.css">' : ''}
  <link rel="stylesheet" href="src/site.css">
  <script type="module" src="src/site.js"></script>${page.demo ? '\n  <script type="module" src="src/demo.js"></script>' : ''}${page.script ? `\n  <script type="module" src="src/${page.script}"></script>` : ''}
</head>
<body>
  <header class="top">
    <a class="brand" href="index.html">xoong</a>
    <span class="tag">standards-first web framework</span>
  </header>
  <div class="layout">
    <nav class="side" aria-label="Documentation">
${side.replace(/^/gm, '      ')}
    </nav>
    <main id="main">
${page.body}
${pager.replace(/^/gm, '      ')}
    </main>
  </div>
  <footer>xoong is a working prototype (0.0.x). MIT licence.</footer>${page.demo ? '\n  <xo-toast></xo-toast>' : ''}
</body>
</html>
`;
}
