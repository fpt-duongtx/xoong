// A static file server for a built app plus the mock API, over HTTP/1.1 or HTTP/2 (TLS with a throw-away self-signed certificate).
// Text files are served compressed (brotli, else gzip, as a CDN would) with the compressed bytes cached after the first request, so
// measuring a page measures the network and the browser, not the compression CPU of this server.
import http from 'node:http';
import http2 from 'node:http2';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from '../shared/api.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.map': 'application/json', '.woff2': 'font/woff2' };
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.map']);

function certificate() {
  const dir = join(here, '..', '.cache');
  const key = join(dir, 'key.pem'), cert = join(dir, 'cert.pem');
  if (!existsSync(cert)) {
    mkdirSync(dir, { recursive: true });
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '30', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
  }
  return { key: execFileSyncRead(key), cert: execFileSyncRead(cert) };
}
import { readFileSync } from 'node:fs';
const execFileSyncRead = (p) => readFileSync(p);

/**
 * @param {{ root: string, protocol?: 'http1' | 'h2', csp?: string, rows?: number, spa?: boolean, transform?: (pathname: string, body: Buffer) => Buffer, handler?: (req: any, res: any, url: URL) => boolean | Promise<boolean> }} o
 * @returns {Promise<{ url: string, close: () => Promise<void>, api: ReturnType<typeof createApi>, requests: string[] }>}
 */
export async function serve({ root, protocol = 'http1', csp, rows = 10000, spa = false, transform, handler }) {
  const api = createApi({ rows });
  const cache = new Map();
  const requests = [];
  const listener = async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      requests.push(`${req.method} ${url.pathname}`);
      if (handler && (await handler(req, res, url))) return;
      if (await api.handle(req, res)) return;
      let file = normalize(join(root, decodeURIComponent(url.pathname)));
      if (!file.startsWith(root)) { res.statusCode = 403; return res.end(); }
      if (url.pathname.endsWith('/')) file = join(file, 'index.html');
      let st = await stat(file).catch(() => null);
      if (!st?.isFile() && spa) { file = join(root, 'index.html'); st = await stat(file).catch(() => null); }
      if (!st?.isFile()) { res.statusCode = 404; return res.end('not found'); }
      const ext = extname(file);
      const headers = { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'no-cache' };
      if (csp && ext === '.html') headers['content-security-policy'] = csp;
      let body = cache.get(file);
      if (!body) { body = { raw: await readFile(file) }; if (transform) body.raw = transform(url.pathname, body.raw); cache.set(file, body); }
      const accept = String(req.headers['accept-encoding'] ?? '');
      let out = body.raw;
      if (COMPRESSIBLE.has(ext)) {
        if (/\bbr\b/.test(accept)) { body.br ??= brotliCompressSync(body.raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }); out = body.br; headers['content-encoding'] = 'br'; }
        else if (/\bgzip\b/.test(accept)) { body.gz ??= gzipSync(body.raw, { level: 9 }); out = body.gz; headers['content-encoding'] = 'gzip'; }
      }
      res.writeHead(200, headers);
      res.end(out);
    } catch (e) { res.statusCode = 500; res.end(String(e)); }
  };
  const server = protocol === 'h2' ? http2.createSecureServer({ ...certificate(), allowHTTP1: true }, listener) : http.createServer(listener);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `${protocol === 'h2' ? 'https' : 'http'}://127.0.0.1:${server.address().port}`;
  return { url, api, requests, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); }) };
}
