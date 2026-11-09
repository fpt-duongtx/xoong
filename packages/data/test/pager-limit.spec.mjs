// The pager steps by the page size that is current (the rows-per-page choice), not the one the markup started with.
import { describe, it, expect, afterEach } from 'vitest';
import { configure } from '@xoong/data';
import '@xoong/data/view';
import '@xoong/ui';
import { mockApi } from '@xoong/test';
import { effect } from '@xoong/core/signals';

const table = {
  version: 1,
  entities: { User: { id: 'id' } },
  operations: {
    listUsers: { id: 'listUsers', method: 'GET', path: '/users', query: ['sort', 'limit', 'offset'], response: { t: 'object', props: { items: { t: 'array', items: { t: 'entity', name: 'User' } }, total: { t: 'number' } } } },
  },
};
const wait = (ms = 20) => new Promise((r) => setTimeout(r, ms));
let container, observer;
afterEach(() => { observer?.disconnect(); container?.remove(); });

const people = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `P${i + 1}`, role: 'member' }));
async function boot(html, rows = people(5)) {
  let data = rows;
  const api = mockApi(table, { listUsers: ({ query }) => ({ items: data.slice(Number(query.offset ?? 0), Number(query.offset ?? 0) + Number(query.limit ?? 1000)).map((r) => ({ ...r })), total: data.length }) });
  const client = configure({ api: api.table, fetch: api.fetch, retry: 0, gcTime: Infinity });
  container = document.createElement('div');
  document.body.append(container);
  container.innerHTML = html;
  await wait(); await wait();
  return { client, view: container.querySelector('xo-view'), set: (next) => { data = next; }, rowsEl: () => [...container.querySelectorAll('li')] };
}
/** Count what changes in the container while `act` runs: nodes added and removed, and text and attribute writes. */
async function touched(act) {
  const seen = { added: 0, removed: 0, text: 0, attributes: 0 };
  observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'childList') { seen.added += r.addedNodes.length; seen.removed += r.removedNodes.length; } else if (r.type === 'characterData') seen.text++; else if (r.target.localName !== 'xo-view') seen.attributes++; // the view marks itself busy while it fetches: that is its own state, not a row
    }
  });
  observer.observe(container, { childList: true, subtree: true, characterData: true, attributes: true });
  await act();
  await wait(); await wait();
  for (const r of observer.takeRecords()) { if (r.type === 'childList') { seen.added += r.addedNodes.length; seen.removed += r.removedNodes.length; } else if (r.type === 'characterData') seen.text++; else if (r.target.localName !== 'xo-view') seen.attributes++; }
  observer.disconnect();
  return seen;
}

const LIST = '<xo-view get="listUsers"><ul><li xo-each="items"><input type="checkbox" xo-select aria-label="pick"> <b>{name}</b> <i>{role}</i></li></ul></xo-view>';

describe('the pager steps by the current page size', () => {
  it('Next after the rows-per-page choice moves by the chosen limit', async () => {
    const t = await boot('<xo-view get="listUsers"><xo-pager page-size="2" page-sizes="2,3"></xo-pager><ul><li xo-each="items">{name}</li></ul></xo-view>', people(12));
    const select = container.querySelector('select');
    select.value = '3'; select.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(40); await wait(40);
    expect(t.rowsEl().map((li) => li.textContent)).toEqual(['P1', 'P2', 'P3']);
    container.querySelector('.xo-pager-next').click();
    await wait(40); await wait(40);
    expect(t.rowsEl().map((li) => li.textContent)).toEqual(['P4', 'P5', 'P6']);
  });
});
