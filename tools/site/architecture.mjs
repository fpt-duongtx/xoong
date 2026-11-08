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
  id: 'ov-layers', label: 'Diagram: the runtime packages as layers', w: 590, h: 372, size: 'sm',
  title: 'The runtime packages as layers',
  desc: 'At the bottom is @xoong/core. On the left, directly above it, is @xoong/data. On the right, directly above core, are @xoong/controls and @xoong/richtext, which import only core. Above data sit @xoong/forms and @xoong/i18n, which import core and data. At the top is @xoong/ui, which imports forms, data and core. Every arrow points downward, from a package to a package it imports: nothing imports upward.',
  caption: 'The runtime packages. An arrow means "imports"; a package may also import packages further down (ui imports data and core directly). Nothing imports upward.',
  draw(d) {
    const ui = d.box(10, 14, 280, '@xoong/ui', 'table, form, dialog, toast, router');
    const forms = d.box(10, 108, 135, '@xoong/forms', 'model, binder');
    const i18n = d.box(155, 108, 135, '@xoong/i18n', 'xo-t, t()');
    const data = d.box(10, 202, 280, '@xoong/data', 'client, cache, store, xo-view');
    const controls = d.box(305, 202, 135, '@xoong/controls', 'tabs, menu, combobox');
    const richtext = d.box(445, 202, 135, '@xoong/richtext', 'xo-richtext');
    const core = d.box(10, 296, 570, '@xoong/core', 'signals, html templates, XoElement, XoControl', { kind: 'core' });
    d.line([[forms.cx, ui.b], [forms.cx, forms.y]]);
    d.line([[forms.cx, forms.b], [forms.cx, data.y]]);
    d.line([[i18n.cx, i18n.b], [i18n.cx, data.y]]);
    d.line([[data.cx, data.b], [data.cx, core.y]]);
    d.line([[controls.cx, controls.b], [controls.cx, core.y]]);
    d.line([[richtext.cx, richtext.b], [richtext.cx, core.y]]);
    d.text(310, 40, 'An arrow means "imports".', 'dg-start');
    d.text(310, 60, 'Nothing imports upward.', 'dg-start');
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
<p>The runtime is seven packages, plus ${c('xoong')}, one package that re-exports the common ones. They are plain ES modules with no build step: the browser loads the files you installed.</p>
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
<tr><td>${c('xoong')}</td><td>One name to install: re-exports core, data, ${c('data/view')} and ui, and carries the ${c('xoong')} command.</td></tr>
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
  caption: 'One road for every read. The arrows are the direction the data travels; a change in the store travels the last three arrows again without a request.',
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
    const s1 = d.box(10, 14, 190, 'GET response', 'a query fetches');
    const s2 = d.box(10, 84, 190, 'Mutation response', 'client.mutate()');
    const s3 = d.box(10, 154, 190, 'client.seed()', 'data the server already has');
    const s4 = d.box(10, 224, 190, 'Stream event', 'patch, upsert, delete');
    const store = d.box(250, 84, 130, 'Entity store', ['one signal', 'per record'], { kind: 'core', bh: 116 });
    const r1 = d.box(430, 34, 160, 'xo-view', 'reads through its query');
    const r2 = d.box(430, 124, 160, 'derived()', 'computed over all(name)');
    const r3 = d.box(430, 214, 160, 'a pristine form', 'follows its record');
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
  id: 'df-write', label: 'Diagram: one write as a sequence', col: 136, size: 'lg',
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
${tabs('One query', [['JavaScript', 'js', KEYS_JS]])}
<p>A query holds signals: ${c('status')} (${c('idle')}, ${c('loading')}, ${c('success')} or ${c('error')}), ${c('error')}, the normalised ${c('root')} and ${c('data')}, a computed value that fills the records back in. It also holds the rules of its life:</p>
<ul>
<li><strong>Deduplicated.</strong> Two views of the same query share one request.</li>
<li><strong>Observed.</strong> A view calls ${c('retain()')} when it starts and ${c('release()')} when its params change or it goes away. Retaining fetches the query if it is not fresh (older than ${c('staleTime')}). While a refetch runs, the old data stays on screen and ${c('$loading')} is true.</li>
<li><strong>Cancelled.</strong> When the last observer lets go while the request is running, the request is aborted. That is not an error; the query returns to its previous state.</li>
<li><strong>Collected.</strong> A query nobody watches is dropped after ${c('gcTime')}. Coming back before that shows the cached data at once.</li>
</ul>

<h2>The entity store</h2>
<p>When a response arrives, the response descriptor tells ${c('normalize()')} where the records are. Each record goes into the store once, under ${c('Name#id')}, and the query keeps a reference (${c('{ $ref: "User#1" }')}) in its place. Every record is one signal.</p>
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
