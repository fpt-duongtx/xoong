// Installed packages beyond xoong's own (config `packages`): exports maps with wildcards and subpaths, Node-only entries left out.
import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../src/build.js';
import { excluder } from '../src/exclude.js';
import { findPackages, createDevHandler } from '@xoong/server/node';

async function project() {
  const root = await mkdtemp(join(tmpdir(), 'xoong-pk-'));
  const pkg = join(root, 'node_modules/rainlet');
  const w = async (p, t) => { await mkdir(join(p, '..'), { recursive: true }); await writeFile(p, t); };
  await w(join(pkg, 'package.json'), JSON.stringify({ name: 'rainlet', type: 'module', exports: { '.': './src/index.js', './widgets/*': './src/widgets/*.js', './theme.css': './src/theme/rainlet.css', './server': './src/server/index.mjs' } }));
  await w(join(pkg, 'src/index.js'), "import './widgets/slug.js';\nexport const ready = true;\n");
  await w(join(pkg, 'src/widgets/slug.js'), "import { ready } from '../index.js';\nexport const slug = ready;\n");
  await w(join(pkg, 'src/widgets/image-field.js'), "export const image = 1;\n");
  await w(join(pkg, 'src/theme/rainlet.css'), "body { background: url(./bg.svg); }\n");
  await w(join(pkg, 'src/theme/bg.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await w(join(pkg, 'src/server/index.mjs'), "import 'node:fs';\n");
  await w(join(root, 'xoong.config.json'), JSON.stringify({ packages: ['rainlet'] }));
  await w(join(root, 'index.html'), '<!doctype html><link rel="stylesheet" href="/@rainlet/theme.css"><script type="module" src="/app.js"></script>');
  await w(join(root, 'app.js'), "import 'rainlet';\nimport { image } from 'rainlet/widgets/image-field';\nconsole.log(image);\n");
  return root;
}

describe('packages named in xoong.config.json', () => {
  it('findPackages expands wildcards, serves unscoped packages under /@name and leaves Node-only entries out', async () => {
    const root = await project();
    const found = await findPackages(root, undefined, ['rainlet']);
    expect(found.rainlet.prefix).toBe('/@rainlet');
    expect(found.rainlet.exports).toEqual({
      '.': './src/index.js', './widgets/slug': './src/widgets/slug.js', './widgets/image-field': './src/widgets/image-field.js', './theme.css': './src/theme/rainlet.css',
    });
  });

  it('the umbrella @xoong/xoong is an installed xoong package, with its /view and /ui subpaths', async () => {
    const found = await findPackages(process.cwd());
    expect(found['@xoong/xoong'].prefix).toBe('/@xoong/xoong');
    expect(Object.keys(found['@xoong/xoong'].exports)).toEqual(expect.arrayContaining(['.', './view', './ui']));
  });

  it('the dev handler serves an exports subpath as its file', async () => {
    const root = await project();
    const handler = await createDevHandler({ root, packages: ['rainlet'] });
    const res = await handler(new Request('http://localhost/@rainlet/theme.css'));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('background');
  });

  it('build resolves bare imports, subpaths with wildcards and the stylesheet, and copies what they pull in', async () => {
    const root = await project();
    const out = join(root, 'dist');
    const r = await build({ root, out });
    expect(r.warnings).toEqual([]);
    const app = await readFile(join(out, 'app.js'), 'utf8');
    expect(app).toContain("import '/@rainlet/src/index.js'");
    expect(app).toContain("from '/@rainlet/src/widgets/image-field.js'");
    expect(await readFile(join(out, 'index.html'), 'utf8')).toContain('href="/@rainlet/src/theme/rainlet.css"');
    expect(await readFile(join(out, '@rainlet/src/theme/rainlet.css'), 'utf8')).toContain('url(/@rainlet/src/theme/bg.svg)');
    const all = (await readdir(out, { recursive: true })).map((n) => n.split('\\').join('/'));
    expect(all).toContain('@rainlet/src/widgets/slug.js'); // pulled in by index.js
    expect(all).toContain('@rainlet/src/theme/bg.svg');
    expect(all.some((n) => n.includes('server'))).toBe(false);
  });
});

describe('a package installed as a symlink, with the app inside the package folder ("rainlet": "file:..")', () => {
  it('the app keeps its pages at the site root; only files reachable from the page are copied from the package', async () => {
    const { symlink } = await import('node:fs/promises');
    const pkg = await mkdtemp(join(tmpdir(), 'xoong-link-'));
    const w = async (p, t) => { await mkdir(join(p, '..'), { recursive: true }); await writeFile(p, t); };
    await w(join(pkg, 'package.json'), JSON.stringify({ name: 'rainlet', type: 'module', exports: { '.': './src/index.js', './theme.css': './src/theme.css', './server': './src/server.mjs' } }));
    await w(join(pkg, 'src/index.js'), 'export const a = 1;\n');
    await w(join(pkg, 'src/theme.css'), 'body{margin:0}\n');
    await w(join(pkg, 'src/unused.js'), 'export const unused = 1;\n');
    await w(join(pkg, 'src/server.mjs'), 'export {};\n');
    await w(join(pkg, 'vendor/old.tgz'), 'x');
    const app = join(pkg, 'playground');
    await w(join(app, 'xoong.config.json'), JSON.stringify({ packages: ['rainlet'] }));
    await w(join(app, 'index.html'), '<!doctype html><link rel="stylesheet" href="/@rainlet/theme.css"><script type="module" src="/main.js"></script>');
    await w(join(app, 'main.js'), "import 'rainlet';\n");
    await mkdir(join(app, 'node_modules'), { recursive: true });
    await symlink(pkg, join(app, 'node_modules/rainlet'), 'dir');
    const out = join(pkg, 'dist');
    const r = await build({ root: app, out });
    expect(r.warnings).toEqual([]);
    const all = (await readdir(out, { recursive: true })).map((n) => n.split('\\').join('/')).filter((n) => /\.\w+$/.test(n)).sort();
    expect(all).toEqual(['@rainlet/src/index.js', '@rainlet/src/theme.css', 'build-report.json', 'index.html', 'main.js']);
  });
});

describe('exclude: HTML that is not a page', () => {
  it('--exclude and build.exclude keep partials, fixtures and drafts out of the build', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xoong-ex-'));
    const outs = await mkdtemp(join(tmpdir(), 'xoong-ex-out-')); // outside the root: a later build must not read an earlier output as input
    const w = async (p, t) => { await mkdir(join(root, p, '..'), { recursive: true }); await writeFile(join(root, p), t); };
    await w('index.html', '<!doctype html><title>x</title><a href="about.html">a</a>');
    await w('about.html', '<!doctype html><title>about</title>');
    await w('screens/home.html', '<p>partial</p>');
    await w('fixtures/a.html', '<p>fixture</p>');
    await w('notes.draft.html', '<p>draft</p>');
    await w('app.html', '<p>source</p>');
    const files = async (out) => (await readdir(out, { recursive: true })).map((n) => n.split('\\').join('/')).filter((n) => n.endsWith('.html')).sort();
    const all = await build({ root, out: join(outs, 'o1') });
    expect(all.warnings).toEqual([]);
    expect(await files(join(outs, 'o1'))).toEqual(['about.html', 'app.html', 'fixtures/a.html', 'index.html', 'notes.draft.html', 'screens/home.html']);
    await build({ root, out: join(outs, 'o2'), exclude: ['screens/', 'fixtures/**', '*.draft.html', 'app.html'] });
    expect(await files(join(outs, 'o2'))).toEqual(['about.html', 'index.html']);
    await writeFile(join(root, 'xoong.config.json'), JSON.stringify({ build: { exclude: ['screens', 'fixtures', 'app.html', '*.draft.html'] } }));
    await build({ root, out: join(outs, 'o3') });
    expect(await files(join(outs, 'o3'))).toEqual(['about.html', 'index.html']);
  });

  it('the glob: * stays in a folder, ** crosses folders, a name without / matches at any depth', () => {
    const ex = excluder(['a/*.html', 'b/**/x.html', 'drafts', '?.md']);
    expect(ex('a/one.html')).toBe(true);
    expect(ex('a/deep/one.html')).toBe(false);
    expect(ex('b/x.html')).toBe(true);
    expect(ex('b/c/d/x.html')).toBe(true);
    expect(ex('src/drafts')).toBe(true);
    expect(ex('src/drafts/x.html')).toBe(false); // a folder is skipped as a whole while walking, so its files are never asked
    expect(ex('z.md')).toBe(true);
    expect(ex('zz.md')).toBe(false);
  });
});
