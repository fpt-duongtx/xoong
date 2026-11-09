import { describe, it, expect, afterEach } from 'vitest';
import { configure } from '@xoong/data';
import { mount, mockApi } from '@xoong/test';

const table = {
  version: 1,
  entities: { User: { id: 'id' } },
  operations: { getMe: { id: 'getMe', method: 'GET', path: '/me', response: { t: 'entity', name: 'User' } } },
};
let screen;
afterEach(() => screen?.unmount());
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
/** An API whose answer can be changed and held back; records the signal of every request. */
function backend() {
  const state = { who: 'Ada', hold: false, gates: [], signals: [] };
  const api = mockApi(table, { getMe: async () => { const who = state.who; if (state.hold) { const g = Promise.withResolvers(); state.gates.push(g); await g.promise; } return { id: 1, name: who }; } });
  const inner = api.fetch;
  api.fetch = (url, init) => { state.signals.push(init?.signal); return inner(url, init); };
  return { api, state };
}

describe('client.reset() (logout, another user)', () => {
  it('drops the cache: a view mounted afterwards asks the server instead of showing the previous user', async () => {
    const { api, state } = backend();
    screen = await mount('<xo-view get="getMe"><b>{name}</b></xo-view>', { api });
    expect(screen.text('b')).toBe('Ada');
    screen.container.innerHTML = ''; // the screen goes away; the query stays cached (gcTime is long)
    state.who = 'Bob';
    screen.client.reset();
    expect(screen.client.size).toBe(0);
    screen.container.innerHTML = '<xo-view get="getMe"><b>{name}</b></xo-view>';
    expect(screen.text('b')).toBe('{name}'); // nothing of the old user at the first paint
    await screen.settle(); await wait();
    expect(screen.text('b')).toBe('Bob');
    expect(api.callsOf('getMe')).toHaveLength(2);
  });
  it('a view that is on screen is fetched again, and the entity store is emptied', async () => {
    const { api, state } = backend();
    screen = await mount('<xo-view get="getMe"><b>{name}</b></xo-view>', { api });
    state.who = 'Bob';
    screen.client.reset();
    expect(screen.client.store.has({ $ref: 'User#1' })).toBe(false);
    await screen.settle(); await wait();
    expect(screen.text('b')).toBe('Bob');
    expect(api.callsOf('getMe')).toHaveLength(2);
  });
  it('requests in flight are cancelled, and an answer that comes anyway is not stored', async () => {
    const { api, state } = backend();
    state.hold = true;
    const client = configure({ api: api.table, fetch: api.fetch, retry: 0, gcTime: Infinity });
    const box = document.createElement('div');
    document.body.append(box);
    box.innerHTML = '<xo-view get="getMe"><b>{name}</b></xo-view>';
    await wait();
    expect(client.pending).toBe(1);
    const old = state.signals[0];
    expect(old.aborted).toBe(false);
    state.who = 'Bob';
    client.reset(); // the old request is cancelled; the view asks again
    expect(old.aborted).toBe(true);
    state.gates[1].resolve(); await wait(30); // the new answer arrives first, the cancelled request's answer (a fetch that ignores the signal) after it
    state.gates[0].resolve(); await wait(60);
    expect(box.querySelector('b').textContent).toBe('Bob');
    expect(state.signals).toHaveLength(2);
    expect(client.pending).toBe(0);
    box.remove();
  });
});
