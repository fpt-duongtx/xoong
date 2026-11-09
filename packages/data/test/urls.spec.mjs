import { describe, it, expect, afterEach, vi } from 'vitest';
import { mount, mockApi } from '@xoong/test';

const table = {
  version: 1,
  entities: { User: { id: 'id' } },
  operations: {
    getMe: { id: 'getMe', method: 'GET', path: '/me', response: null },
    createUser: { id: 'createUser', method: 'POST', path: '/users', body: true, response: { t: 'entity', name: 'User' } },
  },
};
let screen;
let spy;
afterEach(() => { screen?.unmount(); spy?.mockRestore(); spy = undefined; });
const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('image URLs: data: and blob: are for pictures only', () => {
  it('<img src> accepts data:image/(png|jpeg|gif|webp|avif) and blob: URLs', async () => {
    const urls = [PNG, 'data:image/jpeg;base64,/9j/4AAQ', 'data:image/gif;base64,R0lGOD', 'data:image/webp;base64,UklGR', 'data:image/avif;base64,AAAA', 'blob:http://localhost:3000/1234-abcd'];
    screen = await mount('<xo-view get="getMe"><img xo-each="urls" src="{.}" alt=""></xo-view>', { api: mockApi(table, { getMe: () => ({ urls }) }) });
    expect(screen.$$('img').map((i) => i.getAttribute('src'))).toEqual(urls);
  });
  it('<xo-image src> takes a data: image as well', async () => {
    screen = await mount('<xo-view get="getMe"><xo-image src="{thumb}" alt=""></xo-image></xo-view>', { api: mockApi(table, { getMe: () => ({ thumb: PNG }) }) });
    expect(screen.$('xo-image').getAttribute('src')).toBe(PNG);
  });
  it('everything else stays blocked: svg and html data URLs, javascript:, and data:/blob: on links and other attributes', async () => {
    const bad = ['data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html,<script>alert(1)</script>', 'data:application/javascript,alert(1)', 'javascript:alert(1)', ' JaVa\tScript:alert(1)', 'vbscript:x'];
    const urls = [...bad, PNG, 'blob:http://localhost:3000/1'];
    screen = await mount('<xo-view get="getMe"><img xo-each="bad" src="{.}" alt=""><a xo-each="urls" href="{.}">x</a><form action="{frame}"></form></xo-view>', { api: mockApi(table, { getMe: () => ({ bad, urls, frame: PNG }) }) });
    expect(screen.$$('img').map((i) => i.getAttribute('src'))).toEqual(bad.map(() => 'about:blank'));
    expect(screen.$$('a').map((a) => a.getAttribute('href'))).toEqual(urls.map(() => 'about:blank')); // not a picture: data: and blob: stay blocked
    expect(screen.$('form').getAttribute('action')).toBe('about:blank');
  });
});

describe('xo-then goes to this site only', () => {
  const run = async (next) => {
    spy?.mockRestore();
    spy = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    screen = await mount('<xo-view><form xo-submit="createUser" xo-then="{next}"><input name="name" value="N"><button>go</button></form></xo-view>', { api: mockApi(table, { createUser: () => ({ id: 9, name: 'N', next }) }) });
    screen.$('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await screen.settle(); await wait(30);
    errors.mockRestore();
    return spy.mock.calls.map((c) => c[0]);
  };
  it('a relative path and a same-origin URL are followed', async () => {
    expect(await run('/users/9')).toEqual(['/users/9']);
    screen.unmount();
    const own = `${window.location.origin}/users/9`;
    expect(await run(own)).toEqual([own]);
  });
  it('javascript:, data:, another origin and protocol-relative targets are not', async () => {
    for (const next of ['javascript:alert(document.domain)', ' JaVaScRiPt:alert(1)', 'data:text/html,<b>x</b>', 'https://evil.example/phish', '//evil.example/x', '/\\evil.example/x']) {
      expect(await run(next), next).toEqual([]);
      screen.unmount();
    }
  });
});
