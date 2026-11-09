// Install benchmark: `npm ci` (competitors, from their lockfiles) and `npm install` of the xoong umbrella package from freshly packed tarballs,
// each into an empty folder with an empty npm cache. Needs the npm registry (third-party packages are downloaded), so the time depends on your network.
//   node benchmarks/install.mjs [--runs 3] [--out results/install.json]
import { mkdtemp, copyFile, writeFile, readFile, readdir, rm, mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { timeProcess } from './lib/time.mjs';
import { summary, round } from './lib/stats.mjs';
import { apps, repo, root } from './lib/apps.mjs';
import { environment } from './lib/env.mjs';
import { pack } from '../tools/pack.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const RUNS = Number(arg('runs', 3));
const out = arg('out', join(root, 'results/install.json'));
const dirSize = async (dir) => { let t = 0; for (const f of await readdir(dir, { recursive: true, withFileTypes: true })) if (f.isFile()) t += (await stat(join(f.parentPath, f.name))).size; return t; };
/** Packages npm installed: the entries of node_modules/.package-lock.json (workspace links and the tarballs count too). */
const packages = async (dir) => Object.keys(JSON.parse(await readFile(join(dir, 'node_modules/.package-lock.json'), 'utf8')).packages).length;

const result = { environment: environment(), runs: RUNS, install: {} };
async function measure(name, prepare, args) {
  const xs = []; let size = 0, count = 0;
  for (let i = 0; i < RUNS; i++) {
    const dir = await mkdtemp(join(tmpdir(), 'xoong-install-'));
    await prepare(dir);
    xs.push(await timeProcess('npm', [...args, '--cache', join(dir, '.npm-cache'), '--no-audit', '--no-fund', '--loglevel=error'], { cwd: dir }));
    size = await dirSize(join(dir, 'node_modules')); count = await packages(dir);
    await rm(dir, { recursive: true, force: true });
  }
  const s = summary(xs); for (const k of ['median', 'min', 'max', 'q1', 'q3']) s[k] = round(s[k], 0); s.runs = s.runs.map((x) => round(x, 0));
  result.install[name] = { time: s, packages: count, bytes: size };
  console.log(name, s.median, 'ms', count, 'packages', size, 'bytes');
}
for (const id of ['react', 'vue', 'angular']) {
  await measure(`${apps[id].label} stack (npm ci)`, async (dir) => { for (const f of ['package.json', 'package-lock.json']) await copyFile(join(apps[id].dir, f), join(dir, f)); }, ['ci']);
}
await measure('xoong (npm install @xoong/xoong, from tarballs)', async (dir) => {
  const tarballs = join(dir, 'vendor'); await mkdir(tarballs);
  await pack(tarballs, { prefix: './vendor' });
  const c = JSON.parse(await readFile(join(tarballs, 'consume.json'), 'utf8'));
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'bench-xoong-install', private: true, dependencies: { '@xoong/xoong': c.dependencies['@xoong/xoong'] }, overrides: c.overrides }));
}, ['install']);
await measure('xoong + esbuild (npm install @xoong/xoong esbuild, for --minify)', async (dir) => {
  const tarballs = join(dir, 'vendor'); await mkdir(tarballs);
  await pack(tarballs, { prefix: './vendor' });
  const c = JSON.parse(await readFile(join(tarballs, 'consume.json'), 'utf8'));
  const esbuild = JSON.parse(await readFile(join(apps.xoong.dir, 'package.json'), 'utf8')).devDependencies.esbuild;
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'bench-xoong-min-install', private: true, dependencies: { '@xoong/xoong': c.dependencies['@xoong/xoong'] }, devDependencies: { esbuild }, overrides: c.overrides }));
}, ['install']);
await writeFile(out, JSON.stringify(result, null, 1) + '\n');
