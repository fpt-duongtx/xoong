// The Reference page (site/reference.html): every element, directive, event, function and template feature, one section each with an anchor
// (#xo-dialog, #xo-confirm, #event-xo-done, #api-configure), written from the same data as site/reference.json (reference-data.mjs).
// Static HTML: it reads without JavaScript; site/src/page-reference.js adds the filter box. The menu and the search read the same entries.
import { esc, code } from './lib.mjs';
import { buildReference } from './reference-data.mjs';
import { fold } from '../../site/src/search-core.js';

const TYPE_HELP = [
  ['text', 'Any text.'], ['number', 'A number.'], ['flag', 'Present means on, absent means off.'], ['list', 'Comma-separated values.'],
  ['choice', 'One of a fixed set; any other value falls back to the default.'], ['path', 'A path into the data: `items`, `name.en`.'], ['operation', 'An operationId or `METHOD /path`.'],
  ['selector', 'A CSS selector.'], ['JSON', 'A JSON text.'],
];

/** @param {{ file: string, title: string }[]} pages */
function render(pages) {
  const reference = buildReference();
  /** name -> id of the entry a `code` span in a description can link to: elements, then directives, then events */
  const links = new Map();
  for (const g of reference.groups) for (const e of g.entries) if (['element', 'directive', 'event'].includes(e.kind) && !links.has(e.name)) links.set(e.name, e.id);
  const span = (raw, self) => {
    const id = links.get(raw.replace(/^<|>$/g, ''));
    const html = `<code>${esc(raw)}</code>`;
    return id && id !== self ? `<a href="#${id}">${html}</a>` : html;
  };
  /** Text with `code` in backticks (html-data.js writes it so): escaped, the code spans linked to their entries. */
  const inline = (text, self) => text.split('`').map((part, i) => (i % 2 ? span(part, self) : esc(part))).join('');
  const titleOf = (file) => pages.find((p) => p.file === file)?.title ?? file;
  const guide = (target) => {
    if (!target) return '';
    return `<p class="ref-guide"><span class="ref-label">Guide</span> <a href="${esc(target)}">${esc(titleOf(target.split('#')[0]))}</a></p>`;
  };
  const chip = (text, kind = '') => `<span class="ref-chip${kind ? ` ${kind}` : ''}">${esc(text)}</span>`;
  const heading = (label) => `<h3><code>${esc(label)}</code></h3>`;
  const find = (entry, extra = '') => esc(fold(`${entry.name} ${entry.summary} ${entry.keywords ?? ''} ${extra}`.replace(/[`<>"']/g, ' ')));
  const section = (entry, inner, extra = '') => `<section class="ref-entry" id="${entry.id}" data-find="${find(entry, extra)}">\n${inner}\n</section>`;
  const example = (entry) => `<h4>Example</h4>\n${code(entry.example.lang, entry.example.code)}`;
  const dl = (rows) => `<dl class="ref-facts">${rows.filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  const values = (list) => list.map((v) => `<code>${esc(v)}</code>`).join(', ');

  const attributeTable = (el) => {
    if (!el.attributes.length) return '<p class="ref-none">No attributes of its own.</p>';
    const rows = el.attributes.map((a) => {
      const note = a.values ? `<span class="ref-values">One of ${values(a.values)}.</span>` : '';
      const meta = [a.type, a.default && a.type !== 'flag' ? `default ${a.default}` : ''].filter(Boolean).join(', ');
      return `<tr><th scope="row"><code>${esc(a.name)}</code><span class="ref-inline-meta">${esc(meta)}</span></th><td class="ref-type">${esc(a.type)}</td><td class="ref-default">${a.default ? (a.type === 'flag' ? esc(a.default) : `<code>${esc(a.default)}</code>`) : '<span class="ref-dash" aria-label="none">&mdash;</span>'}</td><td>${inline(a.description, el.id)}${note}</td></tr>`;
    }).join('\n');
    return `<table class="ref-table" aria-label="Attributes of ${esc(el.name)}">
<thead><tr><th scope="col">Attribute</th><th scope="col" class="ref-col-type">Type</th><th scope="col" class="ref-col-default">Default</th><th scope="col">What it does</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>`;
  };

  const element = (e) => section(e, `${heading(`<${e.name}>`)}
<p class="ref-meta">${chip(e.package, 'pkg')} <code class="ref-import">${esc(e.import)}</code></p>
<p>${inline(e.description, e.id)}</p>
<h4>Attributes</h4>
${attributeTable(e)}
${e.events.length ? `<h4>Events</h4>\n<ul class="ref-events">${e.events.map((ev) => `<li><a href="#${ev.id}"><code>${esc(ev.name)}</code></a> ${esc(ev.summary)}</li>`).join('')}</ul>` : ''}
${example(e)}
${guide(e.guide)}`, e.attributes.map((a) => a.name).join(' '));

  const directive = (d) => section(d, `${heading(d.name)}
<p class="ref-meta">${chip(d.category)} ${chip(d.package, 'pkg')}</p>
<p>${inline(d.description, d.id)}</p>
${dl([['Applies to', inline(d.applies, d.id)], ['Value', inline(d.value, d.id)], ['Values', d.values ? values(d.values) : '']])}
${d.notes.length ? `<ul class="ref-notes">${d.notes.map((n) => `<li>${inline(n, d.id)}</li>`).join('')}</ul>` : ''}
${example(d)}
${guide(d.guide)}`);

  const event = (ev) => section(ev, `${heading(ev.name)}
<p class="ref-meta">${chip('Bubbles')} ${ev.cancelable ? chip('Cancelable', 'warn') : ''}</p>
<p>${inline(ev.description, ev.id)}</p>
${dl([['Fired by', inline(ev.from, ev.id)], ['<code>detail</code>', inline(ev.detail, ev.id)]])}
${example(ev)}`);

  const api = (a) => section(a, `${heading(a.signature)}
<p class="ref-meta">${chip(a.package, 'pkg')} <code class="ref-import">${esc(a.name.startsWith('client.') ? 'const client = getClient();' : `import { ${a.name.split('.')[0]} } from '${a.import}';`)}</code></p>
<p>${inline(a.description, a.id)}</p>
${a.returns ? dl([['Returns', `<code>${esc(a.returns)}</code>`]]) : ''}
${a.params.length ? `<h4>Parameters</h4>\n<table class="ref-table" aria-label="Parameters of ${esc(a.name)}"><thead><tr><th scope="col">Name</th><th scope="col" class="ref-col-type">Type</th><th scope="col">What it is</th></tr></thead><tbody>\n${a.params.map((p) => `<tr><th scope="row"><code>${esc(p.name)}</code><span class="ref-inline-meta">${esc(p.type)}</span></th><td class="ref-type">${esc(p.type)}</td><td>${inline(p.description, a.id)}</td></tr>`).join('\n')}\n</tbody></table>` : ''}
${example(a)}
${a.declaration ? `<details class="ref-ts"><summary>TypeScript declaration</summary>${code('js', a.declaration)}</details>` : ''}
${guide(a.guide)}`, `${a.package} ${a.name}`);

  const syntax = (t) => section(t, `${heading(t.name)}
<p>${inline(t.description, t.id)}</p>
${t.table ? `<table class="ref-table" aria-label="The formats"><thead><tr><th scope="col">Format</th><th scope="col">Shows</th></tr></thead><tbody>\n${t.table.map(([n, d]) => `<tr><th scope="row"><code>${esc(n)}</code></th><td>${inline(d, t.id)}</td></tr>`).join('\n')}\n</tbody></table>` : ''}
${example(t)}
${guide(t.guide)}`);

  const byKind = { element, directive, event, api, syntax };
  const entryHtml = (e) => byKind[e.kind](e);
  const label = (e) => (e.kind === 'element' ? `<${e.name}>` : e.kind === 'api' && ['function', 'method'].includes(e.type) ? `${e.name}()` : e.name);

  const groups = reference.groups.map((g) => `<h2>${esc(g.label)}</h2>
<p class="ref-group-intro">${inline(g.summary)} <span class="ref-count">${g.count} entries.</span></p>
<ul class="ref-names" aria-label="${esc(g.label)}, all entries">${g.entries.map((e) => `<li data-find-for="${e.id}"><a href="#${e.id}"><code>${esc(label(e))}</code></a></li>`).join('')}</ul>
${g.entries.map(entryHtml).join('\n')}`).join('\n\n');

  const total = reference.groups.reduce((n, g) => n + g.count, 0);
  return `
<h1>Reference</h1>
<p class="lead">Every element, directive, event, function and piece of template syntax of xoong, in one place: what it does, what it takes, an example, and the guide that explains it. ${total} entries, written from the code itself.</p>
<p>Press <kbd>Ctrl</kbd> <kbd>K</kbd> (or <kbd>/</kbd>) to search everything on this site, or open the <strong>Reference</strong> menu in the header. The same data is published as <a href="reference.json">reference.json</a> for tools.</p>
<div class="ref-filter" id="ref-filter" hidden>
  <label for="ref-filter-input">Filter this page</label>
  <input id="ref-filter-input" type="search" autocomplete="off" placeholder="dialog, xo-click, router, confirm…" aria-controls="ref-entries">
  <p class="ref-filter-status" role="status" id="ref-filter-status"></p>
</div>
<nav class="ref-jump" aria-label="Reference groups"><ul>${reference.groups.map((g) => `<li><a href="#${g.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}">${esc(g.label)} <span>${g.count}</span></a></li>`).join('')}</ul></nav>
<details class="ref-types"><summary>What the types mean</summary><dl class="ref-facts">${TYPE_HELP.map(([n, d]) => `<dt><code>${n}</code></dt><dd>${inline(d)}</dd>`).join('')}</dl></details>
<div id="ref-entries">
${groups}
</div>
<p class="ref-empty" id="ref-empty" hidden>Nothing here matches. Try a shorter word.</p>`;
}

/** @param {() => { file: string, title: string }[]} getPages the pages of the site: read when the page is rendered, so this module does not import them */
export const referencePage = (getPages) => ({
  file: 'reference.html', section: 'docs', group: 'Reference', nav: 'All elements and attributes', title: 'Reference', script: 'page-reference.js',
  description: 'Every xoong element, attribute, directive, event, function and template feature: what it does, what it takes, an example and the guide that explains it.',
  get body() { return render(getPages()); },
});
