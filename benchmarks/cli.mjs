// CLI benchmark: wall time of the `xoong` commands (Node start-up included), next to the closest comparable tool where one exists.
//   node benchmarks/cli.mjs [--runs 10] [--out results/cli.json]
import { mkdir, writeFile, readFile, readdir, stat, rm, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { spawn } from 'node:child_process';
import { bench, timeProcess } from './lib/time.mjs';
import { generateSpec } from './lib/gen-spec.mjs';
import { apps, repo, root } from './lib/apps.mjs';
import { environment, pinned } from './lib/env.mjs';
import { serve } from './lib/serve.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const RUNS = Number(arg('runs', 10));
const out = arg('out', join(root, 'results/cli.json'));
const cache = join(root, '.cache/cli');
await rm(cache, { recursive: true, force: true }); await mkdir(cache, { recursive: true });
const XOONG = join(repo, 'packages/cli/src/cli.js');
const OAT = join(root, 'tooling/node_modules/.bin/openapi-typescript');
const run = (args, opts) => () => timeProcess('node', [XOONG, ...args], { cwd: repo, ...opts });
const results = { environment: environment(), runs: RUNS, notes: [], startup: {}, sync: {}, check: {}, build: {}, dev: {}, render: null, versions: { 'openapi-typescript': pinned(join(root, 'tooling'))['openapi-typescript'], vite: pinned(apps.react.dir).vite } };
const log = (...a) => console.log(...a);

// 1. Cold start
results.startup['node (empty script)'] = await bench(() => timeProcess('node', ['-e', '0']), { runs: RUNS });
results.startup['xoong --version'] = await bench(run(['--version']), { runs: RUNS });
results.startup['xoong --help'] = await bench(run(['--help']), { runs: RUNS });
log('startup', results.startup);

// 2. sync
const gen = join(cache, 'generated-500.json');
await writeFile(gen, JSON.stringify(generateSpec(100)));
const specs = [
  ['benchmarks people API (6 operations)', join(root, 'shared/openapi.json')],
  ['examples/admin (4 operations)', join(repo, 'examples/admin/openapi.json')],
  ['generated, 500 operations', gen],
];
for (const [name, file] of specs) {
  const o = join(cache, 'sync-out');
  const r = { xoong: await bench(run(['sync', file, '--out', o]), { runs: RUNS }) };
  r['openapi-typescript'] = await bench(() => timeProcess('node', [OAT, file, '-o', join(cache, 'oat.d.ts')]), { runs: RUNS });
  r.bytes = (await stat(file)).size;
  results.sync[name] = r;
  log('sync', name, r.xoong.median, r['openapi-typescript'].median);
}
// 3. check on N screens (copies of the people screen)
const ops = join(apps.xoong.dir, '.xoong/operations.json');
const screen = await readFile(join(apps.xoong.dir, 'index.html'), 'utf8');
for (const n of [1, 100, 1000]) {
  const dir = join(cache, `screens-${n}`);
  await mkdir(dir, { recursive: true });
  for (let i = 0; i < n; i++) await writeFile(join(dir, `screen-${i}.html`), screen);
  results.check[n] = await bench(run(['check', dir, '--operations', ops]), { runs: n === 1000 ? Math.max(3, RUNS / 2) : RUNS });
  log('check', n, results.check[n].median);
}
// 4. build: xoong build vs vite build of the same screen, and examples/admin
const size = async (dir) => { let raw = 0, gz = 0, files = 0; for (const f of await readdir(dir, { recursive: true, withFileTypes: true })) { if (!f.isFile()) continue; const b = await readFile(join(f.parentPath, f.name)); raw += b.length; files++; if (/\.(js|css|html|json|svg)$/.test(f.name)) gz += gzipSync(b, { level: 9 }).length; } return { files, raw, gzip: gz }; };
const xo = apps.xoong.dir;
const xoBuild = (rootDir, o) => () => timeProcess('node', [XOONG, 'build', '--root', rootDir, '--out', o], { cwd: repo });
const o1 = join(cache, 'build-xoong'); results.build['xoong build (people screen)'] = { time: await bench(xoBuild(xo, o1), { runs: RUNS }), output: await size(o1) };
const adminOut = join(cache, 'build-admin');
await cp(join(repo, 'examples/admin'), join(cache, 'admin-src'), { recursive: true });
await timeProcess('node', [XOONG, 'sync', join(repo, 'examples/admin/openapi.json'), '--out', join(cache, 'admin-src/.xoong')], { cwd: repo });
results.build['xoong build (examples/admin)'] = { time: await bench(xoBuild(join(repo, 'examples/admin'), adminOut), { runs: RUNS }), output: await size(adminOut) };
for (const name of ['react', 'vue']) {
  const dir = apps[name].dir; const o = join(cache, `build-${name}`);
  results.build[`vite build (${name} screen)`] = { time: await bench(() => timeProcess(join(dir, 'node_modules/.bin/vite'), ['build', '--outDir', o, '--emptyOutDir'], { cwd: dir }), { runs: RUNS }), output: await size(o) };
}
{ // Angular's own builder (esbuild): `ng build`
  const dir = apps.angular.dir; const o = join(cache, 'build-angular');
  results.build['ng build (angular screen)'] = { time: await bench(() => timeProcess(join(dir, 'node_modules/.bin/ng'), ['build', '--output-path', o], { cwd: dir }), { runs: RUNS }), output: await size(o) };
}
log('build', Object.fromEntries(Object.entries(results.build).map(([k, v]) => [k, v.time.median])));
// 5. dev server: spawn to first successful response
const ttfb = (cmd, args, cwd, port) => async () => {
  const t0 = process.hrtime.bigint();
  const child = spawn(cmd, args, { cwd, stdio: 'ignore' });
  try {
    for (;;) {
      try { const r = await fetch(`http://127.0.0.1:${port}/`); if (r.ok) { await r.text(); return Number(process.hrtime.bigint() - t0) / 1e6; } } catch { /* not listening yet */ }
      await new Promise((r) => setTimeout(r, 5));
      if (Number(process.hrtime.bigint() - t0) / 1e6 > 30000) throw new Error('dev server did not answer');
    }
  } finally { child.kill('SIGKILL'); await new Promise((r) => setTimeout(r, 150)); }
};
results.dev['xoong dev'] = await bench(ttfb('node', [XOONG, 'dev', '--root', xo, '--port', '5391'], repo, 5391), { runs: RUNS });
results.dev['ng serve (angular)'] = await bench(ttfb(join(apps.angular.dir, 'node_modules/.bin/ng'), ['serve', '--port', '5393', '--host', '127.0.0.1'], apps.angular.dir, 5393), { runs: RUNS });
for (const name of ['react', 'vue']) results.dev[`vite dev (${name})`] = await bench(ttfb(join(apps[name].dir, 'node_modules/.bin/vite'), ['--port', '5392', '--strictPort', '--host', '127.0.0.1'], apps[name].dir, 5392), { runs: RUNS });
log('dev', Object.fromEntries(Object.entries(results.dev).map(([k, v]) => [k, v.median])));
// 6. render (prerender with data): needs the API running
const api = await serve({ root: xo + '/dist' });
try {
  results.render = await bench(run(['render', join(xo, 'index.html'), '--api', api.url + '/api', '--operations', ops, '--out', join(cache, 'rendered.html')]), { runs: RUNS });
  results.renderBytes = (await stat(join(cache, 'rendered.html'))).size;
  log('render', results.render.median);
} catch (e) { results.render = null; results.notes.push('xoong render failed: ' + String(e.message).slice(0, 200)); log('render failed', e.message); }
await api.close();
await writeFile(out, JSON.stringify(results, null, 1) + '\n');
log('wrote', out);
