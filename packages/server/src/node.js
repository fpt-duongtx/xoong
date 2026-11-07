// @ts-check
/** Node adapters for @xoong/server: a file reader rooted at a folder, TypeScript stripping, and an http server. */
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { createHandler } from './handler.js';

/**
 * Read files under `root` only. Paths that escape the root (via .., symlink-free check) are refused.
 * @param {string} root
 */
export function nodeFiles(root) {
  const base = resolve(root);
  return async (/** @type {string} */ path) => {
    const file = resolve(join(base, normalize('.' + path)));
    if (file !== base && !file.startsWith(base + sep)) return null;
    try {
      if (!(await stat(file)).isFile()) return null;
      return { body: await readFile(file) };
    } catch { return null; }
  };
}

/** Strip TypeScript types (erasable syntax only: no enum, namespace or parameter properties). */
export async function stripTypes(/** @type {string} */ code, /** @type {string} */ path) {
  const { transformSync } = await import('amaro');
  try { return transformSync(code, { mode: 'strip-only' }).code; } catch (error) {
    throw new Error(`${path}: ${/** @type {Error} */ (error).message}\nxoong only strips types; use erasable TypeScript (no enum/namespace/parameter properties)`);
  }
}

/** Walk up from a resolved entry file to the package.json of the package called `name`. */
async function packageDirOf(entry, name) {
  for (let dir = dirname(entry); dir !== dirname(dir); dir = dirname(dir)) {
    try {
      const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
      if (pkg.name === name) return { dir, pkg };
    } catch { /* keep walking */ }
  }
  return null;
}

/**
 * Find installed @xoong/* packages from `from` and describe how to serve them to the browser.
 * URL prefixes: @xoong/core -> /@xoong/core; the unscoped umbrella `xoong` -> /vendor/xoong.
 * @param {string} from  a folder inside the project
 * @param {string[]} names
 */
export async function findPackages(from, names = ['@xoong/core', '@xoong/data', '@xoong/forms', '@xoong/ui', 'xoong']) {
  const require = createRequire(join(resolve(from), 'noop.js'));
  /** @type {Record<string, { prefix: string, exports: any, dir: string }>} */
  const out = {};
  for (const name of names) {
    let found = null;
    try { found = await packageDirOf(require.resolve(name), name); } catch { /* not installed */ }
    if (found) out[name] = { prefix: name.startsWith('@') ? `/${name}` : `/vendor/${name}`, exports: found.pkg.exports ?? found.pkg.main ?? './src/index.js', dir: found.dir };
  }
  return out;
}

/**
 * Dev handler: serves `root`, the installed @xoong packages (with an import map), strips .ts on the fly and proxies APIs.
 * @param {{ root?: string, resolveFrom?: string, proxy?: Record<string,string>, spa?: boolean, onError?: (e: unknown, r: Request) => void }} [options]
 *   `resolveFrom`: folder to look for installed @xoong packages from (default: `root`).
 */
/** Dot-folders a page may read: generated tables and the standard well-known folder. Everything else (.env, .git, ...) is refused. */
const ALLOWED_DOT = new Set(['.xoong', '.well-known']);
export const isHidden = (/** @type {string} */ path) => path.split('/').some((seg) => seg.startsWith('.') && !ALLOWED_DOT.has(seg) && seg !== '');

export async function createDevHandler({ root = '.', resolveFrom = root, proxy = {}, spa = false, onError } = {}) {
  const pkgs = await findPackages(resolveFrom);
  const projectFiles = nodeFiles(root);
  const pkgFiles = Object.fromEntries(Object.values(pkgs).map((p) => [p.prefix, nodeFiles(p.dir)]));
  const files = async (/** @type {string} */ path) => {
    if (isHidden(path)) return null;
    for (const [prefix, read] of Object.entries(pkgFiles)) if (path.startsWith(prefix + '/')) return read(path.slice(prefix.length));
    return projectFiles(path);
  };
  const packages = Object.fromEntries(Object.entries(pkgs).map(([name, p]) => [name, { prefix: p.prefix, exports: p.exports }]));
  return createHandler({ files, packages, proxy, spa, onError, transform: { '.ts': stripTypes } });
}

/** The host name in a Host header: "[::1]:5173" -> "::1", "Localhost:80" -> "localhost". */
export function hostName(header) {
  const h = header.trim().toLowerCase();
  if (h.startsWith('[')) return h.slice(1, h.indexOf(']') > 0 ? h.indexOf(']') : undefined);
  return h.replace(/:\d+$/, '');
}

/**
 * Adapt a Fetch-API handler to node:http.
 * @param {(request: Request) => Promise<Response>} handler
 * @param {{ port?: number, host?: string, allowedHosts?: string[] }} [options]
 *   `allowedHosts`: Host header names accepted besides localhost, 127.0.0.1 and [::1] (blocks DNS-rebinding pages).
 */
export function serve(handler, { port = 5173, host = '127.0.0.1', allowedHosts = [] } = {}) {
  const allowed = new Set(['localhost', '127.0.0.1', '::1', host, ...allowedHosts].map((h) => h.toLowerCase()));
  const server = createServer(async (req, res) => {
    try {
      const name = hostName(String(req.headers.host ?? ''));
      if (!allowed.has(name)) {
        res.writeHead(403, { 'content-type': 'text/plain' });
        return res.end(`xoong server: host "${name}" is not allowed (add it to allowedHosts if this is intended)`);
      }
      const origin = `http://${req.headers.host ?? `${host}:${port}`}`;
      const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
      const request = new Request(new URL(req.url ?? '/', origin), {
        method: req.method,
        headers: /** @type {any} */ (req.headers),
        body: hasBody ? /** @type {any} */ (Readable.toWeb(req)) : undefined,
        ...(hasBody ? { duplex: 'half' } : {}),
      });
      const response = await handler(request);
      const out = {};
      for (const [k, v] of response.headers) if (k !== 'set-cookie') out[k] = v;
      const cookies = response.headers.getSetCookie();
      if (cookies.length) out['set-cookie'] = cookies; // several cookies must stay separate headers
      res.writeHead(response.status, out);
      if (!response.body) return res.end();
      const stream = Readable.fromWeb(/** @type {any} */ (response.body));
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy()); // a closed SSE connection must stop the upstream read
      stream.pipe(res);
    } catch (error) {
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('xoong server: internal error');
      console.error(error);
    }
  });
  return new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = /** @type {import('node:net').AddressInfo} */ (server.address());
      resolveListen({ server, port: address.port, url: `http://${host}:${address.port}`, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r(undefined)); }) });
    });
  });
}
