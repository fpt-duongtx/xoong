// This file must not call configure() anywhere else: the point is a page whose module awaits something before it does.
import { it, expect, vi } from 'vitest';
import { configure } from '@xoong/data';
import '@xoong/data/view';
import { mockApi } from '@xoong/test';

const table = { version: 1, entities: { User: { id: 'id' } }, operations: { getMe: { id: 'getMe', method: 'GET', path: '/me', response: { t: 'entity', name: 'User' } } } };
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));

it('a view that starts before configure() waits for it (a module that awaits before configuring), and says so if it takes long', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.useFakeTimers({ toFake: ['setTimeout'] }); // the "still waiting" message is on a timer started by the first waiting view
  container.innerHTML = '<xo-view get="getMe"><b>{name}</b></xo-view>';
  for (let i = 0; i < 5; i++) await Promise.resolve();
  expect(container.querySelector('b').textContent).toBe('{name}'); // not started, and nothing threw
  expect(errors).not.toHaveBeenCalled();
  vi.advanceTimersByTime(3500); // the page has been waiting a while: one clear message, no exception
  vi.useRealTimers();
  expect(errors).toHaveBeenCalledTimes(1);
  expect(String(errors.mock.calls[0][0])).toContain('configure(');
  errors.mockRestore();

  const api = mockApi(table, { getMe: () => ({ id: 1, name: 'Ada' }) });
  configure({ api: api.table, fetch: api.fetch, retry: 0 }); // the awaited work is done
  await wait(60);
  expect(container.querySelector('b').textContent).toBe('Ada');
  expect(api.callsOf('getMe')).toHaveLength(1);
  container.remove();
});
