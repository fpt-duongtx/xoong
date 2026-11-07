// @ts-check
/**
 * One web-standard handler: (Request) => Promise<Response>.
 * It runs anywhere a Fetch-API runtime exists. File access is injected, so this file imports no Node module.
 *
 *   createHandler({
 *     files:    async (path) => ({ body: Uint8Array|string, type?: string }) | null,
 *     proxy:    { '/api': 'https://backend.internal' },   // prefix -> upstream origin
 *     packages: { '@xoong/core': { prefix: '/@xoong/core', exports: {...} } }, // served to the browser via an import map
 *     transform: { '.ts': (code, path) => javascript },     // e.g. strip TypeScript types
 *   })
 */

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.ts': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.xml': 'application/xml', '.pdf': 'application/pdf', '.wasm': 'application/wasm',
  '.map': 'application/json', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg',
};
const extOf = (p) => { const i = p.lastIndexOf('.'); return i < 0 ? '' : p.slice(i).toLowerCase(); };

/** Headers that describe one hop and must not be copied through a proxy. */
const HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'host', 'content-length']);

/**
 * Build the import map for the packages the page may import (bare specifiers like "@xoong/core").
 * @param {Record<string, { prefix: string, exports: Record<string, string> | string }>} packages
 */
export function buildImportMap(packages) {
  /** @type {Record<string, string>} */
  const imports = {};
  for (const [name, { prefix, exports }] of Object.entries(packages)) {
    const map = typeof exports === 'string' ? { '.': exports } : exports;
    for (const [sub, target] of Object.entries(map)) {
      const file = typeof target === 'string' ? target : target?.default ?? target?.import;
      if (typeof file !== 'string') continue;
      imports[sub === '.' ? name : `${name}/${sub.replace(/^\.\//, '')}`] = `${prefix}/${file.replace(/^\.\//, '')}`;
    }
  }
  return { imports };
}

/** Insert an import map before the first <script> (or at the end of <head>) unless the page has one. */
export function injectImportMap(html, importMap) {
  if (/<script[^>]+type\s*=\s*["']importmap["']/i.test(html)) return html;
  const tag = `<script type="importmap">${JSON.stringify(importMap).replace(/</g, '\\u003c')}</script>`;
  const script = html.search(/<script\b/i);
  if (script >= 0) return html.slice(0, script) + tag + '\n' + html.slice(script);
  const head = html.search(/<\/head>/i);
  if (head >= 0) return html.slice(0, head) + tag + '\n' + html.slice(head);
  return tag + '\n' + html;
}

/**
 * @param {{
 *   files?: (path: string) => Promise<{ body: Uint8Array | string, type?: string } | null>,
 *   proxy?: Record<string, string>,
 *   packages?: Record<string, { prefix: string, exports: Record<string, any> | string }>,
 *   transform?: Record<string, (code: string, path: string) => string | Promise<string>>,
 *   fetch?: typeof fetch,
 *   spa?: boolean,
 *   headers?: Record<string, string>,
 *   onError?: (error: unknown, request: Request) => void,
 * }} options
 */
export function createHandler(options = {}) {
  const { files, proxy = {}, packages = {}, transform = {}, spa = false, headers: extra = {}, onError } = options;
  const upstreamFetch = options.fetch ?? globalThis.fetch;
  const importMap = Object.keys(packages).length ? buildImportMap(packages) : null;
  // Longest prefix first so "/api/v2" wins over "/api".
  const proxies = Object.entries(proxy).sort((a, b) => b[0].length - a[0].length);
  for (const [prefix, target] of proxies) {
    if (!prefix.startsWith('/')) throw new Error(`xoong server: proxy prefix "${prefix}" must start with "/"`);
    try { new URL(target); } catch { throw new Error(`xoong server: proxy target for "${prefix}" is not a valid URL: ${target}`); }
  }

  /** path -> { code, out }: an unchanged source file is not transformed again on every reload. */
  const transformed = new Map();
  const text = (status, message) => new Response(message, { status, headers: { 'content-type': 'text/plain; charset=utf-8', ...extra } });

  /** The part of the (still percent-encoded) path below `prefix`, or null when the path is not under it. */
  function below(rawPath, prefix) {
    if (prefix === '/') return rawPath;
    if (rawPath === prefix) return '';
    return rawPath.startsWith(prefix + '/') ? rawPath.slice(prefix.length) : null; // "/apix" is not under "/api"
  }

  /** @param {Request} request @param {URL} url @param {string} rest @param {string} target */
  async function forward(request, url, rest, target) {
    const upstream = new URL(target);
    upstream.pathname = upstream.pathname.replace(/\/$/, '') + (rest || '/');
    upstream.search = url.search;
    const out = new Headers();
    for (const [k, v] of request.headers) if (!HOP.has(k.toLowerCase())) out.set(k, v);
    out.set('x-forwarded-host', url.host);
    out.set('x-forwarded-proto', url.protocol.replace(':', ''));
    const hasBody = !['GET', 'HEAD'].includes(request.method);
    try {
      const res = await upstreamFetch(upstream, { method: request.method, headers: out, body: hasBody ? request.body : undefined, redirect: 'manual', ...(hasBody ? { duplex: 'half' } : {}) });
      const back = new Headers();
      for (const [k, v] of res.headers) if (!HOP.has(k.toLowerCase()) && k.toLowerCase() !== 'content-encoding') back.append(k, v); // append: several Set-Cookie headers must all survive
      // fetch() already decoded the body, so the encoding header would now be wrong.
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers: back });
    } catch (error) {
      onError?.(error, request);
      return text(502, `xoong server: could not reach ${upstream.origin} (${/** @type {Error} */ (error)?.message ?? error})`);
    }
  }

  /** Serve a file, applying transforms and the import map. */
  async function serveFile(path, request) {
    const found = await files?.(path);
    if (!found) return null;
    const ext = extOf(path);
    let body = found.body;
    if (transform[ext]) {
      const code = typeof body === 'string' ? body : new TextDecoder().decode(body);
      try {
        const hit = transformed.get(path);
        if (hit && hit.code === code) body = hit.out;
        else { body = await transform[ext](code, path); transformed.set(path, { code, out: /** @type {string} */ (body) }); }
      } catch (error) {
        onError?.(error, request);
        return text(500, `xoong server: could not transform ${path}\n${/** @type {Error} */ (error)?.message ?? error}`);
      }
    }
    if (ext === '.html' && importMap) body = injectImportMap(typeof body === 'string' ? body : new TextDecoder().decode(body), importMap);
    const h = { 'content-type': found.type ?? TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'no-cache', ...extra };
    return new Response(request.method === 'HEAD' ? null : /** @type {BodyInit} */ (body), { status: 200, headers: h });
  }

  return async function handle(/** @type {Request} */ request) {
    const url = new URL(request.url);
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { return text(400, 'Bad request'); }
    if (pathname.includes('\0') || pathname.split('/').includes('..')) return text(400, 'Bad request');

    // Match on the encoded path so the forwarded path is sliced from the same string that was matched.
    for (const [prefix, target] of proxies) {
      const rest = below(url.pathname, prefix);
      if (rest !== null) return forward(request, url, rest, target);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return text(405, 'Method not allowed');

    // Files provided by installed packages (served under their prefix; the import map points here).
    for (const pkg of Object.values(packages)) {
      if (pathname.startsWith(pkg.prefix + '/')) {
        const res = await serveFile(pathname, request);
        if (res) return res;
        return text(404, 'Not found');
      }
    }

    const candidates = pathname.endsWith('/') ? [pathname + 'index.html'] : [pathname];
    for (const path of candidates) {
      const res = await serveFile(path, request);
      if (res) return res;
    }
    if (spa && !extOf(pathname)) {
      const res = await serveFile('/index.html', request);
      if (res) return res;
    }
    return text(404, 'Not found');
  };
}
