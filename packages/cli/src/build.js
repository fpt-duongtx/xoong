// @ts-check
/**
 * `xoong build`: static output that runs under a strict Content-Security-Policy (no import map, no inline script, no inline style).
 *
 *   xoong build [--root .] [--out dist] [--base /admin]
 *
 * Starts from every .html page under the root and follows what it references (scripts, stylesheets, images) and what the scripts import
 * (relative modules, JSON, and bare packages, which are found in node_modules and copied to the same URLs the dev server uses). Then:
 *   - bare imports ("@xoong/data") are rewritten to URLs, so the page needs no import map;
 *   - TypeScript is stripped (erasable syntax only) and .ts files are written as .js;
 *   - `--base` prefixes root-absolute URLs for an app served under a path;
 *   - `src`, `poster`, `href` of <link>, `srcset` (and `imagesrcset` of <link rel=preload>) are followed: every URL of a srcset is copied and prefixed, its `1x`/`480w` descriptors kept.
 *     `<a href>` is NOT touched, on purpose: a link to another page is left as written for the router and for plain relative links to resolve;
 *   - every page gets <link rel="modulepreload"> for the modules its scripts import (the whole graph is known here; `--no-preload` or `"build": { "preload": false }` turns it off);
 *   - `--minify` and `--bundle` are opt-in and use the esbuild the project has installed (xoong does not depend on it). The default leaves every file as written.
 * HTML files that are not pages (partials, fixtures, drafts) are kept out of the start list with `--exclude <glob>` (repeatable) or `"build": { "exclude": [...] }` in
 * xoong.config.json (paths relative to the root; see exclude.js). A file that a page references is still published.
 * What cannot be seen (a fetch() of a data file, an image named in JavaScript) is added with `--include <file-or-folder>`.
 */
import { readFile, writeFile, mkdir, readdir, stat, copyFile, realpath, mkdtemp, rm } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, extname, posix, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { parse } from 'parse5';
import { findPackages, packagePath, stripTypes } from '@xoong/server/node';
import { loadConfig } from './dev.js';
import { excluder } from './exclude.js';
import { buildImportMap } from '@xoong/server';

const SCRIPT_EXT = new Set(['.js', '.mjs', '.ts', '.mts']);
const toJs = (p) => p.replace(/\.m?ts$/, (m) => (m === '.mts' ? '.mjs' : '.js'));
const isLocal = (u) => !!u && !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(u);

/**
 * The URLs of a `srcset` value with their position, read the way the HTML standard does: a URL is the run of non-space characters
 * (it may contain commas, as a data: URL does; trailing commas end the candidate), then comes an optional descriptor (`2x`, `480w`) up to the next comma.
 * @param {string} value
 * @returns {{ url: string, start: number, end: number }[]}
 */
export function srcsetUrls(value) {
  const space = /[ \t\n\f\r]/;
  const out = [];
  let i = 0;
  while (i < value.length) {
    while (i < value.length && (space.test(value[i]) || value[i] === ',')) i++;
    if (i >= value.length) break;
    const start = i;
    while (i < value.length && !space.test(value[i])) i++;
    let end = i;
    if (value[end - 1] === ',') { while (value[end - 1] === ',') end--; } // "a.png," has no descriptor
    else for (let depth = 0; i < value.length; i++) { // the descriptor: up to a comma that is not inside parentheses
      const c = value[i];
      if (c === '(') depth++;
      else if (c === ')') depth = Math.max(0, depth - 1);
      else if (c === ',' && depth === 0) { i++; break; }
    }
    out.push({ url: value.slice(start, end), start, end });
  }
  return out;
}

/** The policy this output is meant to run under (and is tested with). */
export const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'self'";

const STATIC_IMPORT = /(?:\bimport\s*(?:[\w*${}\s,]*?\bfrom\s*)?|\bexport\s+(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s*from\s*)(['"])([^'"\n]+)\1/g;

/**
 * Modules are fetched one import level at a time, so a chain of N modules costs N round trips. The build knows the whole graph (static imports only;
 * a dynamic import() stays lazy): every page lists the modules its scripts pull in as `<link rel="modulepreload">`, ahead of its first module script.
 * @param {Map<string, Buffer | string>} written output path -> content (the pages are changed in place)
 * @param {string} basePath
 */
export function preloadModules(written, basePath) {
  let count = 0;
  const toOut = (url) => {
    const clean = url.split(/[?#]/)[0];
    if (basePath ? !clean.startsWith(`${basePath}/`) : !clean.startsWith('/') || clean.startsWith('//')) return null;
    return basePath ? clean.slice(basePath.length) : clean;
  };
  /** @param {string} at @param {Set<string>} seen */
  const follow = (at, seen) => {
    const code = written.get(at);
    if (typeof code !== 'string') return;
    for (const m of code.matchAll(STATIC_IMPORT)) {
      const target = toOut(m[2]);
      if (!target || seen.has(target) || !/\.m?js$/.test(target) || !written.has(target)) continue;
      seen.add(target);
      follow(target, seen);
    }
  };
  for (const [page, html] of written) {
    if (typeof html !== 'string' || !/\.html?$/i.test(page)) continue;
    /** @type {string[]} */ const entries = [];
    const have = new Set();
    let first = -1;
    const visit = (/** @type {any} */ node) => {
      for (const child of node.childNodes ?? []) visit(child);
      if (!node.tagName) return;
      const attr = (/** @type {string} */ n) => node.attrs.find((/** @type {{ name: string }} */ a) => a.name === n)?.value;
      if (node.tagName === 'link' && attr('rel') === 'modulepreload' && attr('href')) have.add(toOut(attr('href')));
      if (node.tagName !== 'script' || attr('type') !== 'module' || !attr('src')) return;
      const entry = toOut(attr('src'));
      if (!entry || !written.has(entry)) return;
      entries.push(entry);
      const start = node.sourceCodeLocation.startOffset;
      if (first < 0 || start < first) first = start;
    };
    visit(parse(html, { sourceCodeLocationInfo: true }));
    if (!entries.length) continue;
    const seen = new Set(entries);
    for (const entry of entries) follow(entry, seen);
    const router = [...written.keys()].find((k) => k.endsWith('/@xoong/ui/src/router.js')); // loaded lazily, so a page that has <xo-router> asks for it now
    if (router && /<xo-router[\s>]/i.test(html) && !seen.has(router)) { seen.add(router); follow(router, seen); }
    const links = [...seen].filter((p) => !entries.includes(p) && !have.has(p)).sort().map((p) => `<link rel="modulepreload" href="${basePath}${p}">`);
    if (links.length) { count += links.length; written.set(page, `${html.slice(0, first)}${links.join('\n')}\n${html.slice(first)}`); }
  }
  return count;
}

/**
 * @param {{ root?: string, out?: string, base?: string, include?: string[], exclude?: string[], preload?: boolean, minify?: boolean, bundle?: boolean, inlineScripts?: string, packages?: string[] }} [options]
 * @returns {Promise<{ out: string, files: { path: string, bytes: number, gzip: number }[], warnings: string[], csp: string, minified: boolean, bundled: boolean, failed: boolean, preloads: number | null }>}
 */
export async function build({ root = '.', out = 'dist', base = '', include = [], exclude, preload, minify, bundle, inlineScripts, packages: extra } = {}) {
  const rootDir = await realpath(resolve(root)); // real path: packages are found by theirs, so an app inside a symlinked package must compare equal
  // the output folder may not exist yet: resolve the part that does
  const realOut = async (p) => { try { return await realpath(p); } catch { const up = dirname(p); return up === p ? p : join(await realOut(up), basename(p)); } };
  const outDir = await realOut(resolve(out));
  const basePath = base ? `/${base.replace(/^\/+|\/+$/g, '')}` : '';
  const config = await loadConfig(rootDir);
  const inlineMode = inlineScripts ?? config.build?.inlineScripts ?? 'remove';
  if (inlineMode !== 'remove' && inlineMode !== 'error') throw new Error(`xoong build: --inline-scripts must be remove or error, not "${inlineMode}"`);
  const packages = await findPackages(rootDir, undefined, extra ?? config.packages ?? []);
  const importMap = buildImportMap(packages).imports;
  /** @type {string[]} */ const warnings = [];
  let removedInline = 0;
  const JS_TYPE = /^(?:module|text\/javascript|application\/javascript|text\/ecmascript|application\/ecmascript)$/i;
  /** A URL that already carries the base is not prefixed again, and a file lookup uses the path without it. */
  const unbase = (url) => (!basePath || !url.startsWith('/') || url === basePath ? (url === basePath ? '/' : url) : url.startsWith(`${basePath}/`) ? url.slice(basePath.length) || '/' : url);
  const applyBase = (url) => (!basePath || !url.startsWith('/') || url === basePath || url.startsWith(`${basePath}/`) || url.startsWith(`${basePath}?`) || url.startsWith(`${basePath}#`) ? url : `${basePath}${url}`);
  const publishOps = await stat(join(rootDir, '.xoong', 'operations.json')).then((s) => s.isFile(), () => false);
  /** @type {Map<string, string>} output path (relative to out, with a leading slash) -> source file */
  const sources = new Map();
  /** @type {Map<string, Buffer | string>} */ const written = new Map();
  const queue = [];

  /** Source file for a root-absolute URL path: the app root, or an installed package under its prefix. */
  function fileFor(urlPath) {
    for (const p of Object.values(packages)) {
      if (urlPath === p.prefix || urlPath.startsWith(`${p.prefix}/`)) return join(p.dir, urlPath.slice(p.prefix.length));
    }
    return join(rootDir, urlPath);
  }
  /** An exports subpath used as a URL ("/@rainlet/theme.css") becomes the real file's URL, so relative references inside it keep working. */
  const canon = (url) => {
    for (const p of Object.values(packages)) if (url.startsWith(`${p.prefix}/`)) return p.prefix + packagePath(p.exports, url.slice(p.prefix.length));
    return url;
  };
  /**
   * The URL of a file. The most specific owner wins: an app that lives inside the package it consumes (`"rainlet": "file:.."`, a workspace)
   * keeps its own pages at the site root, while the package's files are still served under its prefix.
   */
  const urlOf = (file) => {
    const inside = (dir) => file === dir || file.startsWith(dir + sep);
    const owner = Object.values(packages).filter((p) => inside(p.dir)).sort((a, b) => b.dir.length - a.dir.length)[0];
    if (owner && !(inside(rootDir) && rootDir.length > owner.dir.length)) return `${owner.prefix}${file.slice(owner.dir.length).split(sep).join('/')}`;
    return `/${relative(rootDir, file).split(sep).join('/')}`;
  };
  const inOut = (f) => f === outDir || f.startsWith(outDir + sep); // the output folder is never an input, even when it sits inside the root
  const exists = async (f) => !inOut(f) && stat(f).then((s) => s.isFile(), () => false);

  /** Rewrite one specifier or URL found in `fromUrl` (a root-absolute URL path). Returns the new text, and queues the target file. */
  async function rewrite(spec, fromUrl) {
    let target;
    if (importMap[spec]) target = importMap[spec]; // a bare import of an installed package
    else if (/^[a-z@][^:]*$/i.test(spec) && !spec.startsWith('.') && !spec.startsWith('/')) {
      const prefix = Object.keys(importMap).filter((k) => k.endsWith('/') && spec.startsWith(k)).sort((a, b) => b.length - a.length)[0];
      if (!prefix) { warnings.push(`${fromUrl}: cannot resolve "${spec}" (not an installed xoong package); left as it is`); return spec; }
      target = importMap[prefix] + spec.slice(prefix.length);
    } else if (spec.startsWith('/')) target = spec.split(/[?#]/)[0];
    else if (spec.startsWith('.')) target = posix.normalize(posix.join(posix.dirname(fromUrl), spec.split(/[?#]/)[0]));
    else return spec; // an absolute URL: not ours
    target = canon(unbase(target));
    const suffix = (spec.match(/[?#].*$/) ?? [''])[0];
    if (publishOps && target === '/.xoong/operations.json') { queue.push(target); return `${applyBase('/operations.json')}${suffix}`; }
    queue.push(target);
    return `${applyBase(toJs(target))}${suffix}`;
  }

  async function transformScript(urlPath, source) {
    let code = source;
    if (/\.m?ts$/.test(urlPath)) code = await stripTypes(code, urlPath);
    const re = /(\bimport\s*(?:[\w*${}\s,]*?\bfrom\s*)?|\bexport\s+(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s*from\s*|\bimport\s*\(\s*)(['"])([^'"\n]+)\2/g;
    const parts = [];
    let last = 0;
    for (const m of code.matchAll(re)) {
      const specStart = (m.index ?? 0) + m[0].length - m[3].length - 1;
      parts.push(code.slice(last, specStart), await rewrite(m[3], urlPath));
      last = specStart + m[3].length;
    }
    parts.push(code.slice(last));
    return parts.join('');
  }

  async function transformCss(urlPath, source) {
    const parts = [];
    let last = 0;
    for (const m of source.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)|@import\s+(['"])([^'"]+)\3/g)) {
      const spec = m[2] ?? m[4];
      if (!isLocal(spec) || spec.startsWith('data:')) continue;
      const at = (m.index ?? 0) + m[0].indexOf(spec);
      parts.push(source.slice(last, at), await rewrite(relativeUrl(spec), urlPath));
      last = at + spec.length;
    }
    parts.push(source.slice(last));
    return parts.join('');
  }

  /** HTML: rewrite references, drop an import map (the imports are rewritten), warn about what a strict policy blocks. */
  async function transformHtml(urlPath, source) {
    const doc = parse(source, { sourceCodeLocationInfo: true });
    const edits = [];
    const visit = async (node) => {
      for (const child of node.childNodes ?? []) await visit(child);
      if (node.nodeName === 'template') for (const child of node.content?.childNodes ?? []) await visit(child);
      if (!node.tagName) return;
      const attr = (n) => node.attrs.find((a) => a.name === n);
      if (node.tagName === 'script') {
        if (attr('type')?.value === 'importmap') { const l = node.sourceCodeLocation; edits.push([l.startOffset, l.endOffset, '']); return; }
        const type = (attr('type')?.value ?? '').trim();
        if (!attr('src') && (type === '' || JS_TYPE.test(type)) && (node.childNodes ?? []).some((c) => c.value?.trim())) {
          removedInline += 1;
          warnings.push(`${urlPath}:${node.sourceCodeLocation.startLine}: removed an inline <script> (blocked by script-src 'self'); move it to a file`);
          const l = node.sourceCodeLocation;
          edits.push([l.startOffset, l.endOffset, '']);
          return;
        }
      }
      if (attr('style')) warnings.push(`${urlPath}:${node.sourceCodeLocation.startLine}: a style="" attribute is blocked by style-src 'self'; use a class`);
      if (node.tagName === 'style') warnings.push(`${urlPath}:${node.sourceCodeLocation.startLine}: an inline <style> is blocked by style-src 'self'; move it to a stylesheet`);
      for (const name of ['src', 'href', 'poster', 'srcset', 'imagesrcset']) {
        const a = attr(name);
        if (!a || node.tagName === 'a' || (node.tagName === 'link' && attr('rel')?.value && !/stylesheet|icon|preload|modulepreload|manifest/.test(attr('rel')?.value ?? ''))) continue;
        if (name === 'imagesrcset' && node.tagName !== 'link') continue;
        const loc = node.sourceCodeLocation.attrs?.[name];
        if (!loc) continue;
        const raw = source.slice(loc.startOffset, loc.endOffset);
        if (name === 'srcset' || name === 'imagesrcset') { // several URLs, each with a descriptor: every local one is copied and given the base
          const found = [];
          for (const { url, start, end } of srcsetUrls(a.value)) if (isLocal(url)) found.push({ start, end, next: await rewriteHtmlUrl(url, urlPath), url });
          const changes = found.filter((f) => f.next !== f.url);
          if (!changes.length) continue;
          let value = a.value;
          for (const { start, end, next } of changes.reverse()) value = value.slice(0, start) + next + value.slice(end);
          // keep the attribute as written (quotes included); a decoded character reference (&amp;) cannot be spliced into the source, so that attribute is written again
          const at = raw.indexOf(a.value, raw.indexOf('=') + 1);
          edits.push([loc.startOffset, loc.endOffset, at >= 0 ? raw.slice(0, at) + value + raw.slice(at + a.value.length) : `${name}="${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`]);
          continue;
        }
        if (!isLocal(a.value) || a.value.startsWith('data:')) continue;
        edits.push([loc.startOffset, loc.endOffset, raw.replace(a.value, await rewriteHtmlUrl(a.value, urlPath))]);
      }
    };
    await visit(doc);
    edits.sort((x, y) => y[0] - x[0]);
    let result = source;
    for (const [s, e, text] of edits) result = result.slice(0, s) + text + result.slice(e);
    return result;
  }

  /** In HTML and CSS a URL without a leading slash or dot is relative to the file (only JavaScript imports have bare package names). */
  const relativeUrl = (u) => (/^[./?#]/.test(u) ? u : `./${u}`);

  /** Links inside the page to other pages are left; files the page loads are queued and given the base. */
  async function rewriteHtmlUrl(rawUrl, fromUrl) {
    const url = relativeUrl(rawUrl); // href="src/app.css" is relative to the page, not a package name
    const target = url.startsWith('/') ? url.split(/[?#]/)[0] : posix.normalize(posix.join(posix.dirname(fromUrl), url.split(/[?#]/)[0]));
    if (!(await exists(fileFor(canon(target))))) return url; // not a file we can serve (a route): keep as written
    return rewrite(url, fromUrl);
  }

  async function emit(urlPath) {
    const outPath = toJs(urlPath);
    if (sources.has(outPath)) return;
    const file = fileFor(urlPath);
    if (inOut(file)) { warnings.push(`${urlPath}: points into the output folder, which is not an input`); sources.set(outPath, ''); return; }
    if (!(await exists(file))) { warnings.push(`${urlPath}: referenced but not found`); sources.set(outPath, ''); return; }
    sources.set(outPath, file);
    const ext = extname(file).toLowerCase();
    if (SCRIPT_EXT.has(ext)) written.set(outPath, await transformScript(urlPath, await readFile(file, 'utf8')));
    else if (ext === '.css') written.set(outPath, await transformCss(urlPath, await readFile(file, 'utf8')));
    else if (ext === '.html' || ext === '.htm') written.set(outPath, await transformHtml(urlPath, await readFile(file, 'utf8')));
    else written.set(outPath, await readFile(file));
  }

  // pages first, then whatever they pull in
  const pages = [];
  const skip = excluder([...(exclude ?? []), ...((config.build ?? {}).exclude ?? [])]);
  const walk = async (dir) => {
    for (const name of await readdir(dir)) {
      if (name === 'node_modules' || name.startsWith('.') || resolve(dir, name) === outDir) continue;
      const p = join(dir, name);
      if (skip(relative(rootDir, p))) continue;
      if ((await stat(p)).isDirectory()) await walk(p); else if (/\.html?$/i.test(name)) pages.push(urlOf(p));
    }
  };
  await walk(rootDir);
  if (!pages.length) throw new Error(`xoong build: no .html page found under ${rootDir}`);
  for (const item of include) {
    const p = resolve(rootDir, item);
    const s = await stat(p).catch(() => null);
    if (!s) { warnings.push(`--include ${item}: not found`); continue; }
    const files = [];
    const collect = async (d) => { for (const n of await readdir(d)) { const f = join(d, n); if (inOut(f)) continue; if ((await stat(f)).isDirectory()) await collect(f); else files.push(f); } };
    if (s.isDirectory()) await collect(p); else files.push(p);
    for (const f of files) queue.push(urlOf(f));
  }
  queue.push(...pages);
  while (queue.length) await emit(/** @type {string} */ (queue.shift()));
  if (publishOps) {
    const body = await readFile(join(rootDir, '.xoong', 'operations.json'), 'utf8');
    written.set('/.xoong/operations.json', body);
    written.set('/operations.json', body); // nginx hides dot-directories, so the table is also at the site root
  }

  /** Bundle module entries from their source (bare specifiers), then drop the copied modules the bundle replaces. A dynamic import() stays a chunk. */
  async function bundleModules(minifyJs) {
    /** @type {Record<string, string>} */
    const points = {};
    const scan = (html, fn) => {
      const visit = (node) => {
        for (const child of node.childNodes ?? []) visit(child);
        if (node.nodeName === 'template') for (const child of node.content?.childNodes ?? []) visit(child);
        fn(node);
      };
      visit(parse(html));
    };
    for (const [page, html] of written) {
      if (typeof html !== 'string' || !/\.html?$/i.test(page)) continue;
      scan(html, (node) => {
        if (node.tagName !== 'script') return;
        const attr = (n) => node.attrs.find((a) => a.name === n)?.value;
        if (attr('type') !== 'module' || !attr('src')) return;
        const src = unbase(attr('src').split(/[?#]/)[0]);
        if (src.startsWith('/') && sources.has(src)) points[src.slice(1).replace(/\.m?js$/, '')] = /** @type {string} */ (sources.get(src));
      });
    }
    if (!Object.keys(points).length) return false;
    const esbuild = findEsbuild(rootDir);
    if (typeof esbuild?.build !== 'function') {
      warnings.push('--bundle: esbuild is not installed in this project (npm install --save-dev esbuild); the output is not bundled');
      return false;
    }
    const tmp = await mkdtemp(join(tmpdir(), 'xoong-bundle-'));
    try {
      const built = await esbuild.build({
        absWorkingDir: rootDir, entryPoints: points, bundle: true, splitting: true, format: 'esm', target: 'es2022', legalComments: 'none', minify: minifyJs, outdir: tmp, write: true, charset: 'utf8', metafile: true, logLevel: 'silent',
        plugins: [{
          name: 'xoong-root-url',
          setup(api) {
            // A root-absolute import is a URL in this project (`/.xoong/operations.json`), not a path from the filesystem root.
            api.onResolve({ filter: /^\// }, async (args) => {
              const spec = args.path.split(/[?#]/)[0];
              if (!spec.startsWith('/') || spec.startsWith('//') || spec.startsWith(rootDir)) return null;
              const file = fileFor(canon(spec));
              if (!(await exists(file))) return null;
              return { path: file };
            });
          },
        }],
      });
      for (const w of built.warnings ?? []) warnings.push(`--bundle: ${w.text}`);
      /** @type {Map<string, Buffer | string>} */
      const produced = new Map();
      const collect = async (dir) => {
        for (const name of await readdir(dir)) {
          const p = join(dir, name);
          if ((await stat(p)).isDirectory()) await collect(p);
          else {
            const rel = `/${relative(tmp, p).split(sep).join('/')}`;
            produced.set(rel, /\.(m?js|css|json|html?)$/.test(rel) ? await readFile(p, 'utf8') : await readFile(p));
          }
        }
      };
      await collect(tmp);
      for (const [rel, content] of produced) written.set(rel, content);
      const classic = new Set();
      for (const [page, html] of written) {
        if (typeof html !== 'string' || !/\.html?$/i.test(page)) continue;
        scan(html, (node) => {
          if (node.tagName !== 'script') return;
          const attr = (n) => node.attrs.find((a) => a.name === n)?.value;
          if (!attr('src') || attr('type') === 'module') return;
          const src = unbase(attr('src').split(/[?#]/)[0]);
          if (src.startsWith('/')) classic.add(toJs(src));
        });
      }
      // esbuild names an input by its path on disk (`../../../packages/...` here, `node_modules/@xoong/...` when installed),
      // never by the /@xoong URL the copy was written at. Map the path back to that URL. A worker, a URL fetch, or --include is not an input.
      const bundled = new Set();
      for (const input of Object.keys(built.metafile?.inputs ?? {})) {
        let abs = resolve(rootDir, input.split('?')[0]);
        try { abs = await realpath(abs); } catch { /* the path esbuild reported */ }
        bundled.add(toJs(urlOf(abs)));
      }
      for (const key of [...written.keys()]) if (/\.m?js$/.test(key) && bundled.has(key) && !produced.has(key) && !classic.has(key)) written.delete(key);
      return true;
    } catch (error) {
      throw new Error(`xoong build: --bundle failed (${error instanceof Error ? error.message : error})`);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  }

  const wantMinify = minify ?? config.build?.minify ?? false;
  const wantBundle = bundle ?? config.build?.bundle ?? false;
  let bundled = false;
  if (wantBundle) bundled = await bundleModules(!!wantMinify);

  let minified = false;
  if (wantMinify) {
    const esbuild = findEsbuild(rootDir);
    if (!esbuild?.transform) warnings.push('--minify: esbuild is not installed in this project (npm install --save-dev esbuild); the output is not minified');
    else {
      for (const [outPath, content] of written) {
        if (typeof content !== 'string' || (bundled && /\.m?js$/.test(outPath))) continue; // a bundle was already minified by esbuild.build
        if (/\.m?js$/.test(outPath)) written.set(outPath, (await esbuild.transform(content, { loader: 'js', format: 'esm', target: 'esnext', minify: true, legalComments: 'none' })).code);
        else if (outPath.endsWith('.css')) written.set(outPath, (await esbuild.transform(content, { loader: 'css', minify: true, legalComments: 'none' })).code);
      }
      for (const [outPath, content] of written) if (outPath.endsWith('.json') && outPath !== '/build-report.json') written.set(outPath, JSON.stringify(JSON.parse(content.toString())));
      minified = true;
    }
  }

  const preloads = (preload ?? config.build?.preload ?? true) ? preloadModules(written, basePath) : null;

  const report = [];
  for (const [outPath, content] of written) {
    const dest = join(outDir, outPath);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, content);
    const buf = typeof content === 'string' ? Buffer.from(content) : content;
    report.push({ path: outPath, bytes: buf.length, gzip: gzipSync(buf).length });
  }
  report.sort((a, b) => a.path.localeCompare(b.path));
  await writeFile(join(outDir, 'build-report.json'), JSON.stringify({ csp: CSP, minified, bundled, files: report, warnings }, null, 2) + '\n');
  void copyFile;
  return { out: outDir, files: report, warnings, csp: CSP, minified, bundled, failed: inlineMode === 'error' && removedInline > 0, preloads };
}

/** esbuild as the project has it installed (xoong does not depend on it); null when it is not there. */
function findEsbuild(rootDir) {
  try { return createRequire(join(rootDir, 'package.json'))('esbuild'); } catch { return null; }
}
