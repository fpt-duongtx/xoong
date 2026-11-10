import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mount, mockApi } from '@xoong/test';
import { router } from '@xoong/ui';

const table = {
  version: 1,
  entities: { User: { id: 'id' } },
  operations: { getUser: { id: 'getUser', method: 'GET', path: '/users/{id}', response: { t: 'entity', name: 'User' } } },
};

let screen;
const until = async (fn, ms = 1000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return; await new Promise((r) => setTimeout(r, 5)); }
  throw new Error(`condition not met: ${fn}`);
};
const go = async (path) => { const ok = await router.navigate(path); await screen.settle(); return ok; };
const text = () => screen.text('.xo-router-root');

beforeEach(() => history.replaceState(null, '', '/'));
afterEach(() => { screen?.unmount(); history.replaceState(null, '', '/'); });

const SHELL = `<template xo-layout="shell"><nav><a href="/" id="home">Home</a> <a href="/users" id="users">Users</a></nav><main xo-outlet></main></template>`;
const APP = (extra = '', attrs = '') => `<xo-router ${attrs}>${SHELL}
  <template xo-route="/" layout="shell" title="Home"><h1>Home page</h1></template>
  <template xo-route="/users" layout="shell" title="Users"><h1>User list</h1></template>
  <template xo-route="/users/new" layout="shell"><h1>New user</h1></template>
  <template xo-route="/users/:id" layout="shell" title="User"><h1>User</h1><xo-view get="getUser" p-id=":id"><b>{name}</b></xo-view></template>
  <template xo-route="/login"><h1>Login</h1></template>
  <template xo-route="*"><h1>Not found</h1></template>${extra}
</xo-router>`;
const open = async (html = APP(), api) => {
  screen = await mount(html, { api: api ?? mockApi(table, { getUser: ({ params }) => ({ id: Number(params.id), name: `Ada ${params.id}` }) }) });
  await until(() => router.current);
  await screen.settle();
};

describe('<xo-router> matching', () => {
  it('shows the route for the current URL, sets the title, and exposes params and query', async () => {
    history.replaceState(null, '', '/users/7?tab=roles');
    await open();
    expect(screen.text('h1')).toBe('User');
    expect(screen.text('b')).toBe('Ada 7'); // p-id=":id" reached the view
    expect(document.title).toBe('User');
    expect(router.current.params).toEqual({ id: '7' });
    expect(router.current.query.get('tab')).toBe('roles');
    expect(router.current.route.pattern).toBe('/users/:id');
  });

  it('a route without a title goes back to the title the page came with (it does not keep the previous route\'s)', async () => {
    document.title = 'My admin';
    history.replaceState(null, '', '/users');
    await open();
    expect(document.title).toBe('Users');
    await go('/users/new');
    expect(document.title).toBe('My admin');
    await go('/users');
    expect(document.title).toBe('Users');
  });

  it('static routes beat parameter routes, a trailing slash is ignored, unknown paths hit the * route', async () => {
    await open();
    await go('/users/new');
    expect(screen.text('h1')).toBe('New user');
    await go('/users/9/');
    expect(screen.text('b')).toBe('Ada 9');
    await go('/nowhere/at/all');
    expect(screen.text('h1')).toBe('Not found');
    expect(router.current.route.pattern).toBe('*');
  });

  it('without a * route an unknown path shows nothing and current.route is null', async () => {
    await open('<xo-router><template xo-route="/"><p>x</p></template></xo-router>');
    await go('/zzz');
    expect(text()).toBe('');
    expect(router.current.route).toBeNull();
  });

  it('writes the URL (push), and replace does not add a history entry', async () => {
    await open();
    const before = history.length;
    await go('/users');
    expect(location.pathname).toBe('/users');
    expect(history.length).toBe(before + 1);
    await router.navigate('/login', { replace: true });
    expect(location.pathname).toBe('/login');
    expect(history.length).toBe(before + 1);
  });

  it('fires xo-navigate with to and from', async () => {
    await open();
    const seen = [];
    screen.container.addEventListener('xo-navigate', (e) => seen.push([e.detail.from?.path, e.detail.to.path]));
    await go('/users');
    expect(seen).toEqual([['/', '/users']]);
  });

  it('route content is inert until matched: no view inside an inactive route fetches', async () => {
    const api = mockApi(table, { getUser: () => ({ id: 1, name: 'x' }) });
    await open(APP(), api);
    expect(api.calls).toEqual([]); // "/" shows the home page; the /users/:id view has not started
    await go('/users/3');
    expect(api.callsOf('getUser')).toHaveLength(1);
    await go('/');
    expect(screen.$('xo-view')).toBeNull(); // leaving removes the view
  });
});

describe('<xo-router> layouts', () => {
  it('keeps the layout (same DOM node, same sidebar state) while only the outlet content changes', async () => {
    await open();
    const nav = screen.$('nav');
    nav.dataset.keep = '1';
    await go('/users');
    expect(screen.$('nav')).toBe(nav);
    expect(screen.text('main h1')).toBe('User list');
    await go('/login'); // a route without the layout drops it
    expect(screen.$('nav')).toBeNull();
    await go('/users');
    expect(screen.$('nav').dataset.keep).toBeUndefined(); // a new instance
  });

  it('nested layouts: the common outer layout stays, the inner one is swapped', async () => {
    await open(`<xo-router>
      <template xo-layout="root"><header>H</header><div xo-outlet></div></template>
      <template xo-layout="admin" layout="root"><aside>A</aside><section xo-outlet></section></template>
      <template xo-route="/a" layout="admin"><p>a</p></template>
      <template xo-route="/b" layout="root"><p>b</p></template>
    </xo-router>`);
    history.replaceState(null, '', '/');
    await go('/a');
    const header = screen.$('header');
    expect(screen.$('aside')).not.toBeNull();
    await go('/b');
    expect(screen.$('header')).toBe(header);
    expect(screen.$('aside')).toBeNull();
    expect(screen.text('.xo-router-root')).toBe('Hb');
  });

  it('reports a layout that is not declared, or has no xo-outlet', async () => {
    await open('<xo-router><template xo-route="/ok"><p>ok</p></template><template xo-route="/a" layout="nope"><p>x</p></template><template xo-route="/b" layout="bad"><p>x</p></template><template xo-layout="bad"><div></div></template></xo-router>');
    await expect(router.navigate('/a')).rejects.toThrow(/layout "nope" is not declared/);
    await expect(router.navigate('/b')).rejects.toThrow(/layout "bad" has no element with xo-outlet/);
  });

  it('an error in a navigation the page started (first load, a link click) is reported, not thrown into the void', async () => {
    const seen = [];
    const original = console.error;
    console.error = (...a) => seen.push(String(a[0]));
    try {
      history.replaceState(null, '', '/a');
      screen = await mount('<xo-router><template xo-route="/a" layout="nope"><p>x</p></template></xo-router>', { api: mockApi(table) });
      await new Promise((r) => setTimeout(r, 30));
    } finally { console.error = original; }
    expect(seen.join('\n')).toMatch(/layout "nope" is not declared/);
  });
});

describe('<xo-router> routes added later, and templates loaded from src', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  it('a route template appended after start is used on the next navigation', async () => {
    await open();
    const t = document.createElement('template');
    t.setAttribute('xo-route', '/late');
    t.innerHTML = '<h1>Late</h1>';
    document.querySelector('xo-router').append(t);
    await go('/late');
    expect(screen.text('h1')).toBe('Late');
  });

  it('fetches an empty route template from src before changing the URL, including a full document and a retry', async () => {
    const seen = [];
    let n = 0;
    globalThis.fetch = async (url) => {
      seen.push(String(url));
      n += 1;
      if (n === 2) return new Response('no', { status: 503 });
      return new Response('<!doctype html><html><body><h1>Loaded</h1></body></html>');
    };
    await open('<xo-router base="/admin" base-links><template xo-route="/" src="home.html"></template><template xo-route="/edit" src="/edit.html"></template></xo-router>');
    expect(screen.text('h1')).toBe('Loaded'); // the first navigation waits for src
    expect(seen[0]).toMatch(/\/admin\/home\.html$/);
    await expect(router.navigate('/edit')).rejects.toThrow(/503/);
    expect(location.pathname).toBe('/admin'); // a failed fetch does not move the address bar
    await go('/edit');
    expect(screen.text('h1')).toBe('Loaded');
    expect(seen.at(-1)).toMatch(/\/admin\/edit\.html$/); // base-links prefixes a root-absolute src, once
  });

  it('a failed src during a link click is reported and is not an unhandled rejection', async () => {
    const reasons = [];
    const onReject = (reason) => reasons.push(reason);
    process.on('unhandledRejection', onReject);
    globalThis.fetch = async () => new Response('no', { status: 503 });
    await open('<xo-router><template xo-route="/"><h1>Home</h1><a id="go" href="/edit">Edit</a></template><template xo-route="/edit" src="edit.html"></template></xo-router>');
    const errors = [];
    document.addEventListener('xo-error', (e) => errors.push(e.detail));
    document.querySelector('#go').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await until(() => errors.length > 0);
    await new Promise((r) => setTimeout(r, 30));
    process.removeListener('unhandledRejection', onReject);
    expect(reasons).toEqual([]);
    expect(location.pathname).toBe('/');
    expect(String(errors[0].message ?? errors[0])).toMatch(/503/);
  });

  it('editing xo-route on a template that is already compiled is seen on the next navigation', async () => {
    await open('<xo-router><template xo-route="/"><h1>Home</h1></template><template xo-route="/old"><h1>Old</h1></template></xo-router>');
    await go('/old');
    expect(screen.text('h1')).toBe('Old');
    document.querySelector('template[xo-route="/old"]').setAttribute('xo-route', '/new');
    await go('/new');
    expect(screen.text('h1')).toBe('Old');
    await go('/old');
    expect(text()).toBe('');
  });
});

describe('<xo-router> links', () => {
  // Records whether the router handled the click, then cancels it so the DOM does not really navigate (happy-dom would fetch the URL).
  const click = (el, init = {}) => {
    let defaultPrevented = false;
    const last = (ev) => { defaultPrevented = ev.defaultPrevented; ev.preventDefault(); };
    window.addEventListener('click', last, { once: true });
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }));
    window.removeEventListener('click', last);
    return { defaultPrevented };
  };

  it('intercepts same-origin link clicks, and marks the active link with aria-current', async () => {
    await open();
    expect(screen.$('#home').getAttribute('aria-current')).toBe('page');
    const e = click(screen.$('#users'));
    expect(e.defaultPrevented).toBe(true);
    await until(() => router.current.path === '/users');
    expect(screen.text('main h1')).toBe('User list');
    expect(screen.$('#users').getAttribute('aria-current')).toBe('page');
    expect(screen.$('#home').hasAttribute('aria-current')).toBe(false);
  });

  it('a link to a section is aria-current="true" while a page below it is shown', async () => {
    await open();
    await go('/users/4');
    expect(screen.$('#users').getAttribute('aria-current')).toBe('true');
    expect(screen.$('#home').hasAttribute('aria-current')).toBe(false); // "/" is never a parent section
  });

  it('xo-current keeps an author-set aria-current (on the link, a nav, or the router)', async () => {
    await open(`<xo-router><template xo-layout="shell"><nav><a id="home" href="/">Home</a> <a id="users" href="/users">Users</a></nav><main xo-outlet></main></template>
      <template xo-route="/" layout="shell"><h1>Home</h1></template>
      <template xo-route="/users" layout="shell"><h1>Users</h1></template>
      <template xo-route="/users/:id" layout="shell"><h1>User</h1></template>
      <nav xo-current><a id="pages" href="/users" aria-current="page">Pages</a></nav>
      <a id="own" href="/users" xo-current aria-current="page">Own</a>
    </xo-router>`);
    await go('/users/4');
    expect(screen.$('#pages').getAttribute('aria-current')).toBe('page');
    expect(screen.$('#own').getAttribute('aria-current')).toBe('page');
    expect(screen.$('#users').getAttribute('aria-current')).toBe('true');
  });

  it('leaves alone: modified clicks, other buttons, target, download, rel=external, other origins, in-page anchors', async () => {
    await open(APP('<a id="x1" href="/users" target="_blank">a</a><a id="x2" href="/users" download>b</a><a id="x3" href="/users" rel="external noopener">c</a><a id="x4" href="https://example.org/users">d</a><a id="x5" href="#top">e</a>'));
    for (const id of ['x1', 'x2', 'x3', 'x4', 'x5']) {
      const link = document.getElementById(id) ?? screen.$(`#${id}`);
      const e = click(link);
      expect(e.defaultPrevented, id).toBe(false);
    }
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) expect(click(screen.$('#users'), init).defaultPrevented).toBe(false);
  });
});

describe('<xo-router> behaviour borrowed from Vue Router and React Router', () => {
  it('navigating to the URL you are already on does nothing (no history entry, no re-render)', async () => {
    await open();
    await go('/users');
    screen.$('main').dataset.keep = '1';
    const entries = history.length;
    expect(await router.navigate('/users')).toBe(false);
    expect(history.length).toBe(entries);
    expect(screen.$('main').dataset.keep).toBe('1');
  });

  it('a change of the hash only does not re-render; the router state follows the URL', async () => {
    await open(APP('<template xo-route="/doc" layout="shell"><h1 id="top">Doc</h1><h2 id="part">Part</h2></template>'));
    await go('/doc');
    const heading = screen.$('#top');
    expect(await router.navigate('/doc#part')).toBe(true);
    expect(screen.$('#top')).toBe(heading); // same DOM: not rendered again
    expect(location.hash).toBe('#part');
    expect(router.current.url).toBe('/doc#part');
    expect(router.current.route.pattern).toBe('/doc');
  });

  it('a malformed escape in the URL does not break the router; the raw text is kept', async () => {
    history.replaceState(null, '', '/users/100%25%zz');
    await open();
    expect(router.current.params.id).toBe('100%25%zz'); // not decodable as a whole: kept raw, no exception
    expect(screen.text('h1')).toBe('User');
  });

  it('keeps a history position in history.state (so Back/Forward can be cancelled without losing entries)', async () => {
    await open();
    expect(history.state).toEqual({ xoPos: 0 });
    await go('/users');
    expect(history.state).toEqual({ xoPos: 1 });
    await router.navigate('/login', { replace: true });
    expect(history.state).toEqual({ xoPos: 1 });
  });
});

describe('<xo-router> base path', () => {
  it('works under a base: URLs include it, routes do not', async () => {
    history.replaceState(null, '', '/admin/users/5');
    await open(APP('', 'base="/admin"'));
    expect(screen.text('b')).toBe('Ada 5');
    expect(router.current.path).toBe('/users/5');
    await go('/users');
    expect(location.pathname).toBe('/admin/users');
    const link = screen.$('#home');
    link.setAttribute('href', '/admin/');
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await until(() => router.current.path === '/');
    expect(location.pathname).toBe('/admin');
  });
});

describe('<xo-router base-links>', () => {
  const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));

  it('a root-relative link inside the router is relative to the base: the same screens mount under any base', async () => {
    history.replaceState(null, '', '/admin-next/users');
    await open(APP('', 'base="/admin-next" base-links'));
    await go('/users');
    expect(screen.$('#users').getAttribute('href')).toBe('/admin-next/users'); // what hover and "open in a new tab" show
    expect(screen.$('#home').getAttribute('href')).toBe('/admin-next/');
    click(screen.$('#home'));
    await until(() => router.current.path === '/');
    expect(location.pathname).toBe('/admin-next');
  });

  it('a link that already has the base, rel="external", or a target is left as written; a link added later still works on click', async () => {
    history.replaceState(null, '', '/admin/users');
    await open(APP('<a id="has" href="/admin/users">a</a><a id="out" href="/logout" rel="external">b</a><a id="tab" href="/help" target="_blank">c</a>', 'base="/admin" base-links'));
    await go('/users');
    expect([screen.$('#has'), screen.$('#out'), screen.$('#tab')].map((a) => a.getAttribute('href'))).toEqual(['/admin/users', '/logout', '/help']);
    const late = document.createElement('a'); // a link a view renders after the navigation
    late.id = 'late'; late.setAttribute('href', '/users/new');
    screen.$('main').append(late);
    click(late);
    await until(() => router.current.path === '/users/new');
    expect(location.pathname).toBe('/admin/users/new');
  });

  it('without base-links nothing changes: a root link outside the base is the browser\'s', async () => {
    history.replaceState(null, '', '/admin/users');
    await open(APP('', 'base="/admin"'));
    await go('/users');
    expect(screen.$('#users').getAttribute('href')).toBe('/users');
  });
});

describe('<xo-router> guards and leaving', () => {
  it('a guard can redirect (login), cancel, or let through; redirects replace the history entry', async () => {
    await open();
    let loggedIn = false;
    const off = router.guard((to) => (to.path.startsWith('/users') && !loggedIn ? '/login' : true));
    expect(await go('/users')).toBe(true); // redirected, then shown
    expect(screen.text('h1')).toBe('Login');
    expect(location.pathname).toBe('/login');
    loggedIn = true;
    await go('/users');
    expect(screen.text('main h1')).toBe('User list');
    off();
    router.guard(() => false);
    expect(await router.navigate('/')).toBe(false);
    expect(location.pathname).toBe('/users');
  });

  it('a guard that keeps redirecting is stopped with a clear error', async () => {
    await open();
    router.guard(() => '/users');
    await expect(router.navigate('/login')).rejects.toThrow(/too many redirects/);
  });

  it('beforeNavigate can veto leaving (unsaved changes), for links and for navigate(); the screen stays', async () => {
    await open();
    await go('/users');
    let dirty = true;
    const calls = [];
    router.beforeNavigate((to, from, type) => { calls.push([from.path, to.path, type]); return !dirty; });
    expect(await router.navigate('/')).toBe(false);
    screen.$('#home').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.text('main h1')).toBe('User list');
    expect(location.pathname).toBe('/users');
    expect(calls).toEqual([['/users', '/', 'api'], ['/users', '/', 'link']]);
    dirty = false;
    expect(await router.navigate('/')).toBe(true);
  });

  it('a vetoed back/forward restores the address bar', async () => {
    await open();
    await go('/users');
    router.beforeNavigate((to, from, type) => type !== 'popstate');
    history.replaceState(null, '', '/'); // what the browser does on Back: the URL is already the previous one
    window.dispatchEvent(new PopStateEvent('popstate'));
    await new Promise((r) => setTimeout(r, 20));
    expect(location.pathname).toBe('/users'); // put back
    expect(screen.text('main h1')).toBe('User list');
  });

  it('back/forward (popstate) shows the route of the URL', async () => {
    await open();
    await go('/users');
    history.replaceState(null, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await until(() => router.current.path === '/login');
    expect(screen.text('h1')).toBe('Login');
  });

  it('Back after a url-params change: the router shows the previous query in the view', async () => {
    const api = { ...table, operations: { ...table.operations, listUsers: { id: 'listUsers', method: 'GET', path: '/users', query: ['status'], response: { t: 'array', items: { t: 'entity', name: 'User' } } } } };
    const extra = `<template xo-route="/people" title="People"><xo-view get="listUsers" url-params="status"><button id="act" xo-param="status=active">Active</button><p xo-each=".">{name}</p></xo-view></template>`;
    await open(APP(extra), mockApi(api, { listUsers: ({ query }) => [{ id: query.status === 'active' ? 2 : 1, name: query.status ?? 'all' }] }));
    await go('/people');
    expect(screen.text('p')).toBe('all');
    await screen.click('#act');
    await until(() => location.search === '?status=active');
    await screen.settle();
    expect(screen.text('p')).toBe('active');
    history.replaceState(null, '', '/people'); // what Back does to the address
    window.dispatchEvent(new PopStateEvent('popstate'));
    await until(() => router.current.url === '/people');
    await screen.settle();
    expect(screen.text('p')).toBe('all');
    expect(location.search).toBe('');
  });

  it('moves focus to the new content after a navigation (not on the first render)', async () => {
    await open();
    expect(document.activeElement?.classList?.contains('xo-layout') ?? false).toBe(false);
    await go('/users');
    expect(document.activeElement.hasAttribute('xo-outlet')).toBe(true);
  });
});
