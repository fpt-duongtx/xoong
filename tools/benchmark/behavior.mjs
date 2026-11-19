// The second stage of the scorer: does the page WORK? The attempt's markup is mounted in happy-dom (the real runtime, only the network is replaced by a mock
// of the task's OpenAPI document), and each task's behaviour is exercised: data appears, buttons call the right operation with the right id, a form sends
// what was typed, a live event changes the list. The checks look for things the way a person would (text, button labels, field names), never for a
// class name or a selector the assistant could not know.
//
//   node tools/benchmark/behavior.mjs <task> <folder>
import { fileURLToPath } from 'node:url';

/** @type {Promise<any> | null} */
let booted = null;

/** One happy-dom window for the whole process (custom elements can only be defined once). */
async function boot() {
  const { Window } = await import('happy-dom');
  const window = new Window({ url: 'http://xoong.local/', settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true, handleDisabledFileLoadingAsSuccess: true } });
  const g = /** @type {any} */ (globalThis);
  for (const name of ['window', 'document', 'customElements', 'HTMLElement', 'Element', 'Node', 'DocumentFragment', 'Text', 'Comment', 'Event', 'CustomEvent', 'HTMLTemplateElement', 'DOMParser', 'HTMLInputElement', 'HTMLFormElement', 'HTMLSelectElement', 'MutationObserver', 'NodeFilter', 'getComputedStyle', 'history', 'localStorage', 'sessionStorage']) {
    if (name === 'window') g.window = window;
    else Object.defineProperty(g, name, { value: /** @type {any} */ (window)[name], configurable: true, writable: true });
  }
  Object.defineProperty(g, 'location', { get: () => window.location, configurable: true });
  for (const m of ['addEventListener', 'removeEventListener', 'dispatchEvent']) g[m] = /** @type {any} */ (window)[m].bind(window); // url-params listens for popstate
  await import('@xoong/data/view');
  await import('@xoong/ui');
  return { window, test: await import('@xoong/test') };
}

/** The `<body>` of a page as markup (scripts do not run: the runtime is set up by `mount`). */
function bodyOf(html, win) {
  return new win.DOMParser().parseFromString(html, 'text/html').body.innerHTML;
}

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Helpers for finding things the way a person does. */
function helpers(screen, failures) {
  const text = () => norm(screen.container.textContent);
  const buttons = () => [...screen.container.querySelectorAll('button, input[type=submit], [role=button], a')];
  const label = (b) => norm(b.textContent || b.getAttribute('aria-label') || b.value || '');
  return {
    text,
    /** Record a failure unless `ok`. */
    check: (ok, message) => { if (!ok) failures.push(message); return ok; },
    /** Buttons whose label matches. */
    buttonsLike: (re) => buttons().filter((b) => re.test(label(b))),
    /** Click like a person: when the click asks "are you sure?" (xo-confirm), say yes. */
    async act(s, el) {
      await s.click(el);
      for (let i = 0; i < 3; i++) {
        const ok = /** @type {any} */ (globalThis).document.querySelector('.xo-confirm-ok');
        if (!ok) break;
        ok.click();
        await new Promise((r) => setTimeout(r, 10));
        await s.settle();
      }
    },
    label,
    /** Fill a form by field name (or by the label/placeholder when there is no such name): returns the names it could not fill. */
    fill(form, values) {
      const missing = [];
      const fields = [...form.querySelectorAll('input, select, textarea')];
      for (const [name, value] of Object.entries(values)) {
        let el = fields.find((f) => f.getAttribute('name') === name);
        el ??= fields.find((f) => new RegExp(name, 'i').test(norm(f.getAttribute('placeholder') ?? '') + ' ' + norm(f.closest('label')?.textContent ?? '') + ' ' + norm(f.getAttribute('aria-label') ?? '')));
        if (!el) { missing.push(name); continue; }
        if (el.tagName === 'SELECT' && ![...el.options].some((o) => (o.value || o.textContent) === value)) { missing.push(`${name} (no option "${value}")`); continue; }
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return missing;
    },
  };
}

const USERS = [
  { id: 1, name: 'Ada Lovelace', email: 'ada@example.test', role: 'admin', status: 'active' },
  { id: 2, name: 'Grace Hopper', email: 'grace@example.test', role: 'member', status: 'active' },
];

/** Per task: how the page is exercised. Each returns nothing; it records failures through `check`. */
const BEHAVIOURS = {
  'small-site': async ({ mount, api, files, check, text, win }) => {
    const s = await mount(files['index.html']);
    check(/Hello xoong/.test(text()) && /Second post/.test(text()), 'index.html does not show the post titles from listPosts');
    const hrefs = s.$$('a').map((a) => a.getAttribute('href') ?? '');
    check(hrefs.some((h) => /post\.html\?id=1\b/.test(h)) && hrefs.some((h) => /post\.html\?id=2\b/.test(h)), `the titles do not link to post.html?id=<id> (links: ${hrefs.join(', ') || 'none'})`);
    s.unmount();
    // post.html: only when the id comes from the page URL declaratively; a script that sets view.params is not run here (the static stage checks the construct)
    if (files['post.html'] && /p-id\s*=\s*["']\?id["']/.test(files['post.html'])) {
      win.happyDOM.setURL('http://xoong.local/post.html?id=2');
      const api2 = api.fresh();
      const p = await mount(files['post.html'], { api: api2 });
      check(api2.callsOf('getPost').some((c) => c.params.id === '2'), 'post.html does not ask getPost for the id in the URL');
      check(/Second post/.test(norm(p.container.textContent)) && /Body two/.test(norm(p.container.textContent)), 'post.html does not show the title and body of the post');
      p.unmount();
      win.happyDOM.setURL('http://xoong.local/');
    }
  },

  'crud-admin': async ({ mount, api, files, check, text, buttonsLike, fill, act, win }) => {
    const s = await mount(files['index.html']);
    check(api.callsOf('listUsers').length >= 1, 'the page never asked for the users (listUsers)');
    check(/Ada Lovelace/.test(text()) && /grace@example\.test/.test(text()) && /member/.test(text()), 'the table does not show name, email and role of each user');
    const disable = buttonsLike(/disable/i);
    const del = buttonsLike(/delete/i);
    check(disable.length >= 2, `expected a Disable button on every row (found ${disable.length})`);
    check(del.length >= 2, `expected a Delete button on every row (found ${del.length})`);
    if (disable[0]) { await act(s, disable[0]); check(api.callsOf('disableUser').some((c) => c.params.id === '1'), 'Disable on the first row did not call disableUser with id 1'); }
    if (del[0]) { await act(s, del[0]); check(api.callsOf('deleteUser').some((c) => c.params.id === '1'), 'Delete on the first row did not call deleteUser with id 1'); }
    const form = s.$('form');
    if (check(!!form, 'there is no form to add a user')) {
      const missing = fill(form, { name: 'Cy Young', email: 'cy@example.test', role: 'admin' });
      check(missing.length === 0, `the form has no field for: ${missing.join(', ')}`);
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await s.settle();
      const sent = api.callsOf('createUser')[0]?.body;
      check(!!sent, 'submitting the form did not call createUser');
      if (sent) check(sent.name === 'Cy Young' && sent.email === 'cy@example.test' && sent.role === 'admin', `createUser got ${JSON.stringify(sent)} instead of what was typed`);
    }
    check(s.errors.length === 0, `the screen reported errors: ${JSON.stringify(s.errors.map((e) => e?.detail ?? e?.message ?? e)).slice(0, 200)}`);
    check(api.unhandled.length === 0, `calls to operations that are not in the API: ${api.unhandled.join(', ')}`);
    s.unmount(); void win;
  },

  'shared-data': async ({ mount, api, files, check, text }) => {
    const s = await mount(files['index.html']);
    check(api.callsOf('listOrders').length >= 1 && api.callsOf('listCustomers').length >= 1, 'both lists must be loaded (listOrders and listCustomers)');
    const t = text();
    check(/#?1\b.*30/.test(t) || /30/.test(t), 'the orders list does not show the order totals');
    const n = (t.match(/Ada Lovelace/g) ?? []).length;
    check(n >= 2, `the customer's name should appear in the orders list and in the customers list (found ${n} time(s))`);
    check(/ada@example\.test/.test(t), 'the customers list does not show the email');
    check(api.unhandled.length === 0, `calls to operations that are not in the API: ${api.unhandled.join(', ')}`);
    s.unmount();
  },

  'live-updates': async ({ mount, files, api, check, text, buttonsLike }) => {
    const s = await mount(files['index.html']);
    check(/Ada Lovelace/.test(text()), 'the list does not show the users');
    check(buttonsLike(/disable/i).length >= 2, 'expected a Disable button on every row');
    await s.push({ type: 'patch', entity: 'User', id: 1, path: '/name', value: 'Ada King', version: 2 });
    check(/Ada King/.test(text()), 'a patch pushed by the server was not applied to the list (is the view `live`?)');
    await s.push({ type: 'upsert', entity: 'User', id: 3, value: { id: 3, name: 'Cy Young', email: 'cy@example.test', role: 'member', status: 'active' }, version: 1 });
    void api;
    s.unmount();
  },
  'admin-table': async ({ mount, api, files, check, text, buttonsLike, fill }) => {
    const s = await mount(files['index.html']);
    const first = api.callsOf('listStaff')[0];
    check(!!first, 'the page never asked for the staff (listStaff)');
    check(first?.query?.limit === '10', `the table should ask for 10 rows per page (limit=${first?.query?.limit ?? 'none'})`);
    const rows = s.$$('tbody tr');
    check(rows.length === 2, `the table should show one row per person (found ${rows.length}, expected 2)`);
    check(/Ada Lovelace/.test(text()) && /grace@example\.test/.test(text()) && /member/.test(text()), 'the table does not show name, email and role');
    const head = s.$$('th button, th [role=button]').find((b) => /name/i.test(b.textContent ?? ''));
    if (check(!!head, 'the Name column header is not a sort control (is the table `sortable`?)')) {
      await s.click(head);
      check(api.callsOf('listStaff').some((c) => /name/.test(c.query.sort ?? '')), 'clicking the Name header did not ask for the staff sorted by name');
    }
    const search = s.$('input[type=search], input[placeholder*="earch" i], input[aria-label*="earch" i]');
    if (check(!!search, 'there is no search box (filters="name:Search")')) {
      search.value = 'ada'; search.dispatchEvent(new Event('input', { bubbles: true })); search.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 450)); await s.settle();
      check(api.callsOf('listStaff').some((c) => c.query.name === 'ada'), 'typing in the search box did not ask for the staff filtered by name');
    }
    check(buttonsLike(/add staff/i).length >= 1, 'there is no "Add staff" button');
    check(!!s.$('dialog, xo-dialog'), 'there is no dialog for the form');
    const form = s.$('form');
    if (check(!!form, 'there is no form to add a person')) {
      const missing = fill(form, { name: 'Cy Young', email: 'cy@example.test', role: 'admin' });
      check(missing.length === 0, `the form has no field for: ${missing.join(', ')}`);
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await s.settle();
      const sent = api.callsOf('createStaff')[0]?.body;
      check(!!sent, 'submitting the form did not call createStaff');
      if (sent) check(sent.name === 'Cy Young' && sent.email === 'cy@example.test' && sent.role === 'admin', `createStaff got ${JSON.stringify(sent)}`);
    }
    check(api.unhandled.length === 0, `calls to operations that are not in the API: ${api.unhandled.join(', ')}`);
    s.unmount();
  },

  'paging-filter': async ({ mount, api, files, check, text, buttonsLike }) => {
    const s = await mount(files['index.html']);
    const visible = (b) => !b.hidden && !b.closest('[hidden]');
    const first = api.callsOf('listArticles')[0];
    check(first?.query?.limit === '5', `the list should ask for 5 articles per page (limit=${first?.query?.limit ?? 'none'})`);
    check(/Article 1(?!\d)/.test(text()) && /Article 5(?!\d)/.test(text()) && !/Article 6(?!\d)/.test(text()), 'the first page should show articles 1 to 5 only');
    check(buttonsLike(/previous/i).filter(visible).length === 0, 'Previous must not be shown on the first page');
    const next = buttonsLike(/next/i).filter(visible)[0];
    if (check(!!next, 'Next must be shown when there is a later page')) {
      await s.click(next);
      check(api.callsOf('listArticles').some((c) => c.query.offset === '5'), 'Next did not ask for the page that starts at offset 5');
      check(/Article 6(?!\d)/.test(text()) && !/Article 1(?!\d)/.test(text()), 'the second page should show articles 6 to 10');
      check(buttonsLike(/previous/i).filter(visible).length === 1, 'Previous must be shown on the second page');
    }
    const draft = buttonsLike(/^draft$/i)[0];
    const published = buttonsLike(/^published$/i)[0];
    if (check(!!draft && !!published, 'there must be a Draft and a Published button')) {
      await s.click(draft);
      check(api.callsOf('listArticles').some((c) => c.query.status === 'draft'), 'Draft did not ask for the draft articles');
      await s.click(published);
      check(api.callsOf('listArticles').some((c) => c.query.status === 'published'), 'Published did not ask for the published articles');
    }
    check(api.unhandled.length === 0, `calls to operations that are not in the API: ${api.unhandled.join(', ')}`);
    s.unmount();
  },
  'edit-article': async ({ mount, api, files, check, fill, win }) => {
    win.happyDOM.setURL('http://xoong.local/edit.html?id=7'); // not the 3 of the task's example: a page that writes the id in cannot pass
    const s = await mount(files['edit.html']);
    check(api.callsOf('getArticle').some((c) => c.params.id === '7'), 'the page does not ask getArticle for the id in the page address (?id=7)');
    const form = s.$('form');
    if (check(!!form, 'there is no form')) {
      const title = form.querySelector('[name=title]');
      const body = form.querySelector('[name=body]');
      check(title?.value === 'Hello xoong', `the title field is not filled with the article's title (it holds "${title?.value ?? 'no field'}")`);
      check(body?.value === 'Body three', `the body field is not filled with the article's body (it holds "${body?.value ?? 'no field'}")`);
      const missing = fill(form, { title: 'New title' });
      check(missing.length === 0, `the form has no field for: ${missing.join(', ')}`);
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await s.settle();
      const call = api.callsOf('updateArticle')[0];
      check(!!call, 'Save did not call updateArticle');
      if (call) check(call.params.id === '7' && call.body?.title === 'New title' && call.body?.body === 'Body three', `updateArticle got id ${call.params.id} and ${JSON.stringify(call.body)} (expected id 7, the new title and the unchanged body)`);
    }
    check(api.unhandled.length === 0, `calls to operations that are not in the API: ${api.unhandled.join(', ')}`);
    s.unmount();
    win.happyDOM.setURL('http://xoong.local/');
  },

  'bulk-delete': async ({ mount, api, files, check, text, buttonsLike }) => {
    const s = await mount(files['index.html']);
    check(/Write tests/.test(text()) && /Ship it/.test(text()), 'the table does not show the task titles');
    const first = api.callsOf('listTasks')[0];
    check(first?.query?.limit === '10', `the table should ask for 10 rows per page (limit=${first?.query?.limit ?? 'none'})`);
    const boxes = s.$$('tbody input[type=checkbox]');
    check(boxes.length >= 3, `expected a checkbox on every row (found ${boxes.length})`);
    for (const b of boxes.slice(0, 2)) { b.checked = true; b.dispatchEvent(new Event('change', { bubbles: true })); b.dispatchEvent(new Event('input', { bubbles: true })); }
    await s.settle();
    const del = buttonsLike(/delete selected/i)[0]; // a table shows its bulk buttons only while rows are ticked
    if (check(!!del, 'there is no "Delete selected" button (to be shown once rows are ticked)')) {
      await s.click(del);
      const calls = api.callsOf('deleteTasks');
      check(calls.length === 1, `deleting the ticked rows should send one request (it sent ${calls.length})`);
      if (calls[0]) check(JSON.stringify([...(calls[0].body?.ids ?? [])].sort()) === '[1,2]', `deleteTasks got ${JSON.stringify(calls[0].body)} instead of the ids of the two ticked rows [1,2]`);
    }
    check(api.unhandled.length === 0, `calls to operations that are not in the API: ${api.unhandled.join(', ')}`);
    s.unmount();
  },

  'error-retry': async ({ mount, api, files, check, text, buttonsLike }) => {
    const s = await mount(files['index.html']);
    await s.settle();
    check(/Try again later/.test(text()), 'when loading fails the page does not show the message the server sent');
    check(!/Buy milk/.test(text()), 'the notes must not show while loading failed');
    const retry = buttonsLike(/retry/i)[0];
    if (check(!!retry, 'there is no Retry button when loading fails')) {
      await s.click(retry);
      await s.settle();
      check(api.callsOf('listNotes').length >= 2, 'Retry did not ask for the notes again');
      check(/Buy milk/.test(text()) && /Call Ada/.test(text()), 'after Retry works the notes are not shown');
      check(!/Try again later/.test(text()), 'the error message is still shown after Retry worked');
    }
    check(api.unhandled.length === 0, `calls to operations that are not in the API: ${api.unhandled.join(', ')}`);
    s.unmount();
  },
};

/** The mock handlers of every task, in one place. */
function handlersOf(task, respond) {
  const POSTS = [{ id: 1, title: 'Hello xoong', author: 'Ada', body: 'Body one' }, { id: 2, title: 'Second post', author: 'Grace', body: 'Body two' }];
  const users = () => USERS.map((u) => ({ ...u }));
  const common = { listUsers: () => ({ items: users(), total: 2 }), createUser: ({ body }) => ({ id: 3, status: 'active', ...body }), disableUser: ({ params }) => ({ ...users().find((u) => String(u.id) === params.id), status: 'disabled' }), deleteUser: () => respond(204, null), getUser: ({ params }) => users().find((u) => String(u.id) === params.id) };
  const per = {
    'small-site': { listPosts: () => POSTS.map((p) => ({ ...p })), getPost: ({ params }) => ({ ...POSTS.find((p) => String(p.id) === params.id) }) },
    'crud-admin': common,
    'live-updates': common,
    'admin-table': {
      listStaff: ({ query }) => {
        let items = [{ id: 1, name: 'Ada Lovelace', email: 'ada@example.test', role: 'admin' }, { id: 2, name: 'Grace Hopper', email: 'grace@example.test', role: 'member' }];
        if (query.name) items = items.filter((p) => p.name.toLowerCase().includes(query.name.toLowerCase()));
        return { items, total: items.length };
      },
      createStaff: ({ body }) => ({ id: 3, ...body }),
    },
    'paging-filter': {
      listArticles: ({ query }) => {
        const all = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, title: `Article ${i + 1}`, status: i % 2 ? 'published' : 'draft' }));
        const rows = query.status ? all.filter((a) => a.status === query.status) : all;
        const limit = Number(query.limit ?? 10);
        const offset = Number(query.offset ?? 0);
        return { items: rows.slice(offset, offset + limit), total: rows.length };
      },
    },
    'edit-article': {
      getArticle: ({ params }) => ({ id: Number(params.id), title: 'Hello xoong', body: 'Body three' }),
      updateArticle: ({ params, body }) => ({ id: Number(params.id), ...body }),
    },
    'bulk-delete': {
      listTasks: ({ query }) => { const all = [{ id: 1, title: 'Write tests', done: true }, { id: 2, title: 'Ship it', done: false }, { id: 3, title: 'Rest', done: false }]; return { items: all.slice(Number(query.offset ?? 0), Number(query.offset ?? 0) + Number(query.limit ?? 10)), total: all.length }; },
      deleteTasks: () => respond(204, null),
    },
    'error-retry': (() => { let n = 0; return { listNotes: () => (n++ === 0 ? respond(503, { error: { code: 'unavailable', message: 'Try again later' } }) : [{ id: 1, text: 'Buy milk' }, { id: 2, text: 'Call Ada' }]) }; })(),
    'shared-data': {
      listOrders: () => ({ items: [{ id: 1, total: 30, customer: { id: 7, name: 'Ada Lovelace', email: 'ada@example.test' } }, { id: 2, total: 45, customer: { id: 8, name: 'Grace Hopper', email: 'grace@example.test' } }] }),
      listCustomers: () => [{ id: 7, name: 'Ada Lovelace', email: 'ada@example.test' }, { id: 8, name: 'Grace Hopper', email: 'grace@example.test' }],
    },
  };
  return per[task];
}

/**
 * Exercise an attempt. `files` maps a file name to its text. Returns the failures (empty = the page works).
 * @param {string} taskName
 * @param {Record<string, string>} files
 * @param {any} table  operations.json of the task's API
 * @param {Record<string, Function>} [extra]  behaviours of tasks defined outside this file
 */
export async function behave(taskName, files, table, extra = {}) {
  const run = BEHAVIOURS[taskName] ?? extra[taskName];
  if (!run) return [];
  booted ??= boot();
  const { window, test } = await booted;
  const clean = () => { window.happyDOM.setURL('http://xoong.local/'); window.document.body.innerHTML = ''; }; // every attempt starts from a clean page and URL (url-params writes to the history)
  clean();
  /** @type {string[]} */ const failures = [];
  const make = () => test.mockApi(table, handlersOf(taskName, test.respond));
  const api = make();
  const bodies = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, bodyOf(v, window)]));
  const help = helpers({ container: /** @type {any} */ (globalThis).document.body }, failures);
  // an exception thrown later by an effect or a timer of the attempt's page is a finding about the page, not a crash of the scorer
  const thrown = (error) => failures.push(`the page threw an error while it ran: ${String(error?.message ?? error).slice(0, 160)}`);
  process.on('uncaughtException', thrown);
  process.on('unhandledRejection', thrown);
  try {
    await run({
      mount: (html, opts = {}) => test.mount(html, { api: opts.api ?? api }),
      api: Object.assign(api, { fresh: make }),
      files: bodies, rawFiles: files, win: window, respond: test.respond, table,
      ...help,
    });
  } catch (error) {
    failures.push(`the page could not be exercised: ${/** @type {Error} */ (error).message}`);
  }
  await new Promise((r) => setTimeout(r, 20)); // let a late error land before the handlers go
  process.off('uncaughtException', thrown);
  process.off('unhandledRejection', thrown);
  clean();
  return [...new Set(failures)];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [name, dir] = process.argv.slice(2);
  if (!name || !dir) { console.error('usage: node tools/benchmark/behavior.mjs <task> <folder>'); process.exit(2); }
  const { score } = await import('./score.mjs');
  const r = await score(name, dir);
  console.log(JSON.stringify({ task: name, staticPass: r.pass, behaviour: r.behaviour }, null, 2));
}
