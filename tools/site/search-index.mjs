// The index of the docs search: site/search-index.json. Built when the pages are generated, so it cannot drift from them:
//   every page (title, description), every section of it (h2 and h3, with the page it belongs to) and every entry of the reference
//   (elements, directives, events, JavaScript API, template syntax) with its one-line summary and a few synonyms.
// The browser matches it with site/src/search-core.js (search.js: the search dialog, reference-menu.js: the Reference menu).
import { buildReference } from './reference-data.mjs';
import { fold } from '../../site/src/search-core.js';

/** The label of a reference result, by kind. */
const KIND_LABEL = { element: 'Element', directive: 'Directive', event: 'Event', api: 'API', syntax: 'Template' };
/** Pages that are not in the docs sidebar (or are only listed there) and their label. */
const HOME_GROUP = { home: 'Home', brand: 'Brand', demo: 'Live demos' };
/** The two full-page demos the sidebar lists under "Live demos": whole apps, not generated pages. */
const DEMOS = [
  { file: 'live-admin.html', title: 'Admin app', text: 'A full-page demo: an admin app with a sidebar, a table, forms and dialogs, all on xoong.' },
  { file: 'live-landing.html', title: 'Landing site', text: 'A full-page demo: a marketing landing page built with xoong.' },
];

/**
 * Words that mean the same thing to a person looking for something. When the title or the keywords of an item contain a word of a set, the whole set
 * is added to its keywords: "popup" finds the dialogs, "grid" finds the table, "dark" finds the theme toggle.
 */
export const SYNONYMS = [
  'dialog modal popup overlay confirm alert prompt window',
  'table grid rows columns pager pagination paging sort filter',
  'form input field validation submit',
  'router route routing navigation history url link',
  'toast notification snackbar message notice',
  'tabs tab panel',
  'menu dropdown popover',
  'combobox select dropdown autocomplete tags chips',
  'richtext editor wysiwyg',
  'theme palette dark light colour color scheme mode',
  'i18n translate translation language locale',
  'install setup npm start begin',
  'test testing vitest mock',
  'data fetch load request query operation api',
  'error failure problem exception',
  'carousel slider slides gallery',
];

const entities = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&middot;': '·', '&rarr;': '→', '&hellip;': '…' };
const unescape = (s) => s.replace(/&(?:lt|gt|amp|quot|#39|nbsp|middot|rarr|hellip);/g, (m) => entities[m]);
/** Text of a piece of HTML: no tags, no code blocks, one line. */
const textOf = (html) => unescape(html.replace(/<(script|style|svg|pre|xo-tabs)\b[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').replace(/ ([.,;:!?)])/g, '$1').replace(/\( /g, '(').trim();
const clip = (raw, n = 170) => {
  const s = raw.replace(/`/g, '');
  return s.length <= n ? s : `${s.slice(0, s.lastIndexOf(' ', n) > 80 ? s.lastIndexOf(' ', n) : n).replace(/[\s,;:.(–-]+$/, '')}…`;
};

/** The ids the layout gives the h2 of a docs page (tools/site/lib.mjs): a plain `<h2>` gets the slug of its text, made unique; `<h2 id>` keeps its own. A page outside the docs shell (the home page) has none: its sections link to the page. */
function sections(body, withIds) {
  const used = new Set();
  const out = [];
  let anchor = '';
  const heads = [...body.matchAll(/<h([23])((?:\s[^>]*)?)>([\s\S]*?)<\/h\1>/g)];
  heads.forEach((m, i) => {
    const [whole, level, attrs, inner] = m;
    const title = textOf(inner);
    if (level === '2') {
      const own = attrs.match(/\sid="([^"]+)"/)?.[1];
      if (own) anchor = own;
      else if (withIds) {
        const plain = inner.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '');
        let id = plain.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
        for (let n = 2; used.has(id); n++) id = `${id.replace(/-\d+$/, '')}-${n}`;
        used.add(id); anchor = id;
      }
    }
    const end = m.index + whole.length;
    const next = heads[i + 1]?.index ?? body.length;
    const after = body.slice(end, next).replace(/<h1[\s\S]*$/, '');
    out.push({ level: Number(level), title, anchor, text: clip(textOf(after)) });
  });
  return out.filter((s) => s.title);
}

/** The singular of a word, roughly: "tables" and "table" are the same search. */
const stem = (w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);

/** When a word of the TITLE belongs to a set of synonyms, the other words of the set are `related` to the item: "popup" finds the dialogs, "grid" the table. */
function withSynonyms(item) {
  const own = new Set(fold(`${item.title} ${item.keywords}`).split(/[^a-z0-9]+/).filter(Boolean).map(stem));
  const titleWords = new Set(fold(item.title).split(/[^a-z0-9]+/).filter(Boolean).map(stem));
  const related = [];
  for (const set of SYNONYMS) {
    const list = set.split(' ');
    if (!list.some((w) => titleWords.has(stem(w)))) continue;
    for (const w of list) if (!own.has(stem(w)) && !related.includes(w)) related.push(w);
  }
  return related.length ? { ...item, related: related.join(' ') } : item;
}

/** @param {{ file: string, title: string, nav?: string, group?: string, section?: string, description?: string, body?: string, root?: boolean }[]} pages */
export function buildSearchIndex(pages) {
  const reference = buildReference();
  const items = [];
  for (const page of pages) {
    if (page.root || !page.file) continue; // 404.html
    const group = page.group ?? HOME_GROUP[page.section] ?? 'Site';
    const home = page.file === 'index.html';
    items.push(withSynonyms({ title: home ? 'Home' : page.title, url: page.file, group, kind: 'page', text: clip(page.description ?? '', 200), keywords: [home ? 'xoong start landing welcome' : '', page.nav && page.nav !== page.title ? page.nav : '', page.group ?? ''].filter(Boolean).join(' ') }));
    if (page.file === 'reference.html') continue; // its entries are indexed below, one by one
    for (const s of sections(page.body ?? '', !!page.group)) { // only the pages of the docs shell have an id on every h2
      if (s.level === 2 && s.title === page.title) continue;
      items.push(withSynonyms({ title: s.title, page: home ? 'Home' : page.title, url: s.anchor ? `${page.file}#${s.anchor}` : page.file, group, kind: 'section', text: s.text, keywords: '' }));
    }
  }
  for (const d of DEMOS) items.push({ title: d.title, url: d.file, group: 'Live demos', kind: 'page', text: d.text, keywords: 'demo example app' });
  for (const g of reference.groups) {
    for (const e of g.entries) {
      const kind = e.kind;
      const title = kind === 'api' && ['function', 'method'].includes(e.type) ? `${e.name}()` : e.name;
      const extra = kind === 'element' ? `${e.package} ${e.attributes.map((a) => a.name).join(' ')}` : kind === 'api' ? e.package : kind === 'directive' ? `${e.package} ${e.category}` : '';
      items.push(withSynonyms({ title, url: `reference.html#${e.id}`, group: KIND_LABEL[kind], kind, text: clip(e.summary, 200), keywords: [e.keywords, extra].filter(Boolean).join(' ') }));
    }
  }
  return {
    version: 1,
    groups: reference.groups.map((g) => ({ id: g.id, label: g.label, summary: g.summary, kind: g.entries[0]?.kind, count: g.count, url: `reference.html#${g.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` })), // the h2 of the group has this id (the layout makes it from the text)
    items,
  };
}

/** One item per line, so a change to the pages is a readable diff. */
export const searchIndexJson = (pages) => {
  const { items, ...head } = buildSearchIndex(pages);
  return `{${JSON.stringify(head).slice(1, -1)},\n"items":[\n${items.map((i) => JSON.stringify(i)).join(',\n')}\n]}\n`;
};
