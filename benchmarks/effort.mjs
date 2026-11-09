// Effort proxies for the same people screen in each stack: lines of code (non-blank, non-comment) split by markup / script / style,
// number of files, and dependencies (direct, and everything npm installs). Lines of code say how much there is to write and read;
// they do NOT say how long it takes, and they depend on style: read them with the caveats in README.md.
//   node benchmarks/effort.mjs [--out results/effort.json]
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
import { apps, root, repo } from './lib/apps.mjs';
import { environment, pinned } from './lib/env.mjs';

const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : join(root, 'results/effort.json');
const lines = (s) => s.split('\n').filter((l) => l.trim()).length;
const noJsComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const noHtmlComments = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
const noCssComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

/** @returns {{ markup: number, script: number, style: number }} */
function count(file, text) {
  const ext = extname(file);
  if (ext === '.html') return { markup: lines(noHtmlComments(text)), script: 0, style: 0 };
  if (ext === '.css') return { markup: 0, script: 0, style: lines(noCssComments(text)) };
  if (['.js', '.jsx', '.ts', '.mjs'].includes(ext)) return { markup: 0, script: lines(noJsComments(text)), style: 0 };
  if (ext === '.vue') {
    const block = (tag) => (text.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`)) ?? [])[1] ?? '';
    // the <script> tags and the <template> tags themselves are not counted: only what is inside
    return { markup: lines(noHtmlComments(block('template'))), script: lines(noJsComments(block('script'))), style: lines(noCssComments(block('style'))) };
  }
  throw new Error(`no counter for ${file}`);
}

async function walk(dir, skip) {
  const files = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(p, skip))); else files.push(p);
  }
  return files;
}

const SKIP = new Set(['node_modules', 'dist', 'dist-nopreload', '.xoong', '.angular', 'package-lock.json', 'package.json', 'vite.config.js', 'xoong.hints.json', 'angular.json', 'tsconfig.json']);
const CONFIG = ['package.json', 'vite.config.js', 'xoong.hints.json', 'angular.json', 'tsconfig.json'];
const lock = JSON.parse(await readFile(join(repo, 'package-lock.json'), 'utf8'));

/** Every package npm installs for one package of this repository (own @xoong packages and third-party ones). */
function installed(name) {
  const seen = new Set();
  const visit = (entry) => {
    for (const dep of Object.keys(entry.dependencies ?? {})) {
      const path = lock.packages[`node_modules/${dep}`]; // workspaces appear as links to packages/*
      if (!path || seen.has(dep)) continue;
      seen.add(dep);
      visit(path.link ? lock.packages[path.resolved] : path);
    }
  };
  visit(lock.packages[`packages/${name}`]);
  return [...seen];
}

/** What each library is for: published on the page, so every package a stack needs is listed and counted. */
const PURPOSE = {
  react: 'components and rendering', 'react-dom': 'rendering in the browser', '@tanstack/react-query': 'server state: fetching, cache, mutations', '@tanstack/react-table': 'headless table: sorting, paging and row selection state',
  'react-hook-form': 'form state and submit', zod: 'validation schema', '@hookform/resolvers': 'connects zod to React Hook Form', '@vitejs/plugin-react': 'JSX transform in the build', vite: 'dev server and bundler',
  vue: 'components and rendering', '@tanstack/vue-query': 'server state: fetching, cache, mutations', '@tanstack/vue-table': 'headless table: sorting, paging and row selection state', 'vee-validate': 'form state and submit', '@vee-validate/zod': 'connects zod to vee-validate', '@vitejs/plugin-vue': 'single-file component compiler in the build',
  '@angular/core': 'components, signals, resource', '@angular/common': 'common directives and pipes (a dependency of the framework)', '@angular/compiler': 'template compiler (a peer of the framework)', '@angular/forms': 'reactive forms and validators', '@angular/platform-browser': 'bootstrap in the browser',
  rxjs: 'observables (required by the framework; used here for the search debounce)', tslib: 'TypeScript helpers', '@angular/build': 'esbuild-based builder', '@angular/cli': 'the ng command', '@angular/compiler-cli': 'ahead-of-time compiler', typescript: 'TypeScript compiler',
};
const result = { environment: environment(), method: 'non-blank, non-comment lines of the files a developer writes (sources, markup, stylesheet); package.json, lockfiles, vite config and the OpenAPI document are not counted (config is listed apart); JSX is counted as script', stacks: {} };
for (const [id, app] of Object.entries(apps).filter(([, a]) => !a.variantOf)) {
  const files = (await walk(app.dir, SKIP)).sort();
  const per = {};
  const total = { markup: 0, script: 0, style: 0 };
  for (const f of files) {
    const c = count(f, await readFile(f, 'utf8'));
    per[relative(app.dir, f)] = c;
    for (const k of Object.keys(total)) total[k] += c[k];
  }
  const config = {};
  for (const c of CONFIG) { try { config[c] = lines(await readFile(join(app.dir, c), 'utf8')); } catch { /* not in this stack */ } }
  const entry = { files: files.length, loc: { ...total, all: total.markup + total.script + total.style }, perFile: per, configLines: config };
  if (id === 'xoong') {
    // the browser gets zero third-party code from xoong's own dependency list; the tooling (`xoong` command) pulls in the packages below
    const pkgs = installed('xoong');
    entry.dependencies = { runtimeInBrowser: 0, direct: 1, installedTotal: pkgs.length + 1, installedOwn: pkgs.filter((p) => p.startsWith('@xoong/')).length + 1, installedThirdParty: pkgs.filter((p) => !p.startsWith('@xoong/')), note: '@xoong/xoong plus everything it needs: the xoong command line (parse5, yaml) is the only third-party code, and it runs in Node, never in the browser' };
  } else {
    const pkg = JSON.parse(await readFile(join(app.dir, 'package.json'), 'utf8'));
    const l = JSON.parse(await readFile(join(app.dir, 'package-lock.json'), 'utf8'));
    entry.dependencies = { runtimeInBrowser: Object.keys(pkg.dependencies).length, direct: Object.keys(pkg.dependencies).length + Object.keys(pkg.devDependencies).length, installedTotal: Object.keys(l.packages).length - 1, versions: pinned(app.dir) };
    entry.libraries = Object.fromEntries(Object.entries(pinned(app.dir)).map(([name, version]) => [name, { version, for: PURPOSE[name] ?? (() => { throw new Error(`say what ${name} is for in PURPOSE`); })(), shipped: name in pkg.dependencies }]));
  }
  result.stacks[id] = entry;
}
await writeFile(out, JSON.stringify(result, null, 1) + '\n');
for (const [id, s] of Object.entries(result.stacks)) console.log(id, s.files, 'files', JSON.stringify(s.loc), JSON.stringify(s.dependencies).slice(0, 160));
