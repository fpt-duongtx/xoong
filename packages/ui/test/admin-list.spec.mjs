import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mount, mockApi, respond } from '@xoong/test';
import '@xoong/ui';
import { setConfirm } from '@xoong/data/view';

const table = {
  version: 1,
  entities: { Article: { id: 'id' } },
  operations: {
    listArticles: { id: 'listArticles', method: 'GET', path: '/articles', query: ['status', 'q', 'sort', 'limit', 'offset'], response: { t: 'object', props: { items: { t: 'array', items: { t: 'entity', name: 'Article' } } } } },
    deleteArticle: { id: 'deleteArticle', method: 'DELETE', path: '/articles/{id}', response: null },
    setStatus: { id: 'setStatus', method: 'POST', path: '/articles/bulk/status', body: true, response: null, bodyFields: [{ name: 'ids', type: 'string' }, { name: 'status', type: 'string' }, { name: 'priority', type: 'integer' }] },
  },
};
const all = Array.from({ length: 7 }, (_, i) => ({ id: i + 1, title: `Article ${i + 1}`, status: i % 2 ? 'draft' : 'published', publishedAt: '2026-11-07T10:00:00Z' }));
const list = ({ query }) => {
  let rows = all.filter((a) => (!query.status || a.status === query.status) && (!query.q || a.title.includes(query.q)));
  const total = rows.length;
  const offset = Number(query.offset ?? 0);
  rows = rows.slice(offset, query.limit ? offset + Number(query.limit) : undefined);
  return { items: rows, total };
};

let screen;
beforeEach(() => { history.replaceState(null, '', '/'); setConfirm(() => true); });
afterEach(() => { screen?.unmount(); history.replaceState(null, '', '/'); });
const api = (extra = {}) => mockApi(table, { listArticles: list, deleteArticle: () => respond(204, null), setStatus: () => respond(204, null), ...extra });
const wait = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const titles = () => screen.texts('tbody tr td:first-child');

describe('xo-param buttons show which one is current', () => {
  const html = `<xo-view get="listArticles" url-params="status"><button id="all" xo-param="status=">All</button><button id="pub" xo-param="status=published">Published</button><button id="dr" xo-param="status=draft">Draft</button>
    <xo-table columns="title"></xo-table></xo-view>`;

  it('aria-current marks the matching button; "k=" matches "param unset", and clearing works', async () => {
    screen = await mount(html, { api: api() });
    expect(screen.$('#all').getAttribute('aria-current')).toBe('true');
    expect(screen.$('#pub').hasAttribute('aria-current')).toBe(false);
    await screen.click('#pub');
    expect(screen.$('#pub').getAttribute('aria-current')).toBe('true');
    expect(screen.$('#all').hasAttribute('aria-current')).toBe(false);
    expect(titles()).toEqual(['Article 1', 'Article 3', 'Article 5', 'Article 7']);
    await screen.click('#all'); // "status=" clears it
    expect(screen.$('#all').getAttribute('aria-current')).toBe('true');
    expect(titles()).toHaveLength(7);
  });
});

describe('url-params: list state lives in the page URL', () => {
  const html = `<xo-view get="listArticles" url-params="status,q,sort,offset"><button id="pub" xo-param="status=published">Published</button><input id="q" xo-param="q">
    <xo-table columns="title" sortable page-size="3"></xo-table></xo-view>`;

  it('a click adds a history entry, typing replaces it, and nothing is written until something changes', async () => {
    screen = await mount(html, { api: api() });
    expect(location.search).toBe(''); // page-size sets limit, which is not a url-param: nothing to write
    const entries = history.length;
    await screen.click('#pub');
    expect(location.search).toBe('?status=published');
    expect(history.length).toBe(entries + 1);
    const q = screen.$('#q');
    q.value = 'Article 3';
    q.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(300);
    await screen.settle();
    expect(location.search).toBe('?status=published&q=Article+3');
    expect(history.length).toBe(entries + 1); // typing replaced the entry
    expect(titles()).toEqual(['Article 3']);
  });

  it('starts from the URL: params, the data shown, filter boxes and the current tab', async () => {
    history.replaceState(null, '', '/?status=draft&q=Article');
    screen = await mount(html.replace('<button id="pub"', '<button id="dr" xo-param="status=draft">Draft</button><button id="pub"'), { api: api() });
    expect(titles()).toEqual(['Article 2', 'Article 4', 'Article 6']);
    expect(screen.$('#q').value).toBe('Article');
    expect(screen.$('#dr').getAttribute('aria-current')).toBe('true');
  });

  it('Back/Forward (popstate) re-reads the query into the view', async () => {
    screen = await mount(html, { api: api() });
    await screen.click('#pub');
    history.replaceState(null, '', '/'); // what Back does to the address
    window.dispatchEvent(new PopStateEvent('popstate'));
    await wait(10);
    await screen.settle();
    expect(titles()).toHaveLength(3); // page-size 3, no status filter
    expect(screen.$('#pub').hasAttribute('aria-current')).toBe(false);
  });
});

describe('table: empty state, labels, range, page size, formats', () => {
  it('empty text appears only when there is nothing and nothing is loading; a template slot can hold richer markup', async () => {
    screen = await mount('<xo-view get="listArticles" p-q="zzz"><xo-table columns="title" empty="No articles match."></xo-table></xo-view>', { api: api() });
    expect(screen.text('.xo-empty')).toBe('No articles match.');
    screen.unmount();
    screen = await mount('<xo-view get="listArticles" p-q="zzz"><xo-table columns="title"><template slot="empty"><b>Nothing</b> <a href="/new">Add one</a></template></xo-table></xo-view>', { api: api() });
    expect(screen.text('.xo-empty b')).toBe('Nothing');
    expect(screen.$('.xo-empty a').getAttribute('href')).toBe('/new');
    screen.unmount();
    screen = await mount('<xo-view get="listArticles"><xo-table columns="title" empty="None"></xo-table></xo-view>', { api: api() });
    expect(screen.$('.xo-empty')?.textContent.trim() ?? '').toBe(''); // there are rows: no empty message
  });

  it('filter boxes take a label ("q:Search") for the placeholder and the accessible name', async () => {
    screen = await mount('<xo-view get="listArticles"><xo-table columns="title:Name" filters="q:Search,status"></xo-table></xo-view>', { api: api() });
    const [q, status] = screen.$$('.xo-filters input');
    expect([q.placeholder, q.getAttribute('aria-label')]).toEqual(['Search', 'Search']);
    expect([status.placeholder, status.getAttribute('aria-label')]).toEqual(['status', 'status']);
  });

  it('shows "1–3 of 7" and a rows-per-page choice that goes back to the first page', async () => {
    screen = await mount('<xo-view get="listArticles"><xo-table columns="title" page-size="3" page-sizes="3,5"></xo-table></xo-view>', { api: api() });
    expect(screen.text('.xo-range')).toBe('1–3 of 7');
    await screen.click('.xo-pager button:last-child');
    expect(screen.text('.xo-range')).toBe('4–6 of 7');
    const select = screen.$('.xo-page-size');
    expect(select.value).toBe('3');
    select.value = '5';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(10);
    await screen.settle();
    expect(titles()).toHaveLength(5);
    expect(screen.text('.xo-range')).toBe('1–5 of 7');
  });

  it('a column format shows dates for people, in the page language', async () => {
    document.documentElement.lang = 'en-US';
    screen = await mount('<xo-view get="listArticles"><xo-table columns="title,publishedAt:Published:datetime"></xo-table></xo-view>', { api: api() });
    const time = screen.$('tbody tr td:nth-child(2) time');
    expect(time.getAttribute('datetime')).toBe('2026-11-07T10:00:00Z');
    expect(time.textContent).toMatch(/Nov 7, 2026/);
    document.documentElement.lang = '';
  });
});

describe('one-request bulk actions, $selected, xo-with', () => {
  const tick = async (n) => { const b = screen.$(`tbody tr:nth-child(${n}) input[type=checkbox]`); b.checked = true; b.dispatchEvent(new Event('change', { bubbles: true })); await screen.settle(); };

  it('xo-selected="ids" sends ONE request with the ticked ids (as the API knows them) and the xo-with fields, typed from the schema', async () => {
    const a = api();
    screen = await mount(`<xo-view get="listArticles"><xo-table columns="title" selectable>
      <button slot="bulk" xo-click="setStatus" xo-selected="ids" xo-with="status=published,priority=2">Publish</button></xo-table></xo-view>`, { api: a });
    await tick(1);
    await tick(3);
    await screen.click('.xo-bulk button');
    expect(a.callsOf('setStatus')).toHaveLength(1);
    expect(a.callsOf('setStatus')[0].body).toEqual({ ids: [1, 3], status: 'published', priority: 2 }); // numbers stay numbers
    expect(screen.$('.xo-bulk')).toBeNull(); // selection cleared on success
  });

  it('xo-body="$selected" hands the ticked rows to a click', async () => {
    const a = api();
    screen = await mount(`<xo-view get="listArticles"><xo-table columns="title" selectable><button slot="bulk" xo-click="setStatus" xo-body="$selected">Send rows</button></xo-table></xo-view>`, { api: a });
    await tick(2);
    await screen.click('.xo-bulk button');
    expect(a.callsOf('setStatus')[0].body).toEqual([{ id: 2, title: 'Article 2', status: 'draft', publishedAt: '2026-11-07T10:00:00Z' }]);
  });
});

describe('xo-confirm and xo-notice', () => {
  it('xo-confirm asks first; "no" sends nothing, the question can name the item', async () => {
    const asked = [];
    let answer = false;
    setConfirm((m) => { asked.push(m); return answer; });
    const a = api();
    screen = await mount(`<xo-view get="listArticles"><xo-table columns="title"><button xo-click="deleteArticle" xo-confirm="Delete {title}?">Delete</button></xo-table></xo-view>`, { api: a });
    await screen.click('tbody tr:nth-child(2) button');
    expect(asked).toEqual(['Delete Article 2?']);
    expect(a.callsOf('deleteArticle')).toHaveLength(0);
    answer = true;
    await screen.click('tbody tr:nth-child(2) button');
    expect(a.callsOf('deleteArticle')).toHaveLength(1);
  });

  it('xo-notice shows a status message in <xo-toast> after success (with the count of ticked rows), errors stay in the alert region', async () => {
    const a = api();
    screen = await mount(`<xo-toast timeout="0"></xo-toast><xo-view get="listArticles"><xo-table columns="title" selectable>
      <button slot="bulk" xo-click="setStatus" xo-selected="ids" xo-notice="Updated {$selectedCount} articles">Go</button></xo-table></xo-view>`, { api: a });
    for (const n of [1, 2, 4]) { const b = screen.$(`tbody tr:nth-child(${n}) input[type=checkbox]`); b.checked = true; b.dispatchEvent(new Event('change', { bubbles: true })); }
    await screen.settle();
    await screen.click('.xo-bulk button');
    const status = screen.$('.xo-toast-status');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.hidden).toBe(false);
    expect(status.textContent).toBe('Updated 3 articles');
    expect(screen.$('.xo-toast:not(.xo-toast-status)').hidden).toBe(true);
  });

  it('a notice can carry an action (Undo) that runs once and closes the toast', async () => {
    screen = await mount('<xo-toast timeout="0"></xo-toast>', { api: mockApi(table) });
    const { toast } = await import('@xoong/ui');
    let undone = 0;
    toast.show({ message: 'Published 3', action: { label: 'Undo', run: () => { undone++; } } });
    const button = screen.$('.xo-toast-status button');
    expect(button.textContent).toBe('Undo');
    button.click();
    await wait(5);
    expect(undone).toBe(1);
    expect(screen.$('.xo-toast-status').hidden).toBe(true);
  });
});
