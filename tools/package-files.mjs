// Writes what every package needs to be published: LICENSE, a README (shown on npmjs.com), a good description and publishConfig.
//   node tools/package-files.mjs          write the files (they are committed; test/publish.test.mjs checks they are up to date)
// The texts live here, so one place says what each package is.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const license = readFileSync(new URL('LICENSE', root), 'utf8');
const REPO = 'https://github.com/fpt-duongtx/xoong';

/** name -> { description?, intro, use } */
const TEXTS = {
  core: { intro: 'The reactive base of xoong: signals, `html` templates and Light DOM custom elements. No dependencies.', use: `
\`\`\`js
import { signal, computed, effect, html, render, XoElement, define } from '@xoong/core';

const count = signal(0);
class ClickCounter extends XoElement {
  render() { return html\`<button @click=\${() => count.value++}>Clicked \${() => count.value}</button>\`; }
}
define('click-counter', ClickCounter);
\`\`\`

\`XoControl\` (also here) is the base of form controls: value, validity, \`dirty\` and \`touched\` through \`ElementInternals\`.` },
  data: { intro: 'The data layer of xoong: a typed client generated from your OpenAPI document, a query cache keyed by operation and parameters, a shared entity store, `<xo-view>` and live updates over server-sent events.', use: `
\`\`\`js
import { configure } from '@xoong/data';
import '@xoong/data/view';
import operations from './.xoong/operations.json' with { type: 'json' };   // written by \`npx xoong sync openapi.json\`

configure({ api: operations, baseUrl: '/api' });
\`\`\`
\`\`\`html
<xo-view get="listPeople">
  <p xo-if="$loading">Loading…</p>
  <ul><li xo-each="items">{name}</li></ul>
</xo-view>
\`\`\`` },
  forms: { intro: 'Forms for xoong: a draft model with per-field state, validation from the OpenAPI request schema, your own rules, payload normalisation and dirty tracking, bound to plain `<form xo-submit>` markup.', use: `
\`\`\`html
<xo-view get="getPerson" p-id="1">
  <form xo-submit="updatePerson">
    <input name="name"> <input name="email" type="email">
    <button>Save</button>
  </form>
</xo-view>
\`\`\`
Importing \`@xoong/ui\` (or \`@xoong/forms\` itself) turns every \`<form xo-submit>\` into a form with a model: \`form.model\`, \`$form.dirty\`, server errors by field.` },
  ui: { description: 'xoong admin set: xoong.css tokens, <xo-table>, <xo-form>, <xo-dialog>, toast, confirm and a declarative History-API router. Depends on @xoong/core, @xoong/data and @xoong/forms.', intro: 'The admin set of xoong: design tokens in cascade layers, `<xo-table>`, a form generated from the request schema, `<xo-dialog>`, toasts, confirm dialogs and `<xo-router>`.', use: `
\`\`\`js
import '@xoong/ui';
\`\`\`
\`\`\`html
<link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
<link rel="stylesheet" href="/@xoong/ui/src/mist.css">   <!-- optional: the Mist look (the Rainlet design system), one self-sufficient file -->
<xo-view get="listPeople">
  <xo-table columns="name,email:E-mail,role" sortable filters="name:Search" page-size="10"></xo-table>
</xo-view>
\`\`\`` },
  controls: { intro: 'Accessible controls for xoong as Light DOM custom elements: tabs, menu, tooltip, combobox, tags and carousel. Only depends on `@xoong/core`.', use: `
\`\`\`js
import '@xoong/controls';          // everything, or one: '@xoong/controls/carousel'
\`\`\`
\`\`\`html
<xo-tabs label="Page"><section xo-tab="General">…</section><section xo-tab="SEO">…</section></xo-tabs>
<xo-combobox name="author" multiple><option value="1">Ada</option></xo-combobox>
<xo-carousel label="Services" items="3" dots counter>…</xo-carousel>
\`\`\`` },
  richtext: { intro: 'A small rich text editor for xoong forms: sanitised HTML in and out, an accessible toolbar in two sizes, a media hook. Only depends on `@xoong/core`.', use: `
\`\`\`js
import '@xoong/richtext';
\`\`\`
\`\`\`html
<xo-richtext name="body" label="Body" media></xo-richtext>
\`\`\`
\`@xoong/richtext/sanitize\` exports the sanitiser, so your server can clean the HTML again on save.` },
  i18n: { intro: 'Internationalisation for xoong: JSON catalogs with an ICU subset, `xo-t` in markup, a locale signal and Intl formats. Built-in strings come with an English catalog and Vietnamese.', use: `
\`\`\`js
import { configureI18n, setLocale } from '@xoong/i18n';

configureI18n({ locale: 'en', load: (code) => fetch(\`/i18n/\${code}.json\`).then((r) => r.json()) });
await setLocale('vi');
\`\`\`
\`\`\`html
<h1 xo-t="home.title">Welcome</h1>
\`\`\`` },
  cli: { description: 'The xoong command line: sync (OpenAPI to typed operations), doctor, check (lint screens), dev, build (strict-CSP static output), render and i18n.', intro: 'The `xoong` command: turns an OpenAPI document into typed operations, lints your screens, runs the dev server and builds static output that runs under a strict Content-Security-Policy.', use: `
\`\`\`bash
npx xoong sync openapi.json        # writes .xoong/operations.json, api.d.ts and the editor data
npx xoong doctor openapi.json      # what in the document (and in xoong.hints.json) limits xoong
npx xoong check index.html         # lint screens against the API (--format json, --exclude)
npx xoong dev                      # static server with an API proxy
npx xoong build --out dist         # strict-CSP static output (--base, --include, --exclude, --no-preload)
npx xoong render page.html --api http://localhost:8080   # prerender a page (needs @xoong/ssr)
npx xoong i18n extract src --out catalogs/en.json         # the xo-t messages; i18n check <catalog> --source <en.json>
npx xoong --help                   # every command and option; an option that does not exist is refused
\`\`\`
Exit code: 0 done, 1 findings or a failure, 2 an unknown command or a missing argument.` },
  server: { intro: 'The server behind `xoong dev` and `xoong build`: one `(Request) => Response` handler for static files, an API proxy and TypeScript type stripping, with a Node adapter. Never shipped to the browser.', use: `
\`\`\`js
import { createHandler } from '@xoong/server';
import { serve } from '@xoong/server/node';
\`\`\`
See the docs for the options.` },
  test: { intro: 'Test helpers for xoong screens: mount markup with a mocked API generated from `operations.json`, click, submit and push live events. Runs on Vitest.', use: `
\`\`\`js
import { mount, mockApi } from '@xoong/test';

const api = mockApi(operations, { listPeople: () => ({ items: [{ id: 1, name: 'Ada' }] }) });
const screen = await mount('<xo-view get="listPeople"><li xo-each="items">{name}</li></xo-view>', { api });
expect(screen.texts('li')).toEqual(['Ada']);
\`\`\`` },
  mcp: { intro: 'An MCP server for xoong: gives AI assistants the spec (`llms.txt`) and the docs, the operations of your API, `xoong check`, and explanations of every error code, element and attribute, over stdio.', use: `
\`\`\`bash
npx xoong-mcp
\`\`\`
Add it to your assistant's MCP configuration as a stdio server running \`xoong-mcp\`. Tools: \`get_spec\`, \`list_operations\`, \`check\`, \`explain_error\`, \`explain_syntax\`, \`search_docs\`. The spec and the docs come with the package.` },
  lsp: { intro: 'A language server for xoong screens: the diagnostics of `xoong check`, completion of operation names, `xo-*` attributes and the attributes and values of each element, hover documentation and quick fixes, in any editor that speaks LSP.', use: `
\`\`\`bash
npx xoong-lsp
\`\`\`` },
  ssr: { intro: 'Prerender xoong pages: runs the real `<xo-view>` runtime in Node (happy-dom), waits for the data and writes HTML. There is no hydration step: the browser re-renders from the saved template.', use: `
\`\`\`bash
npx xoong render page.html --api https://api.example.org --out page.prerendered.html
\`\`\`
Public pages only: a page that needs the visitor's session is rendered in the browser.` },
  xoong: { intro: 'One install for xoong, a small standards-first web framework: signals and templates, the OpenAPI data layer, forms, the admin set and the `xoong` command.', use: `
\`\`\`bash
npm install @xoong/xoong
npx xoong sync openapi.json
\`\`\`
\`\`\`js
import { configure, signal, html } from '@xoong/xoong';
import '@xoong/xoong/view';
import '@xoong/xoong/ui';
\`\`\`
More parts, installed separately: \`@xoong/controls\`, \`@xoong/richtext\`, \`@xoong/i18n\`, \`@xoong/test\`, \`@xoong/ssr\`, \`@xoong/mcp\`, \`@xoong/lsp\`.` },
};

for (const dir of readdirSync(new URL('packages/', root)).sort()) {
  const pkgUrl = new URL(`packages/${dir}/package.json`, root);
  const pkg = JSON.parse(readFileSync(pkgUrl, 'utf8'));
  const t = TEXTS[dir];
  if (!t) throw new Error(`no README text for packages/${dir}`);
  if (t.description) pkg.description = t.description;
  pkg.publishConfig = { access: 'public' };
  pkg.engines = { node: '>=22.12' }; // the baseline of the tools and of the tests; browser packages run anywhere
  writeFileSync(pkgUrl, JSON.stringify(pkg, null, 2) + '\n');
  writeFileSync(new URL(`packages/${dir}/LICENSE`, root), license);
  const install = dir === 'xoong' ? '' : `\n## Install\n\n\`\`\`bash\nnpm install ${pkg.name}\n\`\`\`\n`;
  writeFileSync(new URL(`packages/${dir}/README.md`, root), `# ${pkg.name}\n\n${t.intro}\n${install}\n## Use\n${t.use}\n\n## More\n\n* Documentation, guides and live demos: https://fpt-duongtx.github.io/xoong/\n* Source: ${REPO}/tree/main/packages/${dir}\n* All packages share one version number and are released together: ${REPO}/releases\n* xoong is a working prototype (0.0.x): the HTML syntax is still Draft.\n\nMIT licence.\n`);
}
console.log('wrote LICENSE, README.md and publishConfig for every package');
