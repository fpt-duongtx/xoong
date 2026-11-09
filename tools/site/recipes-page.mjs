// The "Recipes" page: what xoong does not do for you, and the few lines that do it. Every snippet was run against the current packages by the edge-case scan
// (see CHANGELOG "Unreleased"); a note says when a detail was not exercised. What is planned or only partly handled is under "Known limits", not hidden.
import { tabs } from './lib.mjs';

const js = (label, src) => tabs(label, [['JavaScript', 'js', src]]);
const html = (label, src) => tabs(label, [['HTML', 'html', src]]);

export const recipesPage = {
  file: 'recipes.html', section: 'docs', group: 'Extend', nav: 'Recipes', title: 'Recipes',
  description: 'What xoong leaves to you and the few lines that do it: load more, polling, token refresh, uploads, wizards, autosave, routes and deployment.',
  body: `
<h1>Recipes</h1>
<p class="lead">xoong covers the common path with attributes and stays small, so some things are left to you: polling, a wizard, a token refresh. None needs a plugin; each is a few lines on the public API. They were all run against the current packages, and the places where a detail was not exercised are said so.</p>
<p>Names used below: <code>getClient()</code> and <code>configure()</code> from <code>@xoong/data</code>, <code>setFormat()</code> from <code>@xoong/data/view</code>, <code>router</code> from <code>@xoong/ui</code>, <code>setLocale()</code> from <code>@xoong/i18n</code>. A form's <code>model</code> is the form element's own model (<code>form.model.get / set / body / reset / validate / touch</code>).</p>

<h2>Lists and refreshing</h2>
<h3>Load more with a cursor</h3>
<p><code>&lt;xo-view&gt;</code> replaces its rows when a parameter changes, which is right for pages and wrong for "Load more". Keep the rows yourself and ask the client for the next cursor.</p>
${js('Load more', `
import { XoElement, define } from '@xoong/core';
import { getClient } from '@xoong/data';

class LoadMore extends XoElement {
  #rows = []; #next;
  connected() {
    this.innerHTML = '<ul></ul><button type="button">More</button>';
    this.querySelector('button').onclick = () => this.more();
    this.more();
  }
  async more() {
    const page = await getClient().load('listUsers', this.#next ? { cursor: this.#next } : {});
    this.#next = page.next;
    this.#rows.push(...page.items);
    this.querySelector('ul').replaceChildren(...this.#rows.map((r) => Object.assign(document.createElement('li'), { textContent: r.name })));
    this.querySelector('button').hidden = !this.#next;
  }
}
define('x-load-more', LoadMore);`)}

<h3>Polling</h3>
<p>There is no refresh interval attribute. A view has <code>refresh()</code>; call it on a timer, and not while the tab is hidden.</p>
${js('Polling', `
const view = document.querySelector('#orders');           // an <xo-view>
setInterval(() => { if (!document.hidden) view.refresh(); }, 30_000);`)}

<h3>Refetch when the person comes back</h3>
${js('Focus and online', `
import { getClient } from '@xoong/data';

for (const type of ['focus', 'online']) window.addEventListener(type, () => getClient().invalidateAll());`)}

<h3>Pushed updates: WebSocket, and SSE with a header</h3>
<p>For a server that pushes events (<code>upsert</code>, <code>delete</code>, <code>resync</code>), <code>live</code> on a view uses the browser's EventSource. For anything else, feed the same events to the store yourself.</p>
${js('WebSocket', `
const ws = new WebSocket('wss://example.org/events');
ws.onmessage = (message) => {
  const event = JSON.parse(message.data);
  if (event.type === 'resync') getClient().invalidateAll();       // lost track: refetch what is on screen
  else getClient().store.applyEvent(event);                       // upsert or delete of one record
};`)}
${js('SSE with an Authorization header', `
import { connectStream, getClient } from '@xoong/data';
import { EventSourcePolyfill } from 'event-source-polyfill';       // the native EventSource cannot send headers

connectStream({ client: getClient(), url: '/events', EventSource: EventSourcePolyfill });`)}
<p>A record pushed with an id the store already knows updates every view that shows it. A <em>new</em> record does not appear in a list that is already loaded; ask the list to refetch (<code>invalidateAll()</code> or a <code>resync</code> event).</p>

<h2>Sign-in</h2>
<h3>Refresh the token and retry once</h3>
<p>Wrap <code>fetch</code>: on a 401, refresh and send the request again; give up to <code>onUnauthorized</code>. If several requests fail together, share one refresh promise (not exercised here).</p>
${js('Token refresh', `
import { configure } from '@xoong/data';
import { router } from '@xoong/ui';

configure({
  api, baseUrl: '/api',
  headers: () => ({ authorization: \`Bearer \${token}\` }),
  fetch: async (url, init) => {
    let response = await fetch(url, init);
    if (response.status === 401 && (await refresh().then(() => true, () => false))) {
      response = await fetch(url, { ...init, headers: { ...init.headers, authorization: \`Bearer \${token}\` } });
    }
    return response;
  },
  onUnauthorized: () => router.navigate('/login'),
});`)}

<h3>Keep pages behind a sign-in</h3>
<p>Mark the routes in markup, and let one guard decide. A guard returns <code>true</code>, <code>false</code>, or a path to go to.</p>
${html('Marked routes', `
<template xo-route="/billing" layout="shell" title="Billing" data-auth>...</template>`)}
${js('Guard', `
router.guard((to) => (to.route?.template.hasAttribute('data-auth') && !signedIn() ? '/login' : true));`)}
<h3>Sign out</h3>
<p>The client keeps what it fetched, so after a sign-out in the same tab a view that is mounted again would show the previous person's data at once. <code>getClient().reset()</code> aborts the requests in flight and drops every cached query and record; views that are mounted fetch again. Call it when the person signs out, or leave the page, which also starts with an empty cache.</p>
${js('Sign out', `
import { getClient } from '@xoong/data';
import { router } from '@xoong/ui';

async function signOut() {
  await fetch('/api/logout', { method: 'POST' });
  getClient().reset();                       // nothing of this person stays in memory
  router.navigate('/login');
}`)}

<h2>Files</h2>
<h3>Upload progress</h3>
<p>The generated form sends files with <code>fetch</code>, which cannot report progress. For a big upload send the request yourself and drive the file control's <code>progress</code>.</p>
${js('XHR into <xo-file>', `
const xhr = new XMLHttpRequest();
xhr.open('POST', '/api/files');
xhr.upload.onprogress = (event) => { fileControl.progress = event.loaded / event.total; };
xhr.onloadend = () => { fileControl.progress = null; };
xhr.send(formData);`)}

<h3>Download a CSV or PDF</h3>
<p>Views and actions expect JSON, so a file is not one of their operations. With cookie authentication a plain link is enough; the router leaves <code>download</code> links alone.</p>
${html('Link', `<a href="/api/export.csv" download>Export CSV</a>`)}
<p>With a header-based token, fetch it and hand the browser a blob.</p>
${js('Fetch and save', `
const response = await fetch('/api/export.csv', { headers: authHeaders() });
const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(await response.blob()), download: 'export.csv' });
document.body.append(link);
link.click();
link.remove();`)}

<h2>Forms</h2>
<h3>A wizard</h3>
<p>One form, several steps: show one group of fields at a time and validate only that group before moving on.</p>
${js('Steps', `
const STEPS = [['name', 'email'], ['plan'], ['card.number']];     // the field paths of each step
async function next(form, i) {
  const errors = await form.model.validate();
  STEPS[i].forEach((path) => form.model.touch(path));             // show the messages of this step
  if (!STEPS[i].some((path) => errors[path])) show(i + 1);
}`)}

<h3>Autosave a draft</h3>
${js('localStorage', `
form.addEventListener('input', () => { localStorage.draft = JSON.stringify(form.model.body()); });

// on load
if (localStorage.draft) for (const [path, value] of Object.entries(JSON.parse(localStorage.draft))) form.model.set(path, value);`)}

<h3>Reset a form in a dialog when it closes</h3>
${js('Dialog close', `
form.closest('xo-dialog').dialog.addEventListener('close', () => form.model.reset());`)}

<h3>Leave out fields that do not apply, or send only what changed</h3>
<p>A field hidden with <code>xo-if</code> is still part of the draft and is sent. <code>serialize</code> shapes the body just before the request.</p>
${js('serialize', `
// drop a field that is hidden for this kind
form.serialize = (draft, body) => (body.kind === 'company' ? body : (({ vat, ...rest }) => rest)(body));

// PATCH: only the top-level fields the person changed
form.serialize = (draft, body) => Object.fromEntries(Object.entries(body).filter(([key]) => form.model.dirtyAt[key]));`)}

<h3>Field errors from other backends</h3>
<p>The form reads field errors from RFC 9457 problem details, FastAPI and <code>{ error: { fields } }</code>. If your backend answers another shape, rewrite it in the <code>fetch</code> wrapper so the message lands on the input.</p>
${js('Rewrite a 422', `
configure({ api, baseUrl: '/api', fetch: async (url, init) => {
  const response = await fetch(url, init);
  if (response.status !== 422) return response;
  const body = await response.clone().json();                      // { message, errors: { email: ['has already been taken'] } }
  const errors = Object.entries(body.errors ?? {}).flatMap(([field, messages]) => [].concat(messages).map((detail) => ({ pointer: '/' + field, detail })));
  return new Response(JSON.stringify({ title: body.message ?? 'Invalid', errors }), { status: 422, headers: { 'content-type': 'application/problem+json' } });
} });`)}

<h2>Routing</h2>
<h3>A 404 inside a section</h3>
<p>A route is matched exactly, so <code>/admin/nope</code> falls to the page's <code>*</code> route outside the admin layout. Send unknown paths under a prefix to a real not-found route inside it.</p>
${js('Per-section 404', `
router.guard((to) => (to.route?.pattern === '*' && to.path.startsWith('/admin/') ? '/admin/not-found' : true));
// and <template xo-route="/admin/not-found" layout="admin">...</template>`)}

<h3>Any depth: a splat route</h3>
<p>Use the <code>*</code> route for a wiki-like tree and read the path yourself: <code>router.current.path</code>.</p>
<h3>Hash routing</h3>
<p>Not offered: routes are real paths. Make the host answer every path with the app's HTML (<code>xoong dev --spa</code> does it while you work; on a static host copy <code>index.html</code> to <code>404.html</code>, or use the host's rewrite rule).</p>

<h2>Language, formats and time</h2>
${js('Your own formats', `
import { setFormat } from '@xoong/data/view';

setFormat('currency', (value, locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(value));
setFormat('epoch', (value) => new Date(value * 1000).toISOString());       // {created | epoch}`)}
<h3>Data that depends on the language</h3>
${js('Locale and data', `
configure({ api, baseUrl: '/api', headers: () => ({ 'accept-language': document.documentElement.lang }) });

await setLocale('vi');
getClient().invalidateAll();                                      // fetch again in the new language`)}
<h3>Another sort convention</h3>
<p><code>sortable</code> speaks <code>sort=field</code> and <code>sort=-field</code>. For <code>orderBy</code> and <code>dir</code>, or <code>sort=name:desc</code>, use <code>xo-param</code> buttons.</p>
${html('xo-param', `
<button xo-param="orderBy=name">Name</button>
<button xo-param="sort=name:desc">Name, descending</button>`)}
<h3>A time that ticks</h3>
<p>A filter such as <code>{created | relative}</code> is computed once. For "3 minutes ago" that keeps counting, write a small element that repaints on a timer.</p>
${js('Ticking time', `
import { XoElement, define } from '@xoong/core';

class TimeAgo extends XoElement {
  static props = { at: String };
  connected() {
    const paint = () => { this.textContent = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(Math.round((new Date(this.at) - Date.now()) / 60000), 'minute'); };
    this.effect(paint);                                           // read \`this.at\` inside the effect: the attribute is bound after the element connects
    this.timer = setInterval(paint, 30_000);
  }
  disconnected() { clearInterval(this.timer); }
}
define('x-time-ago', TimeAgo);`)}
<h3>Two backends</h3>
${js('Route by path', `
configure({ api, baseUrl: '', fetch: (url, init) => fetch((String(url).startsWith('/auth/') ? 'https://auth.example.com' : 'https://api.example.com') + url, init) });`)}

<h2>Deployment</h2>
<h3>Caching</h3>
<p>Built files keep their names (nothing is hashed), so a browser can keep an old module next to a new page. Serve the built files with <code>Cache-Control: no-cache</code> and an ETag, which makes the browser ask each time and download only what changed. A tab that stays open during a deploy can still mix old and new modules until it is reloaded.</p>
<h3>Assets the build cannot see, and a service worker</h3>
<p><code>xoong build</code> follows what pages and scripts reference. A file named only in a string (<code>register('/sw.js')</code>, icons in a manifest) is added with <code>--include</code>, and under <code>--base</code> it needs its prefix: build such URLs from <code>document.baseURI</code>.</p>
${tabs('Include', [['Terminal', 'bash', `
npx xoong build --out dist --base /admin --include sw.js --include data --include img`], ['JavaScript', 'js', `
navigator.serviceWorker.register(new URL('sw.js', document.baseURI));`]])}

<h2>Known limits</h2>
<p>These are found, understood and not fixed: each one is a trade-off or waits for a real need. The workaround is on the same line, so nobody has to find out the hard way.</p>
<div class="table-wrap"><table>
<thead><tr><th>Limit</th><th>What happens</th><th>What to do</th></tr></thead>
<tbody>
<tr><td>A pager needs <code>total</code></td><td><code>&lt;xo-table page-size&gt;</code> and <code>&lt;xo-pager&gt;</code> on an API that answers <code>items</code> and <code>has_more</code> draw no Previous or Next.</td><td>Add <code>total</code> to the response, or page with <code>xo-param</code> buttons and a cursor (see Load more).</td></tr>
<tr><td>Retries are for outages</td><td>A GET is retried on 502, 503, 504 and network errors; 408 and 429 are not, and <code>Retry-After</code> is ignored.</td><td>Wrap <code>fetch</code> (as in Token refresh): wait for <code>Retry-After</code> and send again.</td></tr>
<tr><td>A new record does not join a loaded list</td><td>A pushed record that already has an id on screen updates in place; a new one is stored but the list stays as it was.</td><td>Send a <code>resync</code> event, or call <code>getClient().invalidateAll()</code>.</td></tr>
<tr><td>Object query parameters</td><td>An object value (<code>filter: { status: 'open' }</code>) is written as <code>[object Object]</code> and shares one cache entry with every other object value. A bracketed name is fine: <code>xo-param="filter[status]=open"</code> sends <code>filter[status]=open</code>.</td><td>Use bracketed names (or flat parameters) instead of an object value.</td></tr>
<tr><td>Braces in a view</td><td>A <code>{...}</code> is a binding only when it holds a path (with an optional <code>| format</code>): JSON, CSS and regular expressions in a view stay as written. <code>{{name}}</code> is not xoong syntax.</td><td>Write <code>\\{name}</code> for a literal brace pair that looks like a path; a key with a space or a colon needs a quoted key such as <code>{['a b']}</code>.</td></tr>
<tr><td>Parameter names with a dash</td><td><code>p-page-size</code> becomes the query name <code>pageSize</code>; an API that wants <code>page-size</code> gets nothing.</td><td>Name the parameter <code>limit</code> or <code>pageSize</code>, or set <code>view.params = { 'page-size': 20 }</code> from script.</td></tr>
<tr><td>Duplicate ids in one list</td><td>Rows are keyed by the record's id, so <code>[A, B, A]</code> draws two rows.</td><td>Give each row an id (a server id, or a composite one).</td></tr>
<tr><td>Rows without an id</td><td>They are matched by position: text typed into an input of a row stays at its position when a row above is removed.</td><td>Give the rows an id.</td></tr>
<tr><td>Hidden and disabled form fields</td><td>A field that <code>xo-if</code> hides, or that is <code>disabled</code>, is still in the draft and is sent: the draft cannot tell "hidden for now" from "not applicable".</td><td>Shape the body with <code>form.serialize</code> (see Forms).</td></tr>
<tr><td>Copying a built combobox</td><td><code>cloneNode(true)</code> of a drawn <code>&lt;xo-combobox&gt;</code> has no options: they were read from the <code>&lt;option&gt;</code> children and removed.</td><td>Clone before it is drawn (from a <code>&lt;template&gt;</code>), or set <code>options</code> on the copy.</td></tr>
<tr><td><code>--base</code> and links</td><td><code>&lt;a href="/about"&gt;</code> is left as written (the router handles links; relative links keep working).</td><td>Use relative links in static pages, or <code>base-links</code> on the router.</td></tr>
<tr><td>No live reload</td><td><code>xoong dev</code> serves the files fresh but does not reload the page.</td><td>Reload by hand.</td></tr>
</tbody></table></div>
`,
};
