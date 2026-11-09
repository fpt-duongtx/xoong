import { describe, it, expect, afterEach } from 'vitest';
import { mount, mockApi } from '@xoong/test';
import '@xoong/ui';

const table = {
  version: 1,
  entities: { Person: { id: 'id' } },
  operations: { listPeople: { id: 'listPeople', method: 'GET', path: '/people', query: ['q'], response: { t: 'object', props: { items: { t: 'array', items: { t: 'entity', name: 'Person' } } } } } },
};
const people = { items: [{ id: 1, name: 'Ada', email: 'ada@x.test', role: 'admin' }, { id: 2, name: 'Bob', email: 'bob@x.test', role: 'editor' }] };
const api = () => mockApi(table, { listPeople: () => people });
let screen;
afterEach(() => { screen?.unmount(); try { localStorage.clear(); } catch { /* none */ } });
const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const shown = () => screen.$$('thead th[data-col]').filter((th) => !th.hidden).map((th) => th.dataset.col);
const SRC = (attrs = '') => `<xo-view get="listPeople"><xo-table columns="name,email:E-mail,role" filters="q:Search" ${attrs}></xo-table></xo-view>`;

describe('<xo-table column-picker>', () => {
  it('draws a Columns dropdown at the end of the search row, one checked box per column', async () => {
    screen = await mount(SRC('column-picker'), { api: api() });
    await wait();
    const row = screen.$('.xo-filters');
    expect(row.lastElementChild.classList.contains('xo-columns')).toBe(true); // after the search box
    expect(screen.text('.xo-columns summary')).toBe('Columns');
    expect(screen.$$('.xo-columns input').map((i) => [i.value, i.checked])).toEqual([['name', true], ['email', true], ['role', true]]);
    expect(screen.$$('.xo-columns label span').map((s) => s.textContent)).toEqual(['Name', 'E-mail', 'Role']);
  });

  it('unticking hides the header and every cell, also rows drawn later; ticking shows them again; the last visible column cannot be unticked', async () => {
    screen = await mount(SRC('column-picker'), { api: api() });
    await wait();
    const box = (v) => screen.$(`.xo-columns input[value="${v}"]`);
    box('email').click();
    expect(shown()).toEqual(['name', 'role']);
    expect(screen.$$('tbody td[data-col="email"]').every((td) => td.hidden)).toBe(true);
    expect(screen.$$('tbody td[data-col="name"]').every((td) => !td.hidden)).toBe(true);
    box('role').click();
    expect(box('name').disabled).toBe(true); // the last one stays
    box('role').click();
    expect(shown()).toEqual(['name', 'role']);
    box('email').click();
    expect(shown()).toEqual(['name', 'email', 'role']);
    expect(box('name').disabled).toBe(false);
    // rows that appear after the choice follow it
    box('role').click();
    screen.$('tbody').append(screen.$('tbody tr').cloneNode(true));
    await wait(10);
    expect(screen.$$('tbody td[data-col="role"]').every((td) => td.hidden)).toBe(true);
  });

  it('hidden-columns starts with columns hidden and the event says what is visible', async () => {
    screen = await mount(SRC('column-picker hidden-columns="email"'), { api: api() });
    await wait();
    expect(shown()).toEqual(['name', 'role']);
    expect(screen.$('.xo-columns input[value="email"]').checked).toBe(false);
    const seen = [];
    screen.container.addEventListener('xo-columns-change', (e) => seen.push(e.detail));
    screen.$('.xo-columns input[value="role"]').click();
    expect(seen).toEqual([{ visible: ['name'], hidden: ['email', 'role'] }]);
  });

  it('columns-key remembers the choice in this browser', async () => {
    screen = await mount(SRC('column-picker columns-key="people"'), { api: api() });
    await wait();
    screen.$('.xo-columns input[value="email"]').click();
    expect(JSON.parse(localStorage.getItem('xoong-columns:people'))).toEqual(['email']);
    screen.unmount();
    screen = await mount(SRC('column-picker columns-key="people"'), { api: api() });
    await wait();
    expect(shown()).toEqual(['name', 'role']);
  });

  it('Escape closes the dropdown and returns to its button; without the attribute there is no dropdown', async () => {
    screen = await mount(SRC('column-picker'), { api: api() });
    await wait();
    const d = screen.$('.xo-columns');
    d.open = true;
    d.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(d.open).toBe(false);
    screen.unmount();
    screen = await mount(SRC(), { api: api() });
    await wait();
    expect(screen.$('.xo-columns')).toBeNull();
  });
});

describe('<xo-form> with buttons inside it', () => {
  const formTable = { version: 1, entities: { Person: { id: 'id' } }, operations: { createPerson: { id: 'createPerson', method: 'POST', path: '/people', bodyFields: [{ name: 'name', type: 'string', required: true }], response: { t: 'entity', name: 'Person' } } } };
  it('draws them beside the submit button in one row, and a plain form keeps its single button', async () => {
    screen = await mount('<xo-view><xo-form op="createPerson" submit="Add"><button type="button" xo-close>Cancel</button></xo-form></xo-view>', { api: mockApi(formTable, { createPerson: () => ({ id: 1, name: 'x' }) }) });
    await wait();
    const row = screen.$('form .xo-form-actions');
    expect([...row.children].map((b) => b.textContent)).toEqual(['Add', 'Cancel']);
    expect(row.children[0].classList.contains('xo-submit')).toBe(true);
    screen.unmount();
    screen = await mount('<xo-view><xo-form op="createPerson" submit="Add"></xo-form></xo-view>', { api: mockApi(formTable, { createPerson: () => ({ id: 1, name: 'x' }) }) });
    await wait();
    expect(screen.$('form .xo-form-actions')).toBeNull();
    expect(screen.$('form > .xo-submit').textContent).toBe('Add');
  });
});
