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

/**
 * A URL path the app is mounted under (`/admin`), or `''` when it is served at `/`.
 * `null` means the value is not a safe path (`..`, a scheme, a double slash, whitespace).
 * @param {string | undefined | null} raw
 * @returns {string | null}
 */
export function sanitizeBase(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (text === '' || text === '/') return '';
  if (/[\s\\?#]|:\/\//.test(text) || text.includes('..') || text.includes('//')) return null;
  const path = (text.startsWith('/') ? text : `/${text}`).replace(/\/+$/, '');
  return path === '/' || path.includes('..') ? null : path;
}

/** Prefix a root-absolute URL once. Relative, protocol-relative and already-prefixed URLs stay as they are. */
export function prefixRoot(url, base) {
  if (!base || !url.startsWith('/') || url.startsWith('//')) return url;
  if (url === base || url.startsWith(`${base}/`) || url.startsWith(`${base}?`) || url.startsWith(`${base}#`)) return url;
  return base + url;
}

/** The path with `base` removed, when the request carried it. A path that only shares the prefix (`/administrator`) stays. */
export function stripBase(pathname, base) {
  if (!base) return pathname;
  if (pathname === base || pathname === `${base}/`) return '/';
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) || '/' : pathname;
}

const ASSET_REL = /stylesheet|icon|preload|modulepreload|manifest/;

/** Prefix root-absolute asset URLs in HTML. Links (`<a href>`) are left for the router. An import map's root-absolute values are prefixed too. */
export function prefixHtml(html, base) {
  if (!base) return html;
  const src = (tag) => tag.replace(/\bsrc\s*=\s*(["'])(\/[^"']*)\1/i, (m, q, url) => (url.startsWith('//') ? m : `src=${q}${prefixRoot(url, base)}${q}`));
  let out = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs, inner) => {
    if (!/type\s*=\s*["']importmap["']/i.test(attrs)) return src(full);
    const next = inner.replace(/"(\/[^"]*)"/g, (m, url) => (url.startsWith('//') ? m : `"${prefixRoot(url, base)}"`));
    return `<script${attrs}>${next}</script>`;
  });
  out = out.replace(/<link\b[^>]*>/gi, (tag) => {
    const rel = tag.match(/\brel\s*=\s*(["'])([^"']*)\1/i)?.[2] ?? '';
    if (!ASSET_REL.test(rel)) return tag;
    return tag.replace(/\bhref\s*=\s*(["'])(\/[^"']*)\1/i, (m, q, url) => (url.startsWith('//') ? m : `href=${q}${prefixRoot(url, base)}${q}`));
  });
  return out;
}

/** Prefix root-absolute `url()` and `@import` in a stylesheet. */
export function prefixCss(css, base) {
  if (!base) return css;
  return css.replace(/url\(\s*(['"]?)([^'")\s]+)\1\s*\)|@import\s+(['"])([^'"]+)\3/g, (m, q1, u1, q2, u2) => {
    const url = u1 ?? u2;
    if (!url.startsWith('/') || url.startsWith('//')) return m;
    const q = u1 != null ? q1 : q2;
    const next = prefixRoot(url, base);
    return u1 != null ? `url(${q}${next}${q})` : `@import ${q}${next}${q}`;
  });
}

const IMPORT_SPEC = /(\bimport\s*(?:[\w*${}\s,]*?\bfrom\s*)?|\bexport\s+(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s*from\s*|\bimport\s*\(\s*)(['"])(\/[^'"\n]+)\2/g;

/** Prefix root-absolute import specifiers. A relative import is left, so a deep link still resolves it against the module URL. */
export function prefixJs(code, base) {
  if (!base) return code;
  return code.replace(IMPORT_SPEC, (m, lead, q, spec) => (spec.startsWith('//') ? m : `${lead}${q}${prefixRoot(spec, base)}${q}`));
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
 *   base?: string,
 *   headers?: Record<string, string>,
 *   onError?: (error: unknown, request: Request) => void,
 * }} options
 * `base`: the path the app is mounted under (`/admin`). `X-Forwarded-Prefix` overrides it per request when the header is a safe path
 * (a reverse proxy that strips the prefix sets it). Root-absolute asset URLs are prefixed; a request that still carries the prefix is served from the root.
 */
export function createHandler(options = {}) {
  const { files, proxy = {}, packages = {}, transform = {}, spa = false, headers: extra = {}, onError } = options;
  const configuredBase = sanitizeBase(options.base ?? '');
  if (configuredBase == null) throw new Error(`xoong server: base must be a path like /admin, not "${options.base}"`);
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

  /** Serve a file, applying transforms, the import map and the base prefix. */
  async function serveFile(path, request, base) {
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
    const textExt = ext === '.html' || ext === '.css' || ext === '.js' || ext === '.mjs' || ext === '.ts';
    if (ext === '.html' && importMap || (base && textExt)) {
      let source = typeof body === 'string' ? body : new TextDecoder().decode(body);
      if (ext === '.html' && importMap) source = injectImportMap(source, importMap);
      if (base && ext === '.html') source = prefixHtml(source, base);
      else if (base && ext === '.css') source = prefixCss(source, base);
      else if (base) source = prefixJs(source, base);
      body = source;
    }
    const h = { 'content-type': found.type ?? TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'no-cache', ...extra };
    return new Response(request.method === 'HEAD' ? null : /** @type {BodyInit} */ (body), { status: 200, headers: h });
  }

  return async function handle(/** @type {Request} */ request) {
    const url = new URL(request.url);
    const header = request.headers.get('x-forwarded-prefix');
    const fromHeader = header == null ? null : sanitizeBase(header);
    const base = fromHeader == null ? configuredBase : fromHeader; // an unsafe header is ignored; the configured base stands
    let pathname;
    try { pathname = stripBase(decodeURIComponent(url.pathname), base); } catch { return text(400, 'Bad request'); }
    if (pathname.includes('\0') || pathname.split('/').includes('..')) return text(400, 'Bad request');
    const rawPath = stripBase(url.pathname, base);

    // Match on the encoded path so the forwarded path is sliced from the same string that was matched.
    for (const [prefix, target] of proxies) {
      const rest = below(rawPath, prefix);
      if (rest !== null) return forward(request, url, rest, target);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return text(405, 'Method not allowed');

    // Files provided by installed packages (served under their prefix; the import map points here).
    for (const pkg of Object.values(packages)) {
      if (pathname.startsWith(pkg.prefix + '/')) {
        const res = await serveFile(pathname, request, base);
        if (res) return res;
        return text(404, 'Not found');
      }
    }

    const candidates = pathname.endsWith('/') ? [pathname + 'index.html'] : [pathname];
    for (const path of candidates) {
      const res = await serveFile(path, request, base);
      if (res) return res;
    }
    if (spa && !extOf(pathname)) {
      const res = await serveFile('/index.html', request, base);
      if (res) return res;
    }
    return text(404, 'Not found');
  };
}
