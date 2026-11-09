// The Reference (site/reference.json, site/reference.html) and the search index (site/search-index.json) cannot drift from the code they describe.
// Both are GENERATED (node tools/site.mjs) from packages/core/src/syntax.js, packages/cli/src/html-data.js, the index.d.ts files and the small
// hand-written supplement tools/site/reference-supplement.mjs. These tests keep the supplement in step: every name, every event, every JavaScript
// export that is not marked internal, every example (HTML runs through `xoong check`, JavaScript through `node --check`) and every link.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SYNTAX, ELEMENT_DOCS, ATTRIBUTE_DOCS, VALUE_SETS, elementAttributes } from '../packages/cli/src/html-data.js';
import { XO_UI_ATTRIBUTES, XO_CONTROL_ATTRIBUTES } from '../packages/core/src/syntax.js';
import { checkHtml } from '../packages/cli/src/check.js';
import { sync } from '../packages/cli/src/commands.js';
import { fold as controlsFold } from '../packages/controls/src/fold.js';
import { fold, prepare, search, tokens } from '../site/src/search-core.js';
import { packageDeclarations, CATEGORY_ORDER } from '../tools/site/reference-data.mjs';
import { ELEMENTS, DIRECTIVES, EVENTS, API } from '../tools/site/reference-supplement.mjs';
import { render } from '../tools/site.mjs';
import { pages } from '../tools/site/pages.mjs';

const read = (file) => readFileSync(file, 'utf8');
const reference = JSON.parse(read('site/reference.json'));
const index = JSON.parse(read('site/search-index.json'));
const group = (id) => reference.groups.find((g) => g.id === id).entries;
const html = Object.fromEntries(render().map(({ file, html: text }) => [file, text]));
const runtime = readdirSync('packages').flatMap((dir) => (existsSync(`packages/${dir}/src`) ? readdirSync(`packages/${dir}/src`).filter((f) => f.endsWith('.js')).map((f) => ({ file: `packages/${dir}/src/${f}`, text: read(`packages/${dir}/src/${f}`) })) : []));

describe('reference.json', () => {
  it('is valid JSON with the five groups, each count equal to its entries, and every id unique', () => {
    expect(reference.groups.map((g) => g.id)).toEqual(['elements', 'directives', 'events', 'api', 'template']);
    for (const g of reference.groups) { expect(g.entries.length, g.id).toBe(g.count); expect(g.count, g.id).toBeGreaterThan(5); }
    const ids = reference.groups.flatMap((g) => g.entries.map((e) => e.id));
    expect(ids.filter((id, i) => ids.indexOf(id) !== i), 'duplicate ids').toEqual([]);
    for (const id of ids) expect(id, 'an id is an anchor: letters, digits and dashes').toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('has every element of syntax.js, in its order, with the description and every attribute of html-data.js', () => {
    expect(group('elements').map((e) => e.name)).toEqual(SYNTAX.elements);
    for (const e of group('elements')) {
      expect(e.description.length, `<${e.name}> has no description`).toBeGreaterThan(40);
      expect(e.summary.length).toBeGreaterThan(20);
      expect(e.summary.length).toBeLessThanOrEqual(e.description.length);
      const own = elementAttributes(e.name).map(([name]) => name);
      expect(e.attributes.map((a) => a.name).filter((n) => !n.startsWith('p-<')), `<${e.name}>: attributes`).toEqual(own);
      for (const [i, [name, text]] of elementAttributes(e.name).entries()) {
        const a = e.attributes[i];
        expect(a.description, `<${e.name} ${name}>`).toBe(text);
        expect(['text', 'number', 'flag', 'list', 'choice', 'path', 'operation', 'selector', 'JSON'], `<${e.name} ${name}>: type ${a.type}`).toContain(a.type);
        if (a.type === 'choice') expect(a.values, `<${e.name} ${name}>`).toEqual(VALUE_SETS[`${e.name} ${name}`] ?? VALUE_SETS[name]);
        else expect(a.values).toBeNull();
      }
      expect(e.package).toMatch(/^@xoong\/(data|ui|controls|richtext)$/);
      expect(e.import).toContain(e.package);
      expect(e.example.code, `<${e.name}> has no example`).toContain(`<${e.name}`);
    }
    expect(Object.keys(ELEMENTS).filter((t) => !SYNTAX.elements.includes(t)), 'the supplement describes an element that syntax.js does not list').toEqual([]);
  });

  it('knows the type of the attributes the runtime declares (`static props`): a flag is a Boolean, a number a Number', () => {
    const type = (tag, name) => group('elements').find((e) => e.name === tag).attributes.find((a) => a.name === name).type;
    expect(type('xo-carousel', 'loop')).toBe('flag');
    expect(type('xo-carousel', 'items')).toBe('number');
    expect(type('xo-switch', 'required')).toBe('flag'); // from XoControl.props
    expect(type('xo-dialog', 'size')).toBe('choice');
    expect(type('xo-table', 'columns')).toBe('list');
    expect(group('elements').find((e) => e.name === 'xo-toast').attributes[0].default).toBe('6');
  });

  it('has every attribute of syntax.js as a directive, with where it applies, what it takes and an example', () => {
    expect(group('directives').map((d) => d.name).sort()).toEqual([...SYNTAX.attributes].sort());
    for (const d of group('directives')) {
      expect(d.description, d.name).toBe(ATTRIBUTE_DOCS[d.name]);
      expect(CATEGORY_ORDER, d.name).toContain(d.category);
      expect(d.applies?.length, `${d.name}: where it applies`).toBeGreaterThan(5);
      expect(d.value?.length, `${d.name}: what it takes`).toBeGreaterThan(3);
      expect(d.example.code, `${d.name} has no example`).toContain(d.name);
      expect(d.values).toEqual(VALUE_SETS[d.name] ?? null);
    }
    for (const d of group('directives')) { // the package follows the list of syntax.js that the attribute is in
      if (XO_UI_ATTRIBUTES.includes(d.name)) expect(d.package, d.name).toBe('@xoong/ui');
      if (XO_CONTROL_ATTRIBUTES.includes(d.name)) expect(d.package, d.name).toBe('@xoong/controls');
    }
    expect(Object.keys(DIRECTIVES).filter((n) => !SYNTAX.attributes.includes(n)), 'the supplement describes an attribute that syntax.js does not list').toEqual([]);
  });

  it('documents every event the runtime fires, and only events the runtime fires', () => {
    const fired = new Set();
    for (const { text } of runtime) for (const m of text.matchAll(/(?:new CustomEvent|new Event|emit)\(\s*'([\w-]+)'/g)) fired.add(m[1]);
    for (const native of ['change', 'input', 'close', 'error', 'load', 'submit', 'invalid']) fired.delete(native); // the browser's own, re-fired for a control
    const documented = group('events').map((e) => e.name);
    expect([...fired].filter((n) => !documented.includes(n)), 'fired by the runtime but not in the reference: add it to EVENTS in reference-supplement.mjs').toEqual([]);
    expect(documented.filter((n) => !fired.has(n)), 'in the reference but fired nowhere').toEqual([]);
    for (const e of group('events')) { expect(e.from, e.name).toBeTruthy(); expect(e.detail, e.name).toBeTruthy(); expect(e.summary.length, e.name).toBeGreaterThan(10); }
    for (const [tag, info] of Object.entries(ELEMENTS)) for (const name of info.events ?? []) expect(Object.keys(EVENTS), `${tag} lists the event ${name}`).toContain(name);
  });

  it('describes the detail of the events the controls type in index.d.ts with the same keys', () => {
    const dts = read('packages/controls/src/index.d.ts').replace(/^\s*\/\/.*$/gm, ''); // not the instructions in the header comment
    const typed = [...dts.matchAll(/'([\w-]+)': CustomEvent<\{([^}]*)\}>/g)];
    expect(typed.length).toBeGreaterThan(8);
    for (const [, name, shape] of typed) {
      expect(Object.keys(EVENTS), `index.d.ts types the event ${name}: document it`).toContain(name);
      for (const [, key] of shape.matchAll(/(\w+)\??:/g)) expect(EVENTS[name].detail, `${name}: detail has no \`${key}\``).toContain(key);
    }
  });

  it('documents every JavaScript export of the packages, except the ones marked internal here', () => {
    // helpers of the framework itself or of its tooling: not something an app calls, so not in the reference (a new export fails until it is one or the other)
    const INTERNAL = {
      data: ['createStore', 'isRef'],
      i18n: ['directionOf', 'resetI18n', 'messageFor', 'formatMessage', 'parse', 'argsOf', 'apply', 'hasText', 'parseSpec', 'startEnhancer', 'builtin'],
      core: ['distance', 'nearest', 'TemplateResult', 'Signal', 'disposeComputed', 'setTextProvider', 'text', 'XO_ATTRIBUTES', 'XO_ELEMENTS', 'XO_UI_ATTRIBUTES', 'XO_UI_ELEMENTS', 'XO_CONTROL_ATTRIBUTES', 'XO_CONTROL_ELEMENTS'],
      forms: ['normalize', 'isoToLocal', 'localToIso', 'parsePath', 'pathKey', 'getAt', 'setAt', 'nodeAt', 'variant', 'coerce', 'defaults', 'validate', 'checkValue', 'resetMessages', 'message'],
      richtext: ['isSafeLink', 'isSafeImage', 'textOf'],
      ui: [],
    };
    const names = new Set(group('api').flatMap((e) => [e.name, e.name.split('.')[0]]));
    for (const [dir, internal] of Object.entries(INTERNAL)) {
      for (const [name, d] of packageDeclarations(dir)) {
        if (!['function', 'const', 'class'].includes(d.kind) || internal.includes(name)) continue;
        expect(names.has(name), `@xoong/${dir} exports ${name}: document it in API of reference-supplement.mjs, or list it as internal in this test`).toBe(true);
      }
      for (const name of internal) expect(packageDeclarations(dir).has(name), `${name} is listed as internal but @xoong/${dir} no longer exports it`).toBe(true);
    }
  });

  it('shows the declaration of every API entry from index.d.ts, and a hand-written one only where there is no declaration', () => {
    for (const e of group('api')) {
      expect(e.signature, e.name).toBeTruthy();
      if (e.name === 'setFormat') {
        expect(read('packages/data/src/format.js'), 'setFormat').toMatch(/export function setFormat\(name, fn\)/);
        expect(read('packages/data/src/view.js'), 'setFormat is exported by @xoong/data/view').toContain("export { setFormat } from './format.js'");
        expect(e.declaration).toContain('setFormat(name: string');
      } else expect(e.declaration, `${e.name}: no declaration found in an index.d.ts`).toBeTruthy();
    }
    expect(API.filter((a) => !a.from && !a.member && !a.hand).map((a) => a.name)).toEqual([]);
  });

  it('lists the view variables of view.js and the formats of format.js in the template syntax', () => {
    const names = group('template').map((t) => t.name).join(' ');
    const view = read('packages/data/src/view.js');
    const vars = new Set([...view.matchAll(/^\s*(\$[A-Za-z]\w*):/gm), ...view.matchAll(/vars: \{ (\$[A-Za-z]\w*):/g)].map((m) => m[1]));
    for (const v of ['$loading', '$refreshing', '$error', '$index', '$form', '$selectedCount']) expect(vars.has(v), `view.js no longer defines ${v}`).toBe(true);
    for (const v of vars) expect(names.includes(v), `view.js defines ${v}: document it in TEMPLATE of reference-supplement.mjs`).toBe(true);
    const formats = [...read('packages/data/src/format.js').matchAll(/^ {2}\['(\w+)', /gm)].map((m) => m[1]);
    expect(formats.length).toBeGreaterThan(5);
    expect(group('template').find((t) => t.name === '{path | format}').table.map(([n]) => n), 'the formats of format.js').toEqual(formats);
  });
});

describe('the examples of the reference', () => {
  let table;
  beforeAll(async () => {
    const out = mkdtempSync(join(tmpdir(), 'xoong-ref-'));
    await sync('site/demo/openapi.json', { out, hints: 'site/demo/xoong.hints.json' });
    table = JSON.parse(read(join(out, 'operations.json')));
  });
  const entries = reference.groups.flatMap((g) => g.entries);

  it('HTML examples pass `xoong check` (every xo-* name, value and place is one the checker knows) against the demo API', () => {
    const markup = entries.filter((e) => e.example.lang === 'html');
    expect(markup.length).toBeGreaterThan(80);
    for (const e of markup) expect(checkHtml(e.example.code, table, e.id, { fragment: true }).map((f) => `${f.code} ${f.message}`), `${e.id}`).toEqual([]);
  });

  it('JavaScript examples are valid modules (node --check)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'xoong-ref-js-'));
    for (const e of entries.filter((x) => x.example.lang === 'js')) {
      const file = join(dir, `${e.id}.mjs`);
      writeFileSync(file, e.example.code);
      expect(() => execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }), `${e.id}: ${e.example.code}`).not.toThrow();
    }
  });
});

describe('links and anchors', () => {
  const entries = reference.groups.flatMap((g) => g.entries);
  const hasAnchor = (file, anchor) => !anchor || new RegExp(`\\sid="${anchor}"`).test(html[file]);

  it('every guide link of the reference points at a page of the site and an anchor that is on it', () => {
    let n = 0;
    for (const e of entries.filter((x) => x.guide)) {
      const [file, anchor] = e.guide.split('#');
      expect(Object.keys(html), `${e.id}: guide ${e.guide}`).toContain(file);
      expect(hasAnchor(file, anchor), `${e.id}: ${e.guide} has no #${anchor}`).toBe(true);
      n++;
    }
    expect(n).toBeGreaterThan(100);
  });

  it('the guide of an element or a directive is a page that shows it', () => {
    const unlinked = entries.filter((x) => ['element', 'directive'].includes(x.kind) && x.guide && !html[x.guide.split('#')[0]].includes(x.name)).map((x) => `${x.id}: ${x.guide} does not mention it`);
    expect(unlinked).toEqual([]);
  });

  it('reference.html has a section for every entry and no id twice; the group headings have the ids the menu links to', () => {
    const page = html['reference.html'];
    const ids = [...page.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i), 'duplicate ids on reference.html').toEqual([]);
    for (const e of entries) expect(page, e.id).toContain(`<section class="ref-entry" id="${e.id}"`);
    for (const g of index.groups) expect(page, g.url).toContain(`id="${g.url.split('#')[1]}"`);
    expect(page).not.toMatch(/ style="/);
  });

  it('every attribute row of an element is on the page, with its type', () => {
    const page = html['reference.html'];
    for (const e of group('elements')) {
      const own = page.slice(page.indexOf(`id="${e.id}"`), page.indexOf('</section>', page.indexOf(`id="${e.id}"`)));
      for (const a of e.attributes) expect(own, `<${e.name} ${a.name}>`).toContain(`<th scope="row"><code>${a.name.replace('<', '&lt;').replace('>', '&gt;')}</code>`);
    }
  });
});

describe('search-index.json', () => {
  const items = index.items;

  it('lists every page (not the 404 page), every reference entry, and sections with a page', () => {
    for (const p of pages.filter((x) => x.file && !x.root)) expect(items.find((i) => i.url === p.file && i.kind === 'page'), `${p.file} is not in the index`).toBeTruthy();
    for (const g of reference.groups) for (const e of g.entries) expect(items.find((i) => i.url === `reference.html#${e.id}`), `${e.id} is not in the index`).toBeTruthy();
    const sections = items.filter((i) => i.kind === 'section');
    expect(sections.length).toBeGreaterThan(150);
    for (const s of sections) expect(s.page, s.title).toBeTruthy();
    for (const i of items) { expect(i.title, JSON.stringify(i)).toBeTruthy(); expect(i.group, i.title).toBeTruthy(); expect(i.url, i.title).toBeTruthy(); }
  });

  it('every url is a page that exists, and its anchor is on it', () => {
    for (const i of items) {
      const [file, anchor] = i.url.split('#');
      if (file.startsWith('live-')) { expect(existsSync(`site/${file}`), file).toBe(true); continue; } // the two full-page demos
      expect(Object.keys(html), `${i.title}: ${i.url}`).toContain(file);
      expect(new RegExp(`\\sid="${anchor}"`).test(html[file]) || !anchor, `${i.title}: ${i.url} has no such anchor`).toBe(true);
    }
  });

  it('carries the groups the menu is built from, with the same counts as the reference', () => {
    expect(index.groups.map((g) => [g.id, g.count])).toEqual(reference.groups.map((g) => [g.id, g.count]));
    for (const g of index.groups) expect(items.filter((i) => i.kind === g.kind).length, g.id).toBe(g.count);
  });
});

describe('the matching of the search (site/src/search-core.js)', () => {
  it('folds like @xoong/controls: lower case, no accents, and đ is a d', () => {
    for (const text of ['Đồng', 'ĐỒNG bộ', 'Nguyễn Văn A', 'café', 'Crème Brûlée', 'ǅ', 'xo-dialog', 'ế']) expect(fold(text)).toBe(controlsFold(text));
    expect(fold('Đồng')).toBe('dong');
  });

  const fixture = [
    { title: 'Đồng bộ dữ liệu', url: 'a.html', group: 'Guides', kind: 'page', text: 'Sync the data.', keywords: '' },
    { title: 'Tables', url: 'b.html', group: 'Guides', kind: 'page', text: 'A grid of rows that you can sort.', keywords: 'grid' },
    { title: 'Sorting', url: 'c.html#s', group: 'Guides', kind: 'section', page: 'Tables', text: 'Tables sort on the server.', keywords: '' },
    { title: 'xo-table', url: 'reference.html#xo-table', group: 'Element', kind: 'element', text: 'A table for a list.', keywords: 'pager' },
    { title: 'Dialogs', url: 'd.html', group: 'Guides', kind: 'page', text: 'Ask a question.', keywords: 'modal', related: 'popup' },
  ];
  const find = (query) => search(prepare(fixture), query).map((i) => i.url);

  it('ignores case and accents in the query and in the text', () => {
    expect(find('dong')).toEqual(['a.html']);
    expect(find('ĐỒNG BỘ')).toEqual(['a.html']);
    expect(find('dỒng bo du lieu')).toEqual(['a.html']);
    expect(find('TABLES')[0]).toBe('b.html');
  });

  it('puts a title match above a match in the text, and finds synonyms and typed tag brackets', () => {
    const order = find('table');
    expect(order.indexOf('reference.html#xo-table')).toBeLessThan(order.indexOf('c.html#s')); // a title beats text
    expect(order.indexOf('b.html')).toBeLessThan(order.indexOf('c.html#s'));
    expect(find('sort')[0]).toBe('c.html#s'); // the title of a section beats the text of a page
    expect(find('modal')).toEqual(['d.html']);
    expect(find('popup')).toEqual(['d.html']); // a related word
    expect(find('pager')).toEqual(['reference.html#xo-table']); // a keyword
    expect(find('<xo-table>')).toEqual(['reference.html#xo-table']);
  });

  it('wants every word, and says nothing for an empty or an unknown query', () => {
    expect(find('tables zzz')).toEqual([]);
    expect(find('')).toEqual([]);
    expect(find('   ')).toEqual([]);
    expect(tokens('  <xo-dialog>  Hello ')).toEqual(['xo-dialog', 'hello']);
  });

  it('finds the real thing in the real index: "confirm" gives xo-confirm and the Dialogs page, "popup" the dialog, "grid" the table', () => {
    const real = prepare(index.items);
    const urls = (q) => search(real, q).map((i) => i.url);
    expect(urls('confirm')).toContain('reference.html#xo-confirm');
    expect(urls('confirm').some((u) => u.startsWith('dialogs.html'))).toBe(true);
    expect(urls('popup')).toContain('reference.html#xo-dialog');
    expect(urls('grid')).toContain('reference.html#xo-table');
    expect(urls('xo-table')[0]).toBe('reference.html#xo-table');
    expect(urls('CONFIRM')[0]).toBe(urls('confirm')[0]);
  });
});
