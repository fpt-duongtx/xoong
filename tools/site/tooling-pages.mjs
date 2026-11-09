// The Tools section of the documentation site: the command line, the MCP server, editor support and the list of error codes.
//
// What can drift is generated, not written:
//   - the commands, their options and defaults, the exit codes     packages/cli/src/usage.js (also the source of `xoong --help` and of the parser)
//   - the tools and their input schemas, the explanation of every code   packages/mcp/src/server.js (TOOLS, EXPLANATIONS)
//   - the output of `xoong check`, the file the editor reads, the MCP exchange   the real code, run on the site's demo API when the pages are generated
// A command, option, tool or code that has no text here makes the generator throw, so a new one cannot ship undocumented.
// test/tooling-pages.test.mjs keeps the pages and the sources in step.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tabs, callout, code, esc, dedent, highlight } from './lib.mjs';
import { USAGE, GLOBAL_OPTIONS, EXIT_CODES, commandUsage } from '../../packages/cli/src/usage.js';
import { checkHtml, formatFindings } from '../../packages/cli/src/check.js';
import { analyze, runtimeTable, HINT_KEYS } from '../../packages/cli/src/openapi.js';
import { htmlData } from '../../packages/cli/src/html-data.js';
import { TOOLS, EXPLANATIONS } from '../../packages/mcp/src/server.js';

const root = new URL('../..', import.meta.url).pathname;
const c = (s) => `<code>${esc(s)}</code>`;
/** Text with `code` spans (the explanations of the codes are written that way), escaped. */
const md = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const table = (head, rows) => `<div class="table-wrap"><table class="names">
<thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
<tbody>
${rows.map((r) => `<tr>${r.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('\n')}
</tbody></table></div>`;
/** A terminal session: the lines that start with "$ " are commands (highlighted, the prompt dimmed); the rest is what they print. */
const term = (src) => `<pre class="plain" data-lang="bash" tabindex="0"><code>${dedent(src).split('\n').map((l) => (l.startsWith('$ ') ? `<span class="tok-c">$</span> ${highlight('bash', l.slice(2))}` : esc(l))).join('\n')}</code></pre>`;
/** The same markup as `tabs`, for blocks that are already HTML. */
const tabbed = (label, items) => `<xo-tabs label="${esc(label)}" class="example">\n${items.map(([name, html]) => `  <section xo-tab="${esc(name)}">${html.replace(' class="plain"', '')}</section>`).join('\n')}\n</xo-tabs>`;
const see = (...links) => `<p><strong>See also:</strong> ${links.join(' · ')}</p>`;
const link = (href, text) => `<a href="${href}">${text}</a>`;

// ---- the demo API every example runs on (the site's own: people) --------------------------------------------------------------------
const DEMO = JSON.parse(readFileSync(join(root, 'site/demo/openapi.json'), 'utf8'));
const OPERATIONS = runtimeTable(analyze(DEMO));

// ====================================================================================================================================
// Error codes: the families, and the explanation of every code (the text `explain_error` returns)
// ====================================================================================================================================
/** Every code belongs to one family (the tens digit). A code without a family makes the generator throw. */
export const CODE_FAMILIES = [
  { tool: 'check', prefix: 'XO20', title: 'Operations in screens', text: 'A name in xo-click, xo-submit, get or op that is not in the synced API, or an operation used the wrong way round: a click that calls a read, a view that reads a write, and in JavaScript load on a write or mutate on a read.' },
  { tool: 'check', prefix: 'XO21', title: 'Path parameters', text: 'A view whose operation has a {param} in its path and no p-param to fill it.' },
  { tool: 'check', prefix: 'XO22', title: 'Forms and expressions', text: 'xo-submit away from a form, a form outside an xo-view (it never binds), an xo-each, xo-if or xo-body with no path.' },
  { tool: 'check', prefix: 'XO23', title: 'Unknown names', text: 'An xo-* element or attribute that xoong does not define. Nearly always a typo; the message names the closest one.' },
  { tool: 'check', prefix: 'XO24', title: 'Accessibility and images', text: 'A button without a name, a click that a keyboard cannot reach, an xo-image without alt, an img whose src is bound inside a view.' },
  { tool: 'check', prefix: 'XO25', title: 'Tables, pagers, generated forms and selection', text: 'A table or pager asking for sorting, paging or filters that the operation does not offer, or sitting outside a view; a generated form with nothing to generate; xo-select and xo-selected used wrongly.' },
  { tool: 'check', prefix: 'XO26', title: 'Routes and layouts', text: 'A route path that is missing, malformed or repeated, a layout that is not declared or has no outlet, a route parameter that the route does not have.' },
  { tool: 'check', prefix: 'XO27', title: 'Attributes in the wrong place', text: 'An attribute that does nothing where it stands, a value outside its set or malformed, a name that the operation does not have, an attribute outside the element that gives it meaning.' },
  { tool: 'doctor', prefix: 'XO10', title: 'The document and its identity', text: 'No paths at all, or an x-xoong-id that names nothing or disagrees between the schemas of one entity.' },
  { tool: 'doctor', prefix: 'XO11', title: 'Operations', text: 'A missing or repeated operationId, an undeclared path parameter, and what the document asks for that xoong does not do (a required header, cookies, HEAD or OPTIONS, servers, a query style).' },
  { tool: 'doctor', prefix: 'XO12', title: 'Responses', text: 'A GET without an application/json success schema, so no types or cache can be made.' },
  { tool: 'doctor', prefix: 'XO13', title: 'Error responses', text: 'An operation that documents no 4xx, 5xx or default response.' },
  { tool: 'doctor', prefix: 'XO14', title: 'Entities', text: 'A schema with an id-like property that is not treated as an entity, so its records are not shared between screens.' },
  { tool: 'doctor', prefix: 'XO15', title: 'References', text: 'A $ref that points nowhere, or outside the document.' },
  { tool: 'doctor', prefix: 'XO16', title: 'Unions', text: 'Members of a union that cannot be told apart, in a response or in a request body.' },
  { tool: 'doctor', prefix: 'XO17', title: 'The hints file', text: 'A key of xoong.hints.json that does nothing, or a hint that names something the document does not have.' },
];
const codesOf = (family) => Object.keys(EXPLANATIONS).filter((k) => k.startsWith(family.prefix)).sort();
for (const code of Object.keys(EXPLANATIONS)) if (!CODE_FAMILIES.some((f) => code.startsWith(f.prefix))) throw new Error(`tooling-pages: ${code} has no family in CODE_FAMILIES`);
for (const f of CODE_FAMILIES) if (!codesOf(f).length) throw new Error(`tooling-pages: the family ${f.prefix}x has no code`);
const codeLink = (code) => `<a href="codes.html#${code.toLowerCase()}">${code}</a>`;

// ====================================================================================================================================
// Command line
// ====================================================================================================================================
const SAMPLE_SCREEN = `<xo-view get="GET /api/people">
  <button xo-click="deletePersn" xo-confirm-kind="danger">Delete</button>
  <xo-table columns="name,email" sortable></xo-table>
</xo-view>
`;
const SAMPLE_FINDINGS = checkHtml(SAMPLE_SCREEN, OPERATIONS, 'screens/people.html');
if (!SAMPLE_FINDINGS.length) throw new Error('tooling-pages: the sample screen no longer has a finding to show');

/** What each command does, for the table at the top: [what it does, what it reads, what it writes]. A command of usage.js without an entry throws. */
const GLANCE = {
  sync: ['Turns an OpenAPI document into the files the runtime and the editor read.', 'An OpenAPI 3 or Swagger 2 document (a file or a URL), a hints file', '<code>.xoong/operations.json</code>, <code>api.d.ts</code>, <code>xoong.html-data.json</code>'],
  doctor: ['Audits the document and says what limits xoong, with a fix for each finding.', 'The document, a hints file', 'Nothing'],
  new: ['Creates a project with a first list screen.', 'The document', 'A project folder'],
  check: ['Checks screens against your API: operations that do not exist, attributes in the wrong place, missing names.', 'HTML, JavaScript and TypeScript files, <code>operations.json</code>', 'Nothing'],
  render: ['Prerenders a page, with its data, into plain HTML.', 'A page, the API it reads from, <code>operations.json</code>', 'The HTML: a file, or standard output'],
  build: ['Writes static files that run under a strict Content-Security-Policy.', 'Every page under the root and what they reference', '<code>dist/</code> and <code>dist/build-report.json</code>'],
  'i18n extract': ['Lists the translatable texts (<code>xo-t</code>) with their source text.', 'HTML and JavaScript files', 'A catalog (JSON): a file, or standard output'],
  'i18n check': ['Compares a translation with the source catalog.', 'Two catalog files', 'Nothing'],
  dev: ['Serves the app while you work: static files, an API proxy, TypeScript.', 'The project folder', 'Nothing'],
};
for (const command of USAGE) if (!GLANCE[command.name]) throw new Error(`tooling-pages: the command "${command.name}" has no entry in GLANCE`);

/** The options of a command: the flag (how its value is written is in the usage line above the table), what is used without it, and what it does. */
const optionsTable = (command) => table(['Option', 'Default', 'What it does'], command.options.map((o) => {
  const fallback = o.required ? '<em>required</em>' : o.value === undefined ? 'off' : o.default === undefined ? 'none' : /\s/.test(o.default) ? esc(o.default) : c(o.default);
  const extra = [o.choices ? `One of ${o.choices.map(c).join(' or ')}.` : '', o.repeatable ? 'May be given more than once.' : ''].filter(Boolean).join(' ');
  return [c(o.flag), fallback, `${md(o.doc)}${extra ? ` ${extra}` : ''}`];
}));
const usageBlock = (command) => code('bash', `xoong ${commandUsage(command)}`).replace('<pre ', '<pre class="plain" ');
const byName = (name) => USAGE.find((u) => u.name === name) ?? (() => { throw new Error(`tooling-pages: no command "${name}"`); })();
/** The usage line and the table of options of a command, both from usage.js. */
const reference = (name) => `${usageBlock(byName(name))}\n${byName(name).options.length ? optionsTable(byName(name)) : ''}`;

const CHECK_TEXT = formatFindings(SAMPLE_FINDINGS, { files: 1 });
const CHECK_JSON = JSON.stringify(SAMPLE_FINDINGS, null, 2);

/** What `xoong.config.json` may hold: [key, used by, default, meaning]. test/tooling-pages.test.mjs keeps the keys in step with dev.js, build.js and cli.js. */
const CONFIG_KEYS = [
  ['root', 'dev', '.', 'The folder to serve. The <code>--root</code> flag wins.'],
  ['port', 'dev', '5173', 'The port. The <code>--port</code> flag wins.'],
  ['proxy', 'dev', 'none', 'An object of prefixes and backends, <code>{ "/api": "http://localhost:8080" }</code>. It adds to the <code>--proxy</code> flags; for the same prefix the flag wins.'],
  ['spa', 'dev', 'false', 'The same as <code>--spa</code>.'],
  ['allowedHosts', 'dev', '[]', 'Host names the dev server accepts besides localhost, 127.0.0.1 and ::1. Any other <code>Host</code> header gets a 403, which stops a web page from reaching your machine through DNS rebinding. Add a name when you reach the server through a tunnel.'],
  ['packages', 'dev, build', '[]', 'Installed packages, besides xoong\'s own, whose browser code the app imports. They are served at <code>/@name</code>, listed in the import map and copied by the build.'],
  ['build.exclude', 'build', '[]', 'Globs of HTML files that are not pages. They add to the <code>--exclude</code> flags of <code>build</code>.'],
  ['build.preload', 'build', 'true', '<code>false</code> turns off the <code>modulepreload</code> links, like <code>--no-preload</code>.'],
  ['build.minify', 'build', 'false', '<code>true</code> minifies scripts, stylesheets and JSON with the esbuild the project has installed, like <code>--minify</code>; without esbuild the build warns and does not minify.'],
  ['check.exclude', 'check', '[]', 'Globs of files and folders that <code>check</code> skips. They add to its <code>--exclude</code> flags.'],
];

/** What the keys of a hints file do: [key, example, meaning]. A key of HINT_KEYS without an entry throws. */
const HINT_DOCS = {
  idNames: ['["id", "gid"]', 'Property names that identify a record, besides <code>id</code>. A schema that has one is an entity: its records are stored once and shared between screens.'],
  schemas: ['{ "SessionResponse": { "entity": "Session", "id": "session_id" } }', 'Which schemas are one entity (<code>entity</code>) and which property is its id (<code>id</code>), for documents you cannot edit.'],
  unwrap: ['"data"', 'Responses shaped <code>{ code, message, data }</code> are read as their <code>data</code>.'],
  idempotencyKeys: ['{ "sendMessage": "client_message_id" }', 'A fresh UUID is put into that field of the request body on every call of the operation.'],
  fields: ['{ "Person.email": { "label": "E-mail", "order": 2 } }', 'How a generated form draws a field, keyed by <code>Schema.property</code>: <code>label</code>, <code>hint</code>, <code>placeholder</code>, <code>order</code>, <code>group</code>, <code>hidden</code>, <code>readOnly</code> and <code>widget</code>. See ' + link('forms.html', 'Forms') + '.'],
};
for (const key of HINT_KEYS) if (!HINT_DOCS[key]) throw new Error(`tooling-pages: the hint "${key}" has no entry in HINT_DOCS`);

const CI_YAML = `
name: xoong
on: [push, pull_request]
jobs:
  screens:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx xoong sync openapi.json --hints xoong.hints.json
      - run: npx xoong check index.html src
      - run: npx xoong build --out dist
      # a warning of the build does not fail it: this step does
      - run: jq -e '.warnings | length == 0' dist/build-report.json`;

export const cliPage = {
  file: 'cli.html', section: 'docs', group: 'Tools', nav: 'Command line', title: 'Command line',
  description: 'The xoong command: sync, doctor, new, check, dev, build, render and i18n, with every option, its default, an example and the exit codes.',
  body: `
<h1>Command line</h1>
<p class="lead">${c('xoong')} is the command that goes with the framework. It reads your OpenAPI document and writes the table of operations the runtime uses, checks your HTML screens against it, serves the app while you work, and writes static files that run under a strict Content-Security-Policy. It runs in Node, in development and in your build; none of it is sent to the browser.</p>

<h2>Install and run</h2>
<p>The command is part of ${c('@xoong/cli')}. ${c('@xoong/xoong')}, the one install for the runtime and the admin set, depends on it, so either gives you ${c('xoong')}. Both need Node 22.12 or newer. The command reads no environment variables.</p>
${tabs('Install', [['Terminal', 'bash', `
# the runtime, the admin set and the command in one install
npm install @xoong/xoong@next

# or only the command, as a development tool
npm install --save-dev @xoong/cli@next

npx xoong --version
npx xoong --help`]])}
<p>${c('npx xoong')} runs the copy in ${c('node_modules')}. ${c('xoong --help')} (or ${c('-h')}, or ${c('xoong help')}, anywhere on the line) prints every command with every option and does nothing else; ${c('xoong --version')} (${c('-v')}) prints the version. An option that does not exist is refused with the list of the ones that do, never ignored. The MCP server and the language server are separate programs: ${link('mcp.html', c('xoong-mcp'))} and ${link('editor.html', c('xoong-lsp'))}.</p>

<h2>The commands at a glance</h2>
${table(['Command', 'What it does', 'Reads', 'Writes'], USAGE.map((u) => [`<a href="#xoong-${u.name.split(' ')[0]}"><code>xoong&nbsp;${esc(u.name)}</code></a>`, ...GLANCE[u.name]]))}
<p>A project uses them in this order: ${c('sync')} when the API changes, ${c('check')} while you write screens, ${c('dev')} to look at them, ${c('build')} to ship them.</p>
${tabs('A project, day to day', [['Terminal', 'bash', `
npx xoong sync openapi.json --hints xoong.hints.json   # after the API changed
npx xoong check index.html src                          # as you write screens
npx xoong dev                                           # http://127.0.0.1:5173
npx xoong build --out dist                              # what you deploy`]])}

<h2>xoong sync</h2>
<p>Turns your OpenAPI document into what the rest of xoong reads. Run it once, and again whenever the API changes. It reads OpenAPI 3.x as JSON or YAML, from a file or an http(s) URL (Swagger 2.0 is converted first), and writes three files into ${c('.xoong/')}:</p>
<ul>
<li>${c('operations.json')}: the table of operations, with their parameters, request fields and entities. ${link('data.html', c('configure({ api })'))} gives it to the runtime; ${c('check')}, the language server and the MCP server read it too.</li>
<li>${c('api.d.ts')}: TypeScript types for the same operations.</li>
<li>${c('xoong.html-data.json')}: completion data for the editor (${link('editor.html', 'Editor support')}).</li>
</ul>
${reference('sync')}
<p>It prints one line with the counts. Errors print in full, with the code, the place, the message and the fix, and make the exit code 1. What the document asks for and xoong does not do (${codeLink('XO113')}) is one ${c('warning')} line per kind. Any other warnings are only counted: ${c('xoong doctor')} lists them.</p>
${term(`
$ npx xoong sync openapi.json --hints xoong.hints.json
synced 5 operations, 1 entities

$ npx xoong sync openapi.json
synced 1 operations, 0 entities
error XO150 #/components/schemas/Order
  $ref points to something that does not exist
  fix: Define the target or remove the reference
warning XO113: the required header X-Tenant-Id (listOrders) is not sent by xoong. Send it on every call: configure({ headers: () => ({ 'X-Tenant-Id': value }) })`)}
<p>The second run exits with 1 because of the error; the warning alone would not.</p>

<h2>xoong doctor</h2>
<p>A health check of the OpenAPI document, for when you do not own it. It prints what limits xoong (a missing ${c('operationId')}, undocumented errors, schemas that are entities in all but name), each with a fix, and writes nothing. The codes are the ${c('XO1xx')} ones in ${link('codes.html', 'Error codes')}.</p>
${reference('doctor')}
<p>Errors always print in full. Each warning code shows its first five findings and counts the rest, so a large API stays readable; ${c('--all')} prints everything. The exit code is 1 when there is an error, 0 otherwise.</p>
${term(`
$ npx xoong doctor openapi.json --hints xoong.hints.json
error XO150 #/components/schemas/Order
  $ref points to something that does not exist
  fix: Define the target or remove the reference
warn XO113 #/paths (parameters in: header)
  the required header X-Tenant-Id (listOrders) is not sent by xoong
  fix: Send it on every call: configure({ headers: () => ({ 'X-Tenant-Id': value }) })

1 operations, 0 entities, 1 errors, 1 warnings`)}

<h2>xoong new</h2>
<p>Creates a project folder from an OpenAPI document: a page with a table of the first list the API offers (the first GET operation without path parameters whose response is, or contains, a list of objects), a test for it, the configuration and the generated files. It refuses to run in a folder that already has a ${c('package.json')}.</p>
${reference('new')}
<p>It writes ${c('package.json')} (with the scripts ${c('dev')}, ${c('sync')}, ${c('check')} and ${c('test')}), ${c('xoong.config.json')}, ${c('xoong.hints.json')}, ${c('index.html')}, ${c('src/main.ts')}, ${c('src/app.css')}, ${c('vitest.config.mjs')}, ${c('test/index.spec.mjs')}, ${c('README.md')}, a copy of the document as ${c('openapi.json')}, and ${c('.xoong/')} as ${c('sync')} would.</p>
${term(`
$ npx xoong new people-app --spec openapi.json
created /home/you/people-app
  first screen: GET /api/people
  next: cd people-app && npm install && npm run dev
  (the @xoong/* packages come from npm; to use a checkout of the xoong repository instead, run again with --link <path to the xoong repository>)`)}
${callout('note', 'The generated <code>package.json</code> asks for the version of the CLI you ran for every <code>@xoong</code> package (they are released together), so <code>npx @xoong/cli@next new</code> gives a project on the same release. See ' + link('install.html', 'Install') + '.')}

<h2>xoong check</h2>
<p>Finds the mistakes that would otherwise show up as a button that does nothing, before you open a browser. It reads HTML files and, in ${c('.js')}, ${c('.mjs')}, ${c('.ts')} and ${c('.mts')} files, the HTML inside ${c('html`...`')} templates and the operation named in a ${c('client.load')}, ${c('query')}, ${c('mutate')} or ${c('stream')} call. It compares what it finds with ${c('operations.json')}. Give it files and folders; folders are walked without ${c('node_modules')}, ${c('dist')}, ${c('build')}, ${c('coverage')} and folders that start with a dot.</p>
${reference('check')}
<p>Every finding has a code, a place (file, line, column), a message and a fix. An error makes the exit code 1; a warning is printed and does not. Without ${c('.xoong/operations.json')} (or the file ${c('--operations')} names) it stops and tells you to run ${c('xoong sync')}. ${c('--exclude')} and ${c('"check": { "exclude": [] }')} of ${c('xoong.config.json')} take globs, see ${link('#configuration', 'Configuration')}.</p>
${tabbed('Check a screen', [
    ['screens/people.html', code('html', SAMPLE_SCREEN)],
    ['Terminal', term(`$ npx xoong check screens\n${CHECK_TEXT}`)],
    ['--format json', term(`$ npx xoong check screens --format json\n${CHECK_JSON}`)],
  ])}
<p>The rules come in families. Each code is explained on the ${link('codes.html', 'Error codes')} page, and the MCP tool ${link('mcp.html', c('explain_error'))} gives the same text to an assistant.</p>
${table(['Codes', 'What they find'], CODE_FAMILIES.filter((f) => f.tool === 'check').map((f) => [codesOf(f).map(codeLink).join(', '), `<strong>${esc(f.title)}.</strong> ${esc(f.text)}`]))}

<h2>xoong dev</h2>
<p>Serves the app while you work. It needs no bundler and no configuration beyond the proxy:</p>
<ul>
<li><strong>Static files</strong> from the root, with ${c('Cache-Control: no-cache')}. There is no live reload yet: refresh the page.</li>
<li><strong>An import map.</strong> An HTML page that has none gets one before its first script, listing the installed xoong packages (and those named in ${c('packages')}), so ${c("import '@xoong/data'")} works as it is.</li>
<li><strong>TypeScript.</strong> A ${c('.ts')} file is served as JavaScript, with its types stripped (erasable syntax only: no ${c('enum')}, ${c('namespace')} or parameter properties; lines and columns stay the same). Import your own files with the ${c('.ts')} extension.</li>
<li><strong>A proxy</strong> for every prefix you give. ${c('/api/people')} reaches ${c('http://localhost:8080')} as ${c('/people')}: the prefix is removed, so put it in the target (${c('/api=http://localhost:8080/api')}) to keep it. Whole path segments only (${c('/api')} does not match ${c('/apix')}), the longest prefix first, bodies streamed both ways (server-sent events pass through), and a backend that does not answer gives a 502 with the reason.</li>
<li><strong>${c('--spa')}</strong> answers a path without a file extension with ${c('index.html')}, for an app with an ${c('<xo-router>')}.</li>
<li><strong>Safe on a shared network.</strong> It listens on 127.0.0.1 only, serves nothing outside the root, hides folders that start with a dot (except ${c('.xoong')} and ${c('.well-known')}) and refuses a ${c('Host')} that is not local (${c('allowedHosts')} adds names).</li>
</ul>
${reference('dev')}
${term(`
$ npx xoong dev
xoong dev  http://127.0.0.1:5173   (root: /home/you/people-app)
  proxy /api -> http://localhost:8080`)}
<p>It runs until you stop it. It exits with 1 when it cannot start (a port in use, a ${c('--port')} that is not a number from 0 to 65535, an unreadable ${c('xoong.config.json')}). The inline import map is blocked by a strict policy, so never deploy what the dev server sends: use ${c('xoong build')}.</p>

<h2>xoong build</h2>
<p>Writes static files that run under a strict Content-Security-Policy: no import map, no inline script, no inline style. It starts from every ${c('.html')} page under the root and follows what each one references: scripts, stylesheets, images, the modules the scripts import, CSS ${c('url()')} and ${c('@import')}. Installed packages are found in ${c('node_modules')} and copied to the same URLs the dev server uses. Then:</p>
<ul>
<li>bare imports (${c('"@xoong/data"')}) are rewritten to URLs, and the import map is dropped from the pages;</li>
<li>TypeScript is stripped and ${c('.ts')} files are written as ${c('.js')};</li>
<li>${c('src')}, ${c('poster')}, a ${c('<link>')}'s ${c('href')} and every URL of a ${c('srcset')} are copied and, with ${c('--base')}, given the prefix. ${c('<a href>')} is left as written on purpose: a link to another page is for the router, or a plain relative link, to resolve;</li>
<li>every page gets ${c('<link rel="modulepreload">')} for the modules its scripts import, so the browser fetches the chain at once instead of one level at a time (${c('--no-preload')} turns it off);</li>
<li>with ${c('--minify')} (or ${c('build.minify')}), scripts, stylesheets and JSON are minified by the esbuild your project has installed (xoong does not depend on it; without it the build warns and goes on). Two risks: esbuild renames local identifiers (code that reads <code>Function.name</code> or a class's <code>name</code> sees short names), and without esbuild the flag is only a warning, so check that it is in your <code>devDependencies</code>.</li>
<li>nothing is minified or bundled: every output file is the one you wrote, readable in the browser's tools.</li>
</ul>
${reference('build')}
<p>HTML that is not a page (a partial, a fixture, a draft) is kept out with ${c('--exclude')}; a file that a page references is still published. What the build cannot see, such as a ${c('fetch()')} of a data file or an image named in JavaScript, is added with ${c('--include')}.</p>
${tabbed('What changes', [
    ['src/main.ts', code('js', `
import { configure } from '@xoong/data';
import '@xoong/data/view';
import operations from '/.xoong/operations.json' with { type: 'json' };`)],
    ['dist/src/main.js', code('js', `
import { configure } from '/@xoong/data/src/index.js';
import '/@xoong/data/src/view.js';
import operations from '/.xoong/operations.json' with { type: 'json' };`)],
    ['With --base /admin', code('js', `
import { configure } from '/admin/@xoong/data/src/index.js';
import '/admin/@xoong/data/src/view.js';
import operations from '/admin/.xoong/operations.json' with { type: 'json' };`)],
  ])}
<h3>The strict-CSP model</h3>
<p>The build prints the policy its output is tested with, and writes it into ${c('dist/build-report.json')} next to the size of every file (raw and gzipped) and the warnings. It does not send the policy: your host sets the ${c('Content-Security-Policy')} header. ${link('arch-build.html#the-csp-model', 'The CSP model')} explains why the runtime needs nothing the policy forbids.</p>
${term(`
$ npx xoong build --out dist
built 23 files into /home/you/people-app/dist (135.5 KB, 47.6 KB gzip)

runs under:  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'self'`)}
<p>The build warns about what that policy would block in your own pages: an inline ${c('<script>')}, a ${c('style=""')} attribute, an inline ${c('<style>')}. It also warns about a bare import it cannot resolve and a referenced file that does not exist. A warning does not fail the build (the exit code stays 0); it is printed and written to the report, so a CI job can fail on it.</p>
${term(`
warning: /index.html:2: a style="" attribute is blocked by style-src 'self'; use a class
warning: /index.html:3: an inline <script> is blocked by script-src 'self'; move it to a file`)}
${tabs('build-report.json', [['JSON', 'json', `
{
  "csp": "default-src 'none'; script-src 'self'; ...",
  "files": [
    { "path": "/index.html", "bytes": 1927, "gzip": 551 },
    { "path": "/src/main.js", "bytes": 493, "gzip": 311 }
  ],
  "warnings": []
}`]])}
<p>Serve ${c('dist')} as static files. With an ${c('<xo-router>')}, make the host answer every path under the base with the app's ${c('index.html')}. ${link('recipes.html#deployment', 'Recipes')} has the deployment notes.</p>

<h2>xoong render</h2>
<p>Prerenders a page into plain HTML that already shows its data, for crawlers, for people without JavaScript and for the first paint. It runs the real ${c('<xo-view>')} runtime in Node and fetches the data from ${c('--api')}; in the browser the view draws again from the saved template, so nothing is hydrated. It needs ${c('@xoong/ssr')}, which is not part of ${c('@xoong/xoong')}: ${c('npm install @xoong/ssr')}. Without it the command stops and says so.</p>
${reference('render')}
<p>For a page with an ${c('<xo-router>')}, ${c('--url')} renders the route of that URL, with its ${c('<title>')} and description. Public pages only: the data is as fresh as the last render, and a page that needs the visitor's session is drawn in the browser. ${c('build')} does not call it: run ${c('render')} for each public page, and publish the files.</p>
${term(`
$ npx xoong render index.html --api http://localhost:8080 --out out/index.html
rendered index.html -> out/index.html`)}
<p>See ${link('arch-build.html#prerendering-with-xoong-ssr', 'Prerendering with @xoong/ssr')} for what the output contains and its limits.</p>

<h2>xoong i18n</h2>
<p>Two sub-commands keep translations honest. The text written in the HTML is the default of a key (${link('how-it-works.html#language', 'Language')}), so a catalog for the source language can be made from the pages themselves.</p>
<h3>i18n extract</h3>
<p>Lists the keys a project uses with their source text: ${c('xo-t')} in HTML (and in HTML written inside JavaScript template strings) and ${c('text(\'key\', \'default\')')} calls. The catalog is sorted by key. A key used with two different texts, or a text that is not a valid message, is reported on standard error and makes the exit code 1; the catalog is still written. Folders are walked without ${c('node_modules')}, ${c('dist')} and folders that start with a dot.</p>
${reference('i18n extract')}
<h3>i18n check</h3>
<p>Compares a translation with the source catalog and prints one line per problem: a key that is missing, a key the source does not use, a message that cannot be read, placeholders that differ from the source's. It ends with the number of problems, or ${c('ok')}, and exits with 1 when there are problems.</p>
${reference('i18n check')}
${term(`
$ npx xoong i18n extract src --out catalogs/en.json
5 messages -> catalogs/en.json

$ npx xoong i18n check catalogs/vi.json --source catalogs/en.json
catalogs/vi.json: "home.count" uses {count} but the source uses {n}
catalogs/vi.json: missing "home.title"
catalogs/vi.json: missing "search.hint"
catalogs/vi.json: "extra.key" is not used by the source
4 problems`)}

<h2>Configuration</h2>
<p>${c('xoong.config.json')} holds what you would otherwise type on every run. All keys are optional, and a flag wins over the file. ${c('dev')} and ${c('build')} read it from their root folder (${c('--root')}, the current folder by default); ${c('check')} reads it from the current folder. The other commands do not read it. A file that cannot be read stops the command with a message.</p>
${table(['Key', 'Used by', 'Default', 'Meaning'], CONFIG_KEYS.map(([key, by, fallback, text]) => [c(key), by, fallback === 'none' ? 'none' : c(fallback), text]))}
${tabs('Example', [['xoong.config.json', 'json', `
{
  "port": 5173,
  "proxy": { "/api": "http://localhost:8080" },
  "packages": ["rainlet"],
  "build": { "exclude": ["screens/**", "*.draft.html"], "preload": true },
  "check": { "exclude": ["vendor/"] }
}`]])}
<h3>Globs</h3>
<p>${c('--exclude')} and the ${c('exclude')} keys take paths relative to the root (for ${c('check')}, the current folder) with ${c('/')} separators. ${c('*')} is any characters except ${c('/')}, ${c('**')} any characters including ${c('/')}, ${c('?')} one character, and a trailing ${c('/')} means the folder and everything in it. A pattern without a ${c('/')} matches that name at any depth (${c('*.draft.html')}, ${c('partials')}). A folder that matches is skipped with all it holds.</p>

<h2>Hints</h2>
<p>${c('xoong.hints.json')} lets the front end say what the OpenAPI document does not, without editing the backend's file. Give it to ${c('sync')} and ${c('doctor')} with ${c('--hints')}; it is not looked for on its own, so the same flag belongs in your ${c('sync')} script. A key that is not one of these is reported (${codeLink('XO171')}), because it would do nothing.</p>
${table(['Key', 'Example', 'What it does'], HINT_KEYS.map((key) => [c(key), `<code>${esc(HINT_DOCS[key][0])}</code>`, HINT_DOCS[key][1]]))}

<h2>In CI</h2>
<p>Three steps cover a project: ${c('sync')} so the table is current (or commit ${c('.xoong/')} and skip it), ${c('check')} to fail on a screen that does not match the API, and ${c('build')} to prove the site builds. Each exits with 1 on a problem, which fails the job. ${c('--format json')} gives other tools the findings.</p>
${tabs('Continuous integration', [['GitHub Actions', 'yaml', CI_YAML]])}

<h2>Exit codes</h2>
${table(['Code', 'Meaning'], EXIT_CODES.map((e) => [c(String(e.code)), esc(e.text)]))}
<ul>
<li>${c('sync')} and ${c('doctor')}: 1 when the document has an error. Warnings do not fail.</li>
<li>${c('check')}: 1 when a finding is an error. Warnings do not fail.</li>
<li>${c('i18n extract')} and ${c('i18n check')}: 1 when there are problems.</li>
<li>${c('build')}: 0 even with warnings; fail on ${c('warnings')} in ${c('build-report.json')} if you want to.</li>
<li>${c('dev')}: runs until you stop it; 1 when it cannot start.</li>
<li>No command at all prints the help and exits with 0. An unknown command, a missing argument or a missing required option prints the help and exits with 2. A refused option exits with 1.</li>
</ul>
${see(link('mcp.html', 'MCP server'), link('editor.html', 'Editor support'), link('codes.html', 'Error codes'), link('install.html', 'Install'), link('data.html', 'Data and tables'), link('recipes.html', 'Recipes'))}`,
};

// ====================================================================================================================================
// MCP server
// ====================================================================================================================================
/** What the tools do that the schema cannot say. A tool of server.js without an entry throws. */
const TOOL_NOTES = {
  get_spec: 'Returns llms.txt, the whole public API in one short document. Read it before writing xoong code.',
  list_operations: 'The operation names to use in <code>xo-click</code>, <code>xo-submit</code> and <code>&lt;xo-view get&gt;</code>, each with its method and path, query parameters and request fields (a <code>*</code> marks a required one). Without a filter it lists all. The table is read again on every call, so a new <code>xoong sync</code> needs no restart.',
  check: 'Runs <code>xoong check</code> on the text it is given and returns the findings (code, line, column, message, fix), or <code>No findings.</code> Give <code>html</code> or <code>script</code>: one of the two is needed. It takes text, not a file name, so it checks what the assistant is about to write.',
  explain_error: 'What a code means and how to fix it: the <code>XO2xx</code> codes of <code>xoong check</code> and the <code>XO1xx</code> codes of <code>xoong doctor</code> and <code>xoong sync</code>. Capitals do not matter. An unknown code gets the list of known ones.',
  explain_syntax: 'What an element or attribute does, which attributes an element has and which values they take. Without a name it lists every element and attribute. A name that does not exist gets suggestions, so an assistant asks before it invents an attribute.',
  search_docs: 'A case-insensitive search of the <code>.md</code> files, line by line, up to 40 lines, with file names and line numbers. It searches the project\'s own docs folder first, then the xoong documentation (marked <code>xoong/</code> when both are searched).',
};
for (const tool of TOOLS) if (!TOOL_NOTES[tool.name]) throw new Error(`tooling-pages: the MCP tool "${tool.name}" has no entry in TOOL_NOTES`);

const inputs = (tool) => {
  const props = Object.entries(tool.inputSchema.properties ?? {});
  if (!props.length) return 'none';
  return props.map(([name, p]) => `${c(name)} (${p.type ?? 'any'}${(tool.inputSchema.required ?? []).includes(name) ? ', required' : ''})${p.description ? `: ${esc(p.description)}` : ''}`).join('<br>');
};

/** The messages of the exchange below. The server answers them for real when the page is generated. */
const EXCHANGE = [
  ['initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'assistant', version: '1' } }],
  ['tools/list'],
  ['tools/call', { name: 'list_operations', arguments: { filter: 'delete' } }],
  ['tools/call', { name: 'check', arguments: { html: '<xo-view get="GET /api/people">\n  <button xo-click="deletePersn">Delete</button>\n</xo-view>' } }],
  ['tools/call', { name: 'explain_error', arguments: { code: 'XO201' } }],
  ['tools/call', { name: 'explain_syntax', arguments: { name: 'xo-dialog size' } }],
  ['tools/call', { name: 'check', arguments: { html: '<xo-view get="GET /api/people">\n  <button xo-click="deletePerson">Delete</button>\n</xo-view>' } }],
];

/** Start the real server (`xoong-mcp`), send it the messages of EXCHANGE over standard input, and print what it said, as the transcript shows it. */
function mcpTranscript() {
  const dir = mkdtempSync(join(tmpdir(), 'xoong-site-mcp-'));
  const operations = join(dir, 'operations.json');
  writeFileSync(operations, JSON.stringify(OPERATIONS));
  const requests = EXCHANGE.map(([method, params], i) => ({ jsonrpc: '2.0', id: i + 1, method, ...(params ? { params } : {}) }));
  const lines = [requests[0], { jsonrpc: '2.0', method: 'notifications/initialized' }, ...requests.slice(1)].map((r) => JSON.stringify(r));
  const run = spawnSync(process.execPath, [join(root, 'packages/mcp/src/cli.js'), '--operations', operations], { cwd: dir, input: `${lines.join('\n')}\n`, encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  if (run.status !== 0) throw new Error(`tooling-pages: xoong-mcp failed: ${run.stderr}`);
  const replies = new Map(run.stdout.split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((m) => [m.id, m]));
  const out = [];
  requests.forEach((r, i) => {
    const reply = replies.get(r.id);
    if (!reply?.result) throw new Error(`tooling-pages: xoong-mcp gave no result for ${r.method}: ${JSON.stringify(reply)}`);
    if (r.method === 'initialize') out.push(`> ${lines[0]}`, ...JSON.stringify(reply.result, null, 2).split('\n').map((l, n) => (n === 0 ? `< ${l}` : `  ${l}`)));
    else if (r.method === 'tools/list') out.push('> tools/list', `< ${reply.result.tools.map((t) => t.name).join(', ')}   (each with its description and input schema)`);
    else {
      out.push(`> tools/call ${r.params.name} ${JSON.stringify(r.params.arguments)}`);
      out.push(...reply.result.content[0].text.split('\n').map((l, n) => (n === 0 ? `< ${l}` : `  ${l}`)));
    }
    if (i < requests.length - 1) out.push('');
  });
  return out.join('\n');
}
const TRANSCRIPT = mcpTranscript();
if (!TRANSCRIPT.includes('XO201') || !TRANSCRIPT.includes('No findings.')) throw new Error('tooling-pages: the MCP exchange no longer shows a finding and its fix');
/** `> ` lines are what the assistant's program sends (highlighted as JSON where it is JSON); `< ` lines are what the server answers. */
const exchangeBlock = (src) => `<pre class="plain" data-lang="json" tabindex="0"><code>${src.split('\n').map((l) => (l.startsWith('> {') ? `&gt; ${highlight('json', l.slice(2))}` : esc(l))).join('\n')}</code></pre>`;

export const mcpPage = {
  file: 'mcp.html', section: 'docs', group: 'Tools', nav: 'MCP server', title: 'MCP server',
  description: 'xoong-mcp gives an AI assistant the spec, the operations of your API, the checker and an explanation of every error, over the Model Context Protocol.',
  body: `
<h1>MCP server</h1>
<p class="lead">The Model Context Protocol (MCP) is an open standard for connecting AI assistants to programs that offer them tools: the assistant starts the program, asks which tools it has, and calls them. ${c('xoong-mcp')} is that program for xoong. It gives an assistant the spec, the real operation names of your API, the checker and an explanation of every error, so the screens it writes pass ${c('xoong check')} instead of guessing attributes.</p>

<h2>What the assistant gets</h2>
<p>Six tools make a loop. The assistant reads the spec, looks up the operations, writes the screen, checks it and fixes what the message says, before it shows you any code.</p>
<ol>
<li>${c('get_spec')}: read ${c('llms.txt')}, the whole public API in one short document.</li>
<li>${c('list_operations')}: the operation names of your API, so it never invents one.</li>
<li>Write the screen.</li>
<li>${c('check')}: run ${link('cli.html#xoong-check', c('xoong check'))} on the HTML (or the script) it wrote. Each finding has a line, a column, a message and the fix.</li>
<li>${c('explain_error')} or ${c('explain_syntax')} when the message is not enough: what a code means, what an element or attribute does and which values it takes.</li>
<li>${c('search_docs')} for anything else in the documentation.</li>
</ol>
<p>Back to step 3 until ${c('check')} says ${c('No findings.')} The server also sends this advice itself, in the ${c('instructions')} of its ${c('initialize')} reply.</p>

<h2>Install and register</h2>
<p>The server reads ${c('.xoong/operations.json')}, so run ${link('cli.html#xoong-sync', c('xoong sync'))} in the project first. Then install the package, which has one program, ${c('xoong-mcp')}, and register it with your assistant as a server that runs over standard input and output (stdio).</p>
${tabs('Register xoong-mcp', [
    ['Claude Code', 'bash', `
npm install --save-dev @xoong/mcp@next
npx xoong sync openapi.json

# for you, in this project
claude mcp add xoong -- npx xoong-mcp

# for everyone who clones the project (writes .mcp.json)
claude mcp add --scope project xoong -- npx xoong-mcp

claude mcp list`],
    ['Claude Desktop', 'json', `
{
  "mcpServers": {
    "xoong": {
      "command": "npx",
      "args": ["-y", "@xoong/mcp@next", "--operations", "/path/to/my-app/.xoong/operations.json"]
    }
  }
}`],
    ['Cursor', 'json', `
{
  "mcpServers": {
    "xoong": { "command": "npx", "args": ["xoong-mcp"] }
  }
}`],
    ['Any client', 'json', `
{
  "mcpServers": {
    "xoong": {
      "command": "npx",
      "args": ["xoong-mcp", "--operations", ".xoong/operations.json", "--docs", "docs"]
    }
  }
}`],
  ])}
<p>Claude Desktop keeps its servers in ${c('claude_desktop_config.json')} (macOS: ${c('~/Library/Application Support/Claude/')}, Windows: ${c('%APPDATA%\\Claude\\')}); it does not know your project folder, so the path of ${c('operations.json')} is absolute and ${c('npx -y')} fetches the package. Cursor reads ${c('.cursor/mcp.json')} in the project, or ${c('~/.cursor/mcp.json')} for every project. Other clients use the same ${c('mcpServers')} shape; look for the place in their documentation.</p>
<p>To see that it answers without an assistant, send it one message:</p>
${tabs('A smoke test', [['Terminal', 'bash', `
printf '%s\\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npx xoong-mcp`]])}

<h2>Where it finds its files</h2>
<p>The server looks for the table of operations and for the project's docs in the folder it is started from. Three options change that; none is required.</p>
${table(['Option', 'Default', 'What it does'], [
    [c('--operations <file>'), c('.xoong/operations.json'), 'The table that <code>xoong sync</code> wrote. It is read again on every call.'],
    [c('--llms <file>'), 'the spec packed with the package', 'A spec to give <code>get_spec</code> instead of the xoong one. If the packed one is missing, <code>llms.txt</code> in the folder is the last resort.'],
    [c('--docs <folder>'), 'a <code>docs</code> folder in the working folder, if there is one', 'The project\'s own documentation. <code>search_docs</code> searches it first, then the xoong documentation.'],
  ])}
<p>If a file is missing, the tool that needs it answers with an error that says what to do (${c('run `xoong sync <openapi>` first or pass --operations <file>')}), and the other tools keep working.</p>

<h2>The tools</h2>
<p>This table is made from the definitions in the server's source, so it is what ${c('tools/list')} returns.</p>
${table(['Tool', 'What it does', 'Input'], TOOLS.map((t) => [c(t.name), TOOL_NOTES[t.name], inputs(t)]))}
<p>Errors of the tools are not protocol errors: the reply has ${c('isError: true')} and a text the assistant can act on, such as the closest name for an unknown attribute. ${c('explain_error')} knows two families of codes: ${c('XO2xx')} from ${c('xoong check')} and ${c('XO1xx')} from ${c('xoong doctor')} and ${c('xoong sync')}. They are all on the ${link('codes.html', 'Error codes')} page, which is made from the same table.</p>

<h2>A session, recorded</h2>
<p>This is a real exchange. When the page is generated, the site starts ${c('xoong-mcp')}, sends it the messages below over standard input (JSON-RPC 2.0, one message per line) and prints what comes back, on the site's own demo API. The first message is shown as it goes over the wire; the others are shortened to the tool and its arguments, and a tool's reply is the text of its ${c('content')}. An assistant does all of this for you; what you see is its answer.</p>
${exchangeBlock(TRANSCRIPT)}
<p>The assistant sent a misspelled operation, ${c('deletePersn')}. ${c('check')} answered with the code, the place and the closest name; ${c('explain_error')} said what ${c('XO201')} means; the second ${c('check')} came back clean.</p>

<h2>What it does not do yet</h2>
<ul>
<li><strong>No ${c('scaffold')} tool.</strong> The assistant writes the screens; a tool that generates a view, form or admin screen for an operation is planned.</li>
<li><strong>No resources and no prompts.</strong> It declares the ${c('tools')} capability only. The spec and the docs are reached through the tools ${c('get_spec')} and ${c('search_docs')}.</li>
<li><strong>It reads, and does not run or write.</strong> It never runs ${c('sync')}, ${c('doctor')}, ${c('build')} or ${c('dev')}, and never writes a file. Run ${c('xoong sync')} yourself when the API changes.</li>
<li><strong>${c('check')} takes text, not file names.</strong> To check files, run ${link('cli.html#xoong-check', c('xoong check'))}.</li>
<li><strong>Standard input and output only</strong>, no HTTP transport. It speaks protocol version 2024-11-05 and answers ${c('initialize')}, ${c('ping')}, ${c('tools/list')} and ${c('tools/call')}; it is written without an SDK, and its only dependency is ${c('@xoong/cli')}.</li>
</ul>

<h2>The spec and the docs come with the package</h2>
<p>The npm tarball may hold ${c('src/')} only, so before the package is packed a script (${c('prepack.mjs')}) copies ${c('llms.txt')} and the ${c('docs/*.md')} files into ${c('src/')}; the copies are generated, not committed, and removed again afterwards. That is why ${c('get_spec')} and ${c('search_docs')} work in a project that installed ${c('@xoong/mcp')} from npm. In the xoong repository the server reads the files at the root. A test packs a copy of the package into a ${c('node_modules')} layout and asks it for the spec from an empty project.</p>

<h2>Without MCP</h2>
<p>An assistant that cannot run a server can still work from two things. ${link('https://github.com/fpt-duongtx/xoong/blob/main/llms.txt', c('llms.txt'))}, at the root of the repository, is what ${c('get_spec')} returns: attach it or paste it. And ${c('npx xoong check --format json')} gives it the same findings that the ${c('check')} tool does; paste them back. Without ${c('list_operations')}, give it the operation names from ${c('.xoong/operations.json')}. A test keeps ${c('llms.txt')} honest: it stays within a token budget, names only commands that exist and documents every attribute the code defines.</p>
${see(link('cli.html', 'Command line'), link('editor.html', 'Editor support'), link('codes.html', 'Error codes'), link('arch-tooling.html#for-ai-assistants-llms-txt-and-the-mcp-server', 'How it is built'))}`,
};

// ====================================================================================================================================
// Editor support
// ====================================================================================================================================
const HTML_DATA = htmlData(OPERATIONS);
const HTML_DATA_EXCERPT = JSON.stringify({
  version: HTML_DATA.version,
  globalAttributes: HTML_DATA.globalAttributes.filter((a) => a.name === 'xo-click'),
  valueSets: HTML_DATA.valueSets.filter((v) => v.name === 'xo-mutations'),
}, null, 2);

export const editorPage = {
  file: 'editor.html', section: 'docs', group: 'Tools', nav: 'Editor support', title: 'Editor support',
  description: 'Completion and hover for xo-* elements and attributes with HTML custom data, and the language server xoong-lsp with live checks, completion, hover and quick fixes.',
  body: `
<h1>Editor support</h1>
<p class="lead">The mistakes ${c('xoong check')} reports can show up while you type. There are two ways to get that, and they work together: HTML custom data, which gives completion and hover in VS Code with nothing to install, and a language server, ${c('xoong-lsp')}, which adds the checks themselves, quick fixes and completion in any editor that speaks LSP.</p>

<h2>Which one</h2>
${table(['Compared', 'HTML custom data', 'Language server'], [
    ['Gives you', 'Completion and hover for every <code>xo-*</code> element and attribute, the operation names, the fixed values', 'The same, and the findings of <code>xoong check</code> as you type, with quick fixes'],
    ['Needs', 'The file <code>xoong sync</code> writes, and one setting', '<code>@xoong/lsp</code>, and an editor that can start a language server'],
    ['Works in', 'VS Code (and tools that read its HTML custom data format)', 'Any editor with an LSP client, for HTML, JavaScript and TypeScript files'],
    ['Checks your code', 'No', 'Yes'],
  ])}

<h2>HTML custom data in VS Code</h2>
<p>${link('cli.html#xoong-sync', c('xoong sync'))} writes ${c('.xoong/xoong.html-data.json')} next to ${c('operations.json')}, and so does ${link('cli.html#xoong-new', c('xoong new'))}. It is the format that VS Code's HTML language service reads. Point the editor at it once, in ${c('.vscode/settings.json')}:</p>
${tabs('VS Code', [['.vscode/settings.json', 'json', `
{
  "html.customData": ["./.xoong/xoong.html-data.json"]
}`], ['xoong.html-data.json (excerpt)', 'json', HTML_DATA_EXCERPT]])}
<p>You then get, in HTML files:</p>
<ul>
<li>completion and hover documentation for every ${c('xo-*')} element and attribute, with the attributes of the element you are in;</li>
<li>the real operation names for ${c('xo-click')}, ${c('xo-submit')}, ${c('<xo-view get>')} and ${c('<xo-form op>')}: mutations for the first two and for ${c('op')}, reads for ${c('get')};</li>
<li>${c('p-<name>')} attributes for the path parameters of your API on a view;</li>
<li>the values of attributes that take a fixed set (${c('xo-confirm-kind')}, ${c('<xo-dialog size>')}, the sizes and statuses of the controls).</li>
</ul>
<p>The file is made again by every ${c('sync')}, so it follows the API. It only offers; it does not check, and it does not fix.</p>

<h2>The language server</h2>
<p>${c('xoong-lsp')} is a language server for the Language Server Protocol, over standard input and output. It finds ${c('.xoong/operations.json')} from the workspace folder upward and reads it again when it changes; saving a file checks it again, which also picks up a fresh ${c('xoong sync')}. It needs no options.</p>
${tabs('Install', [['Terminal', 'bash', `
npm install --save-dev @xoong/lsp@next
npx xoong sync openapi.json
npx xoong-lsp                # started by your editor, not by hand`]])}
<p>Any editor with a language-server client can run it: the command is ${c('npx xoong-lsp')}, the files are HTML, JavaScript and TypeScript, and the root is the folder with ${c('.xoong/')}. In Neovim:</p>
${tabs('Neovim', [['init.lua', 'lua', `
vim.api.nvim_create_autocmd('FileType', {
  pattern = { 'html', 'javascript', 'typescript' },
  callback = function(args)
    vim.lsp.start({
      name = 'xoong',
      cmd = { 'npx', 'xoong-lsp' },
      root_dir = vim.fs.root(args.buf, '.xoong'),
    })
  end,
})`]])}
<p>VS Code has no setting that starts an arbitrary language server, so there the custom data above is what you use; an extension that wraps the server is planned.</p>

<h2>What it gives you</h2>
${table(['Feature', 'What you get'], [
    ['<strong>Diagnostics</strong>', 'The findings of <code>xoong check</code>, with the same code, message and fix, in HTML files and in JavaScript and TypeScript files (<code>html`...`</code> templates and <code>client.*</code> calls). A new rule shows up in the editor without any change to it. Errors and warnings keep their level.'],
    ['<strong>Operation names</strong>', 'Completion inside <code>xo-click</code>, <code>xo-submit</code> and <code>op</code> offers mutations; inside <code>get</code> it offers reads, written as paths. It filters by what you typed.'],
    ['<strong>Names</strong>', 'Completion of <code>xo-*</code> elements after <code>&lt;xo-</code>, of the attributes of the element you are in (<code>page-size</code> inside <code>&lt;xo-pager </code>, on a tag that spans several lines too), of <code>p-&lt;param&gt;</code> on a <code>&lt;xo-view&gt;</code>, and of the <code>xo-*</code> attributes.'],
    ['<strong>Values</strong>', 'Completion of the fixed sets (<code>xo-confirm-kind="</code>, <code>&lt;xo-dialog size="</code>) and of the ids of the <code>&lt;xo-dialog&gt;</code>s of the file inside <code>xo-open="</code>.'],
    ['<strong>Hover</strong>', 'What an element, an <code>xo-*</code> attribute or an attribute of an element does, and the values it takes; what <code>p-id</code>, <code>p-id="?id"</code> and <code>p-id=":id"</code> mean.'],
    ['<strong>Quick fixes</strong>', 'Replace an unknown operation (' + codeLink('XO201') + '), a misspelled <code>xo-*</code> attribute or element (' + codeLink('XO230') + ') or a value outside its set (' + codeLink('XO271') + ') with the closest one.'],
    ['<strong>No table yet</strong>', 'Without <code>.xoong/operations.json</code> a file gets one information message: run <code>xoong sync</code>. Nothing else is reported until it exists.'],
  ])}
<p>The packages' tests cover each of these. A test also fails when an element or attribute is added to the syntax lists and the server cannot complete or explain it.</p>

<h2>Limits</h2>
<ul>
<li>There is <strong>no VS Code extension</strong> yet, and no commands, status bar or snippets. Lint presets and SARIF output are planned.</li>
<li>Completion of <code>{field}</code> paths does not know the scope yet, hover does not show the types of an operation, and there is no go to definition.</li>
<li>The editor sends the whole text of a file on every change (full document sync), which is fine for screens and not meant for huge files.</li>
<li>It checks what the editor sends it. Tell your editor which file types to use it for.</li>
</ul>
${see(link('cli.html', 'Command line'), link('mcp.html', 'MCP server'), link('codes.html', 'Error codes'), link('arch-tooling.html#editors-html-data-and-the-language-server', 'How it is built'))}`,
};

// ====================================================================================================================================
// Error codes
// ====================================================================================================================================
const codeRows = (family) => codesOf(family).map((k) => [`<span id="${k.toLowerCase()}"><code>${k}</code></span>`, md(EXPLANATIONS[k])]);
const familySections = (tool) => CODE_FAMILIES.filter((f) => f.tool === tool).map((f) => `<h3>${esc(f.title)}</h3>
<p>${esc(f.text)}</p>
${table(['Code', 'What it means and how to fix it'], codeRows(f))}`).join('\n');

export const codesPage = {
  file: 'codes.html', section: 'docs', group: 'Tools', nav: 'Error codes', title: 'Error codes',
  description: 'Every code that xoong check, xoong doctor and xoong sync print, with what it means and how to fix it.',
  body: `
<h1>Error codes</h1>
<p class="lead">Everything xoong finds has a stable code, a place, a message that says what is wrong, and a fix. This page lists every code with the explanation that the MCP tool ${c('explain_error')} gives: the page is made from the same table, so they cannot differ. ${c('XO2xx')} codes come from ${link('cli.html#xoong-check', c('xoong check'))}, and ${c('XO1xx')} codes from ${link('cli.html#xoong-doctor', c('xoong doctor'))} and ${link('cli.html#xoong-sync', c('xoong sync'))}.</p>

<h2>What a finding looks like</h2>
<p>An <em>error</em> makes the command exit with 1; a <em>warning</em> is printed and does not. The message says what is wrong, and ${c('fix:')} says what to do. The same finding, as text and as the JSON that ${c('--format json')} prints:</p>
${tabbed('A finding', [
    ['Text', term(CHECK_TEXT.split('\n').slice(0, 2).join('\n'))],
    ['JSON', code('json', JSON.stringify(SAMPLE_FINDINGS[0], null, 2))],
  ])}
<p>Editors show the same message and fix on the line (${link('editor.html', 'Editor support')}), and an assistant reads them through ${link('mcp.html', 'the MCP server')}. The first number after ${c('XO')} is the tool: 1 for the OpenAPI document, 2 for your screens.</p>

<h2>xoong check (XO2xx)</h2>
${familySections('check')}

<h2>xoong doctor and xoong sync (XO1xx)</h2>
${familySections('doctor')}
${see(link('cli.html', 'Command line'), link('mcp.html', 'MCP server'), link('editor.html', 'Editor support'))}`,
};
