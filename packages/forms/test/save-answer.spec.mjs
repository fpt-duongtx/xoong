// What a successful save answers decides the new baseline: the record (an object sharing properties with the request schema) replaces it,
// anything else (`{ ok: true }`, `{}`, a list, nothing) leaves what the person typed, so the form is not blanked.
import { describe, it, expect, afterEach } from 'vitest';
import { mount, mockApi } from '@xoong/test';
import '@xoong/forms';
import { createForm } from '../src/form-model.js';

const str = (extra = {}) => ({ t: 'string', ...extra });
const schema = { t: 'object', required: ['name', 'email'], props: { name: str({ minLength: 2 }), email: str({ format: 'email' }) } };
const table = {
  version: 1, entities: { User: { id: 'id' } },
  operations: {
    getUser: { id: 'getUser', method: 'GET', path: '/users/{id}', response: { t: 'entity', name: 'User' } },
    getMe: { id: 'getMe', method: 'GET', path: '/me', response: { t: 'entity', name: 'User' } },
    updateUser: { id: 'updateUser', method: 'PUT', path: '/users/{id}', body: true, response: { t: 'entity', name: 'User' }, bodySchema: schema },
    saveProfile: { id: 'saveProfile', method: 'POST', path: '/profile/save', body: true, response: null, bodySchema: schema },
  },
};
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

describe('the model: which answers become the baseline', () => {
  const saved = async (answer) => {
    const f = createForm({ schema, value: { id: 1, name: 'Ada', email: 'a@x.io' } });
    f.set('name', 'Grace');
    await f.submit(async () => answer);
    return f;
  };

  it.each([
    ['{ ok: true }', { ok: true }],
    ['an empty object', {}],
    ['an array', [{ ok: true }]],
    ['a string', 'saved'],
    ['null', null],
    ['nothing', undefined],
  ])('%s keeps the draft and makes it the baseline', async (_, answer) => {
    const f = await saved(answer);
    expect([f.dirty, f.get('name'), f.get('email'), f.baseline.name]).toEqual([false, 'Grace', 'a@x.io', 'Grace']);
  });

  it('a record (it shares properties with the schema) is the new baseline, server-owned fields included', async () => {
    const f = await saved({ id: 1, name: 'Grace H.', email: 'a@x.io', updatedAt: 'later' });
    expect([f.dirty, f.get('name'), f.baseline.updatedAt]).toEqual([false, 'Grace H.', 'later']);
  });

  it('a record with just one of the schema properties still counts', async () => {
    const f = await saved({ name: 'Grace' });
    expect(f.baseline).toEqual({ name: 'Grace' });
  });

  it('a union schema looks at the variant the answer (or the draft) names', async () => {
    const union = { t: 'union', key: 'kind', map: { card: { t: 'object', props: { kind: str(), number: str() } }, bank: { t: 'object', props: { kind: str(), iban: str() } } } };
    const f = createForm({ schema: union, value: { kind: 'card', number: '1' } });
    f.set('number', '2');
    await f.submit(async () => ({ ok: true }));
    expect([f.dirty, f.get('number')]).toEqual([false, '2']);
    f.set('number', '3');
    await f.submit(async () => ({ kind: 'card', number: '9' }));
    expect(f.get('number')).toBe('9');
  });
});

describe('an edit form whose save answers something that is not the record', () => {
  let screen;
  afterEach(() => screen?.unmount());
  const type = async (sel, v) => { const el = screen.$(sel); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); await screen.settle(); };

  it('keeps what was typed while the list of the record is refetched (PUT answers { ok: true })', async () => {
    const db = { id: 1, name: 'Ada', email: 'a@x.io' };
    const api = mockApi(table, { getUser: async () => { await tick(30); return { ...db }; }, updateUser: ({ body }) => { Object.assign(db, body); return { ok: true }; } });
    screen = await mount('<xo-view get="getUser" p-id="1"><form xo-submit="updateUser"><input name="name"><input name="email"><button>Save</button></form></xo-view>', { api });
    await type('[name=name]', 'Grace');
    screen.$('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await tick(10); // the PUT has answered, the refetch (30 ms) is still in flight
    expect([screen.$('[name=name]').value, screen.$('[name=email]').value]).toEqual(['Grace', 'a@x.io']);
    await tick(80); await screen.settle();
    expect([screen.$('[name=name]').value, screen.$('form').model.dirty]).toEqual(['Grace', false]); // the refetched record agrees
  });

  it('keeps what was typed when nothing refetches the record (POST /profile/save, GET /me)', async () => {
    const db = { id: 1, name: 'Ada', email: 'a@x.io' };
    const api = mockApi(table, { getMe: () => ({ ...db }), saveProfile: ({ body }) => { Object.assign(db, body); return { ok: true }; } });
    screen = await mount('<xo-view get="getMe"><form xo-submit="saveProfile" xo-body="."><input name="name"><input name="email"><button>Save</button></form></xo-view>', { api });
    await type('[name=name]', 'Grace');
    await screen.submit('form'); await tick(20);
    const form = screen.$('form');
    expect([screen.$('[name=name]').value, screen.$('[name=email]').value, form.model.dirty]).toEqual(['Grace', 'a@x.io', false]);
    expect(form.model.baseline.name).toBe('Grace');
    await screen.submit('form'); // saving again sends the same values, not an empty form
    expect(api.callsOf('saveProfile').map((c) => c.body)).toEqual([{ name: 'Grace', email: 'a@x.io' }, { name: 'Grace', email: 'a@x.io' }]);
    expect(screen.errors).toEqual([]);
  });

  it('an empty answer ({}) keeps the draft too, and an answer that is the record still updates the baseline', async () => {
    let answer = {};
    const api = mockApi(table, { getMe: () => ({ id: 1, name: 'Ada', email: 'a@x.io' }), saveProfile: () => answer });
    screen = await mount('<xo-view get="getMe"><form xo-submit="saveProfile" xo-body="."><input name="name"><input name="email"><button>Save</button></form></xo-view>', { api });
    await type('[name=name]', 'Grace');
    await screen.submit('form'); await tick(20);
    expect(screen.$('[name=name]').value).toBe('Grace');
    answer = { id: 1, name: 'Grace Hopper', email: 'a@x.io' };
    await type('[name=name]', 'Grace H');
    await screen.submit('form'); await tick(20);
    expect([screen.$('[name=name]').value, screen.$('form').model.baseline.name]).toEqual(['Grace Hopper', 'Grace Hopper']);
  });
});
