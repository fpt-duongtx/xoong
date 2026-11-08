// The content of the documentation site. `npm run site` writes site/*.html from this file; the architecture test fails when they differ.
import { readFileSync } from 'node:fs';
import { tabs, example, callout, code, codeCard, mark, art } from './lib.mjs';

/** The inside of a page of the design kit (design/brand-kit/<file>): its content column with the icon sprite it uses; the crumbs are made by the layout. */
const kit = (file) => {
  const html = readFileSync(new URL(`../../design/brand-kit/${file}`, import.meta.url), 'utf8');
  const sprite = html.match(/<svg[^>]*class="sprite"[\s\S]*?<\/svg>/)?.[0] ?? '';
  const main = html.match(/<main class="content" id="main">([\s\S]*?)<\/main>/)?.[1] ?? '';
  const named = main
    .replace(/assets\/img\//g, 'img/') // the site's pictures live in site/img
    .replace(/ style="[^"]*"/g, '') // a style attribute is blocked by the page's CSP; the elements that had one (a carousel's --xo-carousel-items) set it again from their own attributes
    .replace(/<select(?![^>]*aria-label)/g, '<select aria-label="Example"'); // until the kit names its example selects (axe: select-name)
  return sprite + named.replace(/<div class="crumbs">[\s\S]*?<\/div>/, '').replace(/^\n+/, '');
};

/** The card grid of the design kit's controls overview, each card linked to its page. */
const controlCards = () => {
  const html = readFileSync(new URL('../../design/brand-kit/controls-overview.html', import.meta.url), 'utf8');
  const sprite = html.match(/<svg[^>]*class="sprite"[\s\S]*?<\/svg>/)?.[0] ?? '';
  const pages = { 'Tabs': 'tabs.html', 'Menu and tooltip': 'menu.html', 'Combobox and tags': 'combobox.html', 'Carousel': 'carousel.html', 'Rich text': 'richtext.html', 'Your own control': 'own-control.html', 'Standard': 'components.html', 'All controls': 'controls-demo.html' };
  const grid = (html.match(/<ul class="control-cards">[\s\S]*?<\/ul>/)?.[0] ?? '').replace(/<li><a class="card" href="[^"]*">([\s\S]*?<h3>(.*?)<\/h3>[\s\S]*?)<\/a><\/li>/g, (_, inner, title) => `<li><a class="card" href="${pages[title] ?? 'controls.html'}">${inner}</a></li>`);
  return sprite + grid;
};

const VERSION = JSON.parse(readFileSync(new URL('../../packages/xoong/package.json', import.meta.url), 'utf8')).version; // the release the install page names

const TABLE = `
<xo-view get="listPeople">
  <xo-table columns="name,email:E-mail,role" sortable filters="name:Search by name" selectable page-size="5" empty="Nobody here">
    <span slot="role" class="badge">{role}</span>
    <button xo-click="deletePerson" xo-confirm="Delete {name}?" xo-notice="Deleted">Delete</button>
    <button slot="bulk" xo-click="deletePerson" xo-selected>Delete ticked</button>
  </xo-table>
</xo-view>`;

const START = `
import { configure } from '@xoong/data';
import '@xoong/data/view';
import '@xoong/ui';
import operations from '/.xoong/operations.json' with { type: 'json' };

configure({ api: operations, baseUrl: '/api' });`;

export const pages = [

  // ------------------------------------------------------------------------------------------------------------------------------
  {
    file: 'index.html', section: 'home', title: 'One pot. Whole app.', demo: true,
    description: 'xoong: a small, standards-first web framework. Light DOM, plain CSS, an OpenAPI-driven data layer, no runtime dependencies.',
    body: `
  <section class="hero">
    <div class="wrap">
      <div>
        <span class="eyebrow">Standards-first web framework</span>
        <h1>One pot.<br><em>Whole app.</em></h1>
        <p class="lede">Xoong is a small web framework that cooks with what the browser already gives you. Declare a screen, point it at your OpenAPI document, write plain CSS. That is the whole job.</p>
        <div class="actions">
          <a class="btn primary" href="install.html">Get started</a>
          <a class="btn" href="demo.html">See it running</a>
        </div>
        <ul class="pills"><li><b>0</b> runtime deps</li><li><b>0</b> shadow DOM</li><li><b>0</b> inline scripts</li></ul>
      </div>
      <div class="stage">
        <div class="pot-badge">${mark({ size: 128, steam: true })}</div>
        ${codeCard('people.html', 'html', `
<xo-view get="listPeople">
  <xo-table columns="name,email,role"
            sortable></xo-table>
</xo-view>

<!-- loading, errors, cache and types
     come from your OpenAPI document -->`)}
      </div>
    </div>
  </section>

  <section>
    <div class="wrap">
      <div class="head"><span class="eyebrow">The ingredients</span><h2>Few things, chosen well.</h2><p>Mainstream frameworks make you chase them. Xoong keeps its surface tiny and lets the platform do the heavy lifting.</p></div>
      <ul class="grid">
        <li class="card"><span class="no">01</span><h3>Standards first</h3><p>Custom elements, the DOM, ES modules, the History API, native <code>&lt;dialog&gt;</code> and <code>Intl</code>. No virtual DOM, no JSX, no hooks.</p></li>
        <li class="card"><span class="no">02</span><h3>Light DOM only</h3><p>Your CSS and your tests see the real DOM. No Shadow DOM and no scoped-style magic between you and the page.</p></li>
        <li class="card"><span class="no">03</span><h3>OpenAPI is the contract</h3><p><code>xoong sync</code> reads your spec and writes typed operations. Forms and tables are drawn from the schemas.</p></li>
        <li class="card"><span class="no">04</span><h3>Zero runtime deps</h3><p>Upgrading Node never breaks the runtime, because the runtime runs in the browser and brings nothing along.</p></li>
        <li class="card"><span class="no">05</span><h3>Strict CSP ready</h3><p><code>xoong build</code> outputs static files that run under <code>script-src 'self'</code>. No inline code, ever.</p></li>
        <li class="card"><span class="no">06</span><h3>Made for AI and people</h3><p>One way to do each thing, a short <code>llms.txt</code>, an MCP server, and <code>xoong check</code> with messages that contain the fix.</p></li>
      </ul>
    </div>
  </section>

  <div class="band" role="presentation">
    <div class="wrap">
      <div><strong>1</strong><span>way to do each thing</span></div>
      <div><strong>0</strong><span>runtime dependencies</span></div>
      <div><strong>600+</strong><span>tests, incl. real browsers</span></div>
      <div><strong>MIT</strong><span>licence, forever</span></div>
    </div>
  </div>

  <section>
    <div class="wrap">
      <div class="head"><span class="eyebrow">Taste it</span><h2>This table is the real thing.</h2><p>Sort a column, search, tick rows and delete them. There is no server: a function in the page plays the API, and everything else is xoong.</p></div>
      ${example({ label: 'A data table', preview: TABLE })}
    </div>
  </section>

  <section>
    <div class="wrap">
      <div class="head"><span class="eyebrow">The recipe</span><h2>Three steps from spec to screen.</h2></div>
      <ol class="recipe">
        <li><div><h3>Sync your API</h3><p>Generate typed operations from the OpenAPI document you already have.</p>${code('bash', 'npx xoong sync openapi.json')}</div></li>
        <li><div><h3>Write the screen</h3><p>HTML with a few <code>xo-*</code> elements. Style it with plain CSS and custom properties.</p>${code('html', '<xo-view get="listPeople"><xo-table sortable></xo-table></xo-view>')}</div></li>
        <li><div><h3>Serve it hot</h3><p>Run the dev server, then build static output for strict-CSP hosting.</p>${code('bash', 'npx xoong dev\nnpx xoong build --out dist')}</div></li>
      </ol>
    </div>
  </section>

  <section class="cta">
    <div class="wrap">
      <div class="box">
        <h2>Hungry for less framework?</h2>
        <p>Xoong is a 0.0.x prototype and the syntax is still Draft. Come cook with us early.</p>
        <div class="actions"><a class="btn primary" href="install.html">Install</a><a class="btn" href="how-it-works.html">How it works</a></div>
      </div>
    </div>
  </section>`,
  },
  // ------------------------------------------------------------------------------------------------------------------------------
  {
    file: 'overview.html', group: 'Start', nav: 'Overview', title: 'Overview', demo: true, section: 'docs',
    description: 'xoong: a standards-first web framework. Light DOM, plain CSS, an OpenAPI-driven data layer, no runtime dependencies.',
    body: `
<h1>xoong</h1>
<p class="lead">Build data-driven web pages with HTML, plain CSS and your OpenAPI document. Custom elements in the Light DOM, no virtual DOM, no runtime dependencies in the core, no build step needed to try it.</p>
${callout('note', '<strong>Status:</strong> a working prototype (0.x). It is not published to npm yet, so you install it from release files: see <a href="install.html">Install</a>.')}

<h2>What you write</h2>
<p>A screen is HTML. The table below reads <code>listPeople</code> from an OpenAPI operation; sorting, search, paging, selection, the confirm dialog and the toast are attributes. Try it: sort a column, type in the search box, tick rows.</p>
${example({
  label: 'A data table',
  preview: TABLE,
  extra: [['main.js', 'js', START], ['OpenAPI', 'json', `
{
  "paths": {
    "/api/people": {
      "get": {
        "operationId": "listPeople",
        "parameters": [{ "name": "sort", "in": "query" }, { "name": "limit", "in": "query" }, { "name": "offset", "in": "query" }, { "name": "name", "in": "query" }],
        "responses": { "200": { "description": "ok" } }
      }
    }
  }
}`]],
})}
<p>There is no server behind this page: a function in the page plays the API (<code>configure({ fetch })</code>), and everything else, the typed operation, the cache, the loading and error states, is the real thing.</p>

<h2>Ideas</h2>
<div class="cards">
  <section><h3>Standards first</h3><p>Custom elements in the Light DOM, the History API, native <code>&lt;dialog&gt;</code> and Popover, <code>Intl</code>, <code>ElementInternals</code> for form controls.</p></section>
  <section><h3>Your API is the contract</h3><p><code>xoong sync</code> reads OpenAPI and writes typed operations. Tables and forms are drawn from the schemas; validation comes from them too.</p></section>
  <section><h3>Plain CSS</h3><p>Design tokens are custom properties in cascade layers. Your own CSS always wins, no utility classes, no CSS-in-JS.</p></section>
  <section><h3>Strict CSP ready</h3><p><code>xoong build</code> writes static output with no inline code and no import map. This site is built that way.</p></section>
  <section><h3>Accessible by default</h3><p>Tabs, menu, tooltip, combobox and the toolbar follow the WAI-ARIA patterns, with keyboard support and tests in three browsers.</p></section>
  <section><h3>Made for AI and humans</h3><p>A short <code>llms.txt</code>, an MCP server, and <code>xoong check</code>, which catches mistakes in markup and tells you the fix.</p></section>
</div>

<h2>Where to go next</h2>
<ul>
  <li><a href="install.html">Install</a> xoong and start a project in a few commands.</li>
  <li>Read <a href="how-it-works.html">how it works</a>, then the guides: <a href="data.html">data and tables</a>, <a href="forms.html">forms</a>, <a href="controls.html">controls</a>, <a href="richtext.html">rich text</a> and <a href="styling.html">styling</a>.</li>
  <li>Open the <a href="demo.html">live demo</a>, a small admin screen.</li>
</ul>`,
  },
  // ------------------------------------------------------------------------------------------------------------------------------
  {
    file: 'install.html', section: 'docs', group: 'Start', nav: 'Install', title: 'Install',
    description: 'Install xoong from release files, generate typed operations from OpenAPI and run a project.',
    body: `
<h1>Install</h1>
${callout('note', 'xoong is not on npm yet. Each version is a GitHub Release with one tarball per package. Until the repository is public you need <code>gh</code> signed in to an account that can read it.')}
<p>You need Node 22.12 or newer. The libraries themselves have no runtime dependencies; Node is only for the tools (<code>xoong sync</code>, <code>dev</code>, <code>build</code>).</p>

<h2>1. Download a release</h2>
${tabs('Download', [['Terminal', 'bash', `
gh release download v${VERSION} -R fpt-duongtx/xoong -D vendor/xoong`]])}
<p>The folder holds one <code>.tgz</code> per package and a <code>consume.json</code> that says what to copy into your project.</p>

<h2>2. Point your <code>package.json</code> at the tarballs</h2>
<p>Copy <code>dependencies</code> (what you import) and every entry of <code>overrides</code> from <code>consume.json</code>, then run <code>npm install</code>.</p>
${tabs('package.json', [['package.json', 'json', `
{
  "dependencies": {
    "xoong": "file:./vendor/xoong/xoong-${VERSION}.tgz",
    "@xoong/ui": "file:./vendor/xoong/xoong-ui-${VERSION}.tgz"
  },
  "overrides": {
    "@xoong/core": "file:./vendor/xoong/xoong-core-${VERSION}.tgz"
  }
}`], ['Terminal', 'bash', `
npm install`]])}

<h2>3. Generate typed operations and run</h2>
<p>Give <code>xoong sync</code> your OpenAPI document (a file or a URL). It writes <code>.xoong/operations.json</code>, which the data layer reads, and <code>api.d.ts</code> for TypeScript.</p>
${tabs('Commands', [
  ['Terminal', 'bash', `
npx xoong sync openapi.json      # writes .xoong/operations.json and api.d.ts
npx xoong dev                    # static server with an API proxy
npx xoong build --out dist       # static output for strict-CSP hosting`],
  ['xoong.config.json', 'json', `
{
  "port": 5173,
  "proxy": { "/api": "http://localhost:8080" }
}`],
])}

<h2>4. A first screen</h2>
<p>Or let <code>xoong new</code> do steps 3 and 4: <code>npx xoong new my-app --spec openapi.json</code> creates a project with a first list screen.</p>
${tabs('First screen', [
  ['index.html', 'html', `
<!doctype html>
<link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
<script type="module" src="main.js"></script>

<xo-view get="listPeople">
  <p xo-if="$loading">Loading…</p>
  <xo-table columns="name,email:E-mail,role" sortable></xo-table>
</xo-view>`],
  ['main.js', 'js', START],
])}
<p>Run <code>npx xoong check index.html</code> to lint the markup against your API; each message says how to fix it.</p>`,
  },
  // ------------------------------------------------------------------------------------------------------------------------------
  {
    file: 'how-it-works.html', section: 'docs', group: 'Start', nav: 'How it works', title: 'How it works',
    description: 'How xoong turns an OpenAPI document into data, forms and screens.',
    body: `
<h1>How it works</h1>
<p>xoong has three layers, and you can stop at any of them: a reactive core and base element, a data layer generated from OpenAPI, and ready-made admin parts on top.</p>

<h2>Data</h2>
<p><code>xoong sync</code> turns your OpenAPI document into <code>operations.json</code>. A <code>&lt;xo-view get="listPeople"&gt;</code> calls the operation, caches the answer in a shared store (records with the same id are shared between screens) and exposes <code>$loading</code>, <code>$error</code> and the data to the markup inside it. You never write a cache key, an HTTP client or an error handler.</p>
${tabs('Data', [
  ['HTML', 'html', `
<xo-view get="listPeople">
  <p xo-if="$loading">Loading…</p>
  <p xo-if="$error" role="alert">{$error.code}: {$error.detail}</p>
  <ul>
    <li xo-each="items">{name} <small>{email}</small></li>
  </ul>
</xo-view>`],
  ['Terminal', 'bash', `
npx xoong sync openapi.json`],
])}

<h2>Actions and forms</h2>
<p>Writes are attributes too. A button runs an operation; after it succeeds, every cached query whose path overlaps it is refetched, so lists stay current without extra code. A form with <code>&lt;xo-form op="createPerson"&gt;</code> is drawn from the request schema: nested objects, arrays and unions included. Validation comes from the same schema, with your own rules by path.</p>
${tabs('Actions', [
  ['HTML', 'html', `
<button xo-click="POST /api/people/{id}/disable" xo-confirm="Disable {name}?" xo-notice="Disabled">Disable</button>

<xo-form op="createPerson" submit="Add person"></xo-form>`],
  ['JavaScript', 'js', `
// Only when HTML is not enough: the same client, typed from api.d.ts
import { getClient } from '@xoong/data';

const created = await getClient().mutate('createPerson', {}, { name: 'Ada', email: 'ada@example.org' });`],
])}

<h2>Pages</h2>
<p><code>&lt;xo-router&gt;</code> is a declarative History-API router with nested layouts, guards and a "leave this page?" question for unsaved forms. Public pages stay one HTML file each and can be prerendered with <code>@xoong/ssr</code>.</p>
${tabs('Router', [['HTML', 'html', `
<xo-router base="/admin">
  <template xo-layout="shell">
    <nav><a href="/people">People</a></nav>
    <main xo-outlet></main>
  </template>
  <template xo-route="/people/:id" layout="shell" title="Person">
    <xo-view get="getPerson" p-id=":id">...</xo-view>
  </template>
  <template xo-route="*">Not found</template>
</xo-router>`]])}

<h2>Language</h2>
<p><code>@xoong/i18n</code> uses plain JSON catalogs and ICU-style messages. <code>xo-t</code> translates markup, and every built-in string (table, forms, controls) is a catalog key, Vietnamese included.</p>
${tabs('i18n', [['HTML', 'html', `
<h1 xo-t="home.title">Welcome</h1>
<input xo-t="placeholder:search.placeholder" placeholder="Search">`], ['JavaScript', 'js', `
import { configureI18n, setLocale } from '@xoong/i18n';

configureI18n({ locale: 'en', load: (locale) => fetch(\`/i18n/\${locale}.json\`).then((r) => r.json()) });
await setLocale('vi');`]])}

<h2>Safety</h2>
<p><code>xoong build</code> rewrites imports to files and removes the need for inline code, so the output runs under <code>default-src 'none'; script-src 'self'; style-src 'self'</code>. This site is built that way, and its tests fail on any CSP violation. Interpolated text is escaped, <code>javascript:</code> URLs become <code>about:blank</code>, and rich text is sanitised on every input.</p>

<h2>Packages</h2>
<p>Install only what you use. Sizes are gzip budgets that the tests enforce.</p>
<div class="table-wrap"><table>
<thead><tr><th>Package</th><th>What it is</th><th>Budget</th></tr></thead>
<tbody>
<tr><td><code>@xoong/core</code></td><td>Signals, <code>html</code> templates, <code>XoElement</code>, <code>XoControl</code></td><td>5.6 KB</td></tr>
<tr><td><code>@xoong/data</code></td><td>Typed client, entity store, <code>&lt;xo-view&gt;</code>, live updates</td><td>16.5 KB</td></tr>
<tr><td><code>@xoong/forms</code></td><td>Form model and binder: validation, arrays, dirty state</td><td>9.5 KB</td></tr>
<tr><td><code>@xoong/ui</code></td><td><code>xoong.css</code> tokens, table, generated form, dialog, toast, router</td><td>10 KB</td></tr>
<tr><td><code>@xoong/controls</code></td><td>Tabs, menu, tooltip, combobox, tags</td><td>9.5 KB</td></tr>
<tr><td><code>@xoong/richtext</code></td><td>Sanitised rich text editor</td><td>8.5 KB</td></tr>
<tr><td><code>@xoong/i18n</code></td><td>Catalogs, ICU-subset messages, <code>xo-t</code></td><td>5 KB</td></tr>
<tr><td><code>@xoong/cli</code></td><td><code>sync</code>, <code>check</code>, <code>dev</code>, <code>build</code>, <code>render</code>, <code>i18n</code></td><td>tools</td></tr>
<tr><td><code>@xoong/test</code>, <code>mcp</code>, <code>lsp</code>, <code>ssr</code>, <code>server</code></td><td>Mock API and screens for Vitest, an MCP server, editor support, prerendering, the dev and build server</td><td>tools</td></tr>
</tbody></table></div>`,
  },
  // ------------------------------------------------------------------------------------------------------------------------------
  {
    file: 'data.html', section: 'docs', group: 'Guides', nav: 'Data and tables', title: 'Data and tables', demo: true,
    description: 'Read data with xo-view, draw a table with xo-table, and run actions with plain attributes.',
    body: `
<h1>Data and tables</h1>
<p class="lead">Reads are <code>&lt;xo-view get&gt;</code>. Writes are <code>xo-click</code> and <code>xo-submit</code>. The data layer does the caching, retries, loading and errors.</p>

<h2>Start-up</h2>
<p>This is all the JavaScript most apps need. <code>operations.json</code> is generated by <code>xoong sync</code>; <code>baseUrl</code> is where your API lives.</p>
${tabs('Start-up', [['main.js', 'js', START], ['Terminal', 'bash', 'npx xoong sync openapi.json']])}

<h2>A table in one element</h2>
<p><code>&lt;xo-table&gt;</code> draws a table from the view's data. The attributes below turn on sorting (<code>sort</code> query parameter), a search box per filter (the field's query parameter), row selection, bulk actions and paging (<code>limit</code>, <code>offset</code> and <code>total</code> in the response). Children fill cells: <code>slot="role"</code> replaces the role cell, any other element goes in the last cell.</p>
${example({ label: 'xo-table', preview: TABLE })}
<table class="props">
<thead><tr><th>Attribute</th><th>What it does</th></tr></thead>
<tbody>
<tr><td><code>columns</code></td><td><code>field</code>, <code>field:Label</code> or <code>field:Label:format</code>, comma separated</td></tr>
<tr><td><code>sortable</code></td><td>Header buttons set <code>sort</code> (<code>name</code>, then <code>-name</code>)</td></tr>
<tr><td><code>filters</code></td><td><code>name:Search by name</code>: a search box that sets that query parameter</td></tr>
<tr><td><code>selectable</code></td><td>A checkbox per row; <code>slot="bulk"</code> buttons run once per ticked row</td></tr>
<tr><td><code>page-size</code></td><td>Sets <code>limit</code> and shows Previous and Next (<code>offset</code>)</td></tr>
<tr><td><code>empty</code></td><td>The text shown when there are no rows</td></tr>
</tbody></table>

<h2>Your own markup</h2>
<p>When a table is not the right shape, write the markup. <code>xo-each</code> repeats an element for each item, <code>xo-if</code> shows it conditionally, <code>{name}</code> reads a field, and <code>xo-param</code> sets a query parameter and refetches (the button for the current value gets <code>aria-current</code>). Text is always escaped.</p>
${example({
  label: 'xo-view with your markup',
  preview: `
<xo-view get="listPeople">
  <p class="toolbar">
    <button xo-param="role=">Everyone</button>
    <button xo-param="role=admin">Admins</button>
    <button xo-param="role=editor">Editors</button>
    <button xo-param="role=viewer">Viewers</button>
  </p>
  <p xo-if="$loading" aria-busy="true">Loading…</p>
  <p xo-if="$error" role="alert">{$error.code}: {$error.detail}</p>
  <ul class="people">
    <li xo-each="items">
      <strong>{name}</strong> <span class="badge">{role}</span><br>
      <a href="mailto:{email}">{email}</a>
    </li>
  </ul>
</xo-view>`,
})}

<h2>Loading, empty and error</h2>
<p>A view tells you in which state it is: <code>$loading</code> while a request runs, <code>$error</code> when it failed, and an empty list otherwise. <code>&lt;xo-table&gt;</code> shows its <code>empty</code> content only when the list is really empty (not while loading, not after an error); a <code>&lt;template slot="empty"&gt;</code> gives it any markup. <code>xo-refresh</code> on a button fetches the view's data again: a "Try again". Say what happened, what to do, and offer one action.</p>
<p>Try it: type <strong>zzz</strong> for an empty list, or <strong>fail</strong>: the first request with it fails, and Try again then succeeds.</p>
${example({
  label: 'Loading, empty and error states',
  preview: `
<xo-view class="states" get="listPeople" p-limit="4">
  <div class="skeleton" xo-if="$loading" role="status" aria-label="Loading"><i></i><i></i><i></i></div>
  <div class="state error" xo-if="$error" role="alert">
    ${art.error}
    <h3>Could not load people</h3>
    <p>{$error.detail}</p>
    <div class="row-actions"><button class="btn primary" type="button" xo-refresh>Try again</button></div>
  </div>
  <xo-table columns="name,email:E-mail" filters="name:Search (try zzz or fail)" empty="Nobody here">
    <template slot="empty"><div class="state">${art.empty}<h3>Nobody here yet</h3><p>No one matches this search.</p></div></template>
  </xo-table>
</xo-view>`,
})}

<h2>Actions</h2>
<p>A button with <code>xo-click</code> calls an operation by name (or as <code>METHOD /path</code>). <code>{id}</code> and other path parameters come from the row. After it succeeds, the queries it affects are refetched. These attributes shape the call:</p>
<table class="props">
<thead><tr><th>Attribute</th><th>What it does</th></tr></thead>
<tbody>
<tr><td><code>xo-confirm="Delete {name}?"</code></td><td>Asks first, in a native dialog</td></tr>
<tr><td><code>xo-notice="Saved"</code></td><td>Shows a toast on success; errors always show one</td></tr>
<tr><td><code>xo-with="role=admin"</code></td><td>Adds fields to the request body</td></tr>
<tr><td><code>xo-optimistic="role=admin"</code></td><td>Applies the change at once, undone if the call fails</td></tr>
<tr><td><code>xo-selected</code></td><td>Runs once per ticked row (or sends the ticked ids in one request)</td></tr>
</tbody></table>

<h2>Errors and loading</h2>
<p>A running call sets <code>aria-busy</code> on the button. A failure becomes one error type with <code>status</code>, <code>code</code> and <code>detail</code> (from <code>application/problem+json</code>, <code>{ error: { code, message } }</code> or <code>{ detail }</code>), shown by <code>&lt;xo-toast&gt;</code> or by <code>$error</code> in your markup. Listen for <code>xo-done</code> and <code>xo-error</code> to react in code.</p>
${tabs('Errors', [['HTML', 'html', `
<xo-view get="getPerson" p-id="99">
  <p xo-if="$error" role="alert">{$error.status} {$error.code}: {$error.detail}</p>
</xo-view>
<xo-toast></xo-toast>`], ['JavaScript', 'js', `
document.addEventListener('xo-error', (e) => console.warn(e.detail.code, e.detail.detail));`]])}`,
  },
  // ------------------------------------------------------------------------------------------------------------------------------
  {
    file: 'forms.html', section: 'docs', group: 'Guides', nav: 'Forms', title: 'Forms', demo: true, richtext: true,
    description: 'Generated and hand-written forms: schema validation, dirty state, arrays with reordering, server errors.',
    body: `
<h1>Forms</h1>
<p class="lead">A form is a <code>&lt;form xo-submit&gt;</code> inside an <code>xo-view</code>. The request schema of the operation gives each field its type, its limits and its errors, and the record fills the fields.</p>

<h2>Generated from the schema</h2>
<p><code>&lt;xo-form op="createPerson"&gt;</code> (inside an <code>&lt;xo-view&gt;</code>) draws every field of the request body: text, e-mail, a select for the enum, and the rich widgets chosen by the schema (<code>x-xoong-widget</code> in OpenAPI, or a hint). Submit it empty to see the validation messages, then add a person with an address that is already used (<code>ada@example.org</code>) to see a server error. The list refreshes by itself after a successful save.</p>
${example({
  label: 'xo-form',
  preview: `
<div class="split">
  <xo-view><xo-form op="createPerson" submit="Add person"></xo-form></xo-view>
  <xo-view get="listPeople" p-sort="-id" p-limit="5">
    <h3>Newest people</h3>
    <ul class="people"><li xo-each="items"><strong>{name}</strong><br><small>{email}</small></li></ul>
  </xo-view>
</div>`,
  extra: [['OpenAPI', 'json', `
"PersonInput": {
  "type": "object",
  "required": ["name", "email"],
  "properties": {
    "name": { "type": "string", "minLength": 2, "maxLength": 40 },
    "email": { "type": "string", "format": "email" },
    "role": { "type": "string", "enum": ["admin", "editor", "viewer"] },
    "topics": { "type": "array", "items": { "type": "string", "enum": ["web", "data", "design", "ops"] }, "x-xoong-widget": "xo-combobox" },
    "keywords": { "type": "array", "items": { "type": "string" }, "x-xoong-widget": "xo-tags" },
    "bio": { "type": "string", "x-xoong-widget": "xo-richtext" }
  }
}`], ['Hints', 'json', { file: 'site/demo/xoong.hints.json' }]],
})}

<h2>Written by hand</h2>
<p>For a layout of your own, write the form. <code>name</code> is a path (<code>title.en</code>, <code>items[0].x</code>). The record fills the fields, errors appear after blur or submit, and <code>$form</code> tells the markup what is going on: <code>dirty</code>, <code>valid</code>, <code>submitting</code>, <code>errors['email']</code>. Put sections in <code>&lt;xo-tabs&gt;</code>: when a field on another tab is invalid, that tab opens before the focus moves there.</p>
${example({
  label: 'A hand-written form',
  preview: `
<xo-view get="getPerson" p-id="1">
  <form xo-submit="updatePerson" xo-notice="Saved">
    <xo-tabs label="Person">
      <section xo-tab="General">
        <label class="field">Name <input name="name" autocomplete="off"></label>
        <span class="error" xo-if="$form.errors['name']">{$form.errors['name']}</span>
        <label class="field">E-mail <input name="email" type="email"></label>
        <span class="error" xo-if="$form.errors['email']">{$form.errors['email']}</span>
        <label class="field">Role
          <select name="role"><option>admin</option><option>editor</option><option>viewer</option></select>
        </label>
      </section>
      <section xo-tab="Topics">
        <xo-combobox name="topics" label="Topics" multiple>
          <option value="web">Web</option><option value="data">Data</option>
          <option value="design">Design</option><option value="ops">Operations</option>
        </xo-combobox>
        <xo-tags name="keywords" label="Keywords" placeholder="Add a keyword"></xo-tags>
      </section>
      <section xo-tab="Bio">
        <xo-richtext name="bio" label="Bio" toolbar="compact"></xo-richtext>
      </section>
    </xo-tabs>
    <p class="toolbar">
      <button>Save</button>
      <span class="hint" xo-if="$form.dirty">Unsaved changes</span>
      <span class="hint" xo-if="$form.submitting" aria-busy="true">Saving…</span>
    </p>
  </form>
</xo-view>`,
})}
<p>Clear the name or type a single letter, go to another tab and press Save: the first invalid field is revealed, and nothing is sent until the form is valid. The leave guard of <code>&lt;xo-router&gt;</code> uses the same <code>dirty</code> state.</p>

<h2>Rows you can add, move and remove</h2>
<p>An array of values or objects is edited with <code>xo-each</code> over the draft. <code>xo-add</code> appends a row, <code>xo-remove</code> removes one, <code>xo-move</code> moves it (the focus follows the row), and <code>xo-drag</code> on a handle lets a pointer drag it onto another row of the same list.</p>
${example({
  label: 'Array rows',
  preview: `
<xo-view get="getPerson" p-id="2">
  <form xo-submit="updatePerson" xo-notice="Saved">
    <fieldset>
      <legend>Keywords</legend>
      <div class="row" xo-each="keywords">
        <span class="handle" xo-drag="keywords[{$index}]" title="Drag to reorder">⠿</span>
        <input name="keywords[{$index}]" aria-label="Keyword">
        <button type="button" xo-move="keywords[{$index}]:up" aria-label="Move up">↑</button>
        <button type="button" xo-move="keywords[{$index}]:down" aria-label="Move down">↓</button>
        <button type="button" xo-remove="keywords[{$index}]" aria-label="Remove">✕</button>
      </div>
      <button type="button" xo-add="keywords">Add keyword</button>
    </fieldset>
    <p class="toolbar"><button>Save</button> <span class="hint" xo-if="$form.dirty">Unsaved changes</span></p>
  </form>
</xo-view>`,
})}

<h2>Your own rules</h2>
<p>Schema rules always apply. Add rules the schema cannot express by path, with the loaded record at hand; a rule returns an empty string when the value is fine, or the message. Rules may be asynchronous, for example to ask the server whether a slug is free.</p>
${tabs('Rules', [['JavaScript', 'js', `
const form = document.querySelector('form');

form.rules = {
  email: (value) => (value.endsWith('@example.org') ? '' : 'Use a company address'),
  '*': (record) => (record.role === 'admin' && !record.topics.length ? { topics: 'Admins need a topic' } : {}),
};
form.serialize = (draft, body) => ({ ...body, name: body.name.trim() }); // the last word on the request body`]])}
<p>On an invalid submit the form fires a cancelable <code>xo-reveal</code> event with the path, so tabs and collapsed sections can open before the focus moves, then <code>xo-invalid</code>.</p>`,
  },
  // ------------------------------------------------------------------------------------------------------------------------------
  {
    file: 'richtext.html', section: 'docs', group: 'Guides', nav: 'Rich text', title: 'Rich text', demo: true, richtext: true, script: 'page-richtext.js',
    description: 'A small rich text editor for forms: sanitised HTML value, accessible toolbar, two sizes, an expand dialog.',
    body: `
<h1>Rich text</h1>
<p class="lead"><code>&lt;xo-richtext&gt;</code> is a <code>contenteditable</code> area with an accessible toolbar, and its value is <strong>sanitised HTML</strong>. It covers what most admin forms need and hands the rest (media libraries, embeds, custom blocks) to your app.</p>
${tabs('Use', [['main.js', 'js', `
import '@xoong/richtext';`], ['HTML', 'html', `
<link rel="stylesheet" href="/@xoong/richtext/richtext.css">
<xo-richtext name="body" label="Body" placeholder="Write something" media></xo-richtext>`]])}

<h2>Try it</h2>
<p>Drag the handle in the corner of the box to change its width: under 580px the editor switches to the <strong>compact</strong> toolbar and the rest of the tools move into a <em>More</em> menu. The toolbar is chosen by the editor's own width, not the screen's, so an editor in a narrow side panel gets the compact one on a wide screen. Click the image tool to see the media hook, and paste something from a web page: only what the editor allows is kept.</p>
${example({
  label: 'xo-richtext',
  preview: `
<div class="resizable">
  <xo-richtext id="demo-editor" name="body" label="Body" placeholder="Write something" media></xo-richtext>
</div>
<p class="toolbar"><button id="expand" type="button">Expand</button><button id="reset" type="button">Reset</button></p>
<h3>Value</h3>
<pre class="value"><code id="rt-out"></code></pre>`,
  extra: [['JavaScript', 'js', { file: 'site/src/page-richtext.js' }]],
})}

<h2>What the value may contain</h2>
<p><code>sanitizeHtml()</code> runs on every input, paste, drop and <code>value</code> set. Everything else is unwrapped (its text stays); scripts, styles, frames and the like are removed with their content, and no attribute outside this table survives (no <code>style</code>, <code>class</code>, <code>on*</code>).</p>
<table class="props">
<thead><tr><th>Allowed</th><th>Notes</th></tr></thead>
<tbody>
<tr><td><code>p</code> <code>h2</code> <code>h3</code> <code>blockquote</code> <code>ul</code> <code>ol</code> <code>li</code> <code>br</code></td><td><code>h1</code> becomes <code>h2</code>, <code>h4</code> to <code>h6</code> become <code>h3</code>, <code>div</code> becomes <code>p</code></td></tr>
<tr><td><code>strong</code> <code>em</code> <code>u</code></td><td><code>b</code> and <code>i</code> are mapped</td></tr>
<tr><td><code>a</code> with <code>href</code></td><td>Only <code>http</code>, <code>https</code>, <code>mailto</code>, <code>tel</code>; <code>rel="noopener noreferrer"</code> is added</td></tr>
<tr><td><code>img</code> with <code>src</code>, <code>alt</code></td><td><code>src</code> must be http(s) or a relative URL; no <code>data:</code>, no <code>javascript:</code></td></tr>
</tbody></table>
${callout('note', 'The client is never a trust boundary. The same function is exported as <code>@xoong/richtext/sanitize</code> so your <strong>server</strong> can sanitise on save as well.')}

<h2>Media</h2>
<p>The image tool fires a cancelable <code>xo-pick-media</code> event. Open your own library, then call <code>detail.insert({ src, alt })</code> now or later. With the caret in a heading the image goes in a paragraph after it, and nothing is written inline, so it works under a strict CSP.</p>

<h2>Keys and sizes</h2>
<ul>
  <li><strong>Toolbar:</strong> one tab stop; Left, Right, Home and End move inside it. Ctrl or Cmd with B, I, U and K work in the editor.</li>
  <li><strong>Sizes:</strong> <code>toolbar="full"</code> or <code>"compact"</code> forces one; the default follows the editor's width.</li>
  <li><strong>Expand:</strong> <code>el.expand()</code> moves the same editor, with its caret and undo history, into a dialog; Done and Escape close it. The host places its own Expand button.</li>
  <li><strong>Props:</strong> <code>name</code>, <code>label</code>, <code>placeholder</code>, <code>required</code>, <code>readonly</code>, <code>disabled</code>, <code>maxlength</code>, <code>tools="bold italic link"</code>.</li>
</ul>`,
  },
  // ------------------------------------------------------------------------------------------------------------------------------
  {
    file: 'styling.html', section: 'docs', group: 'Guides', nav: 'Styling', title: 'Styling', demo: false, script: 'page-styling.js',
    description: 'Change the look of xoong with CSS custom properties and cascade layers.',
    body: `
<h1>Styling</h1>
<p class="lead">xoong ships design tokens as custom properties and the default look of its parts as plain CSS in cascade layers. There is nothing to build and nothing to eject: your own CSS wins without specificity fights.</p>

<h2>Tokens</h2>
<p>Everything in <code>xoong.css</code> is read from <code>--xo-*</code> properties. Change them on <code>:root</code> for the whole app, or on any element for a region. Move the controls to try it on the sample panel (they set the properties on that panel only).</p>
<div class="playground-controls">
  <span class="setting"><label for="p-accent">Accent</label> <input id="p-accent" type="color" value="#9a4d33"></span>
  <span class="setting"><label for="p-radius">Radius</label> <input id="p-radius" type="range" min="0" max="16" value="6"> <output id="p-radius-out" for="p-radius">6px</output></span>
  <span class="setting"><label for="p-scheme">Scheme</label> <select id="p-scheme"><option value="light dark">Follow the system</option><option value="light">Light</option><option value="dark">Dark</option></select></span>
</div>
<div class="playground" id="playground">
  <div class="toolbar"><button>Default</button><button class="primary">Primary</button><input aria-label="Search" placeholder="Search"><span class="badge">badge</span></div>
  <div class="xo-table"><table>
    <thead><tr><th scope="col">Name</th><th scope="col">Role</th></tr></thead>
    <tbody><tr><td>Ada Lovelace</td><td>admin</td></tr><tr><td>Grace Hopper</td><td>editor</td></tr></tbody>
  </table></div>
  <p class="xo-hint">A hint in the muted colour, and <a href="#playground">a link</a> in the accent colour.</p>
</div>
${tabs('Tokens', [['CSS', 'css', `
:root {
  --xo-color-accent: #0a7;   /* links, focus ring, primary actions */
  --xo-radius: 0;            /* corners of buttons, fields, panels */
  --xo-font: "Inter", system-ui, sans-serif;
}

.sidebar {                   /* or a region: its children follow */
  --xo-color-surface: #fafafa;
  --xo-space-3: 0.75rem;
}`], ['Tokens', 'css', `
--xo-font, --xo-font-mono, --xo-text, --xo-text-small
--xo-space-1 … --xo-space-4, --xo-radius, --xo-form-max-width
--xo-color-bg, --xo-color-surface, --xo-color-text, --xo-color-muted
--xo-color-border, --xo-color-accent, --xo-color-accent-text, --xo-color-danger
--xo-focus`]])}

<h2>Layers</h2>
<p>The default styles live in three layers, <code>xoong.tokens</code>, <code>xoong.base</code> and <code>xoong.components</code>. Unlayered CSS beats any layered CSS, so a plain rule in your stylesheet overrides the default without <code>!important</code> and without matching its specificity. Light and dark come from <code>light-dark()</code> and <code>color-scheme</code>.</p>
${tabs('Layers', [['CSS', 'css', `
/* your stylesheet: no layer, so it wins */
.xo-table th { text-transform: uppercase; letter-spacing: 0.04em; }
xo-dialog > dialog { max-width: 40rem; }

/* or order the layers yourself */
@layer reset, xoong.tokens, xoong.base, xoong.components, app;`]])}

<h2>The admin shell</h2>
<p>Put <code>class="xo-admin"</code> on the body (or on <code>&lt;xo-router&gt;</code>) with a <code>&lt;header&gt;</code>, a <code>&lt;nav&gt;</code> and a <code>&lt;main&gt;</code>, and you have a header, a sidebar and a content area that folds into one column on a phone.</p>
${tabs('Shell', [['HTML', 'html', `
<body class="xo-admin">
  <header>My admin</header>
  <nav><a href="/people" aria-current="page">People</a></nav>
  <main>...</main>
</body>`]])}`,
  },
  // ------------------------------------------------------------------------------------------------------------------------------
  {
    file: 'controls.html', section: 'docs', group: 'Controls', nav: 'Overview', title: 'Controls',
    description: 'Accessible tabs, menu, tooltip, combobox, tags and carousel as custom elements.',
    body: `

<h1>Controls</h1>
<p class="lead">The controls every admin needs, as custom elements in the Light DOM with plain CSS. <code>@xoong/controls</code> depends only on <code>@xoong/core</code>, so it works with or without the rest.</p>
${tabs('Use', [['main.js', 'js', `
import '@xoong/controls';   // registers every element; or import one: '@xoong/controls/tabs'`], ['HTML', 'html', `
<link rel="stylesheet" href="/@xoong/controls/controls.css">  <!-- optional; one @layer, uses the --xo-* tokens -->`]])}

<h2>The controls</h2>
${controlCards()}
`,
  },
  // ------------------------------------------------------------------------------------------------------------------------------
  {
    file: 'tabs.html', section: 'docs', group: 'Controls', nav: 'Tabs', title: 'Tabs', script: 'page-tabs.js',
    description: 'The WAI-ARIA tabs pattern as a custom element; panels stay in the form.',
    body: `
<h1>Tabs</h1>
<p>The WAI-ARIA tabs pattern with automatic activation: Left and Right (wrapping), Home and End move and select, and only the selected tab is in the tab order. <code>xo-tab</code> is the label; the section's <code>id</code> is its key. Panels are hidden, not removed, so their form fields stay in the form. <em>The code tabs on this page are made with it.</em></p>
${example({
  label: 'xo-tabs',
  preview: `
<xo-tabs id="demo-tabs" label="Article" value="seo">
  <section xo-tab="General"><p>General settings: title, slug, author.</p></section>
  <section xo-tab="SEO" id="seo"><p>Search engine settings. This tab is selected by <code>value="seo"</code>.</p></section>
  <section xo-tab="Social"><p>How the page looks when it is shared.</p></section>
</xo-tabs>
<p class="hint">Selected: <output id="tabs-out">seo</output></p>`,
  extra: [['JavaScript', 'js', { file: 'site/src/page-tabs.js' }]],
})}
<table class="props">
<thead><tr><th>API</th><th>What it does</th></tr></thead>
<tbody>
<tr><td><code>value</code>, <code>tabs.select(key)</code></td><td>Select a tab by key (its <code>id</code>, or its position)</td></tr>
<tr><td><code>xo-tab-change</code></td><td>Fires with <code>{ value }</code></td></tr>
<tr><td><code>xo-reveal</code></td><td>A form fires it when an invalid field is on another tab; the tab is selected first</td></tr>
<tr><td><code>data-invalid</code></td><td>Set on a tab whose panel has an <code>aria-invalid</code> control</td></tr>
</tbody></table>
`,
  },
  // ------------------------------------------------------------------------------------------------------------------------------
  {
    file: 'menu.html', section: 'docs', group: 'Controls', nav: 'Menu and tooltip', title: 'Menu and tooltip', script: 'page-menu.js',
    description: 'A menu button in the top layer, choice menus and tooltips.',
    body: `
<h1>Menu and tooltip</h1>
<p>The menu button pattern: click, Enter, Space or ArrowDown opens it (ArrowUp opens on the last item); arrows wrap, Home and End jump, a letter jumps to the next item that starts with it, Escape closes and returns to the trigger. The list is drawn in the <strong>top layer</strong> with the Popover API, so a table cell or a scroll area never clips it, and it is positioned through the CSS object model, which a strict CSP allows. A tooltip shows after a delay on hover and at once on keyboard focus, stays while the pointer is on it (WCAG 1.4.13) and describes, never names: an icon-only button still needs <code>aria-label</code>.</p>
${example({
  label: 'xo-menu and xo-tooltip',
  preview: `
<p class="toolbar">
  <xo-menu id="demo-menu" label="Row actions">
    <button xo-menu-trigger>Actions</button>
    <button type="button">Edit</button>
    <button type="button">Duplicate</button>
    <a href="#menu-link">Open link</a>
  </xo-menu>
  <button xo-tooltip="Save the draft (Ctrl+S)" aria-label="Save"><span class="ic" data-ic="download" aria-hidden="true"></span></button>
  <button xo-tooltip="Keyboard focus shows this at once">Focus me</button>
</p>
<p class="hint">Chosen: <output id="menu-out">nothing yet</output></p>`,
  extra: [['JavaScript', 'js', { file: 'site/src/page-menu.js' }]],
})}
`,
  },
  // ------------------------------------------------------------------------------------------------------------------------------
  {
    file: 'combobox.html', section: 'docs', group: 'Controls', nav: 'Combobox and tags', title: 'Combobox and tags', script: 'page-combobox.js',
    description: 'Pick from a list you can filter, or type free tags: form controls.',
    body: `
<h1>Combobox and tags</h1>
<p>Both are form controls: <code>name</code>, <code>required</code>, <code>disabled</code>, <code>value</code>, validity, <code>dirty</code> and <code>touched</code>, and they work in <code>&lt;form xo-submit&gt;</code> like a native field. The value is a string, or an array with <code>multiple</code> and for tags. Options come from <code>&lt;option&gt;</code> children, from <code>el.options</code>, or from the schema's <code>enum</code>. <code>creatable</code> lets people add a value that is not in the list; <code>remote</code> leaves filtering to you through the <code>xo-search</code> event.</p>
${example({
  label: 'xo-combobox and xo-tags',
  preview: `
<div class="split">
  <xo-combobox id="demo-author" name="author" label="Author" placeholder="Choose an author">
    <option value="1">Ada Lovelace</option>
    <option value="2">Grace Hopper</option>
    <option value="3">Barbara Liskov</option>
  </xo-combobox>
  <xo-combobox id="demo-topics" name="topics" label="Topics (several, new allowed)" multiple creatable>
    <option value="web">Web</option>
    <option value="data" selected>Data</option>
    <option value="design">Design</option>
  </xo-combobox>
  <xo-tags id="demo-tags" name="keywords" label="Keywords" placeholder="Type and press Enter"></xo-tags>
</div>
<p class="hint">Values: <output id="combo-out"></output></p>`,
  extra: [['JavaScript', 'js', { file: 'site/src/page-combobox.js' }]],
})}
<p>Keys: ArrowDown and ArrowUp open and move (the focus stays in the input, <code>aria-activedescendant</code> follows), Enter picks, Escape closes, Backspace on an empty field removes the last chip. In tags, Enter or a comma adds the typed text. Enter never submits the form while the list is open.</p>

<h2>In a generated form</h2>
<p><code>&lt;xo-form&gt;</code> draws a control for any field with a <code>widget</code> hint that is a tag name: <code>xo-combobox</code>, <code>xo-tags</code>, <code>xo-richtext</code>, or your own element built on <code>XoControl</code>.</p>
${tabs('Widgets', [['xoong.hints.json', 'json', `
{
  "fields": {
    "Page.topics": { "widget": "xo-combobox" },
    "Page.keywords": { "widget": "xo-tags" },
    "Page.role": { "widget": "xo-combobox" }
  }
}`], ['OpenAPI', 'json', `
"keywords": { "type": "array", "items": { "type": "string" }, "x-xoong-widget": "xo-tags" }`]])}
`,
  },
  // ------------------------------------------------------------------------------------------------------------------------------
  {
    file: 'carousel.html', section: 'docs', group: 'Controls', nav: 'Carousel', title: 'Carousel', demo: true,
    description: 'Cards, banners, testimonials and galleries with scroll snap.',
    body: `
<h1>Carousel</h1>
<p><code>&lt;xo-carousel&gt;</code> is a row of slides, its children, that you move through. It is made on the platform: the slides sit in a scroll container with CSS scroll snap, so touch swiping, the wheel and momentum are the browser's own, and the buttons only ask it to scroll. It follows the WAI-ARIA carousel pattern, and a slide that is out of view cannot be reached with Tab. These are the forms it covers, one element each:</p>

<h2>Cards, several at a time</h2>
<p><code>items</code> sets how many are visible; set <code>--xo-carousel-items</code> in CSS to change it with the screen width. <code>counter</code> shows the position, and the arrows stop at the ends (or wrap with <code>loop</code>).</p>
${example({
  label: 'xo-carousel with cards',
  preview: `
<xo-carousel class="service-cards" label="Services" counter>
  <article class="card"><h3>Digestive check</h3><p>Advice on stomach, bowel and liver symptoms.</p><a href="#book">Book</a></article>
  <article class="card"><h3>Painless endoscopy</h3><p>Stomach and bowel, with sedation.</p><a href="#book">Book</a></article>
  <article class="card"><h3>H. pylori test</h3><p>A sample taken during the endoscopy.</p><a href="#book">Book</a></article>
  <article class="card"><h3>Abdominal ultrasound</h3><p>Done together with the doctor.</p><a href="#book">Book</a></article>
  <article class="card"><h3>Health packages</h3><p>Checks with offers.</p><a href="#book">Book</a></article>
</xo-carousel>`,
  extra: [['CSS', 'css', `
.service-cards { --xo-carousel-items: 1; }
@media (min-width: 40rem) { .service-cards { --xo-carousel-items: 2; } }
@media (min-width: 60rem) { .service-cards { --xo-carousel-items: 3; --xo-carousel-gap: 1.5rem; } }`]],
})}

<h2>A banner or testimonials, moving by itself</h2>
<p>One slide at a time with <code>dots</code> and <code>autoplay</code> (milliseconds). It adds a pause button, pauses while the pointer or the focus is inside, does not run under <code>prefers-reduced-motion</code>, and the slides are announced politely only when it is not moving.</p>
${example({
  label: 'xo-carousel as a banner',
  preview: `
<xo-carousel class="banner" label="What people say" dots autoplay="6000" loop>
  <blockquote><p>The form just worked: validation, errors and the draft came from the OpenAPI document.</p><footer>Ada, platform team</footer></blockquote>
  <blockquote><p>We deleted our table component and kept the markup.</p><footer>Grace, admin app</footer></blockquote>
  <blockquote><p>Strict CSP on day one, no exceptions to write.</p><footer>Barbara, security</footer></blockquote>
</xo-carousel>`,
})}

<h2>A gallery with thumbnails</h2>
<p>A slide with <code>data-thumb</code> gives its picture to the button that goes to it, in place of a dot. Keys on the picture area: Left and Right, Home and End.</p>
${example({
  label: 'xo-carousel as a gallery',
  preview: `
<xo-carousel label="Gallery" dots>
  <img src="img/gallery-1.svg" alt="Clay hills" data-thumb="img/gallery-1.svg">
  <img src="img/gallery-2.svg" alt="Green valley" data-thumb="img/gallery-2.svg">
  <img src="img/gallery-3.svg" alt="Night over the ridge" data-thumb="img/gallery-3.svg">
</xo-carousel>`,
})}

<h2>Slides from data</h2>
<p>The slides can come from the data layer: put <code>xo-each</code> on the slide. The carousel follows its children as they arrive and change.</p>
${example({
  label: 'xo-carousel with data',
  preview: `
<xo-view get="listPeople" p-limit="6">
  <xo-carousel class="service-cards" label="People" items="2" counter no-arrows>
    <article class="card" xo-each="items"><h3>{name}</h3><p>{email}</p><span class="badge">{role}</span></article>
  </xo-carousel>
</xo-view>`,
})}
<h2>Arrows at the sides</h2>
<p>The arrows, dots and counter are children of the carousel's controls row. To lay them out another way, make the row and the arrows' box transparent to layout (<code>display: contents</code>) and place each piece in the carousel's own grid. This is how this site draws them:</p>
${tabs('Layout recipe', [['CSS', 'css', `
xo-carousel { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; column-gap: 0.75rem; align-items: center; }
xo-carousel .xo-carousel-controls, xo-carousel .xo-carousel-nav { display: contents; }
xo-carousel .xo-carousel-track { grid-column: 2; grid-row: 1; }
xo-carousel .xo-carousel-prev { grid-column: 1; grid-row: 1; }
xo-carousel .xo-carousel-next { grid-column: 3; grid-row: 1; }
xo-carousel .xo-carousel-dots { grid-column: 2; grid-row: 2; justify-self: center; }
xo-carousel .xo-carousel-count { grid-column: 2; grid-row: 2; justify-self: end; }`]])}
<table class="props">
<thead><tr><th>API</th><th>What it does</th></tr></thead>
<tbody>
<tr><td><code>items</code></td><td>Slides visible at once (default 1; <code>1.15</code> lets the next one peek)</td></tr>
<tr><td><code>dots</code>, <code>counter</code>, <code>no-arrows</code></td><td>The position buttons (or thumbnails), "1 / 5", hide the arrows</td></tr>
<tr><td><code>loop</code>, <code>autoplay</code></td><td>Next at the end returns to the first; move on by itself every n milliseconds</td></tr>
<tr><td><code>index</code>, <code>count</code>, <code>next()</code>, <code>prev()</code>, <code>goTo(i)</code>, <code>play()</code>, <code>pause()</code></td><td>Control it from code; <code>index</code> is the first visible slide</td></tr>
<tr><td><code>xo-carousel-change</code></td><td>Fires with <code>{ index, count }</code></td></tr>
</tbody></table>
<p>Not included on purpose: crossfade and 3D styles, an endless loop made of cloned slides, and a continuously scrolling logo strip. They need a different mechanism than scroll snap, and the last two are bad for people who use a keyboard or a screen reader; a CSS animation does the logo strip well.</p>
`,
  },
  // ------------------------------------------------------------------------------------------------------------------------------
  {
    file: 'own-control.html', section: 'docs', group: 'Controls', nav: 'Your own control', title: 'Your own control',
    description: 'Build a form control on XoControl.',
    body: `
<h1>Your own control</h1>
<p>A control that takes part in forms extends <code>XoControl</code>. It gets a value, validity, <code>dirty</code>, <code>touched</code>, <code>name</code> and <code>disabled</code>, and talks to the form binder through <code>ElementInternals</code>. You only write the rendering and call <code>userInput()</code> when the person changes something.</p>
${tabs('XoControl', [['JavaScript', 'js', `
import { XoControl, define, html } from '@xoong/core';

class RatingStars extends XoControl {
  render() {
    return html\`\${[1, 2, 3, 4, 5].map((n) => html\`
      <button type="button" aria-pressed=\${() => String(this.value >= n)} @click=\${() => this.userInput(n)}>★</button>\`)}\`;
  }
}
define('rating-stars', RatingStars);`], ['HTML', 'html', `
<form xo-submit="updateReview">
  <rating-stars name="rating"></rating-stars>
  <button>Save</button>
</form>`]])}
`,
  },
  // ------------------------------------------------------------------------------------------------------------------------------
  {
    file: 'components.html', section: 'docs', group: 'Controls', nav: 'Standard', title: 'Controls standard',
    description: 'One size scale, one focus ring and the same states for every control.',
    body: kit('components.html'),
  },
  {
    file: 'controls-demo.html', section: 'docs', group: 'Controls', nav: 'All controls', title: 'All controls',
    description: 'Every control with realistic content, in one place.',
    body: kit('controls-demo.html'),
  },
  {
    file: 'icons.html', section: 'docs', group: 'Controls', nav: 'Icons', title: 'Icons',
    description: 'The icon set: 24px grid, 1.75 stroke, currentColor.',
    body: kit('icons.html'),
  },
  // ------------------------------------------------------------------------------------------------------------------------------
  {
    file: 'demo.html', section: 'demo', group: 'Demo', nav: 'Live demo', title: 'Live demo', demo: true, richtext: true,
    description: 'A small admin screen built with xoong: a data table, an add dialog and bulk actions on a fake in-page API.',
    body: `
<h1>Live demo</h1>
<p>A small people admin on the in-page API: sort, search, page, add someone, delete one or several. It is a table, a dialog with a generated form, and two buttons; there is no application code. Changes last until you reload.</p>
${example({
  label: 'People admin',
  preview: `
<xo-view get="listPeople">
  <p class="toolbar"><button xo-open="#add">Add person</button></p>
  <xo-table columns="name,email:E-mail,role,topics:Topics" sortable filters="name:Search by name" selectable page-size="5" empty="Nobody here">
    <span slot="role" class="badge">{role}</span>
    <span slot="topics"><span class="badge" xo-each="topics">{.}</span></span>
    <button xo-click="deletePerson" xo-confirm="Delete {name}?" xo-notice="Deleted">Delete</button>
    <button slot="bulk" xo-click="deletePerson" xo-selected xo-confirm="Delete the ticked people?">Delete ticked</button>
  </xo-table>
</xo-view>
<xo-dialog id="add">
  <h2>Add person</h2>
  <xo-view><xo-form op="createPerson" submit="Add"></xo-form></xo-view>
  <button type="button" xo-close>Cancel</button>
</xo-dialog>`,
  extra: [['main.js', 'js', { file: 'site/src/demo.js' }], ['api.js', 'js', { file: 'site/src/api.js' }]],
})}
<p>The <em>api.js</em> tab is the whole backend of this page. Replace <code>fetch: handle</code> with a <code>baseUrl</code> and the same markup talks to a real server.</p>`,
  },

  // ------------------------------------------------------------------------------------------------------------------------------
  {
    file: 'brand.html', section: 'brand', title: 'Brand kit',
    description: 'The identity of xoong: logo, colour, type and voice, with downloads.',
    body: `
  <div class="page-head"><div class="wrap"><h1>Brand kit</h1><p class="lede">The identity of xoong: a small pot with a lot of heat.</p></div></div>
  <div class="wrap">
  <div class="prose">
    <h2>The idea</h2>
    <p><em>Xoong</em> is the Vietnamese word for a saucepan, the pot every kitchen has and nobody replaces. That is the framework: one small, sturdy tool that does the whole job. The steam rising from the lid is a pair of angle brackets, so the pot reads as code at a glance.</p>
    <p>Personality: <strong>practical, warm, a little cheeky.</strong> We talk like a good cook explaining a recipe, not like a vendor selling a platform.</p>
  </div>

  <section>
    <div class="head"><span class="eyebrow">Logo</span><h2>Mark and wordmark</h2><p>The mark is the only symbol. The wordmark is lowercase <b>xoong</b>, heavy weight, tracking −0.045em. On this site the mark is inline SVG and follows the palette (use the menu in the header); the files below are fixed colour.</p></div>
    <div class="logo-grid">
      <div class="tile on-rice"><span class="lockup"><img src="brand/mark.svg" alt=""><span class="word">xoong</span></span><small>mark.svg · on Paper</small></div>
      <div class="tile on-soot"><span class="lockup"><img src="brand/mark-reverse.svg" alt=""><span class="word">xoong</span></span><small>mark-reverse.svg · on Ink</small></div>
      <div class="tile on-ember"><span class="lockup"><img src="brand/mark-mono.svg" alt=""><span class="word">xoong</span></span><small>mark-mono.svg · one colour</small></div>
      <div class="tile on-broth"><span class="sizes"><img src="brand/favicon.svg" alt="" width="72" height="72"><img src="brand/favicon.svg" alt="" width="48" height="48"><img src="brand/favicon.svg" alt="" width="32" height="32"><img src="brand/favicon.svg" alt="" width="16" height="16"></span><small>favicon.svg · 72 48 32 16</small></div>
    </div>
    <div class="prose"><p>Clear space equals one handle (about a fifth of the mark) on every side. Minimum size: 16 px for the icon, 24 px for the mark. Do not recolour the pot outside a palette, add outlines, rotate it for effect or use the steam alone.</p></div>
    <div class="dl">
      <a class="btn" href="brand/mark.svg" download>mark.svg</a><a class="btn" href="brand/mark-reverse.svg" download>mark-reverse.svg</a><a class="btn" href="brand/mark-mono.svg" download>mark-mono.svg</a><a class="btn" href="brand/favicon.svg" download>favicon.svg</a>
      <a class="btn" href="brand/mark-ember.svg" download>mark-ember.svg</a><a class="btn" href="brand/mark-ember-reverse.svg" download>mark-ember-reverse.svg</a><a class="btn" href="brand/favicon-ember.svg" download>favicon-ember.svg</a>
      <a class="btn" href="brand/lockup.png" download>lockup.png</a><a class="btn" href="brand/og.png" download>og.png</a>
    </div>
  </section>

  <section>
    <div class="head"><span class="eyebrow">Colour</span><h2>Two palettes, one structure.</h2><p><b>Calm</b> (clay and sage on warm paper) is the default. <b>Ember</b> turns the heat up. A palette is only a set of custom-property values, so a third is easy: see the tabs below.</p></div>
    <ul class="swatches">
      <li><span class="swatch-chip c-clay"></span><div class="info"><b>Clay</b><code>#DF8A6A</code><p>Calm: the pot, fills.</p></div></li>
      <li><span class="swatch-chip c-deep"></span><div class="info"><b>Clay Deep</b><code>#9A4D33</code><p>Calm: links, primary actions.</p></div></li>
      <li><span class="swatch-chip c-soot"></span><div class="info"><b>Ink</b><code>#2B2623</code><p>Text, outlines, dark surfaces.</p></div></li>
      <li><span class="swatch-chip c-paper"></span><div class="info"><b>Paper</b><code>#F7F4EC</code><p>Page background.</p></div></li>
      <li><span class="swatch-chip c-ember"></span><div class="info"><b>Ember</b><code>#FF5B22</code><p>Ember palette: the pot.</p></div></li>
      <li><span class="swatch-chip c-embdeep"></span><div class="info"><b>Ember Deep</b><code>#B93A0A</code><p>Ember: links on light.</p></div></li>
      <li><span class="swatch-chip c-sesame"></span><div class="info"><b>Sesame</b><code>#E6C783</code><p>Notes, highlights.</p></div></li>
      <li><span class="swatch-chip c-herb"></span><div class="info"><b>Sage</b><code>#5B8A6B</code><p>Success.</p></div></li>
    </ul>
    ${tabs('Palette as tokens', [['CSS', 'css', `
/* a palette is values for the brand tokens; the site maps them onto the --xo-* tokens */
:root[data-palette="ember"] {
  --ember:      light-dark(#ff5b22, #ff7a45);
  --ember-deep: light-dark(#b93a0a, #ff9068);
  --bg:         light-dark(#fff8ee, #15110f);
  --text:       light-dark(#1c1512, #f6ebdd);
}`], ['HTML', 'html', `
<xo-menu label="Colour palette" value="calm">
  <button xo-menu-trigger>Palette</button>
  <button value="calm">Calm</button>
  <button value="ember">Ember</button>
</xo-menu>`]])}
  </section>

  <section>
    <div class="head"><span class="eyebrow">Type</span><h2>System fonts, set with confidence.</h2><p>No font files: zero requests and a strict CSP that stays strict.</p></div>
    <div class="type-row"><small>Display<br>800 · −0.055em</small><div class="t-display">One pot. Whole app.</div></div>
    <div class="type-row"><small>Text<br>400 · 17px / 1.65</small><div>Avenir Next, Segoe UI Variable, then the system UI font. Short paragraphs, plain words.</div></div>
    <div class="type-row"><small>Code<br>ui-monospace</small><div class="t-mono">&lt;xo-view get="listPeople"&gt;</div></div>
  </section>

  <section>
    <div class="head"><span class="eyebrow">Voice</span><h2>Say it like a cook.</h2></div>
    <div class="dodont">
      <div class="card"><span class="no">Do</span><ul><li>Be concrete: “one way to do each thing”.</li><li>Use kitchen words lightly: pot, recipe, ingredients.</li><li>Say the status honestly: prototype, Draft syntax.</li><li>Lead with what the reader can do next.</li></ul></div>
      <div class="card"><span class="no bad">Don't</span><ul><li>Say “revolutionary”, “blazing” or “next-gen”.</li><li>Use more than one cooking word per paragraph.</li><li>Promise what is still planned.</li><li>Write the name in capitals. It is <b>xoong</b>.</li></ul></div>
    </div>
  </section>
  </div>`,
  },

  // ------------------------------------------------------------------------------------------------------------------------------
  {
    file: '404.html', root: true, title: 'Page not found', script: 'not-found.js',
    description: 'This page went off the boil.',
    body: `
  <div class="lost"><div>
    <div class="big" aria-hidden="true"><span>4</span>${mark({ size: 128, steam: true })}<span>4</span></div>
    <h1>This page went off the boil</h1>
    <p>We could not find <span class="path" id="lost-path">this page</span>. It may have moved, or the link may be wrong.</p>
    <div class="actions"><a class="btn primary" href="index.html">Back to the kitchen</a><a class="btn" href="overview.html">Read the docs</a></div>
  </div></div>`,
  },
];
