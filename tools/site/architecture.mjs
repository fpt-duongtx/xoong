// The Architecture section of the documentation site: how xoong works inside. Seven pages, each with diagrams (inline SVG, classes dg-* in architecture.css) and
// code. Every statement was checked against the source it names in "Where to look in the code"; what is planned and not built is left out or marked "not yet".
import { tabs, code } from './lib.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Inline code. */
const c = (s) => `<code>${esc(s)}</code>`;
/** A list of files for "Where to look in the code": [path, what is there]. */
const files = (items) => `<ul>\n${items.map(([path, what]) => `<li>${c(path)}: ${what}</li>`).join('\n')}\n</ul>`;

// ---- diagrams -------------------------------------------------------------------------------------------------------------------------
// A diagram is a hand-placed set of boxes and arrows. `diagram()` wraps it (figure, focusable scroll frame, role="img" with a title and a full text
// description, visible caption); `d.box()` sizes a box from its text and returns its edges so arrows can start and end on them.

const TITLE_LINE = 44, SUB_LINE = 16;
/** Height a box needs for a title and `n` lines of small text. */
const natural = (n) => (n ? 58 + SUB_LINE * (n - 1) : TITLE_LINE);

/**
 * @param {{ id: string, label: string, title: string, desc: string, caption: string, w: number, h: number, size?: 'sm' | 'md' | 'lg', draw: (d: any) => void }} spec
 */
function diagram({ id, label, title, desc, caption, w, h, size = 'sm', draw }) {
  const out = [];
  const d = {
    id, w, h,
    /** A box at (x, y), `bw` wide; its height follows the text unless `bh` is given (then the text is centred). Returns its edges. */
    box(x, y, bw, name, sub = [], { kind = '', bh } = {}) {
      const lines = Array.isArray(sub) ? sub : [sub];
      const nat = natural(lines.filter(Boolean).length);
      const bhh = bh ?? nat;
      const top = y + (bhh - nat) / 2;
      const cls = `dg-box${kind ? ` dg-k-${kind}` : ''}`;
      out.push(`<g class="dg-node"><rect class="${cls}" x="${x}" y="${y}" width="${bw}" height="${bhh}" rx="8"/>`
        + `<text class="dg-t" x="${x + bw / 2}" y="${top + 22}">${esc(name)}</text>`
        + lines.filter(Boolean).map((l, i) => `<text class="dg-sub" x="${x + bw / 2}" y="${top + 42 + SUB_LINE * i}">${esc(l)}</text>`).join('')
        + '</g>');
      return { x, y, w: bw, h: bhh, r: x + bw, b: y + bhh, cx: x + bw / 2, cy: y + bhh / 2 };
    },
    /** An arrow along `points`; `label` is placed at `at` ([x, y], centred unless `anchor` is 'start' or 'end'). */
    line(points, { dash = false, life = false, label: text, at, anchor = '', head = !life } = {}) {
      out.push(`<path class="${life ? 'dg-life' : `dg-line${dash ? ' dg-dash' : ''}`}" d="M${points.map(([x, y]) => `${x} ${y}`).join(' L')}"${head ? ` marker-end="url(#${id}-a)"` : ''}/>`);
      if (text) out.push(`<text class="dg-lab${anchor ? ` dg-${anchor}` : ''}" x="${at[0]}" y="${at[1]}">${esc(text)}</text>`);
    },
    /** A dashed frame with a label at its top left. */
    zone(x, y, zw, zh, text) {
      out.push(`<rect class="dg-zone" x="${x}" y="${y}" width="${zw}" height="${zh}" rx="12"/><text class="dg-zlab" x="${x + 14}" y="${y + 18}">${esc(text)}</text>`);
    },
    /** A line of small text. */
    text(x, y, text, cls = '') { out.push(`<text class="dg-sub ${cls}" x="${x}" y="${y}">${esc(text)}</text>`); },
  };
  draw(d);
  return `<figure class="dg-fig">
<div class="dg-scroll" tabindex="0" role="group" aria-label="${esc(label)}">
<svg class="dg dg-${size}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${id}-t ${id}-d">
<title id="${id}-t">${esc(title)}</title>
<desc id="${id}-d">${esc(desc)}</desc>
<defs><marker id="${id}-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="dg-head" d="M0 0 10 5 0 10z"/></marker></defs>
${out.join('\n')}
</svg>
</div>
<p class="hint">${caption}</p>
</figure>`;
}

/**
 * A sequence diagram: participants across the top, one arrow per message, top to bottom. A message is { from, to, label (string or lines), dashed? }
 * or a note { note, over: [first, last] }.
 */
function sequence({ id, label, title, desc, caption, parts, msgs, col = 150, size = 'md' }) {
  const w = parts.length * col;
  const x = (i) => col * i + col / 2;
  let y = 66;
  const rows = msgs.map((m) => {
    if (m.note) { const row = { ...m, y, h: 36 }; y += 52; return row; }
    const lines = Array.isArray(m.label) ? m.label : [m.label];
    const row = { ...m, lines, y: y + 15 * lines.length + 6 };
    y += 15 * lines.length + 30;
    return row;
  });
  const h = y + 10;
  return diagram({
    id, label, title, desc, caption, w, h, size,
    draw(d) {
      const heads = parts.map((p, i) => d.box(x(i) - (col - 16) / 2, 10, col - 16, p, [], { bh: 38 }));
      parts.forEach((_, i) => d.line([[x(i), heads[i].b], [x(i), h - 6]], { life: true })); // lifelines first, so the arrows are drawn over them
      for (const m of rows) {
        if (m.note) {
          const x1 = x(m.over[0]) - (col - 24) / 2, x2 = x(m.over[1]) + (col - 24) / 2;
          d.box(x1, m.y, x2 - x1, m.note, [], { kind: 'soft', bh: m.h });
          continue;
        }
        const a = x(m.from), b = x(m.to);
        d.line([[a, m.y], [b, m.y]], { dash: m.dashed });
        m.lines.forEach((l, i) => d.text((a + b) / 2, m.y - 12 - 15 * (m.lines.length - 1 - i), l, 'dg-lab'));
      }
    },
  });
}

// ---- 1. overview ----------------------------------------------------------------------------------------------------------------------

const overviewLayers = diagram({
  id: 'ov-layers', label: 'Diagram: the runtime packages as layers', w: 640, h: 372, size: 'md',
  title: 'The runtime packages as layers',
  desc: 'At the bottom is @xoong/core. On the left, directly above it, is @xoong/data. On the right, directly above core, are @xoong/controls and @xoong/richtext, which import only core. Above data sit @xoong/forms and @xoong/i18n, which import core and data. At the top is @xoong/ui, which imports forms, data and core. Every arrow points downward, from a package to a package it imports: nothing imports upward.',
  caption: 'The runtime packages. An arrow means "imports"; a package may also import packages further down (ui imports data and core directly). Nothing imports upward.',
  draw(d) {
    const ui = d.box(10, 14, 260, '@xoong/ui', 'table, form, dialog, toast, router');
    const forms = d.box(10, 108, 125, '@xoong/forms', 'model, binder');
    const i18n = d.box(145, 108, 125, '@xoong/i18n', 'xo-t, t()');
    const data = d.box(10, 202, 260, '@xoong/data', 'client, cache, store, xo-view');
    const controls = d.box(290, 202, 165, '@xoong/controls', 'tabs, menu, combobox');
    const richtext = d.box(465, 202, 165, '@xoong/richtext', 'xo-richtext');
    const core = d.box(10, 296, 620, '@xoong/core', 'signals, html templates, XoElement, XoControl', { kind: 'core' });
    d.line([[forms.cx, ui.b], [forms.cx, forms.y]]);
    d.line([[forms.cx, forms.b], [forms.cx, data.y]]);
    d.line([[i18n.cx, i18n.b], [i18n.cx, data.y]]);
    d.line([[data.cx, data.b], [data.cx, core.y]]);
    d.line([[controls.cx, controls.b], [controls.cx, core.y]]);
    d.line([[richtext.cx, richtext.b], [richtext.cx, core.y]]);
    d.text(300, 40, 'An arrow means "imports".', 'dg-start');
    d.text(300, 60, 'Nothing imports upward.', 'dg-start');
  },
});

const overviewTooling = diagram({
  id: 'ov-tooling', label: 'Diagram: the tooling packages', w: 590, h: 376, size: 'sm',
  title: 'The tooling packages',
  desc: 'The xoong command (@xoong/cli) is used by the language server (xoong-lsp) and the MCP server (xoong-mcp), which both import it. The command imports @xoong/server for the dev server and the build. It loads @xoong/ssr only when you run xoong render, shown as a dashed arrow. @xoong/ssr imports the runtime packages. @xoong/test, the test helpers, also imports the runtime packages.',
  caption: 'The tooling packages. Dashed: loaded only when needed. They run in Node or in a test runner, never in the browser.',
  draw(d) {
    const mcp = d.box(20, 14, 170, 'xoong-mcp', '@xoong/mcp');
    const lsp = d.box(210, 14, 170, 'xoong-lsp', '@xoong/lsp');
    const cli = d.box(115, 110, 170, 'xoong command', '@xoong/cli');
    const test = d.box(420, 110, 160, 'test helpers', '@xoong/test');
    const server = d.box(20, 206, 170, '@xoong/server', 'handler, Node adapters');
    const ssr = d.box(210, 206, 170, '@xoong/ssr', 'prerender');
    const rt = d.box(20, 302, 560, 'Runtime packages', 'core, data, forms, ui, ...', { kind: 'core' });
    d.line([[mcp.cx, mcp.b], [mcp.cx, 91], [150, 91], [150, cli.y]]);
    d.line([[lsp.cx, lsp.b], [lsp.cx, 91], [250, 91], [250, cli.y]]);
    d.line([[150, cli.b], [150, 187], [server.cx, 187], [server.cx, server.y]]);
    d.line([[250, cli.b], [250, 187], [ssr.cx, 187], [ssr.cx, ssr.y]], { dash: true, label: 'xoong render only', at: [304, 181], anchor: 'start' });
    d.line([[ssr.cx, ssr.b], [ssr.cx, rt.y]]);
    d.line([[500, test.b], [500, rt.y]]);
  },
});

const SEAM = `
// packages/forms/src/index.js: forms import data, so data cannot import forms.
// forms registers itself, and every <form xo-submit> then uses the form model.
import { setFormEngine } from '@xoong/data/view';
import { attach as attachForm } from './form-dom.js';
setFormEngine({ attach: attachForm });`;

const overview = {
  file: 'arch-overview.html', section: 'docs', group: 'Architecture', nav: 'Layers', title: 'Architecture overview',
  description: 'The packages of xoong, what each one owns, the rule that keeps them apart, and what runs when.',
  body: `
<h1>Architecture overview</h1>
<p class="lead">xoong is a stack of small packages. Each owns one job and imports only packages below it. The ones that run in the browser import nothing from outside xoong.</p>

<h2>The layers</h2>
<p>The runtime is seven packages, plus ${c('@xoong/xoong')}, one package that re-exports the common ones. They are plain ES modules with no build step: the browser loads the files you installed.</p>
${overviewLayers}
<table>
<thead><tr><th>Package</th><th>Owns</th></tr></thead>
<tbody>
<tr><td>${c('@xoong/core')}</td><td>${c('signal')}, ${c('computed')}, ${c('effect')}, ${c('batch')}, ${c('untracked')}; the ${c('html')} template tag; ${c('XoElement')} and ${c('XoControl')}; ${c('define')}; the ${c('text()')} hook that packages use to ask for words; the list of ${c('xo-*')} names (${c('syntax.js')}) that the tools check against.</td></tr>
<tr><td>${c('@xoong/data')}</td><td>The client (${c('configure')}, ${c('getClient')}, ${c('createClient')}), the query cache, the entity store, ${c('derived')}, the live-update stream, ${c('XoongError')}, and ${c('<xo-view>')} (the ${c('@xoong/data/view')} entry).</td></tr>
<tr><td>${c('@xoong/forms')}</td><td>The request-schema model, the form model (${c('createForm')}) and the DOM binder (${c('attach')}).</td></tr>
<tr><td>${c('@xoong/ui')}</td><td>${c('<xo-table>')}, ${c('<xo-form>')}, ${c('<xo-dialog>')}, ${c('<xo-toast>')}, ${c('<xo-router>')} with the ${c('router')} object, the confirm dialog, and ${c('xoong.css')}.</td></tr>
<tr><td>${c('@xoong/i18n')}</td><td>${c('xo-t')}, ${c('t()')}, ${c('configureI18n')}, the message format, locale-aware formats.</td></tr>
<tr><td>${c('@xoong/controls')}</td><td>${c('<xo-tabs>')}, ${c('<xo-menu>')}, ${c('<xo-combobox>')}, ${c('<xo-tags>')}, ${c('<xo-carousel>')}, the ${c('xo-tooltip')} attribute.</td></tr>
<tr><td>${c('@xoong/richtext')}</td><td>${c('<xo-richtext>')} and the HTML sanitiser it uses.</td></tr>
<tr><td>${c('@xoong/xoong')}</td><td>One name to install: re-exports core, data, ${c('data/view')} and ui, and carries the ${c('xoong')} command.</td></tr>
</tbody></table>

<h2>The dependency rule</h2>
<p>A runtime package may import only the packages in its row below, and nothing else: no npm package, no Node built-in. This is checked on every test run by ${c('test/architecture.test.mjs')}, which reads each ${c('package.json')} and each source file.</p>
<table>
<thead><tr><th>Package</th><th>May import</th></tr></thead>
<tbody>
<tr><td>${c('core')}</td><td>nothing</td></tr>
<tr><td>${c('data')}, ${c('controls')}, ${c('richtext')}</td><td>${c('core')}</td></tr>
<tr><td>${c('forms')}, ${c('i18n')}</td><td>${c('core')}, ${c('data')}</td></tr>
<tr><td>${c('ui')}</td><td>${c('core')}, ${c('data')}, ${c('forms')}</td></tr>
</tbody></table>
<p>The same test also fails when ${c('data')} imports something from ${c('core')} that is not one of its public entries (${c('@xoong/core')}, ${c('/signals')}, ${c('/closest')}, ${c('/syntax')}), when a runtime package imports tooling (${c('cli')}, ${c('server')}, ${c('mcp')}, ${c('test')}), and when a pure-logic module touches ${c('document')} or ${c('window')} while it loads. That last rule keeps ${c('signals.js')} and everything in ${c('data')} except ${c('view.js')} importable from plain Node, which is how the tools and the prerenderer reuse them.</p>
<p>How does a lower package use a higher one, then? It does not: the higher package <strong>registers</strong> itself into a seam the lower one provides. Importing ${c('@xoong/forms')} calls ${c('setFormEngine()')}; importing ${c('@xoong/i18n')} calls ${c('setTranslator()')}, ${c('setTextProvider()')} and ${c('setLocaleSource()')}; the router calls ${c('setParamSource()')} and ${c('setUrlSync()')}; ${c('@xoong/ui')} calls ${c('setConfirm()')}. Without the higher package the lower one still works, with a plain default (English text, the browser's ${c('confirm()')}, the History API directly).</p>
${tabs('A seam', [['JavaScript', 'js', SEAM]])}

<h2>The tooling</h2>
<p>Tooling runs in Node (or a test runner) and is allowed to have dependencies: ${c('@xoong/cli')} uses ${c('parse5')} and ${c('yaml')}, ${c('@xoong/server')} uses ${c('amaro')} to strip TypeScript types, ${c('@xoong/ssr')} uses ${c('happy-dom')}. None of it ships to the browser.</p>
${overviewTooling}
<table>
<thead><tr><th>Package</th><th>Owns</th></tr></thead>
<tbody>
<tr><td>${c('@xoong/cli')}</td><td>The ${c('xoong')} command: ${c('sync')}, ${c('doctor')}, ${c('new')}, ${c('check')}, ${c('render')}, ${c('build')}, ${c('dev')}, ${c('i18n extract')}, ${c('i18n check')}. Also the OpenAPI analysis and the ${c('xoong check')} rule engine.</td></tr>
<tr><td>${c('@xoong/server')}</td><td>One web-standard handler, ${c('(Request) => Promise<Response>')}: static files, API proxy, import map, TypeScript stripping. ${c('@xoong/server/node')} adds the Node file reader and HTTP server. It imports no other xoong package.</td></tr>
<tr><td>${c('@xoong/ssr')}</td><td>${c('renderPage()')}: prerender a page with its data, using the real ${c('<xo-view>')} on a happy-dom document.</td></tr>
<tr><td>${c('@xoong/test')}</td><td>${c('mockApi()')} and ${c('mount()')} for screen tests.</td></tr>
<tr><td>${c('@xoong/lsp')}, ${c('@xoong/mcp')}</td><td>The same checks as ${c('xoong check')}, for editors and for AI assistants.</td></tr>
</tbody></table>
<p>The stream gateway described in older design notes is not built yet. The server package today does static files, proxy, import map and type stripping.</p>

<h2>Three contracts</h2>
<p><strong>Light DOM.</strong> Elements draw into the ordinary DOM, so your CSS, your tests, axe and the browser's own tools see exactly what the person sees. There is no Shadow DOM (<a href="https://github.com/fpt-duongtx/xoong/blob/main/docs/decisions/0002-light-dom-only.md">decision record 0002</a>).</p>
<p><strong>Plain CSS.</strong> xoong ships design tokens as custom properties (${c('--xo-color-*')}, ${c('--xo-radius')}, ...) and a few class names. You write CSS. See <a href="styling.html">Styling</a>.</p>
<p><strong>OpenAPI.</strong> Operation names, URLs, query parameters, entity identity, request schemas and error shapes come from your OpenAPI document. If the document cannot say something, ${c('xoong doctor')} tells you what to add, or a hints file says it for you without editing the backend's document. See <a href="arch-data-flow.html">Data flow</a>.</p>

<h2>What runs when</h2>
<table>
<thead><tr><th>When</th><th>Where</th><th>What</th></tr></thead>
<tbody>
<tr><td>Development, once per API change</td><td>Node</td><td>${c('xoong sync')} reads the OpenAPI document (a file or a URL; YAML, JSON, Swagger 2.0) and writes ${c('.xoong/operations.json')}, ${c('api.d.ts')} and ${c('xoong.html-data.json')}.</td></tr>
<tr><td>Development</td><td>Node</td><td>${c('xoong dev')} serves the files, proxies the API and strips types; ${c('xoong check')} and the language server lint screens.</td></tr>
<tr><td>Release</td><td>Node</td><td>${c('xoong build')} writes static, strict-CSP output; ${c('xoong render')} prerenders public pages.</td></tr>
<tr><td>Always</td><td>Browser</td><td>All runtime packages. ${c('operations.json')} is plain JSON that your ${c('main.js')} imports. Nothing in the browser reads OpenAPI.</td></tr>
</tbody></table>
<p>A screen at runtime: the HTML arrives; the browser upgrades each ${c('xo-*')} element whose package you imported; ${c('<xo-view>')} waits until the page is parsed, then asks the client for its operation; the answer lands in the store; effects write exactly the DOM nodes that read it. There is no hydration step and no tree re-render. The next pages follow each part: <a href="arch-data-flow.html">data</a>, <a href="arch-forms.html">forms</a>, <a href="arch-rendering.html">rendering</a>, <a href="arch-routing.html">routing</a>, <a href="arch-build.html">build</a>, <a href="arch-tooling.html">tooling</a>.</p>

<h2>Where to look in the code</h2>
${files([
  ['test/architecture.test.mjs', 'the dependency rule, import direction, size budgets, licence, ' + c('llms.txt') + ' limits'],
  ['packages/*/package.json', 'the declared dependencies of each package'],
  ['packages/forms/src/index.js, packages/i18n/src/index.js', 'the registration seams in action'],
  ['packages/core/src/syntax.js', 'the names of every ' + c('xo-*') + ' element and attribute'],
  ['docs/decisions/', 'the decision records (0001 to 0010)'],
])}
`,
};

// ---- 2. data flow ---------------------------------------------------------------------------------------------------------------------

const dataRoad = diagram({
  id: 'df-road', label: 'Diagram: from the OpenAPI document to the DOM', w: 560, h: 676, size: 'sm',
  title: 'The road from the OpenAPI document to the DOM',
  desc: 'Two stages. At build time, in Node: the OpenAPI document goes into xoong sync, which writes operations.json, api.d.ts and xoong.html-data.json. In the browser: configure() creates the one client from operations.json; the client keeps a query cache with one query per operation and canonical parameters; queries normalise responses into the entity store, which holds one signal per record; an xo-view reads its query and the store to build its scope with the variables $loading, $error and the items; effects write only the DOM nodes that read a changed signal.',
  caption: 'One road for every read. The arrows are the direction the data travels; a change in the store travels the last two arrows again, without a request.',
  draw(d) {
    d.zone(8, 8, 544, 196, 'Build time (Node)');
    const spec = d.box(100, 34, 360, 'OpenAPI document', 'your backend\'s contract');
    const sync = d.box(100, 118, 360, 'xoong sync', ['writes .xoong/operations.json,', 'api.d.ts and xoong.html-data.json']);
    d.line([[spec.cx, spec.b], [spec.cx, sync.y]]);
    d.zone(8, 224, 544, 444, 'In the browser');
    const cfg = d.box(100, 250, 360, 'configure({ api, baseUrl, ... })', 'creates the one client: requests, retries, errors', { kind: 'core' });
    const cache = d.box(100, 336, 360, 'Query cache', 'one query per operation + canonical params');
    const store = d.box(100, 422, 360, 'Entity store', 'one signal per record: User#1, User#2');
    const view = d.box(100, 508, 360, 'xo-view scope', '$loading, $error, items, p-* params');
    const dom = d.box(100, 594, 360, 'DOM', 'only nodes that read a signal update');
    d.line([[sync.cx, sync.b], [sync.cx, cfg.y]], { label: 'operations.json', at: [292, 227], anchor: 'start' });
    d.line([[cfg.cx, cfg.b], [cfg.cx, cache.y]], { label: 'query(op, params)', at: [292, 323], anchor: 'start' });
    d.line([[cache.cx, cache.b], [cache.cx, store.y]], { label: 'normalize(response)', at: [292, 409], anchor: 'start' });
    d.line([[store.cx, store.b], [store.cx, view.y]], { label: 'denormalize (tracked)', at: [292, 495], anchor: 'start' });
    d.line([[view.cx, view.b], [view.cx, dom.y]], { label: 'effects', at: [292, 581], anchor: 'start' });
  },
});

const dataEntry = diagram({
  id: 'df-entry', label: 'Diagram: four ways data enters the store', w: 600, h: 300, size: 'md',
  title: 'Four ways data enters the entity store',
  desc: 'Four sources on the left all write into the one entity store in the middle: a GET response fetched by a query, a mutation response, client.seed() with data the server already has, and a stream event (patch, upsert or delete). The store feeds three readers on the right: xo-view, derived() and a pristine form, which follows its record.',
  caption: 'Whatever the source, a record is stored once, so every reader of that record updates.',
  draw(d) {
    const s1 = d.box(10, 14, 200, 'GET response', 'a query fetches');
    const s2 = d.box(10, 84, 200, 'Mutation response', 'client.mutate()');
    const s3 = d.box(10, 154, 200, 'client.seed()', 'data the server already has');
    const s4 = d.box(10, 224, 200, 'Stream event', 'patch, upsert, delete');
    const store = d.box(255, 84, 125, 'Entity store', ['one signal', 'per record'], { kind: 'core', bh: 116 });
    const r1 = d.box(425, 34, 175, 'xo-view', 'reads through its query');
    const r2 = d.box(425, 124, 175, 'derived()', 'computed over all(name)');
    const r3 = d.box(425, 214, 175, 'a pristine form', 'follows its record');
    [[s1, 100], [s2, 128], [s3, 156], [s4, 184]].forEach(([s, y]) => d.line([[s.r, s.cy], [store.x, y]]));
    d.line([[store.r, 110], [r1.x, r1.cy]]);
    d.line([[store.r, 142], [r2.x, r2.cy]]);
    d.line([[store.r, 174], [r3.x, r3.cy]]);
  },
});

const readSeq = sequence({
  id: 'df-read', label: 'Diagram: one read as a sequence', col: 150, size: 'md',
  title: 'One read',
  desc: 'Four participants: the xo-view, the query cache, the entity store and the backend API. 1. The view asks the cache for its query and retains it. 2. The cache sets loading, so the view sees $loading true. 3. The cache sends GET /users?limit=10 to the API. 4. The API answers 200 with JSON. 5. The cache normalises the response into the store, upserting User#1 and the other records. 6. The cache sets success, so $loading becomes false. 7. The view reads the records from the store, tracked, and draws them.',
  caption: 'A read, top to bottom. Dashed arrows are answers or signal updates.',
  parts: ['xo-view', 'Query cache', 'Entity store', 'Backend API'],
  msgs: [
    { from: 0, to: 1, label: 'query(op, params).retain()' },
    { from: 1, to: 0, label: '$loading = true', dashed: true },
    { from: 1, to: 3, label: 'GET /users?limit=10' },
    { from: 3, to: 1, label: '200 JSON', dashed: true },
    { from: 1, to: 2, label: 'upsert User#1, User#2' },
    { from: 1, to: 0, label: '$loading = false', dashed: true },
    { from: 0, to: 2, label: 'read records (tracked)' },
  ],
});

const writeSeq = sequence({
  id: 'df-write', label: 'Diagram: one write as a sequence', col: 144, size: 'lg',
  title: 'One write',
  desc: 'Five participants: the xo-click button, client.mutate, the entity store, the query cache and the backend API. 1. The button calls mutate with the operation, params and body. 2. With xo-optimistic, mutate puts a provisional patch in the store. 3. Mutate sends POST /users/1/disable to the API. 4. The API answers 200 with the updated User. 5. Mutate normalises the response into the store, upserting User#1. 6. Mutate invalidates every cached query whose path overlaps /users/1/disable. 7. The query cache refetches GET /users, if something is watching it. 8. The API answers with the list. 9. Mutate resolves and the xo-done event fires. A note says that on failure the optimistic patch is undone, a XoongError is thrown and xo-error fires.',
  caption: 'A write, top to bottom. Invalidation is by path; only queries that something is watching refetch at once.',
  parts: ['xo-click', 'client.mutate', 'Entity store', 'Query cache', 'Backend API'],
  msgs: [
    { from: 0, to: 1, label: 'mutate(op, params, body)' },
    { from: 1, to: 2, label: ['xo-optimistic:', 'provisional patch'] },
    { from: 1, to: 4, label: 'POST /users/1/disable' },
    { from: 4, to: 1, label: '200 + User', dashed: true },
    { from: 1, to: 2, label: 'upsert User#1' },
    { from: 1, to: 3, label: ['invalidate paths that overlap', '/users/1/disable'] },
    { from: 3, to: 4, label: 'refetch GET /users' },
    { from: 4, to: 3, label: '200 list', dashed: true },
    { from: 1, to: 0, label: 'resolves, xo-done', dashed: true },
    { note: 'On failure: patch undone, XoongError thrown, xo-error fires', over: [0, 4] },
  ],
});

const OPERATIONS = `
{
  "version": 1,
  "operations": {
    "listUsers": {
      "id": "listUsers", "method": "GET", "path": "/users",
      "query": ["limit", "sort"],
      "response": { "t": "object", "props": { "items": { "t": "array", "items": { "t": "entity", "name": "User", "replace": true } } } }
    },
    "updateUser": {
      "id": "updateUser", "method": "PATCH", "path": "/users/{id}",
      "body": true,
      "bodySchema": { "t": "object", "props": { "name": { "t": "string", "minLength": 2 }, "email": { "t": "string", "format": "email" } }, "required": ["name"] },
      "response": { "t": "entity", "name": "User", "replace": true }
    }
  },
  "entities": { "User": { "id": "id" } }
}`;

const MAIN_JS = `
import { configure } from '@xoong/data';
import '@xoong/data/view';
import operations from '/.xoong/operations.json' with { type: 'json' };

configure({ api: operations, baseUrl: '/api', streamUrl: '/api/events' });`;

const READ_HTML = `
<xo-view get="listUsers" p-limit="10">
  <p xo-if="$loading" aria-busy="true">Loading…</p>
  <p xo-if="$error" role="alert">{$error.code}: {$error.detail}</p>
  <ul>
    <li xo-each="items">
      {name}
      <button xo-click="POST /users/{id}/disable" xo-optimistic="status=disabled">Disable</button>
    </li>
  </ul>
</xo-view>`;

const KEYS_JS = `
const a = client.query('listUsers', { limit: 10 });
const b = client.query('GET /users', { limit: '10' });
a === b;   // true: both are the query  listUsers:{"limit":"10"}`;

const STORE_JS = `
const q = client.query('listUsers', { limit: 10 });
await q.fetch();
q.root.peek();                 // { items: [{ $ref: 'User#1' }, { $ref: 'User#2' }], total: 2 }
client.store.read('User#1');   // { id: 1, name: 'Ada', email: '...' }  (a tracked read)
q.data.peek();                 // the same list with the records filled in`;

const MUTATE_JS = `
await client.mutate('updateUser', { id: 1 }, { name: 'Ada L.' }, {
  optimistic: [{ $ref: 'User#1', patch: { name: 'Ada L.' } }],
});`;

const SEED_JS = `
// main.js: the server wrote the answer into the page as <script type="application/json" id="seed-users">
const data = JSON.parse(document.getElementById('seed-users').textContent);
getClient().seed('listUsers', { limit: 10 }, data);
// a view with get="listUsers" p-limit="10" shows it at once and makes no request until it is stale`;

const EVENTS_JSON = `
{ "type": "patch",  "entity": "User", "id": "42", "path": "/email", "value": "a@b.c", "version": 17 }
{ "type": "upsert", "entity": "User", "id": "42", "value": { "id": 42, "name": "Ada" }, "version": 18 }
{ "type": "delete", "entity": "User", "id": "42", "version": 19 }
{ "type": "resync" }`;

const dataFlow = {
  file: 'arch-data-flow.html', section: 'docs', group: 'Architecture', nav: 'Data flow', title: 'Data flow',
  description: 'How a read and a write travel from the OpenAPI document through the client, the query cache and the entity store to the DOM.',
  body: `
<h1>Data flow</h1>
<p class="lead">A screen reads through one road: the OpenAPI document, a generated table, one client, a query cache, a shared entity store, and the scope of ${c('<xo-view>')}. A write travels back along the same road and refreshes what it touches.</p>

<h2>The road from spec to screen</h2>
<p>Nothing in the browser knows OpenAPI. ${c('xoong sync')} reads the document once, at development time, and writes a small table that the client uses at run time.</p>
${dataRoad}
<p>The rest of this page follows the road from the top, then the write path, live updates and errors.</p>

<h2>Sync: what the generated files hold</h2>
<table>
<thead><tr><th>File (in <code>.xoong/</code>)</th><th>What it is for</th></tr></thead>
<tbody>
<tr><td>${c('operations.json')}</td><td>The runtime table. Per operation: ${c('id')}, ${c('method')}, ${c('path')} template, the names of its ${c('query')} parameters, whether it has a ${c('body')}, the request schema (${c('bodySchema')}, used by <a href="arch-forms.html">forms</a>), and a ${c('response')} descriptor that says where entities sit in the answer. Plus the ${c('entities')}: which schemas are records and which property is their id.</td></tr>
<tr><td>${c('api.d.ts')}</td><td>TypeScript types for every operation, so ${c('createClient<Operations>()')} checks names, params and bodies. JavaScript users never load it.</td></tr>
<tr><td>${c('xoong.html-data.json')}</td><td>Completion and hover for ${c('xo-*')} names and your operation names in editors. See <a href="arch-tooling.html">Tooling</a>.</td></tr>
</tbody></table>
${tabs('Generated and loaded', [['operations.json (trimmed)', 'json', OPERATIONS], ['main.js', 'js', MAIN_JS], ['Terminal', 'bash', 'npx xoong sync openapi.json --hints xoong.hints.json']])}
<p>An operation is named by its ${c('operationId')}. Without one, sync builds a name from the method and path. A schema is an <strong>entity</strong> when it has a property named ${c('id')}, or one named by ${c('x-xoong-id')} in the document, or by a hints file (${c('idNames')}, or ${c('schemas.X.id')}); an id may be several properties (a composite id). A response that uses the entity's own schema is stored by <em>replacing</em> the record (${c('replace: true')} above); several schemas that share one entity through a hint merge field by field, because projections carry fewer fields. ${c('xoong doctor')} lists what the document leaves unclear, with a fix for each.</p>

<h2>The client</h2>
<p>${c('configure()')} makes the one app-wide client (${c('createClient()')}); ${c('getClient()')} returns it. Everything that talks to the API goes through it. A request is built like this:</p>
<ul>
<li>The path template is filled from params and every value is URL-encoded; a missing path parameter throws and names it. Only the query names the operation declares are sent; an array repeats the name.</li>
<li>${c('headers()')} is called per request (it may be async: auth tokens). ${c('credentials')} is passed to ${c('fetch')}. The body is JSON, or ${c('FormData')} as it is for multipart operations.</li>
<li>Only GET is retried: on a network failure or a 502, 503 or 504, up to ${c('retry')} times (2), waiting ${c('retryDelay')} milliseconds (300) doubled each time. A write is never retried, so it cannot run twice. Fields that hints declare as idempotency keys get a fresh UUID per call.</li>
<li>${c('204')} answers ${c('null')}. A hint ${c('unwrap: "data"')} reads ${c('{ code, message, data }')} envelopes as ${c('data')}.</li>
</ul>
<p>A failure is always a ${c('XoongError')} with ${c('status')} (0 for a network failure), ${c('title')}, ${c('detail')}, ${c('code')}, ${c('retryAfterS')} and ${c('fields')}. It is built from ${c('application/problem+json')}, ${c('{ error: { code, message, fields } }')}, FastAPI-style ${c('{ detail: [{ loc, msg }] }')} or ${c('{ errors: [{ pointer, detail }] }')}. A 401 calls ${c('onUnauthorized')}, then every failure calls ${c('onError')}.</p>
<table>
<thead><tr><th>Option</th><th>Default</th><th>Meaning</th></tr></thead>
<tbody>
<tr><td>${c('api')}</td><td>required</td><td>the contents of ${c('operations.json')}</td></tr>
<tr><td>${c('baseUrl')}, ${c('headers')}, ${c('credentials')}, ${c('fetch')}</td><td></td><td>where and how requests go out</td></tr>
<tr><td>${c('staleTime')}</td><td>30000 ms</td><td>how long a GET result counts as fresh</td></tr>
<tr><td>${c('gcTime')}</td><td>300000 ms</td><td>how long a query that nothing watches is kept</td></tr>
<tr><td>${c('retry')}, ${c('retryDelay')}</td><td>2, 300 ms</td><td>GET retries and the first delay</td></tr>
<tr><td>${c('evictEntities')}</td><td>true</td><td>drop records no cached query reaches when a query is collected</td></tr>
<tr><td>${c('invalidate')}</td><td>none</td><td>extra rules: mutation id to the operation ids to refresh</td></tr>
<tr><td>${c('onError')}, ${c('onUnauthorized')}, ${c('streamUrl')}</td><td></td><td>global error handler, 401 handler, the server-sent events endpoint</td></tr>
</tbody></table>

<h2>The query cache</h2>
<p>A read is a <em>query</em>. Its key is the operation id plus the canonical params: keys sorted, empty values dropped, every value as its text in the URL. So the same data is the same query, however you ask for it, and a developer never writes a key.</p>
${readSeq}
${tabs('One query', [['JavaScript', 'js', KEYS_JS]])}
<p>A query holds signals: ${c('status')} (${c('idle')}, ${c('loading')}, ${c('success')} or ${c('error')}), ${c('error')}, the normalised ${c('root')} and ${c('data')}, a computed value that fills the records back in. It also holds the rules of its life:</p>
<ul>
<li><strong>Deduplicated.</strong> Two views of the same query share one request.</li>
<li><strong>Observed.</strong> A view calls ${c('retain()')} when it starts and ${c('release()')} when its params change or it goes away. Retaining fetches the query if it is not fresh (older than ${c('staleTime')}). While a refetch runs, the old data stays on screen and ${c('$loading')} is true.</li>
<li><strong>Cancelled.</strong> When the last observer lets go while the request is running, the request is aborted. That is not an error; the query returns to its previous state.</li>
<li><strong>Collected.</strong> A query nobody watches is dropped after ${c('gcTime')}. Coming back before that shows the cached data at once.</li>
</ul>

<h2>The entity store</h2>
<p>When a response arrives, the response descriptor tells ${c('normalize()')} where the records are. Each record goes into the store once, under ${c('Name#id')}, and the query keeps a reference (${c('{ $ref: "User#1" }')}) in its place. Every record is one signal. A GET response is only one of four ways a record gets in:</p>
${dataEntry}
${tabs('Normalised', [['JavaScript', 'js', STORE_JS]])}
<p>The effect is sharing: a list, a detail page and a dashboard that show ${c('User#1')} read the same signal, so one change reaches all of them. Reading the data (${c('denormalize')}) resolves the references; a reference to a deleted record drops out of lists instead of leaving a hole. A union is stored under the right entity when the members can be told apart (a discriminator, a fixed tag value, or a property only one member has); otherwise the value stays inline and ${c('xoong doctor')} reports it (XO160).</p>
<p>${c('derived(({ all, get }) => ...)')} is a ${c('computed')} over the store: ${c('all("Order")')} is every <em>loaded</em> order, from any query, and the result recomputes when one of them or the set changes. It never fetches; fetching is declared on a view.</p>
<p>One caveat. When a query is collected, records that no remaining cached query reaches (following nested references) are dropped, and a screen still reading them sees them as deleted. So a screen should show its data through a query. Turn it off with ${c('evictEntities: false')}.</p>

<h2>The view and the DOM</h2>
<p>${c('<xo-view get>')} picks its query in an effect over its ${c('get')} attribute and its params (the ${c('p-*')} attributes, ${c('xo-param')}, the URL). When either changes, it releases the old query and retains the new one. Its scope has ${c('$loading')} (status is ${c('loading')}), ${c('$error')} (the ${c('XoongError')}), the response fields (${c('items')}), and the params, so ${c('{id}')} works in an action. Text bindings read the scope inside effects, so only the nodes whose values changed are written. <a href="arch-rendering.html">Rendering</a> shows how.</p>
${tabs('A read and a write on one screen', [['HTML', 'html', READ_HTML]])}

<h2>The write path</h2>
<p>A write is ${c('xo-click')} on a button or ${c('xo-submit')} on a form. Both end in ${c('client.mutate(op, params, body)')}.</p>
${writeSeq}
<ol>
<li><strong>The handler.</strong> It ignores a second click while one call is running (and sets ${c('aria-busy')}). ${c('xo-confirm')} asks first. Path and query params come from the scope: the current item first, then the view's ${c('p-*')} params. The body is the form model's result, the form's fields, ${c('xo-body')} (a record from the scope), plus ${c('xo-with')} fields; ${c('xo-selected')} runs once per ticked row or sends the ticked ids in one request.</li>
<li><strong>Optimistic update.</strong> With ${c('xo-optimistic="status=disabled"')} (or the ${c('optimistic')} option), the patch is applied to loaded records at once. If the call fails, only the fields that still hold the provisional value are put back, so a newer change from the server or another screen is never erased.</li>
<li><strong>The response</strong> is normalised into the store, so every screen that shows the record updates. The call resolves with the denormalised result.</li>
<li><strong>Invalidation.</strong> Every cached query whose path overlaps the mutation's path is marked stale, and refetched now if something is watching it. Two paths overlap when one is a prefix of the other, segment by segment.</li>
<li><strong>Events.</strong> The view's host fires ${c('xo-done')} with the result, and ${c('xo-notice')} when the button has a ${c('xo-notice')} message (shown by ${c('<xo-toast>')}).</li>
</ol>
<table>
<thead><tr><th>Cached query</th><th>After <code>POST /users/1/disable</code></th></tr></thead>
<tbody>
<tr><td>${c('GET /users')}</td><td>refreshed (a prefix of the mutation's path)</td></tr>
<tr><td>${c('GET /users/1')}</td><td>refreshed, unless the response was that very record: it was just rewritten, so it is marked fresh instead</td></tr>
<tr><td>${c('GET /users/1/posts')}</td><td>kept (neither path is a prefix of the other)</td></tr>
<tr><td>${c('GET /users/2')}</td><td>kept (differs at a segment)</td></tr>
</tbody></table>
<p>The rule is by path, so it needs no declaration. When it is not enough, name the extra queries once: ${c('configure({ invalidate: { shipOrder: ["getDashboard"] } })')}. Those are refreshed whatever their path.</p>
${tabs('From JavaScript', [['JavaScript', 'js', MUTATE_JS]])}
<p>A deleted record is not removed from the store by a ${c('DELETE')} call: the lists that contained it refetch and no longer name it. Only a stream ${c('delete')} event removes a record at once.</p>

<h2>Server-known data: seed</h2>
<p>When the server already has the answer (it rendered the page), put it in the cache instead of asking again. The server writes the JSON into the page as ${c('<script type="application/json">')} (not code, so a strict CSP allows it), one module script calls ${c('client.seed(op, params, data)')}, and the data is stored like any response, entities included. A view that asks for the same operation and params shows it at once and makes no request until it is stale.</p>
${tabs('Seed', [['JavaScript', 'js', SEED_JS]])}

<h2>Live updates</h2>
<p>With ${c('streamUrl')} set and ${c('live')} on a view, the client opens one server-sent events connection, shared by all live views and closed when the last one goes away. It is loaded lazily, so an app without live views never pays for it. Each message is one JSON event, applied to the <em>store</em>, not to a view: every screen showing that record updates.</p>
${tabs('Events', [['JSON', 'json', EVENTS_JSON]])}
<ul>
<li>${c('patch')} changes one field, addressed by a JSON Pointer (${c('/email')}); it is ignored if the record is not loaded. ${c('upsert')} merges fields into the record, or creates it. ${c('delete')} removes it.</li>
<li>${c('version')} must rise per record. An event with a version at or below the last applied one is dropped, and a delete keeps its version so a late event cannot bring the record back.</li>
<li>${c('resync')} forgets the versions and marks every cached query stale. So does a reconnect after an interruption: events may have been missed, so what is on screen is refetched. Replay by ${c('Last-Event-ID')} is the browser's ${c('EventSource')} doing its job; the client adds no replay of its own.</li>
</ul>

<h2>When something fails</h2>
<ul>
<li><strong>A read fails</strong> (after the retries): the query's status is ${c('error')}, ${c('$error')} holds the ${c('XoongError')}, any earlier data stays, and ${c('onError')} runs. ${c('xo-refresh')} on a button fetches again.</li>
<li><strong>A write fails:</strong> the optimistic patch is undone, ${c('onError')} runs, and the view's host fires ${c('xo-error')} with the error. ${c('<xo-toast>')} listens for it. In a form, ${c('error.fields')} are put on the fields they name (see <a href="arch-forms.html">Forms flow</a>).</li>
<li><strong>A screen mistake</strong> (an unknown operation name in ${c('get')}) is not an API failure: it is logged with ${c('console.error')} together with the closest valid name, ${c('xo-error')} fires, and the rest of the screen keeps working.</li>
</ul>

<h2>Where to look in the code</h2>
${files([
  ['packages/cli/src/openapi.js', 'the analysis behind ' + c('sync') + ': entities, response descriptors, request schemas'],
  ['packages/data/src/client.js', 'request building, retries, ' + c('XoongError') + ', queries, ' + c('mutate') + ', ' + c('seed') + ', ' + c('stream')],
  ['packages/data/src/invalidate.js', 'the path-overlap rule'],
  ['packages/data/src/store.js', 'normalisation, the entity signals, stream events, optimistic updates, eviction'],
  ['packages/data/src/stream.js, default.js', 'the SSE connection and its sharing'],
  ['packages/data/src/view.js', c('<xo-view>') + ', scope variables, the action handlers'],
  ['docs/data-layer.md', 'the longer design notes (parts of it, such as per-view ' + c('stale') + ' and the gateway, are not built)'],
])}
`,
};

// ---- 3. forms -------------------------------------------------------------------------------------------------------------------------

const formsModel = diagram({
  id: 'fm-model', label: 'Diagram: from the request schema to the form controls', w: 560, h: 520, size: 'sm',
  title: 'From the request schema to the form controls',
  desc: 'At the top left, the request schema in the OpenAPI document becomes the bodySchema node tree in operations.json when xoong sync runs. At the top right is the record, the item of the enclosing xo-view. Both feed the form model, created by createForm: the bodySchema is its schema and a copy of the record is its baseline. The model holds the baseline, the draft and the state of every path. Below it is the DOM binder, attach(form). Effects carry values and errors from the model to the binder, and set(path, raw) carries changes back. The binder writes to the form controls (input, select, textarea, XoControl) and hears their input, change and focusout events.',
  caption: 'The model is the single source of truth. The DOM is a view of it: values go out through effects, changes come back through delegated events.',
  draw(d) {
    const a = d.box(10, 14, 250, 'Request schema', 'requestBody in OpenAPI');
    const b = d.box(10, 104, 250, 'bodySchema', 'node tree in operations.json');
    const rec = d.box(300, 14, 250, 'Record', 'item of the enclosing xo-view');
    const model = d.box(80, 214, 400, 'Form model', ['createForm({ schema, value, rules })', 'baseline, draft, state per path'], { kind: 'core' });
    const binder = d.box(80, 336, 400, 'DOM binder', 'attach(form): delegated listeners, effect per control');
    const ctl = d.box(80, 442, 400, 'Form controls', 'input, select, textarea, XoControl');
    d.line([[a.cx, a.b], [a.cx, b.y]], { label: 'xoong sync', at: [146, 88], anchor: 'start' });
    d.line([[b.cx, b.b], [b.cx, 188], [200, 188], [200, model.y]]);
    d.line([[rec.cx, rec.b], [rec.cx, 188], [360, 188], [360, model.y]], { label: 'baseline = copy', at: [440, 130], anchor: 'start' });
    d.line([[170, model.b], [170, binder.y]], { label: 'effects', at: [158, 312], anchor: 'end' });
    d.line([[390, binder.y], [390, model.b]], { label: 'set(path, raw)', at: [402, 312], anchor: 'start' });
    d.line([[170, binder.b], [170, ctl.y]], { label: 'value, error note', at: [158, 418], anchor: 'end' });
    d.line([[390, ctl.y], [390, binder.b]], { label: 'input, change, focusout', at: [402, 418], anchor: 'start' });
  },
});

const formsSubmit = diagram({
  id: 'fm-submit', label: 'Diagram: the submit pipeline', w: 560, h: 496, size: 'sm',
  title: 'The submit pipeline',
  desc: 'Submitting runs these steps in order. 1. touchAll makes every error visible. 2. validate runs the schema rules, the custom rules and the async rules, and waits for them. If anything is invalid, nothing is sent: a cancelable xo-reveal fires, the first invalid field gets focus, and then xo-invalid fires. If valid, 3. normalize(draft) reduces the draft to the request schema, following emptyAs and pruneEmpty. 4. client.mutate sends it. On success, the saved record becomes the baseline for an edit form, and a create form resets, unless it has xo-keep. On failure, the error fields land on their paths and the detail is shown as a summary.',
  caption: 'Nothing leaves the page until the model says the draft is valid.',
  draw(d) {
    const a = d.box(10, 14, 280, 'touchAll()', 'every error becomes visible');
    const b = d.box(10, 104, 280, 'validate()', ['schema rules, custom rules,', 'async rules (awaited)']);
    const r1 = d.box(350, 104, 210, 'Invalid: nothing sent', ['xo-reveal, then focus;', 'then xo-invalid fires'], { kind: 'err' });
    const c = d.box(10, 210, 280, 'normalize(draft)', 'only request-schema fields; emptyAs');
    const m = d.box(10, 300, 280, 'client.mutate(op, params, body)', 'optimistic, send, normalise, invalidate');
    const ok = d.box(10, 404, 280, 'Success', ['edit: saved record = new baseline', 'create: the form resets'], { kind: 'ok' });
    const r2 = d.box(350, 292, 210, 'Failure', ['error.fields land on their', 'paths; detail as a summary'], { kind: 'err' });
    d.line([[a.cx, a.b], [a.cx, b.y]]);
    d.line([[b.cx, b.b], [b.cx, c.y]], { label: 'valid', at: [158, 194], anchor: 'start' });
    d.line([[b.r, b.cy], [r1.x, r1.cy]], { label: 'invalid', at: [325, b.cy - 13] });
    d.line([[c.cx, c.b], [c.cx, m.y]]);
    d.line([[m.cx, m.b], [m.cx, ok.y]], { label: 'ok', at: [158, 389], anchor: 'start' });
    d.line([[m.r, m.cy], [r2.x, r2.cy]], { label: 'error', at: [320, m.cy - 13] });
  },
});

const BODY_SCHEMA = `
{
  "t": "object",
  "required": ["title"],
  "props": {
    "title": { "t": "object", "props": { "en": { "t": "string", "minLength": 1 }, "vi": { "t": "string" } } },
    "publishedAt": { "t": "string", "format": "date-time", "nullable": true },
    "blocks": { "t": "array", "items": { "t": "union", "key": "type", "map": {
      "text":  { "t": "object", "props": { "type": { "t": "string", "enum": ["text"] }, "body": { "t": "string" } } },
      "image": { "t": "object", "props": { "type": { "t": "string", "enum": ["image"] }, "src": { "t": "string", "format": "uri" } } }
    } } }
  }
}`;

const MODEL_JS = `
import { createForm } from '@xoong/forms';

// No DOM needed: the model runs in plain Node, which is how it is tested.
const form = createForm({ schema: op.bodySchema, value: record });
form.set('title.en', 'Hello');       // a control's raw value, coerced to the schema's type
form.field('title.vi').error;        // reactive: read it inside an effect or a template
form.dirty;                          // normalise(draft) differs from normalise(baseline)
await form.submit((body) => client.mutate('updateArticle', { id }, body));`;

const FORM_HAND_HTML = `
<xo-view get="getArticle" p-id=":id">
  <form xo-submit="updateArticle">
    <label>Slug <input name="slug"></label>
    <label>Title <input name="title.en"></label>
    <small xo-if="$form.errors['title.en']">{$form.errors['title.en']}</small>
    <p xo-if="$form.dirty">Unsaved changes</p>
    <button>Save</button>
  </form>
</xo-view>`;

const RULES_JS = `
const form = document.querySelector('form');   // after its xo-view has started
form.rules = {
  slug: async (value, { record }) => ((await isTaken(value, record.id)) ? 'Already used' : ''),
  '*': (record) => (record.start > record.end ? { end: 'Must be after the start' } : {}),
};
form.serialize = (draft, body) => body;        // the escape hatch for the payload`;

const FORM_GEN_HTML = `
<!-- you write -->
<xo-form op="updateUser" submit="Save"></xo-form>

<!-- the template writes (then the binder takes over, as for any xo-submit form) -->
<form xo-submit="updateUser" class="xo-form">
  <label class="xo-field"><span>Name</span><input name="name"></label>
  <label class="xo-field"><span>Email</span><input name="email"></label>
  <button class="xo-submit">Save</button>
</form>`;

const HINTS_JSON = `
{
  "fields": {
    "Article.slug": { "hint": "Used in the address", "order": 1 },
    "Article.body": { "widget": "xo-richtext", "label": "Body", "order": 2 },
    "Article.internalNote": { "hidden": true }
  }
}`;

const forms = {
  file: 'arch-forms.html', section: 'docs', group: 'Architecture', nav: 'Forms flow', title: 'Forms flow',
  description: 'How a request schema becomes a form model, how the DOM binder connects it to a form, and how submit and server errors travel.',
  body: `
<h1>Forms flow</h1>
<p class="lead">A form is a typed draft of a record, the baseline it came from, and one small piece of state per field path. The rules come from the request schema of the operation; the DOM only shows the model.</p>
<p>This page is the inside view. For using forms, see <a href="forms.html">Forms</a>.</p>

<h2>From the schema to the controls</h2>
<p>The pieces, in the order the data meets them:</p>
${formsModel}
<ol>
<li><strong>${c('bodySchema')}.</strong> ${c('xoong sync')} converts the JSON request body of an operation into a compact node tree and stores it in ${c('operations.json')}. A node has a type ${c('t')} (${c('string')}, ${c('integer')}, ${c('number')}, ${c('boolean')}, ${c('object')}, ${c('array')}, ${c('union')}, ${c('any')}) and the rules that OpenAPI states: ${c('format')}, ${c('enum')}, length, range, ${c('pattern')}, ${c('nullable')}, ${c('readOnly')}, ${c('default')}, ${c('title')}, ${c('description')}. ${c('allOf')} is merged; ${c('oneOf: [X, null]')} is a nullable X; a ${c('oneOf')} of objects becomes a ${c('union')} when a discriminator or a property with one fixed value per member tells them apart. Otherwise the node is ${c('any')}, which is accepted as it is and not drawn by ${c('<xo-form>')}, and ${c('xoong doctor')} warns (XO161). A multipart body has no ${c('bodySchema')}: ${c('xo-submit')} sends ${c('FormData')}.</li>
<li><strong>The record.</strong> An <em>edit</em> form (the operation has a path parameter, or ${c('xo-body')} names a record) starts from the record in its scope, read from the store. A <em>create</em> form starts from the schema's defaults.</li>
<li><strong>The model</strong> copies the record twice: the baseline (what was loaded) and the draft (what the person edits).</li>
<li><strong>The binder</strong> connects the model to the real ${c('<form>')}.</li>
</ol>
${tabs('A schema node tree', [['JSON', 'json', BODY_SCHEMA]])}

<h2>The form model</h2>
<p>${c('createForm({ schema, value, rules })')} has no DOM and no framework: it is pure signals, so it is tested in plain Node.</p>
${tabs('The model', [['JavaScript', 'js', MODEL_JS]])}
<ul>
<li><strong>Per-path state.</strong> ${c('form.field("title.en")')} gives ${c('value')}, ${c('error')}, ${c('touched')}, ${c('dirty')} and ${c('filled')} for that path. Each is a signal created the first time it is asked for and updated only when its own value changes, so an edit wakes the readers of that field and its parents, not the other few hundred. A path is written ${c('a.b')} or ${c('items[2].x')}; ${c('items.2.x')} is the same.</li>
<li><strong>Typed values.</strong> A control gives a string. ${c('set(path, raw)')} coerces it with the node: numbers become numbers, a checkbox a boolean, empty text becomes ${c('null')} for a nullable field and otherwise "nothing" (the key is left out). A text that is not a number stays text and fails validation.</li>
<li><strong>Errors, in order of priority.</strong> The server's field errors, then async rules, then synchronous custom rules, then the schema's own rules. For one path the later one wins, so a schema error is never hidden by a custom rule. The schema checks required, type, minimum and maximum (also exclusive), ${c('multipleOf')}, lengths, ${c('pattern')}, ${c('format')} (email, uri, uuid, date, date-time), ${c('enum')}, item counts, uniqueness, and that a union has a variant.</li>
<li><strong>Rules</strong> are plain functions keyed by path (${c('"items[].title"')} covers every item; ${c('"*"')} is the whole record and returns errors by path). Synchronous rules run on every change. An async rule (one that returns a promise) marks the form ${c('pending')} and is re-run only for the path that changed; an answer for an older value is ignored. A rule that throws becomes an error, not a crash.</li>
<li><strong>What is sent.</strong> ${c('form.body()')} reduces the draft to the request schema: only properties of the schema (ids and timestamps of the record never go out; read-only ones are skipped), empty values follow ${c('emptyAs')} (${c('omit')} by default, or ${c('null')}), ${c('pruneEmpty')} drops empty members of an object, and a node of type ${c('any')} is kept as it is. A nullable property that the schema lists as required is sent as ${c('null')} when empty, because the key must be present. ${c('serialize')} replaces all of this.</li>
<li><strong>Dirty</strong> uses the same reduction on both sides, and treats ${c('null')} and absent as equal. Typing a letter and deleting it is pristine again.</li>
<li><strong>Arrays.</strong> ${c('append')}, ${c('removeAt')} and ${c('moveItem')} change the draft; touched marks follow their item, and the errors of that array are recomputed for the new positions. ${c('onArrayChange')} reports it; the binder turns that into the ${c('xo-array-change')} event.</li>
</ul>
${tabs('Rules in a hand-written form', [['HTML', 'html', FORM_HAND_HTML], ['JavaScript', 'js', RULES_JS]])}

<h2>The DOM binder</h2>
<p>Every ${c('<form xo-submit>')} whose operation has a ${c('bodySchema')} gets a binder as soon as its view starts, once ${c('@xoong/forms')} is imported (importing it registers the binder with ${c('xo-submit')}). It is attached at once, not at the first click, so fields are filled before anyone touches the form.</p>
<ul>
<li><strong>${c('novalidate')}.</strong> The browser's own validation is switched off. Validity lives in the model, so an invalid control that is hidden (another tab, a collapsed block) can never block the submit with "not focusable".</li>
<li><strong>DOM to model.</strong> One delegated ${c('input')} and ${c('change')} listener on the form, plus ${c('focusout')} for "touched". A form of 800 fields has three listeners. A control is found by its ${c('name')} path. The model is written only by these <em>user</em> events: setting ${c('el.value')} from code does not touch it, which also means an untouched date-time keeps its exact original string (an edit converts local time to UTC ISO).</li>
<li><strong>Model to DOM.</strong> For each control, one effect writes its value and one shows its error once the field is touched (a ${c('<small class="xo-error">')}, ${c('aria-invalid')}, ${c('aria-describedby')}, and ${c('setCustomValidity')}). The effect skips the control the change came from, so it never rewrites what the person is typing, and it reads the control untracked, so what the control does inside (its own value, its validity) cannot subscribe it.</li>
<li><strong>Completing attributes.</strong> From the node, the binder fills in only what you left out: ${c('type')}, ${c('step')}, ${c('min')}, ${c('max')}, ${c('minlength')}, ${c('maxlength')}, ${c('pattern')}, ${c('required')}, ${c('readonly')}, the options of an enum ${c('<select>')}. An attribute you wrote always wins.</li>
<li><strong>Controls that come and go.</strong> A ${c('MutationObserver')} binds controls added later (rows of ${c('xo-each')}, a revealed tab) and re-binds a control whose ${c('name')} changes (a reordered row). A custom element used before its class is defined is bound when the browser upgrades it.</li>
<li><strong>Custom controls.</strong> Any form-associated element with a ${c('name')} (every ${c('XoControl')}) is the field of that path. It receives ${c('schema')} (its node), ${c('hints')} (every hint of the field, unknown keys included) and ${c('xoForm')} (the model, to read other paths). It writes with ${c('userInput(value)')}, which fires ${c('input')}.</li>
<li><strong>After a save</strong> the model's baseline becomes the saved record (${c('markPristine')}), the controls are rewritten from it, and custom controls are told, so their own ${c('dirty')} agrees with the form's. A create form resets to the defaults instead, unless it has ${c('xo-keep')}.</li>
<li><strong>The record underneath.</strong> The binder watches the record. When it changes (a live update), a pristine form follows it; a dirty form keeps its draft and ${c('$form.stale')} becomes true.</li>
</ul>
<p>The binder announces itself with events that bubble from the form: ${c('xo-form-ready')} (${c('form.model')} exists from then), ${c('xo-dirty')} (${c('{ dirty }')}: the router listens to this, see <a href="arch-routing.html">Router</a>), ${c('xo-array-change')} and ${c('xo-reveal')}. The view around the form fires ${c('xo-invalid')}. In markup, ${c('$form')} is the model: ${c('$form.dirty')}, ${c('$form.valid')}, ${c('$form.submitting')}, ${c('$form.errors["title.vi"]')}, ${c('$form.touched[...]')}, ${c('$form.filled[...]')}. A tab can show an error dot from the model, even for fields that are not on the visible tab.</p>

<h2>The submit pipeline</h2>
${formsSubmit}
<ul>
<li>${c('xo-submit')} first asks ${c('xo-confirm')} if there is one, then calls ${c('engine.submit')}. The model touches every field (so every error shows), validates, and awaits the async rules.</li>
<li><strong>Invalid.</strong> Nothing is sent. The binder finds the first invalid path in the order controls appear on the page and fires a bubbling, cancelable ${c('xo-reveal')} ${c('{ path }')}. If a listener calls ${c('preventDefault()')} (it switched a tab, selected a block), the binder waits 30 milliseconds for the render. Then the control is focused (a custom control focuses its ${c('focusTarget')}). Last, the view fires ${c('xo-invalid')} with the errors.</li>
<li><strong>Valid.</strong> ${c('client.mutate')} sends the normalised body, with the optimistic patch if the button asked for one. Then the model marks itself pristine or resets, as above.</li>
<li><strong>The server says no.</strong> A ${c('XoongError')} carries ${c('fields')}, keyed by dotted path. The client builds them from a pointer (${c('/title/en')} becomes ${c('title.en')}), from ${c('{ error: { fields } }')}, or from FastAPI's ${c('loc')}. The model puts them on the same paths as its own errors, so they appear next to the field. A field's server error clears as soon as that field is edited. A failure with no field messages shows its ${c('detail')} as a ${c('role="alert"')} summary under the form.</li>
</ul>

<h2>The generated form</h2>
<p>${c('<xo-form op="updateUser">')} is only a markup generator. It writes the ${c('<form xo-submit>')} you would have written from the operation's ${c('bodySchema')}, and from then on it is an ordinary form with the same binder. There is no second code path and no second validation.</p>
${tabs('Generated markup', [['HTML', 'html', FORM_GEN_HTML], ['xoong.hints.json', 'json', HINTS_JSON]])}
<ul>
<li>A string, number or integer is a labelled input (the label is the schema's ${c('title')}, else the humanised name). An ${c('enum')} is a ${c('<select>')}, a boolean a checkbox, and ${c('format')} chooses the input type.</li>
<li>An object is a ${c('<fieldset>')} with a legend. An array is a fieldset of rows over ${c('xo-each')}, each with move up, move down and remove buttons (and a drag handle), and an Add button. A union gets one "Add <em>variant</em>" button per variant, and each row shows the fields of its variant (${c('xo-if="type=image"')}).</li>
<li><strong>Hints</strong> change the drawing: ${c('label')}, ${c('hint')}, ${c('placeholder')}, ${c('order')}, ${c('group')} (a fieldset with a legend), ${c('hidden')} (kept in the model and sent, not drawn), ${c('readOnly')} (not drawn, not sent) and ${c('widget')}. A widget is a built-in name (${c('textarea')}, ${c('password')}, ${c('url')}, ${c('email')}, ${c('color')}, ${c('date')}, ${c('datetime')}, ${c('select')}) or the tag of a custom element that extends ${c('XoControl')} (any name with a hyphen). They come from the OpenAPI ${c('title')} and ${c('description')}, from ${c('x-xoong-widget')} on a node, or from the ${c('fields')} map of ${c('xoong.hints.json')}, keyed by schema and property, for documents you cannot edit. Any other hint passes through to the widget in ${c('hints')}.</li>
<li>Without a ${c('bodySchema')} (a multipart body) the generator draws the flat ${c('bodyFields')}, and files become file inputs.</li>
</ul>

<h2>Where to look in the code</h2>
${files([
  ['packages/cli/src/body-schema.js', 'request schema to node tree'],
  ['packages/forms/src/schema.js', 'paths, ' + c('coerce') + ', ' + c('defaults') + ', ' + c('validate') + ', the message catalogue'],
  ['packages/forms/src/form-model.js', c('createForm') + ', ' + c('normalize') + ', rules, arrays, ' + c('submit')],
  ['packages/forms/src/form-dom.js', 'the binder, ' + c('attach')],
  ['packages/data/src/view.js', c('bindAction') + ' (where ' + c('xo-submit') + ' meets the form engine), ' + c('$form') + ', the array buttons'],
  ['packages/ui/src/form.js', c('<xo-form>') + ', the markup generator'],
  ['docs/decisions/0009-forms-from-the-api-schema.md', 'the reasons behind this design'],
])}
`,
};

// ---- 4. rendering ---------------------------------------------------------------------------------------------------------------------

const renderGraph = diagram({
  id: 'rn-graph', label: 'Diagram: how a signal change reaches the DOM', w: 590, h: 360, size: 'sm',
  title: 'How a signal change reaches the DOM',
  desc: 'Two signals, first and last, feed a computed value, full, which is calculated lazily and cached. Two effects read the computed value: one writes a text node and one writes the class attribute. Each effect updates only its own DOM node. A separate box notes that batch groups several writes so that the effects run once, at the end.',
  caption: 'A write to a signal marks what read it. Only the effects that depend on it re-run, and each writes one node.',
  draw(d) {
    const s1 = d.box(10, 14, 170, 'first', 'signal("Ada")');
    const s2 = d.box(200, 14, 170, 'last', 'signal("Lovelace")');
    const comp = d.box(95, 104, 190, 'full', 'computed(): lazy, cached');
    const e1 = d.box(10, 194, 170, 'effect', 'sets node.data');
    const e2 = d.box(200, 194, 170, 'effect', 'sets class attribute');
    const dom = d.box(10, 284, 360, 'DOM', 'a text node and an attribute change; nothing else');
    d.box(398, 104, 180, 'batch(fn)', ['groups writes: effects', 'run once at the end'], { kind: 'soft' });
    d.line([[s1.cx, s1.b], [s1.cx, 88], [150, 88], [150, comp.y]]);
    d.line([[s2.cx, s2.b], [s2.cx, 88], [230, 88], [230, comp.y]]);
    d.line([[150, comp.b], [150, 178], [e1.cx, 178], [e1.cx, e1.y]]);
    d.line([[230, comp.b], [230, 178], [e2.cx, 178], [e2.cx, e2.y]]);
    d.line([[e1.cx, e1.b], [e1.cx, dom.y]]);
    d.line([[e2.cx, e2.b], [e2.cx, dom.y]]);
  },
});

const viewLife = diagram({
  id: 'rn-view', label: 'Diagram: the life of an xo-view', w: 560, h: 520, size: 'sm',
  title: 'The life of an xo-view',
  desc: 'Six steps, top to bottom. 1. connected: the view waits until the page is parsed. 2. start: it saves its markup once and reads its p-* params. 3. draw: it clones the markup and binds every node. 4. select the query: an effect over get and the params releases the old query and retains the new one. 5. live: when params, the store or the query status change, only the bound nodes update. 6. disconnected: the effects are disposed, the query is released and the stream is closed.',
  caption: 'The markup is kept as a template and drawn from it, so a view that is disconnected and connected again starts from the same source.',
  draw(d) {
    const steps = [
      ['connected', 'waits until the page is parsed'],
      ['start', 'saves the markup once, reads p-* params'],
      ['draw', 'clones the markup, binds every node'],
      ['select the query', 'effect over get + params: release, retain'],
      ['live', 'a change updates only the bound nodes'],
      ['disconnected', 'effects disposed, query released, stream closed'],
    ];
    let prev = null;
    steps.forEach(([name, sub], i) => {
      const b = d.box(60, 14 + i * 86, 440, name, sub, { kind: i === 4 ? 'core' : '' });
      if (prev) d.line([[b.cx, prev.b], [b.cx, b.y]]);
      prev = b;
    });
  },
});

const SIGNALS_JS = `
import { signal, computed, effect, batch } from '@xoong/core';

const first = signal('Ada');
const last = signal('Lovelace');
const full = computed(() => first.value + ' ' + last.value);   // lazy, cached

const stop = effect(() => { document.title = full.value; });     // runs now, and again when full changes

batch(() => { first.value = 'Augusta'; last.value = 'King'; });   // one run of the effect, not two
stop();                                                           // a returned function disposes it`;

const ELEMENT_JS = `
import { XoElement, html, define } from '@xoong/core';

class UserCard extends XoElement {
  static props = { name: String, age: Number, vip: Boolean };   // attributes name, age, vip

  render() {                                                    // this element owns its content
    return html\`
      <h3 class=\${() => (this.vip ? 'vip' : '')}>\${() => this.name}</h3>
      <p ?hidden=\${() => !this.age}>Age \${() => this.age}</p>
      <button @click=\${() => this.emit('card-open', { name: this.name })}>Open</button>
      <div style:--age=\${() => this.age}></div>\`;
  }
}
define('user-card', UserCard);`;

const CONTROL_JS = `
import { XoControl, html, define } from '@xoong/core';

class StarRating extends XoControl {
  static props = { ...XoControl.props, max: Number };
  render() {
    return html\`<button type="button" @click=\${() => this.userInput(Number(this.value) + 1)}>+</button>\`;
  }
  validate(value) { return Number(value) > this.max ? 'Too many stars' : ''; }   // '' means valid
}
define('star-rating', StarRating);`;

const VIEW_BEFORE_HTML = `
<xo-view get="listUsers">
  <p xo-if="$loading">Loading…</p>
  <li xo-each="items"><a href="/users/{id}">{name}</a></li>
</xo-view>`;

const VIEW_AFTER_HTML = `
<xo-view get="listUsers">
  <!--xo-if-->
  <!--xo-each-->
  <li><a href="/users/1">Ada</a></li>
  <li><a href="/users/2">Cy</a></li>
  <!--/xo-each-->
</xo-view>`;

const rendering = {
  file: 'arch-rendering.html', section: 'docs', group: 'Architecture', nav: 'Rendering', title: 'Rendering model',
  description: 'Signals, html templates, XoElement and XoControl, why xoong uses the Light DOM without a virtual DOM, and how xo-view expands your markup.',
  body: `
<h1>Rendering model</h1>
<p class="lead">xoong draws nothing twice. A change to a signal wakes the few effects that read it, and each effect writes one DOM node. There is no virtual DOM to diff and no tree to re-render.</p>

<h2>Signals</h2>
<p>All of reactivity is five functions in ${c('@xoong/core')}.</p>
${renderGraph}
<ul>
<li>${c('signal(v)')} holds a value. Read it with ${c('.value')} (tracked) or ${c('.peek()')} (not tracked); write with ${c('.value =')} or ${c('.update(fn)')}. Writing a value that is the same by ${c('Object.is')} does nothing.</li>
<li>${c('computed(fn)')} is a derived value. It is lazy (it runs when read), cached until a signal it read changes, and lets go of its sources when nothing watches it.</li>
<li>${c('effect(fn)')} runs now and again when a signal it read changes. It may return a cleanup function. It returns a function that disposes it. An effect is for side effects: <strong>never fetch in one</strong>. Declare the read on a view instead.</li>
<li>${c('batch(fn)')} groups writes. Outside a batch each write flushes the effects it affects at once; inside, they flush once when the outermost batch ends.</li>
<li>${c('untracked(fn)')} reads without subscribing.</li>
</ul>
<p>Two safety nets: an effect that keeps writing a signal it reads is stopped after 10,000 rounds with an error that says so, and when an effect throws, the others still run; the errors are raised together afterwards.</p>
${tabs('Signals', [['JavaScript', 'js', SIGNALS_JS]])}

<h2>Templates</h2>
<p>${c('html')} is a tagged template. The strings of one call site are parsed once into a ${c('<template>')} and cloned for each render; the values are bound to the cloned nodes. The bindings are the whole language:</p>
<table>
<thead><tr><th>You write</th><th>It does</th></tr></thead>
<tbody>
<tr><td>${c('${() => x.value}')} as a child</td><td>An effect owns that spot. A function is reactive; a plain value is written once. Arrays, nodes and nested ${c('html')} results work.</td></tr>
<tr><td>${c('class=${() => ...}')}</td><td>A reactive attribute. ${c('null')} or ${c('false')} removes it; ${c('true')} sets it empty.</td></tr>
<tr><td>${c('?hidden=${() => ...}')}</td><td>A boolean attribute (${c('toggleAttribute')}).</td></tr>
<tr><td>${c('.value=${v}')}</td><td>A DOM property, with its case kept.</td></tr>
<tr><td>${c('@click=${fn}')}</td><td>An event listener, removed on dispose.</td></tr>
<tr><td>${c('style:--age=${() => ...}')}</td><td>A custom property set through the CSS object model, so it works under a strict CSP that blocks ${c('style=""')}.</td></tr>
</tbody></table>
<p>An attribute value must be exactly one expression. Text mixed with ${c('${}')} inside an attribute is an error with a message that says so. When a reactive child function runs again, its region is cleared and drawn again; reusing rows by key is what ${c('xo-each')} does in ${c('<xo-view>')}.</p>

<h2>XoElement</h2>
<p>${c('XoElement')} is the base class of every xoong element. ${c('static props')} lists typed properties; each becomes an observed attribute (${c('maxItems')} is ${c('max-items')}) and a signal.</p>
<table>
<thead><tr><th>Type</th><th>From the attribute</th></tr></thead>
<tbody>
<tr><td>${c('String')}</td><td>its text, ${c('""')} when absent</td></tr>
<tr><td>${c('Number')}</td><td>${c('Number(text)')}, 0 when absent</td></tr>
<tr><td>${c('Boolean')}</td><td>true when present, unless it is ${c('"false"')}</td></tr>
</tbody></table>
<ul>
<li>Reading ${c('this.name')} inside a template function or an effect is tracked, so the right nodes update when the attribute changes. The flow is one way: an attribute sets the property; setting the property from code does not write the attribute back. A property set before the element was upgraded is kept.</li>
<li>Implement ${c('render()')} only when the element <em>owns</em> its content: it is drawn into the element, replacing the children. To enhance HTML that is already there (server-rendered, or written by you), implement ${c('connected()')} instead. ${c('ready()')} resolves when the parser has reached the end of the document, for children that may not exist yet.</li>
<li>${c('this.effect(fn)')} is an effect that is disposed when the element is removed. ${c('emit(name, detail)')} fires a bubbling, composed ${c('CustomEvent')}.</li>
<li>${c('define(tag, class)')} registers the element (once; calling it again is harmless) and installs the property accessors.</li>
</ul>
${tabs('An element', [['JavaScript', 'js', ELEMENT_JS]])}

<h2>XoControl</h2>
<p>${c('XoControl')} extends ${c('XoElement')} for things that act like a form field: the rich text editor, the combobox, a tag input, your own image picker. It makes the element a form-associated custom element through ${c('ElementInternals')}, so it behaves like a native input in a ${c('<form>')}.</p>
<ul>
<li><strong>Value.</strong> ${c('value')} may be anything; ${c('serialize(value)')} says what the form submits (a string, a file, ${c('FormData')}, or nothing). It appears in ${c('FormData')} and resets with the form.</li>
<li><strong>Two ways to set it.</strong> ${c('setValue(v)')} (and the ${c('value')} property) is like ${c('input.value = x')}: no events, and the form model is not told. ${c('userInput(v)')} is for the person's change: it sets the value and fires ${c('input')}, which is what the form model listens for. ${c('userChange()')} fires ${c('change')}.</li>
<li><strong>State as signals:</strong> ${c('dirty')} (against the initial value), ${c('pristine')}, ${c('touched')} (focus left the control), ${c('valid')}. They are mirrored as the attributes ${c('data-dirty')}, ${c('data-touched')} and ${c('data-invalid')}, so CSS can use them. ${c('markPristine()')} makes the current value the new baseline.</li>
<li><strong>Validation.</strong> ${c('required')}, your ${c('validate(value)')} hook (return a message, or ${c('""')}), ${c('setCustomValidity()')}, ${c('checkValidity()')} and ${c('reportValidity()')}, passed on to the browser through ${c('internals.setValidity')}. A disabled ${c('fieldset')} disables it.</li>
<li>Where ${c('ElementInternals')} is missing (older DOMs, happy-dom) the control keeps its own value, validity and state; it only does not appear in a native ${c('FormData')}. ${c('<xo-form>')} and the form binder read controls through these properties, so tests in happy-dom work.</li>
</ul>
${tabs('A control', [['JavaScript', 'js', CONTROL_JS]])}

<h2>Why Light DOM, and why no virtual DOM</h2>
<ul>
<li><strong>Light DOM.</strong> Elements draw into the ordinary document. Your global CSS and tokens reach them; ${c('querySelector')}, axe and analytics see what the person sees; a form control participates in forms without a bridge. The cost is that collisions are possible: xoong answers with a tag prefix, cascade layers and ${c('xoong check')}, not walls. See <a href="styling.html">Styling</a>.</li>
<li><strong>No virtual DOM.</strong> A binding points at one node. When a signal changes, the effects that read it write that node: there is no second tree to build and compare. So an update touches only the node that reads the signal and leaves the rest of the page alone, including content that you or the person put there.</li>
<li><strong>Same markup on the server.</strong> Because the DOM is the output, prerendering produces plain HTML and the browser needs no hydration step. See <a href="arch-build.html">Build and delivery</a>.</li>
</ul>

<h2>How xo-view expands your markup</h2>
<p>${c('<xo-view>')} is the one element that reads markup as a language. It takes its children as a template, draws a copy, and binds the copy.</p>
${viewLife}
${tabs('Before and after', [['You write', 'html', VIEW_BEFORE_HTML], ['In the DOM', 'html', VIEW_AFTER_HTML]])}
<ul>
<li><strong>Text.</strong> A text node with ${c('{path}')} gets one effect that sets its ${c('data')}. It is a text node, never HTML, so the data cannot inject markup. Missing values are empty; objects are shown as JSON; ${c('{publishedAt | datetime}')} formats with ${c('Intl')}.</li>
<li><strong>Attributes.</strong> An attribute with ${c('{path}')} gets an effect that calls ${c('setAttribute')}. Interpolating into ${c('on*')} or ${c('srcdoc')} is refused (the attribute is removed and a message is logged). In a URL attribute (${c('href')}, ${c('src')}, ${c('action')}, ...) any scheme other than relative, ${c('http')}, ${c('https')}, ${c('mailto')} or ${c('tel')} becomes ${c('about:blank')}, even when hidden with whitespace.</li>
<li><strong>${c('xo-each')}.</strong> The element is the row template, bracketed by two comment markers. Rows are keyed by the entity reference (${c('User#1')}) or, for plain values, by position, so a row is reused when its item moves and removed (its effects disposed) when its item goes. A deleted entity drops out. Inside a row, ${c('$index')}, ${c('$n')} (from 1) and ${c('$i0')}, ${c('$i1')} (one per nesting level) are available.</li>
<li><strong>${c('xo-if')}.</strong> A comment marker stands where the element would be; the element is created and bound when the condition becomes true, and unbound and removed when it becomes false. ${c('xo-if="!path"')} negates, an empty array is false, and ${c('xo-if="type=image"')} or ${c('status!=draft')} compares with a literal.</li>
<li><strong>Scope.</strong> ${c('{name}')} is looked up from the current item outwards to the view's root and its ${c('p-*')} params, so ${c('{id}')} in a row finds the row's ${c('id')} first. ${c('{.}')} is the item itself, ${c('$loading')}, ${c('$error')} and the like are variables of the view.</li>
<li><strong>Template tags.</strong> ${c('<xo-table>')} and ${c('<xo-form>')} are not elements that draw themselves. They are expanders: before binding, each is replaced by the plain markup it describes, which is then bound like your own. If one throws (an unknown operation), a comment records it, ${c('xo-error')} fires, and the rest of the view still works.</li>
<li><strong>Actions</strong> (${c('xo-click')}, ${c('xo-submit')}, ${c('xo-param')}, ${c('xo-refresh')}, ${c('xo-add')}, ...) add event listeners on the element; see <a href="arch-data-flow.html">Data flow</a>.</li>
<li><strong>Starting again.</strong> The markup is kept; every start clones it. A view that is disconnected and connected again starts from the same source, and a prerendered view, which keeps its original markup in a ${c('<template data-xo-template>')}, starts from that instead of its rendered rows.</li>
</ul>

<h2>Where to look in the code</h2>
${files([
  ['packages/core/src/signals.js', 'signals, computed, effects, batch'],
  ['packages/core/src/html.js', 'template parsing and bindings'],
  ['packages/core/src/element.js', c('XoElement') + ', ' + c('define')],
  ['packages/core/src/control.js', c('XoControl')],
  ['packages/data/src/view.js', c('<xo-view>') + ': ' + c('bindNode') + ', ' + c('bindEach') + ', ' + c('bindIf') + ', the scope lookup'],
  ['docs/decisions/0002-light-dom-only.md', 'why Light DOM'],
])}
`,
};

// ---- 5. routing -----------------------------------------------------------------------------------------------------------------------

const navSteps = diagram({
  id: 'rt-steps', label: 'Diagram: the steps of one navigation', w: 570, h: 650, size: 'sm',
  title: 'The steps of one navigation',
  desc: 'A navigation starts from a link click, Back or Forward, or router.navigate(). Step 1: if the new location has the same path and query as the current one, nothing is done. Step 2: the vetoes run, which are the beforeNavigate hooks and the built-in check that asks first when a form has unsaved changes. Step 3: the guards run; each returns true, false, or a path to redirect to. A veto or a guard that returns false stops here: the URL is put back, and a Back or Forward is undone with history.go. Step 4: the history is written with pushState or replaceState and a position. Step 5: the layouts are kept or replaced and the route template is cloned. Step 6: after the render, the title, the description, aria-current, the focus and the scroll are set, and the xo-navigate event fires.',
  caption: 'One navigation. A newer navigation that starts while a veto or guard is still waiting takes over, and the older one stops.',
  draw(d) {
    const t = d.box(10, 14, 320, 'Trigger', 'link, Back/Forward, router.navigate()');
    const same = d.box(10, 100, 320, 'Same place?', 'same path and query: nothing to do');
    const veto = d.box(10, 186, 320, 'Vetoes', ['beforeNavigate() hooks;', 'a form with unsaved changes asks first']);
    const guard = d.box(10, 288, 320, 'Guards', ['guard() hooks: true, false,', 'or a path to redirect to']);
    const hist = d.box(10, 390, 320, 'History', 'pushState or replaceState, with a position');
    const render = d.box(10, 476, 320, 'Render', 'keep shared layouts, clone the route template', { kind: 'core' });
    const after = d.box(10, 562, 320, 'After', ['title, description, aria-current, focus,', 'scroll, then the xo-navigate event']);
    const stay = d.box(390, veto.y, 170, 'Stay', ['URL put back;', 'Back/Forward undone', 'with history.go()'], { kind: 'err', bh: guard.b - veto.y });
    [[t, same], [same, veto], [veto, guard], [guard, hist], [hist, render], [render, after]].forEach(([a, b]) => d.line([[a.cx, a.b], [a.cx, b.y]]));
    d.line([[veto.r, veto.cy], [stay.x, veto.cy]], { label: 'false', at: [360, veto.cy - 13] });
    d.line([[guard.r, guard.cy], [stay.x, guard.cy]], { label: 'false', at: [360, guard.cy - 13] });
  },
});

const layoutBoxes = diagram({
  id: 'rt-layout', label: 'Diagram: the elements the router builds', w: 560, h: 350, size: 'sm',
  title: 'The elements the router builds',
  desc: 'Nested frames. The outer frame is the xo-router element, whose templates stay inert. Inside it is a div with class xo-router-root. Inside that is a div with class xo-layout, which is the layout named shell and stays while only the route changes. The layout holds a nav on the left, and on the right the element marked xo-outlet. In the outlet is the route content, cloned from the route template, where views start and fetch.',
  caption: 'Between two routes that use the same layout, only the content of the outlet is replaced; the layout and its nav stay.',
  draw(d) {
    d.zone(10, 10, 540, 330, 'xo-router: its templates stay inert');
    d.zone(30, 44, 500, 280, 'div.xo-router-root');
    d.zone(50, 78, 460, 230, 'div.xo-layout (shell): stays between routes');
    d.box(70, 112, 120, 'nav', ['links with', 'aria-current'], { bh: 170 });
    d.zone(210, 112, 280, 170, 'main[xo-outlet]');
    d.box(230, 146, 240, 'Route content', ['cloned from template[xo-route]', 'views start and fetch now'], { kind: 'core', bh: 120 });
  },
});

const ROUTER_HTML = `
<xo-router base="/admin" base-links>
  <template xo-layout="shell">
    <nav><a href="/users">Users</a></nav>
    <main xo-outlet></main>
  </template>
  <template xo-route="/users" layout="shell" title="Users">...</template>
  <template xo-route="/users/:id" layout="shell" title="User" description="One user">
    <xo-view get="getUser" p-id=":id">...</xo-view>
  </template>
  <template xo-route="*">Not found</template>
</xo-router>`;

const ROUTER_JS = `
import { router } from '@xoong/ui';
import { configure } from '@xoong/data';

// after the router has started (it starts once the page is parsed)
router.guard(async (to, from) => ((await loggedIn()) ? true : '/login'));   // true, false, or a path to go to instead
router.beforeNavigate((to, from) => !editing || window.confirm('Leave?'));   // false: stay where you are
await router.navigate('/users/3', { replace: true });                        // resolves true when it happened
router.current;   // { path, params, query, url, route }

configure({ api, onUnauthorized: () => router.navigate('/login') });          // a 401 sends the person to log in`;

const routing = {
  file: 'arch-routing.html', section: 'docs', group: 'Architecture', nav: 'Router', title: 'Router and page lifecycle',
  description: 'How <xo-router> turns templates into routes, the steps of a navigation, layouts, history, the unsaved-changes guard and the link to views.',
  body: `
<h1>Router and page lifecycle</h1>
<p class="lead">${c('<xo-router>')} is a History-API router written in markup. Routes and layouts are templates that stay inert until they match, so a view inside a route starts, and fetches, only when its route is shown.</p>
<p>Public sites can skip all of this: one HTML file per page needs no router, and prerenders well. The router is for apps with a persistent shell, such as an admin (<a href="https://github.com/fpt-duongtx/xoong/blob/main/docs/decisions/0008-spa-router.md">decision record 0008</a>).</p>

<h2>Routes are templates</h2>
${tabs('A router', [['HTML', 'html', ROUTER_HTML], ['JavaScript', 'js', ROUTER_JS]])}
<ul>
<li>When the router starts (once the page is parsed) it reads its direct child ${c('<template>')} elements: ${c('xo-layout="name"')} declares a layout, ${c('xo-route="/path"')} a route. A route may name a ${c('layout')}, and a layout may name an outer ${c('layout')}.</li>
<li>A route path has static segments and ${c(':params')}. ${c('*')} matches anything and is the not-found route. When several match, the most specific wins: static segments rank above parameters, and parameters above ${c('*')}. A trailing slash is ignored, parameters are URL-decoded, and a malformed escape such as ${c('%zz')} is kept as written instead of throwing.</li>
<li>A <em>location</em> is ${c('{ path, params, query, url, route }')}: ${c('path')} is without the ${c('base')}, ${c('url')} is as the address bar shows it.</li>
<li>${c('xoong check')} reports a route without a path or declared twice (XO260), an undeclared layout (XO261), a layout without ${c('xo-outlet')} (XO262), and a ${c('p-x=":name"')} that the route does not have (XO263).</li>
</ul>

<h2>The steps of a navigation</h2>
<p>Four things start a navigation: the first load (which replaces the current history entry), a click on a link, Back or Forward, and ${c('router.navigate(path)')}. A click is taken only when it is a plain left click on an ${c('<a href>')} that goes to the same origin and inside ${c('base')}, has no ${c('target')} (other than ${c('_self')}), no ${c('download')} and no ${c('rel="external"')}, and is not a jump to an anchor of the current page. Everything else stays the browser's.</p>
${navSteps}
<ol>
<li><strong>Same place.</strong> The same path and query as now does nothing (${c('navigate()')} resolves ${c('false')}). If only the hash differs, there is no render: the page scrolls to the element with that id.</li>
<li><strong>Vetoes.</strong> The ${c('beforeNavigate()')} hooks run in the order they were added. The router adds one of its own at start, which asks first when a form has unsaved changes. The first ${c('false')} stops the navigation. They are skipped on the first load.</li>
<li><strong>Guards.</strong> The ${c('guard()')} hooks may be async. ${c('false')} cancels. A string is a redirect: a new navigation to that path that replaces the entry, up to ten in a row, after which the router throws an error that says a guard keeps redirecting. Guards also run on the first load, so a login redirect works for a deep link.</li>
<li><strong>Cancelled or vetoed.</strong> For Back and Forward the address bar has already moved, and the platform cannot stop that. The router stores a position in ${c('history.state')} and puts the address back with ${c('history.go(-delta)')}, so the history stays as it was, forward entries included. Where the position is unknown (an entry something else created) it falls back to ${c('pushState')}, which drops the forward entries.</li>
<li><strong>History.</strong> ${c('pushState')} for a link or ${c('navigate()')}, ${c('replaceState')} for a redirect, the first load and ${c('{ replace: true }')}. The scroll position of the entry being left is saved, and ${c('history.scrollRestoration')} is set to ${c('manual')}.</li>
<li><strong>Render</strong>, next section.</li>
<li><strong>After.</strong> The route's ${c('title')} becomes ${c('document.title')} and its ${c('description')} the description meta tag. Every ${c('<a href>')} on the page gets ${c('aria-current="page"')} when it points at this path, or ${c('aria-current="true"')} when it points at a parent section. Except on the first load, the focus moves to the outlet (it is given ${c('tabindex="-1"')}), and the page scrolls: to the top for a new page, to the anchor if there is one, to the saved position on Back or Forward. Last, ${c('xo-navigate')} fires with ${c('{ to, from }')}.</li>
</ol>
<p>A navigation that starts while an earlier one is still waiting in a veto or guard takes over; the older one stops quietly.</p>

<h2>Layouts and rendering</h2>
${layoutBoxes}
<p>For a route, the router builds the chain of layouts, outermost first. It keeps the layouts that the previous route also had, and replaces the rest. Each layout is a ${c('div.xo-layout')} filled from its template; its ${c('xo-outlet')} element is where the next layout, or the route, goes. The route's template is cloned into the innermost outlet with ${c('replaceChildren')}, which is the moment views inside it start and fetch. Leaving a route removes its content, which stops its views: their effects are disposed and their queries released (a request still running is cancelled).</p>
<p>Content that ${c('xoong render')} wrote into the router earlier is removed at start and drawn again, so a prerendered page and the live page end up the same.</p>
<p>Because the cache outlives the views, coming back to a list shows its data at once if the query is still held (${c('gcTime')}, five minutes by default) and refetches it when it is older than ${c('staleTime')} (30 seconds by default).</p>

<h2>Base, links and history</h2>
<ul>
<li>${c('base="/admin"')} is the part of the address that is not the route. Routes are written without it.</li>
<li>${c('base-links')} makes a root-relative link inside the router relative to the base: ${c('href="/users"')} means ${c('/admin/users')}, so the same screens can be mounted under any base. After each navigation the ${c('href')} is rewritten to the real address, so hover and "open in a new tab" show it; a link added later is resolved on click. ${c('rel="external"')} or a ${c('target')} leave the app.</li>
<li>The server must answer every path under ${c('base')} with the app's HTML (${c('xoong dev --spa')}, or ${c('"spa": true')} in ${c('xoong.config.json')}).</li>
</ul>

<h2>The unsaved-changes guard</h2>
<p>A form that has a form model announces itself: it fires ${c('xo-dirty')} with ${c('{ dirty }')} each time that changes (see <a href="arch-forms.html">Forms flow</a>). The router listens at the document and keeps the set of dirty forms (forms that are no longer in the page are dropped). The built-in veto asks a question when the set is not empty. The question is the form's own ${c('xo-guard')} text, else "You have unsaved changes. Leave this page?" (the key ${c('xoong.guard.leave')}). ${c('xo-guard="off"')} on a form leaves it out. Closing the tab asks through ${c('beforeunload')}.</p>
<p>How the question looks is not the router's business. It calls the confirm function that ${c('@xoong/data/view')} holds: the browser's ${c('confirm()')} by default, a native modal ${c('<dialog>')} once ${c('@xoong/ui')} is imported, or your own after ${c('setConfirm(fn)')}. The same function answers ${c('xo-confirm')}.</p>

<h2>How routes and views meet</h2>
<ul>
<li><strong>Route params.</strong> The router tells ${c('<xo-view>')} how to read them (${c('setParamSource')}). ${c('p-id=":id"')} takes ${c('id')} from the current location when the view starts. A view that starts before the router has (the order elements were defined) waits until the router is ready.</li>
<li><strong>Query params.</strong> ${c('p-id="?id"')} reads the page URL. A view with ${c('url-params="status,q"')} keeps those params in the query string, and the router carries the write (${c('setUrlSync')}): it updates the address, adds a history entry for a click and replaces it for typing, and does not render the route again. Back and Forward over such a change do render the route again, and the new views read their params from the URL.</li>
<li><strong>Authentication.</strong> A 401 is the data layer's to detect and the router's to answer: ${c('configure({ onUnauthorized: () => router.navigate("/login") })')}. Guards are plain functions, not markup, so there is one way to write one.</li>
<li><strong>Prerendering.</strong> ${c('xoong render page.html --url /users/7')} renders the route of that URL, with its title and description. See <a href="arch-build.html">Build and delivery</a>.</li>
</ul>
<p>Not yet: nested routers, route-level data loading hooks, per-route code splitting, and relative paths in ${c('navigate()')}.</p>

<h2>Where to look in the code</h2>
${files([
  ['packages/ui/src/router.js', 'the whole router'],
  ['packages/data/src/view.js', c('setParamSource') + ', ' + c('setConfirm') + ', ' + c('p-*') + ' params, ' + c('url-params')],
  ['packages/data/src/url-state.js', 'the query-string hook the router replaces'],
  ['packages/cli/src/check.js', 'XO260 to XO263'],
  ['docs/admin.md', 'the router in use, hosting and SEO'],
])}
`,
};

// ---- 6. build and delivery ------------------------------------------------------------------------------------------------------------

const buildSteps = diagram({
  id: 'bd-build', label: 'Diagram: what xoong build does', w: 570, h: 480, size: 'sm',
  title: 'What xoong build does',
  desc: 'Every HTML page under the root is the start. The build follows what each page references: scripts, stylesheets and images, the modules the scripts import, CSS urls, and any files named with --include. Installed @xoong packages are found in node_modules and copied to the same URLs the dev server uses. It then rewrites bare imports to URLs, strips TypeScript, drops the import map and applies the --base prefix. It warns about anything the strict policy would block: an inline script, a style attribute, an inline style element. The result is the dist folder: the files you wrote, plus build-report.json.',
  caption: 'No bundling and no minifying: each file in the output is the file you wrote, with its imports rewritten.',
  draw(d) {
    const pages = d.box(10, 14, 320, 'HTML pages', 'every .html file under --root');
    const follow = d.box(10, 100, 320, 'Follow references', ['script, link, img; module imports;', 'CSS url(); --include files']);
    const pkgs = d.box(390, 100, 170, 'Installed packages', ['@xoong/* from', 'node_modules']);
    const rewrite = d.box(10, 202, 320, 'Rewrite', ['bare imports to URLs, TypeScript stripped,', 'import map dropped, --base prefix']);
    const warn = d.box(10, 304, 320, 'Warn', ['what a strict policy blocks: inline script,', 'style attribute, style element']);
    const out = d.box(10, 406, 320, 'dist/', 'your files, rewritten, plus build-report.json', { kind: 'core' });
    [[pages, follow], [follow, rewrite], [rewrite, warn], [warn, out]].forEach(([a, b]) => d.line([[a.cx, a.b], [a.cx, b.y]]));
    d.line([[pkgs.x, pkgs.cy], [follow.r, follow.cy]]);
  },
});

const prerenderSteps = diagram({
  id: 'bd-render', label: 'Diagram: prerendering a page', w: 570, h: 480, size: 'sm',
  title: 'Prerendering a page',
  desc: 'The input is a public page, or a route chosen with --url. xoong render, or renderPage(), runs the real xo-view runtime on a happy-dom document and sends GET requests to the backend API. It waits until no request is pending, for at most ten seconds. The output is HTML that already shows the data; each top-level xo-view keeps its original markup in a template element with data-xo-template. In the browser, the view draws again from that template, with the same result, and then becomes live and interactive.',
  caption: 'There is no hydration step: the browser simply draws again from the saved markup, so there is nothing to mismatch.',
  draw(d) {
    const page = d.box(10, 14, 320, 'Page HTML', 'a public page, or a route with --url');
    const render = d.box(10, 100, 320, 'xoong render / renderPage()', ['the real xo-view runtime', 'on a happy-dom document'], { kind: 'core' });
    const api = d.box(390, 100, 170, 'Backend API', 'public data');
    const wait = d.box(10, 218, 320, 'Wait', 'until nothing is loading, up to 10 s');
    const html = d.box(10, 304, 320, 'HTML with the data', ['each top-level xo-view keeps its markup in', 'template[data-xo-template]']);
    const browser = d.box(10, 406, 320, 'Browser', ['the view draws again from the template:', 'same result, then live and interactive'], { kind: 'ok' });
    [[page, render], [render, wait], [wait, html], [html, browser]].forEach(([a, b]) => d.line([[a.cx, a.b], [a.cx, b.y]]));
    d.line([[render.r, render.cy], [api.x, api.cy]], { label: 'GET', at: [360, render.cy - 13] });
  },
});

const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'self'";

const DEV_CONFIG = `
{
  "port": 5173,
  "proxy": { "/api": "http://localhost:8080" },
  "spa": false,
  "allowedHosts": [],
  "packages": ["rainlet"]
}`;

const BUILD_SH = `
npx xoong dev                          # development: static, proxy, TypeScript stripping
npx xoong build --out dist             # strict-CSP static output
npx xoong build --out dist --base /admin --include data --include img
npx xoong render index.html --api http://localhost:8080 --out dist/index.html`;

const BUDGETS = `
const budgetKb = { core: 5.6, data: 17.2, forms: 9.5, i18n: 5, ui: 10, controls: 9.5, richtext: 8.5 };`;

const build = {
  file: 'arch-build.html', section: 'docs', group: 'Architecture', nav: 'Build and delivery', title: 'Build and delivery',
  description: 'How xoong dev serves your app, what xoong build changes, the strict CSP model, prerendering with @xoong/ssr, and the size budgets the tests guard.',
  body: `
<h1>Build and delivery</h1>
<p class="lead">There are three ways to run a xoong app: serve it with ${c('xoong dev')} while you work, ship the static files that ${c('xoong build')} writes, or prerender public pages. The runtime needs no bundler in any of them.</p>

<h2>Development: xoong dev</h2>
<p>${c('xoong dev')} is ${c('@xoong/server')} wired to your folder. One web-standard handler does all of it, and file access is injected, so the handler imports no Node module.</p>
${tabs('Config and commands', [['xoong.config.json', 'json', DEV_CONFIG], ['Terminal', 'bash', BUILD_SH]])}
<ul>
<li><strong>Static files and packages.</strong> It serves the project folder and finds the installed ${c('@xoong/*')} packages (and any listed in ${c('packages')}), serving them under ${c('/@xoong/core')}, ${c('/@xoong/data')} and so on. It injects an <em>import map</em> into each HTML page that has none, so ${c('import "@xoong/data"')} works in the browser without a bundler. Your own packages resolve through their ${c('exports')} map (conditions, subpaths, wildcards); entries under ${c('./server')} are never served.</li>
<li><strong>TypeScript.</strong> A ${c('.ts')} file is stripped of its types when it is requested, by ${c('amaro')}. Only erasable syntax works: no ${c('enum')}, ${c('namespace') } or parameter properties, and the error message says so. Import local TypeScript with the ${c('.ts')} extension.</li>
<li><strong>Proxy.</strong> A prefix in ${c('proxy')} (or ${c('--proxy /api=http://localhost:8080')}) is forwarded to its upstream, so there is no CORS in development. It matches whole segments (${c('/api')} does not match ${c('/apix')}), longest prefix first. Bodies stream both ways, so server-sent events pass through unbuffered and a closed tab stops the upstream read. An unreachable upstream answers 502 with the reason.</li>
<li><strong>Safety.</strong> Files come only from under the root; paths that escape it are refused. Dot folders are refused too, except ${c('.xoong')} and ${c('.well-known')}, so ${c('.env')} and ${c('.git')} are never served. The ${c('Host')} header must be ${c('localhost')}, ${c('127.0.0.1')}, ${c('::1')} or in ${c('allowedHosts')}, which blocks DNS-rebinding pages.</li>
<li>${c('--spa')} answers any path without a file extension with ${c('index.html')}, for an app with a router. Files are sent with ${c('cache-control: no-cache')}.</li>
</ul>
<p>Not yet: live reload and SCSS compilation.</p>

<h2>Release: xoong build</h2>
${buildSteps}
<ul>
<li><strong>Input.</strong> Every ${c('.html')} file under ${c('--root')} (not ${c('node_modules')}, not dot folders, not the output folder). From each page it follows ${c('<script src>')}, ${c('<link href>')}, ${c('<img src>')} and the like, then the imports of each script, then the ${c('url()')} and ${c('@import')} of each stylesheet. Links to other pages are left as they are.</li>
<li><strong>Rewrite.</strong> A bare import such as ${c('"@xoong/data"')} becomes a URL (the same one the dev server uses), so the page needs <em>no import map</em>; the import map in your HTML is dropped. ${c('.ts')} is stripped and written as ${c('.js')}. ${c('--base /admin')} prefixes every root-absolute URL, for an app served under a path. Imports are found by scanning for ${c('import')} and ${c('export ... from')} with a string, and dynamic ${c('import("...")')}; what cannot be seen that way (a ${c('fetch()')} of a data file, an image named only in JavaScript) is added with ${c('--include <file-or-folder>')}.</li>
<li><strong>Warnings, not failures.</strong> The build tells you about an inline ${c('<script>')}, a ${c('style=""')} attribute and an inline ${c('<style>')} (the policy blocks them), an import it cannot resolve, and a file that is referenced but missing. It prints the total size, with gzip, and the policy the output is meant to run under.</li>
<li><strong>Preload.</strong> The build knows the whole module graph, so each page gets a ${c('<link rel="modulepreload">')} for every module its scripts import (static imports only; a dynamic ${c('import()')} stays lazy). The browser then fetches the chain at once instead of one import level at a time. ${c('--no-preload')} turns it off.</li>
<li><strong>Output.</strong> Nothing is bundled and nothing is minified: every file is the one you wrote, readable in the browser's tools. ${c('build-report.json')} lists each file's bytes and gzip size, the warnings and the policy. Any static host works; send the policy as a header.</li>
</ul>

<h2>The CSP model</h2>
<p>The runtime runs under this policy, with no ${c('unsafe-eval')} and no ${c('unsafe-inline')}:</p>
${code('bash', 'Content-Security-Policy: ' + CSP)}
<ul>
<li><strong>No code from strings.</strong> The runtime never calls ${c('eval')}, ${c('new Function')} or ${c('setTimeout')} with a string. Interpolation, ${c('xo-if')}, ${c('xo-each')}, formats and validation rules are plain code walking data.</li>
<li><strong>No inline style.</strong> It never creates a ${c('<style>')} element and never writes a ${c('style=""')} attribute. Where a value must reach the style (a custom property from ${c('style:--x=${...}')}, the position of a popup), it uses the CSS object model, which the policy allows. ${c('xoong.css')} is an external file and the generated markup uses classes only.</li>
<li><strong>No inline handlers.</strong> Event listeners are added with ${c('addEventListener')}. Interpolating data into an ${c('on*')} attribute is refused.</li>
<li><strong>Data is not code.</strong> ${c('<script type="application/json">')}, the way to hand the page its first data (${c('client.seed')}), is not executed, so the policy allows it.</li>
<li><strong>One exception, in development.</strong> The dev server injects an <em>inline</em> import map, which ${c("script-src 'self'")} blocks. So never ship the dev server's HTML. The output of ${c('xoong build')} has no import map. Nonce-based policies work as well: nothing in the runtime needs a nonce.</li>
</ul>
<p>It is tested, not only claimed. ${c('packages/cli/test/build.test.mjs')} builds the admin example and serves it in real Chromium with exactly this policy, and fails on any ${c('securitypolicyviolation')}; a second test shows the policy really is enforced there (an inline script is blocked). The documentation site you are reading is built and tested the same way, under ${c('/xoong')}.</p>

<h2>Prerendering with @xoong/ssr</h2>
${prerenderSteps}
<ul>
<li><strong>The same runtime.</strong> ${c('renderPage(html, { operations, baseUrl })')} runs the real ${c('<xo-view>')} (and ${c('@xoong/ui')}) on a happy-dom document, so the syntax has one implementation and the output matches what the browser draws. The page's own scripts and stylesheets are neither run nor fetched.</li>
<li><strong>Output.</strong> HTML that already shows the data, for crawlers, for people without JavaScript, and for the first paint. In the browser the view draws again from the saved template. A router page rendered with ${c('--url')} has that route's content, ${c('<title>')} and description; the router replaces it with the same page when it starts.</li>
<li><strong>Public pages only.</strong> The data is as fresh as the last render, and personalised pages would need the visitor's credentials. Use ${c('headers')} only for service credentials. Personalised pages stay drawn in the browser.</li>
<li><strong>Things to know.</strong> Pages render one after another, because the DOM globals are process-wide, and the first render installs ${c('window')} and ${c('document')} on ${c('globalThis')} for the rest of the process: prerender in a build script or a separate process, not inside a server that detects browsers by ${c('typeof window')}. A page whose API calls fail still renders its ${c('$error')} branches; pass ${c('failOnError: true')} to make that an error, or ${c('onError')} to observe it. A page whose data does not finish loading within ${c('timeoutMs')} (10 s) fails instead of rendering half.</li>
<li><strong>Not yet:</strong> request-time rendering inside ${c('xoong dev')} or ${c('@xoong/server')}, caching and revalidation policy, and rendering the first state of ${c('live')} views. ${c('xoong build')} does not call the prerenderer: run ${c('xoong render')} for each public page.</li>
</ul>

<h2>Size budgets and what the tests guard</h2>
<p>The size of a runtime package is a tested promise. ${c('test/architecture.test.mjs')} measures the gzip size of each package's source <em>with comments removed</em> and fails when it passes its budget. It is a regression guard, not the shipped size (that is the files themselves, which are not minified). A budget sits 5 to 10 percent above the measured value, and raising one needs a reason in the commit. The roadmap's target of single-digit kilobytes applies to the minified size, which has not been measured yet.</p>
${tabs('Budgets, in KB gzip', [['test/architecture.test.mjs', 'js', BUDGETS]])}
<p>The tests that keep the architecture honest:</p>
<ul>
<li><strong>Architecture test:</strong> zero runtime dependencies and the import direction (see <a href="arch-overview.html">Overview</a>), the size budgets, MIT licence everywhere, and that the generated documentation pages equal what the generator writes.</li>
<li><strong>${c('llms.txt')} cannot drift:</strong> it stays within about 3,000 tokens (estimated as length divided by 3.8), mentions only commands the CLI has, and documents exactly the ${c('xo-*')} names xoong defines. The runtime must handle each of them.</li>
<li><strong>Build test:</strong> the strict-CSP run above. <strong>Coverage:</strong> the suite runs with thresholds (statements 88, branches 79, functions 88, lines 92 overall; ${c('core')} stricter) that sit just under the measured values, so a drop fails the build.</li>
<li><strong>Pack test:</strong> the tarballs that projects install contain what a package needs and nothing else.</li>
</ul>

<h2>Where to look in the code</h2>
${files([
  ['packages/cli/src/dev.js', c('xoong dev') + ' and ' + c('xoong.config.json')],
  ['packages/server/src/handler.js, node.js', 'the handler, the proxy, the import map, ' + c('findPackages') + ', type stripping, the Host check'],
  ['packages/cli/src/build.js', c('xoong build') + ' and the ' + c('CSP') + ' constant'],
  ['packages/ssr/src/render.js', c('renderPage')],
  ['docs/security.md', 'the policy and what the runtime refuses or escapes'],
  ['docs/server.md', 'the server design, including what is not built'],
  ['test/architecture.test.mjs', 'the budgets and the dependency rules'],
])}
`,
};

// ---- 7. tooling -----------------------------------------------------------------------------------------------------------------------

const toolEngine = diagram({
  id: 'tl-engine', label: 'Diagram: one check engine, three front ends', w: 590, h: 290, size: 'sm',
  title: 'One check engine, three front ends',
  desc: 'Three inputs feed the check engine: operations.json written by xoong sync, the list of xo-star names in syntax.js, and your HTML, JavaScript and TypeScript files. The engine, with its functions checkHtml and checkScript, produces findings with codes XO2xx. Three front ends show the same findings: the xoong check command for the terminal and CI, the xoong-lsp language server for editors, and the xoong-mcp server for AI assistants.',
  caption: 'A new rule is written once and appears in every front end with the same message and the same fix.',
  draw(d) {
    const i1 = d.box(10, 14, 200, 'operations.json', 'from xoong sync', { bh: 74 });
    const i2 = d.box(10, 104, 200, 'syntax.js', 'every xo-* name', { bh: 74 });
    const i3 = d.box(10, 194, 200, 'Your files', 'HTML, JS, TS', { bh: 74 });
    const eng = d.box(250, 54, 150, 'check engine', ['checkHtml()', 'checkScript()', 'codes XO2xx'], { kind: 'core', bh: 190 });
    const o1 = d.box(432, 14, 150, 'xoong check', 'CLI and CI', { bh: 74 });
    const o2 = d.box(432, 104, 150, 'xoong-lsp', ['diagnostics,', 'completion, hover'], { bh: 74 });
    const o3 = d.box(432, 194, 150, 'xoong-mcp', ['tools: check,', 'explain_error'], { bh: 74 });
    [[i1, 100], [i2, 150], [i3, 200]].forEach(([b, y]) => d.line([[b.r, b.cy], [eng.x, y]]));
    [[o1, 100], [o2, 150], [o3, 200]].forEach(([b, y]) => d.line([[eng.r, y], [b.x, b.cy]]));
  },
});

const testLayers = diagram({
  id: 'tl-tests', label: 'Diagram: the layers of tests', w: 560, h: 330, size: 'sm',
  title: 'The layers of tests',
  desc: 'Four layers of tests, from the cheapest to the most realistic. Unit tests run in Node and cover signals, the store, the client, the form model, the CLI and the OpenAPI analysis. Screen tests run in happy-dom with mount and mockApi on a real DOM and a fake network. Real-browser tests drive Chromium for templates, the router, controls, the strict-CSP build and a two-tab end-to-end run. Documentation site tests build the site under a project path and check the CSP, axe, focus indicators and sideways scroll at 390 pixels.',
  caption: 'Four layers. Cheap and fast on top, realistic at the bottom; each catches what the one above cannot.',
  draw(d) {
    d.box(10, 14, 540, 'Unit tests (Node)', 'signals, store, client, form model, CLI, OpenAPI analysis');
    d.box(10, 94, 540, 'Screen tests (happy-dom)', 'mount() and mockApi(): a real DOM, a fake network');
    d.box(10, 174, 540, 'Real-browser tests (Chromium)', 'templates, router, controls, strict-CSP build, two-tab end to end', { kind: 'soft' });
    d.box(10, 254, 540, 'Documentation site tests', 'built under /xoong with the CSP: axe, focus indicators, 390 px', { kind: 'core' });
  },
});

const CHECK_OUT = `
users.html:3:13  error XO201  unknown operation "POST /user/{id}/disable" (closest: "POST /users/{id}/disable")
    fix: Use "POST /users/{id}/disable"

1 files, 1 errors, 0 warnings`;

const MCP_CONFIG = `
{ "mcpServers": { "xoong": { "command": "npx", "args": ["xoong-mcp"] } } }`;

const EDITOR_CONFIG = `
{ "html.customData": ["./.xoong/xoong.html-data.json"] }`;

const TEST_JS = `
import { mount, mockApi } from '@xoong/test';
import table from '../.xoong/operations.json' with { type: 'json' };

const api = mockApi(table, { listUsers: () => [{ id: 1, name: 'Ada' }] });   // keyed by operationId or "METHOD /path"
const screen = await mount('<xo-view get="/users"><li xo-each=".">{name}</li></xo-view>', { api });

screen.texts('li');            // ['Ada']
await screen.click('button');  // clicks, then waits until no request is pending
await screen.push({ type: 'patch', entity: 'User', id: 1, path: '/name', value: 'Ada L.', version: 2 });
api.callsOf('listUsers');      // what the app really asked for
api.unhandled;                 // [] means nothing unexpected was called`;

const tooling = {
  file: 'arch-tooling.html', section: 'docs', group: 'Architecture', nav: 'Tooling and tests', title: 'Tooling and tests',
  description: 'The check engine behind xoong check, the language server and the MCP server, the test helpers, the layers of tests, and how this site is generated.',
  body: `
<h1>Tooling and tests</h1>
<p class="lead">The tools exist so that a mistake is caught where it is made, with a message that contains the fix. One rule engine serves the command line, the editor and AI assistants, and the tests run the real framework with only the network replaced.</p>

<h2>One check engine</h2>
${toolEngine}
<p>${c('xoong check <files or folders>')} lints screens against your API. The engine is ${c('checkHtml(source, table, file)')} for HTML and ${c('checkScript(source, table, file)')} for JavaScript and TypeScript. It parses HTML with ${c('parse5')} and keeps exact line and column. In scripts it reads the HTML inside ${c('html`...`')} templates and the operation named in a string passed to ${c('client.load')}, ${c('query')}, ${c('mutate')} or ${c('stream')}, on something that looks like a client (${c('client')}, ${c('apiClient')}, ${c('getClient()')}, ${c('xo')}); a name built at run time is not checked. It knows your operations from ${c('operations.json')} and the framework's names from ${c('syntax.js')}.</p>
<p>Every finding has a stable code, a place, a message and a fix. The output, and the process exit code (1 when there is an error), are the same in the terminal and in CI:</p>
${tabs('xoong check', [['Terminal', 'bash', CHECK_OUT]])}
<table>
<thead><tr><th>Codes</th><th>What they catch</th></tr></thead>
<tbody>
<tr><td>XO201 to XO204</td><td>an unknown operation (with the closest name), ${c('xo-click')} on a GET, ${c('get')} on a non-GET, a read or write method on the wrong kind of operation in JavaScript</td></tr>
<tr><td>XO210, XO251 to XO253</td><td>a missing ${c('p-*')} for a path parameter; ${c('<xo-table>')} outside a view, or sorting, paging and filters that the operation has no query parameters for</td></tr>
<tr><td>XO220, XO221, XO252, XO254, XO255</td><td>${c('xo-submit')} not on a form, an empty ${c('xo-each')} or ${c('xo-if')}, a ${c('<xo-form>')} with nothing it can draw or that can never satisfy the server, ${c('xo-selected')} or ${c('xo-select')} in the wrong place</td></tr>
<tr><td>XO230</td><td>an ${c('xo-*')} element or attribute that xoong does not define (usually a typo, with the closest name)</td></tr>
<tr><td>XO240, XO241</td><td>a button or link without an accessible name; ${c('xo-click')} on something a keyboard cannot reach</td></tr>
<tr><td>XO260 to XO263</td><td>route paths, layouts, outlets and route parameters</td></tr>
</tbody></table>
<p>${c('xoong doctor openapi.json')} is the same idea for the document: ${c('XO1xx')} codes for what limits xoong, such as a missing ${c('operationId')} (XO110), no identity property (so records are not shared), an unresolved ${c('$ref')} (XO150), a union that cannot be told apart (XO160, XO161) or no documented errors (XO130). Warnings for one code are cut off after five unless you pass ${c('--all')}. ${c('xoong sync')} also reports the errors.</p>

<h2>Editors: html-data and the language server</h2>
<ul>
<li><strong>${c('xoong.html-data.json')}.</strong> ${c('xoong sync')} writes it next to ${c('operations.json')}. Point VS Code's ${c('html.customData')} at it once and you get completion and hover for every ${c('xo-*')} element and attribute, and your real operation names inside ${c('xo-click')}, ${c('xo-submit')}, ${c('get')} and ${c('op')}. It needs no extension.</li>
<li><strong>${c('xoong-lsp')}.</strong> A language server over stdio. It finds ${c('.xoong/operations.json')} from the workspace folder upwards and re-reads it when it changes. It offers diagnostics (the findings above, as you type), completion, hover, and a code action "use the closest operation". The message handling is a pure function of a message (${c('createLanguageServer')}), so it is tested without a process.</li>
</ul>
${tabs('Editor setup', [['VS Code settings', 'json', EDITOR_CONFIG]])}
<p>Not yet: a VS Code extension, lint presets for ESLint and Stylelint, and SARIF output.</p>

<h2>For AI assistants: llms.txt and the MCP server</h2>
<p>${c('llms.txt')}, at the root of the repository and on this site, is the whole public API in about 1,800 tokens, with the rules an assistant must follow. A test keeps it honest: it must stay under the budget, name only commands that exist, and mention exactly the ${c('xo-*')} names the code defines.</p>
<p>${c('xoong-mcp')} is a Model Context Protocol server: JSON-RPC 2.0 over stdio with one message per line, written without an SDK. It has five tools, which make a loop: ${c('get_spec')} (the ${c('llms.txt')}), ${c('list_operations')} (the real names from ${c('operations.json')}), write the screen, ${c('check')} (HTML or script source in, findings out), fix from the message; ${c('explain_error')} says what a code means; ${c('search_docs')} searches a docs folder. A test makes sure ${c('explain_error')} covers every code that ${c('check')} can print. A ${c('scaffold')} tool is not built yet.</p>
${tabs('MCP', [['Settings', 'json', MCP_CONFIG]])}

<h2>@xoong/test</h2>
<p>A screen test renders real markup, with the real data layer, against a fake network. That is the only seam: <strong>mock the network, never the data layer</strong>, because the cache, the store and invalidation are part of what you are testing.</p>
<ul>
<li>${c('mockApi(table, handlers)')} builds a ${c('fetch')} replacement from ${c('operations.json')}. It matches the method and the path, and calls your handler with ${c('{ params, query, body }')}. Return data (answered 200) or ${c('respond(status, body)')}. An operation without a handler answers 404 and is listed in ${c('api.unhandled')}. ${c('api.calls')}, ${c('callsOf(id)')} and ${c('on(id, handler)')} are there too.</li>
<li>${c('mount(html, { api })')} configures the real client with that ${c('fetch')} (no retries, queries kept for ever) and a fake ${c('EventSource')}, renders the markup into a div, and waits until everything has settled. The ${c('screen')} has ${c('$')}, ${c('$$')}, ${c('text')}, ${c('texts')}, ${c('click')}, ${c('submit')}, ${c('push(event)')} for live events, ${c('settle')}, ${c('errors')} (the ${c('xo-error')} events seen) and ${c('unmount')}.</li>
<li>"Settled" means no request in flight, checked twice a tick apart, which is why there is no ${c('await')} roulette.</li>
</ul>
${tabs('A screen test', [['JavaScript', 'js', TEST_JS]])}

<h2>The test strategy</h2>
${testLayers}
<table>
<thead><tr><th>Layer</th><th>How it runs</th><th>What it is for</th></tr></thead>
<tbody>
<tr><td>Unit</td><td>${c('*.test.mjs')}, Node</td><td>pure logic: signals, the store and normalisation, the client (cache, invalidation, retry, errors, streams), the form model, the OpenAPI analysis, the CLI. The corpus tool also runs real-world OpenAPI documents through the analysis and checks that the generated types compile.</td></tr>
<tr><td>Screens</td><td>${c('*.spec.mjs')}, happy-dom</td><td>${c('mount')} and ${c('mockApi')} flows: rendering, actions, errors, live updates, forms. Fast, and measured for coverage. Many cover the same behaviour as the real-browser tests, so each environment checks the other.</td></tr>
<tr><td>Real browser</td><td>${c('*.test.mjs')} that launch Chromium through Playwright (Firefox or WebKit with ${c('XOONG_BROWSER')})</td><td>what happy-dom cannot do: layout, focus, native ${c('<dialog>')} and popover details, templates against a fake backend over HTTP and server-sent events, the strict-CSP build, and an end-to-end run of ${c('xoong dev')} with two tabs seeing a live update.</td></tr>
<tr><td>Docs site</td><td>one test that builds ${c('site/')} under ${c('/xoong')}</td><td>every page loads under the strict policy with no violation or error; axe (WCAG 2.0 and 2.1, A and AA) finds nothing on any page in four palette and light or dark combinations; a tab through five main pages measures every focus indicator against what surrounds it (3:1, WCAG 1.4.11), which axe cannot do; no page scrolls sideways at 390 px; menus and dialogs are checked in their open state.</td></tr>
<tr><td>Architecture</td><td>${c('test/architecture.test.mjs')}</td><td>the promises of the design (see <a href="arch-overview.html">Overview</a> and <a href="arch-build.html">Build and delivery</a>).</td></tr>
</tbody></table>
<p>The runner is Vitest with two projects, ${c('logic')} (Node) and ${c('screens')} (happy-dom). There is also a first-attempt-correctness benchmark in ${c('tools/benchmark')}: four tasks, scored by a script, to check that an assistant with only ${c('llms.txt')} writes working screens. It has a first small measurement and is not a rate.</p>

<h2>This site is generated</h2>
<p>The pages of this documentation are JavaScript objects (${c('file')}, ${c('group')}, ${c('title')}, ${c('body')}) in ${c('tools/site/')}. ${c('npm run site')} writes ${c('site/*.html')} from them with one layout function; the architecture test fails when a page on disk differs from what the generator writes. The generator makes the "On this page" list from the ${c('h2')} headings, highlights code while it writes the page, and shows each live example's markup both as the running preview and as the code tab, so the two cannot drift apart. Some pages come from the design kit in ${c('design/brand-kit')}. The diagrams on these Architecture pages are inline SVG with a title and a text description, drawn with the page's own colour tokens so they follow the palette and dark mode. The built site is served by the same strict policy as any xoong app, and the site test above checks it.</p>

<h2>Where to look in the code</h2>
${files([
  ['packages/cli/src/check.js', 'the rules and their codes'],
  ['packages/cli/src/openapi.js', 'the analysis and the ' + c('doctor') + ' problems'],
  ['packages/cli/src/html-data.js', 'the editor data, written by ' + c('sync')],
  ['packages/lsp/src/server.js, cli.js', 'the language server and its stdio framing'],
  ['packages/mcp/src/server.js', 'the five tools and ' + c('EXPLANATIONS')],
  ['packages/test/src/index.js', c('mockApi') + ' and ' + c('mount')],
  ['vitest.config.mjs', 'the two projects and the coverage thresholds'],
  ['tools/axe.mjs, tools/focus.mjs, tools/browser.mjs', 'the accessibility and browser helpers'],
  ['tools/site.mjs, tools/site/', 'the site generator'],
  ['docs/testing.md, docs/ai-integration.md, docs/editor-integration.md', 'the longer notes'],
])}
`,
};

export const architecturePages = [overview, dataFlow, forms, rendering, routing, build, tooling];
