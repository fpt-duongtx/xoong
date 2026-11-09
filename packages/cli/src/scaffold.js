// @ts-check
import { readFileSync } from 'node:fs';
import { mkdir, writeFile, copyFile, access } from 'node:fs/promises';
import { join, basename, resolve } from 'node:path';
import { analyze, runtimeTable, generateDts } from './openapi.js';
import { load } from './commands.js';
import { htmlData } from './html-data.js';

const SCALAR = new Set(['string', 'integer', 'number', 'boolean']);
const refName = (r) => r.slice(r.lastIndexOf('/') + 1);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/**
 * Pick a first screen: a GET operation without path parameters whose response is (or contains) a list of objects.
 * Returns { operation, listPath, columns } or null.
 */
export function pickListScreen(a) {
  const deref = (s) => (s?.$ref ? a.schemas[refName(s.$ref)] : s);
  const columnsOf = (item) => {
    const schema = deref(item);
    const props = { ...(schema?.properties ?? {}) };
    for (const part of schema?.allOf ?? []) Object.assign(props, deref(part)?.properties ?? {});
    return Object.entries(props).filter(([, v]) => SCALAR.has(deref(v)?.type)).map(([k]) => k).slice(0, 4);
  };
  for (const op of Object.values(a.operations)) {
    if (op.method !== 'GET' || /\{/.test(op.path)) continue;
    const root = deref(op._types.okSchema);
    if (!root) continue;
    if (root.type === 'array') { const columns = columnsOf(root.items); if (columns.length) return { operation: op, listPath: '.', columns }; }
    for (const [key, v] of Object.entries(root.properties ?? {})) {
      const prop = deref(v);
      if (prop?.type === 'array') { const columns = columnsOf(prop.items); if (columns.length) return { operation: op, listPath: key, columns }; }
    }
  }
  return null;
}

/** HTML for the first screen. */
export function listScreenHtml(pick, title) {
  let view = '    <p>No list operation found in the API; add a screen by hand.</p>';
  if (pick) {
    const heading = pick.columns.map((c) => `<th>${esc(c)}</th>`).join('');
    const cells = pick.columns.map((c) => `<td>{${c}}</td>`).join('');
    const op = pick.operation;
    view = `    <xo-view get="${esc(op.method + ' ' + op.path)}">
      <p xo-if="$loading">Loading…</p>
      <p xo-if="$error" class="error">{$error.code} {$error.detail}</p>
      <table>
        <thead><tr>${heading}</tr></thead>
        <tbody><tr xo-each="${pick.listPath}">${cells}</tr></tbody>
      </table>
    </xo-view>`;
  }
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="/src/app.css">
  <script type="module" src="/src/main.ts"></script>
</head>
<body>
  <main>
    <h1>${esc(title)}</h1>
${view}
  </main>
</body>
</html>
`;
}

/**
 * Create a project folder from an OpenAPI document.
 * @param {string} dir  target folder (created; must not contain files we would overwrite)
 * @param {{ spec: string, title?: string, link?: string }} options  `link`: path to a checkout of xoong; the project then depends on its packages by path instead of from npm
 */
export async function scaffold(dir, { spec, title, link }) {
  const target = resolve(dir);
  try { await access(join(target, 'package.json')); throw new Error(`xoong: ${target} already contains a project (package.json exists)`); } catch (error) {
    if (!/ENOENT/.test(String(/** @type {any} */ (error)?.code))) throw error;
  }
  const doc = await load(spec);
  const a = analyze(doc);
  const name = basename(target).toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'xoong-app';
  const pick = pickListScreen(a);
  const heading = title ?? doc.info?.title ?? name;
  // The packages are released together under one version: the project asks for the version of this CLI, not `*` (which npm reads as `latest`, an older release than `next`)
  const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  const pkg = (n) => (link ? `file:${resolve(link, 'packages', n)}` : version);

  await mkdir(join(target, 'src'), { recursive: true });
  await mkdir(join(target, 'test'), { recursive: true });
  await mkdir(join(target, '.xoong'), { recursive: true });
  const files = {
    'package.json': JSON.stringify({
      name, version: '0.0.0', private: true, type: 'module',
      scripts: { dev: 'xoong dev', sync: 'xoong sync openapi.json --hints xoong.hints.json', check: 'xoong check index.html', test: 'vitest run' },
      dependencies: { '@xoong/core': pkg('core'), '@xoong/data': pkg('data'), '@xoong/ui': pkg('ui') },
      devDependencies: { '@xoong/cli': pkg('cli'), '@xoong/test': pkg('test'), vitest: '*', 'happy-dom': '*' },
      // The packages depend on each other by name: point those names at the checkout too.
      ...(link ? { overrides: Object.fromEntries(['core', 'data', 'forms', 'ui', 'cli', 'test', 'server'].map((n) => [`@xoong/${n}`, pkg(n)])) } : {}),
    }, null, 2) + '\n',
    'xoong.config.json': JSON.stringify({ port: 5173, proxy: { '/api': 'http://localhost:8080' } }, null, 2) + '\n',
    'xoong.hints.json': JSON.stringify({ idNames: ['id'] }, null, 2) + '\n',
    'index.html': listScreenHtml(pick, heading),
    'src/main.ts': `import { configure } from '@xoong/data';
import '@xoong/data/view';
import operations from '/.xoong/operations.json' with { type: 'json' };

// The generated table describes every operation; requests go through the dev proxy (see xoong.config.json).
configure({ api: operations, baseUrl: '/api' });

// Mutation failures arrive as bubbling events; show them however you like.
document.addEventListener('xo-error', (event) => console.warn((event as CustomEvent).detail));
`,
    'src/app.css': `:root { --space: 1rem; --border: #d0d7de; --accent: #0b5fff; }
body { font: 16px/1.5 system-ui, sans-serif; margin: 0; }
main { max-width: 60rem; margin: 0 auto; padding: var(--space); }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: .5rem; border-bottom: 1px solid var(--border); }
.error { color: #b42318; }
`,
    'vitest.config.mjs': `import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'happy-dom', include: ['test/**/*.spec.{mjs,js,ts}'] } });
`,
    'test/index.spec.mjs': pick ? `import { it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { mount, mockApi } from '@xoong/test';
import operations from '../.xoong/operations.json';

let screen;
afterEach(() => screen?.unmount());

it('shows the ${esc(pick.operation.path)} list', async () => {
  const api = mockApi(operations, { ${JSON.stringify(pick.operation.id)}: () => ${pick.listPath === '.' ? '[]' : `({ ${pick.listPath}: [] })`} });
  const html = readFileSync('index.html', 'utf8').match(/<xo-view[\\s\\S]*<\\/xo-view>/)[0];
  screen = await mount(html, { api });
  expect(api.unhandled).toEqual([]);
  expect(screen.errors).toEqual([]);
});
` : '',
    'README.md': `# ${heading}

Generated by \`xoong new\` from \`openapi.json\`.

\`\`\`bash
npm install
npm run sync     # regenerate .xoong/ after the API changes
npm run check    # check the HTML screens against the API
npm run dev      # http://localhost:5173 (proxies /api to xoong.config.json)
npm test
\`\`\`
`,
  };
  for (const [file, content] of Object.entries(files)) if (content) await writeFile(join(target, file), content);
  await writeFile(join(target, 'openapi.json'), JSON.stringify(doc, null, 2) + '\n');
  // Same output as `xoong sync` (kept in step by sharing the functions): the table, the types and the editor data.
  const table = runtimeTable(a);
  await writeFile(join(target, '.xoong', 'operations.json'), JSON.stringify(table, null, 2) + '\n');
  await writeFile(join(target, '.xoong', 'xoong.html-data.json'), JSON.stringify(htmlData(table), null, 2) + '\n');
  await writeFile(join(target, '.xoong', 'api.d.ts'), generateDts(a));
  return { dir: target, screen: pick ? `${pick.operation.method} ${pick.operation.path}` : null, files: Object.keys(files).filter((f) => files[f]).concat('openapi.json', '.xoong/operations.json', '.xoong/xoong.html-data.json', '.xoong/api.d.ts') };
}
