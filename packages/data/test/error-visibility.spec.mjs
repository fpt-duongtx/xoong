import { describe, it, expect, afterEach, vi } from 'vitest';
import { mount, mockApi, respond } from '@xoong/test';
import '@xoong/ui';
import { setFormat } from '@xoong/data/view';
import { format } from '../src/format.js';

const table = {
  version: 1,
  entities: { Person: { id: 'id' } },
  operations: { listPeople: { id: 'listPeople', method: 'GET', path: '/people', response: { t: 'object', props: { items: { t: 'array', items: { t: 'entity', name: 'Person' } } } } } },
};
let screen;
afterEach(() => { screen?.unmount(); vi.restoreAllMocks(); });
const failing = (status, body = { title: 'Broken', detail: 'The database is down' }) => ({ listPeople: () => respond(status, body) });
const wait = (ms = 80) => new Promise((r) => setTimeout(r, ms));

describe('a failed read is never silent', () => {
  it('a view without $error markup tells the person with xo-error (what <xo-toast> shows)', async () => {
    const seen = [];
    document.addEventListener('xo-error', (e) => seen.push(e.detail.status), { once: true });
    screen = await mount('<xo-view get="listPeople"><ul><li xo-each="items">{name}</li></ul></xo-view>', { api: mockApi(table, failing(500)) });
    await wait();
    expect(seen).toEqual([500]);
  });

  it('a view that shows $error itself marks the event handled (no toast on top of it); so does a 401, which is left to onUnauthorized', async () => {
    const seen = [];
    const on = (e) => seen.push([e.detail.status, e.handled]);
    document.addEventListener('xo-error', on);
    try {
      screen = await mount('<xo-view get="listPeople"><p xo-if="$error" role="alert">{$error.detail}</p></xo-view>', { api: mockApi(table, failing(500)) });
      await wait();
      expect(screen.text('p')).toBe('The database is down');
      screen.unmount();
      screen = await mount('<xo-view get="listPeople"><ul><li xo-each="items">{name}</li></ul></xo-view>', { api: mockApi(table, failing(401, { title: 'Unauthorized' })) });
      await wait();
      expect(seen).toEqual([[500, true], [401, true]]);
    } finally { document.removeEventListener('xo-error', on); }
  });

  it('without an onError handler a server failure is written to the console; a 404 (an expected answer) is not', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    screen = await mount('<xo-view get="listPeople"><p xo-if="$error">x</p></xo-view>', { api: mockApi(table, failing(500)) });
    await wait();
    expect(error.mock.calls.some((c) => String(c[0]).includes('listPeople failed (500)'))).toBe(true);
    error.mockClear();
    screen.unmount();
    screen = await mount('<xo-view get="listPeople"><p xo-if="$error">x</p></xo-view>', { api: mockApi(table, failing(404, { title: 'Not found' })) });
    await wait();
    expect(error.mock.calls.filter((c) => String(c[0]).includes('failed'))).toEqual([]);
  });
});

describe('a format that throws says so once and shows the plain value', () => {
  it('logs one error naming the format', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    setFormat('boom', () => { throw new Error('bad input'); });
    expect(format('boom', 5)).toBe('5');
    expect(format('boom', 6)).toBe('6');
    expect(error.mock.calls.filter((c) => String(c[0]).includes('"boom" threw'))).toHaveLength(1);
  });
});

describe('a screen can handle the error itself', () => {
  it('xo-error from a view is cancelable and carries the XoongError; preventDefault keeps <xo-toast> quiet, even from a listener on the document', async () => {
    const mine = [];
    const on = (e) => { mine.push([e.detail.status, e.cancelable, e.handled]); e.preventDefault(); };
    document.addEventListener('xo-error', on);
    try {
      screen = await mount('<xo-toast></xo-toast><xo-view id="v" get="listPeople"><ul><li xo-each="items">{name}</li></ul></xo-view>', { api: mockApi(table, failing(500)) });
      await wait();
      expect(mine[0]).toEqual([500, true, false]);
      expect(screen.$('.xo-toast').hidden).toBe(true); // handled: no toast
      expect(screen.$('#v').error?.status).toBe(500);
    } finally { document.removeEventListener('xo-error', on); }
  });

  it('without a handler the toast shows it; a view that shows $error marks the event handled (no double report); a 401 is handled too', async () => {
    screen = await mount('<xo-toast></xo-toast><xo-view get="listPeople"><ul><li xo-each="items">{name}</li></ul></xo-view>', { api: mockApi(table, failing(500)) });
    await wait();
    expect(screen.$('.xo-toast').hidden).toBe(false);
    screen.unmount();
    const handled = [];
    document.addEventListener('xo-error', (e) => handled.push(e.handled), { once: true });
    screen = await mount('<xo-toast></xo-toast><xo-view get="listPeople"><p xo-if="$error">{$error.detail}</p></xo-view>', { api: mockApi(table, failing(500)) });
    await wait();
    expect(handled).toEqual([true]);
    expect(screen.$('.xo-toast').hidden).toBe(true);
    screen.unmount();
    screen = await mount('<xo-toast></xo-toast><xo-view get="listPeople"><ul><li xo-each="items">{name}</li></ul></xo-view>', { api: mockApi(table, failing(401, { title: 'Unauthorized' })) });
    await wait();
    expect(screen.$('.xo-toast').hidden).toBe(true);
  });

  it('an action error is cancelable too, and a listener on the button handles it before the toast', async () => {
    const api = { version: 1, entities: {}, operations: { disable: { id: 'disable', method: 'POST', path: '/disable', response: { t: 'object', props: {} } } } };
    screen = await mount('<xo-toast></xo-toast><xo-view><button id="b" xo-click="disable">Go</button></xo-view>', { api: mockApi(api, { disable: () => respond(409, { title: 'Conflict', detail: 'Already disabled' }) }) });
    const seen = [];
    screen.$('#b').addEventListener('xo-error', (e) => { seen.push([e.cancelable, e.detail.status]); e.preventDefault(); });
    screen.$('#b').click();
    await wait();
    expect(seen).toEqual([[true, 409]]);
    expect(screen.$('.xo-toast').hidden).toBe(true);
  });
});
