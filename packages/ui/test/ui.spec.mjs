import { describe, it, expect, afterEach } from 'vitest';
import { mount, mockApi, respond } from '@xoong/test';
import '@xoong/ui';

const table = {
  version: 1,
  entities: { User: { id: 'id' } },
  operations: {
    listUsers: { id: 'listUsers', method: 'GET', path: '/users', query: ['sort', 'limit', 'offset'], response: { t: 'object', props: { items: { t: 'array', items: { t: 'entity', name: 'User' } } } } },
    createUser: {
      id: 'createUser', method: 'POST', path: '/users', body: true, response: { t: 'entity', name: 'User' },
      bodyFields: [
        { name: 'name', type: 'string', required: true, maxLength: 20 },
        { name: 'email', type: 'string', required: true, format: 'email' },
        { name: 'age', type: 'integer' },
        { name: 'role', type: 'string', enum: ['admin', 'member'], required: true },
        { name: 'newsletter', type: 'boolean' },
        { name: 'nick_name', type: 'string' },
      ],
    },
    deleteUser: { id: 'deleteUser', method: 'DELETE', path: '/users/{id}', response: null },
  },
};
const all = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: `User ${i + 1}`, email: `u${i + 1}@x.test` }));
/** A tiny backend honouring sort, limit and offset. */
const list = ({ query }) => {
  const rows = [...all];
  if (query.sort) {
    const desc = query.sort.startsWith('-');
    const key = query.sort.replace(/^-/, '');
    rows.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (desc ? -1 : 1));
  }
  const offset = Number(query.offset ?? 0);
  return { items: rows.slice(offset, query.limit ? offset + Number(query.limit) : undefined), total: all.length };
};

let screen;
afterEach(() => screen?.unmount());

describe('<xo-table>', () => {
  const html = (attrs = '', inner = '') => `<xo-view get="/users"><xo-table columns="name,email:E-mail" ${attrs}>${inner}</xo-table></xo-view>`;

  it('expands into a plain table with labelled headers and one row per item', async () => {
    screen = await mount(html(), { api: mockApi(table, { listUsers: list }) });
    expect(screen.texts('thead th')).toEqual(['name', 'E-mail']);
    expect(screen.texts('tbody tr td:first-child')).toEqual(all.map((u) => u.name));
    expect(screen.$('thead button')).toBeNull(); // not sortable unless asked
    expect(screen.$('.xo-pager')).toBeNull();
  });

  it('children become an actions cell that can call operations with the row', async () => {
    const api = mockApi(table, { listUsers: list, deleteUser: () => respond(204, null) });
    screen = await mount(html('', '<button xo-click="DELETE /users/{id}">Remove</button>'), { api });
    expect(screen.$$('tbody tr .xo-actions button')).toHaveLength(5);
    await screen.click('tbody tr:nth-child(2) button');
    expect(api.callsOf('deleteUser')[0].params).toEqual({ id: '2' });
  });

  it('sortable: a header click sorts on the server, a second click reverses, a third restores', async () => {
    const api = mockApi(table, { listUsers: list });
    screen = await mount(html('sortable'), { api });
    await screen.click('thead th:first-child button');
    expect(api.calls.at(-1).query.sort).toBe('name');
    await screen.click('thead th:first-child button');
    expect(api.calls.at(-1).query.sort).toBe('-name');
    expect(screen.texts('tbody tr td:first-child')[0]).toBe('User 5');
    await screen.click('thead th:first-child button');
    expect(screen.texts('tbody tr td:first-child')[0]).toBe('User 1'); // ascending again (served from cache)
  });

  it('page-size: requests a page, shows Next/Previous only when they apply, and returns to page one on sort', async () => {
    const api = mockApi(table, { listUsers: list });
    screen = await mount(html('page-size="2" sortable'), { api });
    expect(api.calls[0].query).toEqual({ limit: '2' });
    expect(screen.texts('tbody tr td:first-child')).toEqual(['User 1', 'User 2']);
    expect(screen.texts('.xo-pager button')).toEqual(['Next']);
    await screen.click('.xo-pager button');
    expect(api.calls.at(-1).query).toEqual({ limit: '2', offset: '2' });
    expect(screen.texts('.xo-pager button')).toEqual(['Previous', 'Next']);
    await screen.click('.xo-pager button:last-child');
    expect(screen.texts('tbody tr td:first-child')).toEqual(['User 5']);
    expect(screen.texts('.xo-pager button')).toEqual(['Previous']);
    await screen.click('.xo-pager button'); // Previous really goes back (regression: "offset-=2" was parsed as a param named "offset-")
    expect(api.calls.every((c) => !('offset-' in c.query))).toBe(true);
    expect(screen.texts('tbody tr td:first-child')).toEqual(['User 3', 'User 4']);
    await screen.click('.xo-pager button:last-child');
    await screen.click('thead th:first-child button');
    expect(api.calls.at(-1).query).toEqual({ limit: '2', offset: '0', sort: 'name' });
    expect(screen.errors).toEqual([]);
    expect(api.unhandled).toEqual([]);
  });

  it('escapes labels it receives from markup', async () => {
    screen = await mount(`<xo-view get="/users"><xo-table columns='name:<img src=x onerror=alert(1)>'></xo-table></xo-view>`, { api: mockApi(table, { listUsers: list }) });
    expect(screen.$('thead img')).toBeNull();
    expect(screen.text('thead th')).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('<xo-table> filters and custom cells', () => {
  const ft = { ...table, operations: { ...table.operations, listUsers: { ...table.operations.listUsers, query: ['sort', 'limit', 'offset', 'name'] } } };
  const byName = ({ query }) => ({ items: all.filter((u) => !query.name || u.name.includes(query.name)), total: all.length });

  it('a filter box sets the query parameter as typing pauses, and empty removes it', async () => {
    const api = mockApi(ft, { listUsers: byName });
    screen = await mount('<xo-view get="/users"><xo-table columns="name,email" filters="name"></xo-table></xo-view>', { api });
    const input = screen.$('.xo-filters input');
    expect(input.getAttribute('aria-label')).toBe('name'); // the label (default: the field name) is the accessible name
    input.value = 'User 3';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    await screen.settle();
    expect(api.calls.at(-1).query).toEqual({ name: 'User 3' });
    expect(screen.texts('tbody tr td:first-child')).toEqual(['User 3']);
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    await screen.settle();
    expect(screen.texts('tbody tr td:first-child')).toHaveLength(5);
  });

  it('a child with slot="field" replaces that column\'s cell and sees the row', async () => {
    screen = await mount('<xo-view get="/users"><xo-table columns="name,email"><b slot="email" class="mail" title="{id}">{email}!</b><button>Act</button></xo-table></xo-view>', { api: mockApi(table, { listUsers: list }) });
    expect(screen.texts('tbody tr:first-child td')).toEqual(['User 1', 'u1@x.test!', 'Act']);
    expect(screen.$('.mail').getAttribute('title')).toBe('1');
    expect(screen.$('.mail').hasAttribute('slot')).toBe(false);
  });
});

describe('<xo-toast>', () => {
  it('shows the latest xo-error from anywhere, hides on xo-done and after the timeout', async () => {
    const api = mockApi(table, { createUser: () => respond(422, { error: { code: 'bad', message: 'name is required' } }), deleteUser: () => respond(204, null), listUsers: list });
    screen = await mount('<xo-toast timeout="0.05"></xo-toast><xo-view get="/users"><xo-form op="POST /users"></xo-form></xo-view>', { api });
    const toast = () => screen.$('.xo-toast');
    expect(toast().hidden).toBe(true);
    await screen.submit('form', { name: 'A', email: 'a@x.test', role: 'admin' });
    expect(toast().hidden).toBe(false);
    expect(toast().textContent).toBe('name is required');
    await new Promise((r) => setTimeout(r, 120));
    expect(toast().hidden).toBe(true);
    screen.container.dispatchEvent(new CustomEvent('xo-error', { bubbles: true, detail: new Error('boom') }));
    expect(toast().textContent).toBe('boom');
    screen.container.dispatchEvent(new CustomEvent('xo-done', { bubbles: true }));
    expect(toast().hidden).toBe(true);
  });
});

describe('<xo-form>', () => {
  const html = '<xo-view><xo-form op="POST /users" submit="Add"></xo-form></xo-view>';

  it('generates labelled controls from the request schema', async () => {
    screen = await mount(html, { api: mockApi(table) });
    const f = (name) => screen.$(`[name="${name}"]`);
    expect(screen.texts('label > span')).toEqual(['Name', 'Email', 'Age', 'Role', 'Newsletter', 'Nick name']);
    expect([f('name').type, f('name').required, f('name').maxLength]).toEqual(['text', true, 20]);
    expect([f('email').type, f('age').type, f('newsletter').type]).toEqual(['email', 'number', 'checkbox']);
    expect(f('age').required).toBe(false);
    expect(f('role').localName).toBe('select');
    expect([...f('role').options].map((o) => o.value)).toEqual(['admin', 'member']); // required: no blank choice
    expect(screen.text('form > button')).toBe('Add');
  });

  it('sends typed values: numbers as numbers, checkbox as boolean, empty optional fields omitted', async () => {
    const api = mockApi(table, { createUser: ({ body }) => ({ id: 9, name: body.name, email: body.email }) });
    screen = await mount(html, { api });
    await screen.submit('form', { name: 'Ada', email: 'ada@x.test', age: '36', role: 'admin' });
    expect(api.callsOf('createUser')[0].body).toEqual({ name: 'Ada', email: 'ada@x.test', age: 36, role: 'admin', newsletter: false });
    screen.$('[name="newsletter"]').checked = true;
    await screen.submit('form', { name: 'Bo', email: 'b@x.test', role: 'member' });
    expect(api.callsOf('createUser')[1].body).toEqual({ name: 'Bo', email: 'b@x.test', role: 'member', newsletter: true });
  });

  it('shows server field errors beside the field, keeps the input, and clears them on the next submit', async () => {
    let bad = true;
    const api = mockApi(table, {
      createUser: ({ body }) => (bad ? respond(422, { detail: [{ loc: ['body', 'email'], msg: 'is not valid' }, { loc: ['body', 'nope'], msg: 'ignored' }] }) : { id: 9, ...body }),
    });
    screen = await mount(html, { api });
    await screen.submit('form', { name: 'Ada', email: 'x', role: 'admin' });
    expect(screen.text('.xo-error')).toBe('is not valid');
    expect(screen.$('[name="email"]').getAttribute('aria-invalid')).toBe('true');
    expect(screen.$('[name="email"]').getAttribute('aria-describedby')).toBe(screen.$('.xo-error').id);
    expect(screen.$('[name="email"]').value).toBe('x');
    bad = false;
    await screen.submit('form', { email: 'ada@x.test' });
    expect(screen.$('.xo-error')).toBeNull();
    expect(screen.$('[aria-invalid]')).toBeNull();
  });

  it('shows messages for server fields that have no input, even when other fields matched', async () => {
    const api = mockApi(table, { createUser: () => respond(422, { error: { code: 'bad', message: 'bad', fields: { email: 'taken', 'address.zip': 'too short' } } }) });
    screen = await mount(html, { api });
    await screen.submit('form', { name: 'A', email: 'a@x.test', role: 'admin' });
    expect(screen.texts('.xo-error')).toEqual(['taken', 'address.zip: too short']);
  });

  it('reports an unknown operation with the closest valid one', async () => {
    const seen = [];
    const original = console.error;
    console.error = (...a) => seen.push(a.map(String).join(' '));
    try {
      screen = await mount('<xo-view><xo-form op="POST /user"></xo-form></xo-view>', { api: mockApi(table) });
    } catch (e) {
      seen.push(String(e));
    } finally {
      console.error = original;
    }
    expect(seen.join(' ')).toMatch(/POST \/users|createUser/);
  });
});

describe('<xo-dialog>', () => {
  it('a mistyped xo-open selector is reported, not thrown from the page-wide click handler', async () => {
    const seen = [];
    const original = console.error;
    console.error = (...a) => seen.push(a.join(' '));
    try {
      screen = await mount('<button id="bad" xo-open="##">x</button><button id="none" xo-open="#nothing">y</button>', { api: mockApi(table) });
      await screen.click('#bad');
      await screen.click('#none');
    } finally { console.error = original; }
    expect(seen.join('\n')).toMatch(/not a valid selector[\s\S]*matches no <xo-dialog>/);
  });

  it('wraps its content in a native dialog, opens from xo-open, closes from xo-close', async () => {
    screen = await mount(`<button id="o" xo-open="#d">Open</button><xo-dialog id="d"><p>Hello</p><button id="c" xo-close>Cancel</button></xo-dialog>`, { api: mockApi(table) });
    const dialog = screen.$('xo-dialog > dialog');
    expect(dialog.textContent).toContain('Hello');
    expect(dialog.hasAttribute('open')).toBe(false);
    await screen.click('#o');
    expect(dialog.hasAttribute('open')).toBe(true);
    await screen.click('#c');
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('closes when a form inside it succeeds, and stays open when it fails', async () => {
    let fail = true;
    const api = mockApi(table, { createUser: ({ body }) => (fail ? respond(422, { error: { code: 'bad', message: 'no' } }) : { id: 9, ...body }) });
    screen = await mount(`<button id="o" xo-open="#d">Open</button><xo-dialog id="d"><xo-view><xo-form op="POST /users"></xo-form></xo-view></xo-dialog>`, { api });
    await screen.click('#o');
    const dialog = screen.$('dialog');
    await screen.submit('form', { name: 'A', email: 'a@x.test', role: 'admin' });
    expect(dialog.hasAttribute('open')).toBe(true);
    fail = false;
    await screen.submit('form');
    expect(dialog.hasAttribute('open')).toBe(false);
  });
});

describe('<xo-form> with fields it cannot generate', () => {
  it('warns on the console when a required field is nested or an array', async () => {
    const t = { ...table, operations: { ...table.operations, createUser: { ...table.operations.createUser, bodySkipped: [{ name: 'title', type: 'object', required: true }, { name: 'tags', type: 'array' }] } } };
    const seen = [];
    const original = console.warn;
    console.warn = (...a) => seen.push(a.join(' '));
    try { screen = await mount('<xo-view><xo-form op="POST /users"></xo-form></xo-view>', { api: mockApi(t) }); } finally { console.warn = original; }
    expect(seen.join('\n')).toMatch(/cannot generate the required field\(s\) title \(object\)/);
    expect(seen.join('\n')).not.toMatch(/tags/); // optional: no noise
  });
});
