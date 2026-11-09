// One change must touch one row: rows are kept (same element) by key, an unchanged answer writes nothing, a deleted row does not make the rows after it move,
// ticking a row re-runs that row's checkbox only, and the pager steps by the page size that is current, not the one the markup started with.
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

describe('a refetch with the same data', () => {
  it('keeps every row element and writes nothing', async () => {
    const t = await boot(LIST);
    const before = t.rowsEl();
    const seen = await touched(async () => { t.view.refresh(); });
    expect(t.rowsEl()).toHaveLength(5);
    t.rowsEl().forEach((li, i) => expect(li, `row ${i}`).toBe(before[i]));
    expect(seen).toEqual({ added: 0, removed: 0, text: 0, attributes: 0 });
  });

  it('does not re-run the bindings of the rows (an unchanged entity is not a change)', async () => {
    const t = await boot(LIST);
    let runs = 0;
    // every text binding of every row reads its entity; count how often the effects of this view run
    const stop = effect(() => { runs++; t.client.store.read('User#1'); });
    runs = 0;
    t.view.refresh(); await wait(); await wait();
    expect(runs).toBe(0);
    stop();
  });
});

describe('one record changes', () => {
  it('rewrites that row only; the other rows are the same elements and untouched', async () => {
    const t = await boot(LIST);
    const before = t.rowsEl();
    const next = people(5); next[2].name = 'Changed';
    t.set(next);
    const seen = await touched(async () => { t.view.refresh(); });
    t.rowsEl().forEach((li, i) => expect(li).toBe(before[i]));
    expect(t.rowsEl()[2].querySelector('b').textContent).toBe('Changed');
    expect(seen.added + seen.removed).toBe(0);
    expect(seen.text).toBe(1);
  });
});

describe('a row is deleted or added', () => {
  it('deleting the third row removes one row and moves none of the others', async () => {
    const t = await boot(LIST);
    const before = t.rowsEl();
    t.set(people(5).filter((p) => p.id !== 3));
    const seen = await touched(async () => { t.view.refresh(); });
    const after = t.rowsEl();
    expect(after).toHaveLength(4);
    expect(after).toEqual([before[0], before[1], before[3], before[4]]);
    // one row (an <li> with its text and children) leaves, and nothing else is added or removed: no row was moved
    expect(seen.added).toBe(0);
    expect(seen.removed).toBeLessThanOrEqual(1);
  });

  it('adding a row at the end adds that row and keeps the others in place', async () => {
    const t = await boot(LIST);
    const before = t.rowsEl();
    t.set(people(6));
    const seen = await touched(async () => { t.view.refresh(); });
    expect(t.rowsEl().slice(0, 5)).toEqual(before);
    expect(seen.removed).toBe(0);
    expect(seen.added).toBeLessThanOrEqual(2); // the row, and at most the whitespace node that follows it
  });

  it('new rows inserted between old ones land in order, in one insertion, and the old rows stay in place', async () => {
    const t = await boot(LIST, [1, 2, 5].map((id) => ({ id, name: `P${id}`, role: 'member' })));
    const before = t.rowsEl();
    t.set(people(6));
    const seen = await touched(async () => { t.view.refresh(); });
    expect(t.rowsEl().map((li) => li.querySelector('b').textContent)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
    expect([t.rowsEl()[0], t.rowsEl()[1], t.rowsEl()[4]]).toEqual(before);
    expect(seen.removed).toBe(0);
  });

  it('a reorder keeps the same row elements (they move, they are not rebuilt)', async () => {
    const t = await boot(LIST);
    const byName = new Map(t.rowsEl().map((li) => [li.querySelector('b').textContent, li]));
    t.set(people(5).reverse());
    t.view.refresh(); await wait(); await wait();
    expect(t.rowsEl().map((li) => li.querySelector('b').textContent)).toEqual(['P5', 'P4', 'P3', 'P2', 'P1']);
    for (const li of t.rowsEl()) expect(li).toBe(byName.get(li.querySelector('b').textContent));
  });
});

describe('ticking a row', () => {
  it('re-runs the checkbox of that row, not of every row', async () => {
    const t = await boot(LIST);
    const boxes = [...container.querySelectorAll('input[type=checkbox]')];
    let changes = 0;
    const o = new MutationObserver((r) => { changes += r.filter((x) => x.type === 'attributes').length; });
    boxes.forEach((b) => o.observe(b, { attributes: true }));
    boxes[2].checked = true; boxes[2].dispatchEvent(new Event('change', { bubbles: true }));
    await wait();
    expect(t.view.selectedRefs().map((r) => r.$ref)).toEqual(['User#3']);
    expect(boxes.map((b) => b.checked)).toEqual([false, false, true, false, false]);
    expect(changes).toBe(0); // the property is set, nothing else is rewritten
    boxes[2].checked = false; boxes[2].dispatchEvent(new Event('change', { bubbles: true }));
    await wait();
    expect(t.view.selectedRefs()).toHaveLength(0);
    o.disconnect();
  });
});

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
