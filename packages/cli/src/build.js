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
 *   - nothing is minified or bundled; every file is the one you wrote (readable in the browser's tools).
 * What cannot be seen (a fetch() of a data file, an image named in JavaScript) is added with `--include <file-or-folder>`.
 */
import { readFile, writeFile, mkdir, readdir, stat, copyFile, realpath } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, extname, posix, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { parse } from 'parse5';
import { findPackages, packagePath, stripTypes } from '@xoong/server/node';
import { loadConfig } from './dev.js';
import { buildImportMap } from '@xoong/server';

const SCRIPT_EXT = new Set(['.js', '.mjs', '.ts', '.mts']);
const toJs = (p) => p.replace(/\.m?ts$/, (m) => (m === '.mts' ? '.mjs' : '.js'));
const isLocal = (u) => !!u && !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(u);

/** The policy this output is meant to run under (and is tested with). */
export const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'self'";

/**
 * @param {{ root?: string, out?: string, base?: string, include?: string[] }} [options]
 * @returns {Promise<{ out: string, files: { path: string, bytes: number, gzip: number }[], warnings: string[], csp: string }>}
 */
export async function build({ root = '.', out = 'dist', base = '', include = [], packages: extra } = {}) {
  const rootDir = await realpath(resolve(root)); // real path: packages are found by theirs, so an app inside a symlinked package must compare equal
  // the output folder may not exist yet: resolve the part that does
  const realOut = async (p) => { try { return await realpath(p); } catch { const up = dirname(p); return up === p ? p : join(await realOut(up), basename(p)); } };
  const outDir = await realOut(resolve(out));
  const basePath = base ? `/${base.replace(/^\/+|\/+$/g, '')}` : '';
  const packages = await findPackages(rootDir, undefined, extra ?? (await loadConfig(rootDir)).packages ?? []);
  const importMap = buildImportMap(packages).imports;
  /** @type {string[]} */ const warnings = [];
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
    target = canon(target);
    const suffix = (spec.match(/[?#].*$/) ?? [''])[0];
    queue.push(target);
    return `${basePath}${toJs(target)}${suffix}`;
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
      parts.push(source.slice(last, at), await rewrite(spec, urlPath));
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
        if (!attr('src') && (node.childNodes ?? []).some((c) => c.value?.trim())) warnings.push(`${urlPath}:${node.sourceCodeLocation.startLine}: an inline <script> is blocked by script-src 'self'; move it to a file`);
      }
      if (attr('style')) warnings.push(`${urlPath}:${node.sourceCodeLocation.startLine}: a style="" attribute is blocked by style-src 'self'; use a class`);
      if (node.tagName === 'style') warnings.push(`${urlPath}:${node.sourceCodeLocation.startLine}: an inline <style> is blocked by style-src 'self'; move it to a stylesheet`);
      for (const name of ['src', 'href', 'poster', 'srcset']) {
        const a = attr(name);
        if (!a || !isLocal(a.value) || node.tagName === 'a' || (node.tagName === 'link' && attr('rel')?.value && !/stylesheet|icon|preload|modulepreload|manifest/.test(attr('rel')?.value ?? ''))) continue;
        if (name === 'srcset' || a.value.startsWith('data:')) continue;
        const loc = node.sourceCodeLocation.attrs?.[name];
        if (!loc) continue;
        const raw = source.slice(loc.startOffset, loc.endOffset);
        edits.push([loc.startOffset, loc.endOffset, raw.replace(a.value, await rewriteHtmlUrl(a.value, urlPath))]);
      }
    };
    await visit(doc);
    edits.sort((x, y) => y[0] - x[0]);
    let result = source;
    for (const [s, e, text] of edits) result = result.slice(0, s) + text + result.slice(e);
    return result;
  }

  /** Links inside the page to other pages are left; files the page loads are queued and given the base. */
  async function rewriteHtmlUrl(url, fromUrl) {
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
  const walk = async (dir) => {
    for (const name of await readdir(dir)) {
      if (name === 'node_modules' || name.startsWith('.') || resolve(dir, name) === outDir) continue;
      const p = join(dir, name);
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

  const report = [];
  for (const [outPath, content] of written) {
    const dest = join(outDir, outPath);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, content);
    const buf = typeof content === 'string' ? Buffer.from(content) : content;
    report.push({ path: outPath, bytes: buf.length, gzip: gzipSync(buf).length });
  }
  report.sort((a, b) => a.path.localeCompare(b.path));
  await writeFile(join(outDir, 'build-report.json'), JSON.stringify({ csp: CSP, files: report, warnings }, null, 2) + '\n');
  void copyFile;
  return { out: outDir, files: report, warnings, csp: CSP };
}
