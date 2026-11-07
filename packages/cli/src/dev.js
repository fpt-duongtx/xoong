// @ts-check
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/**
 * Read `xoong.config.json` from `dir` (all fields optional):
 *   { "root": ".", "port": 5173, "proxy": { "/api": "http://localhost:8080" }, "spa": false, "allowedHosts": [] }
 */
export async function loadConfig(dir = '.') {
  try { return JSON.parse(await readFile(join(dir, 'xoong.config.json'), 'utf8')); } catch (error) {
    if (/** @type {any} */ (error)?.code === 'ENOENT') return {};
    throw new Error(`xoong: could not read xoong.config.json: ${/** @type {Error} */ (error).message}`);
  }
}

/** Parse repeated `--proxy /api=http://host:port` flags into a map. */
export function parseProxyFlags(values) {
  /** @type {Record<string, string>} */
  const proxy = {};
  for (const v of values) {
    const i = v.indexOf('=');
    if (i <= 0) throw new Error(`xoong: --proxy expects /prefix=http://target, got "${v}"`);
    proxy[v.slice(0, i)] = v.slice(i + 1);
  }
  return proxy;
}

/**
 * Start the dev server.
 * @param {{ root?: string, port?: number, host?: string, allowedHosts?: string[], proxy?: Record<string,string>, spa?: boolean, resolveFrom?: string, quiet?: boolean }} [options]
 */
export async function startDev(options = {}) {
  const config = await loadConfig(options.root ?? '.');
  const root = resolve(options.root ?? config.root ?? '.');
  const proxy = { ...(config.proxy ?? {}), ...(options.proxy ?? {}) };
  const { createDevHandler, serve } = await import('@xoong/server/node');
  const handler = await createDevHandler({
    root, resolveFrom: options.resolveFrom ?? root, proxy, spa: options.spa ?? config.spa ?? false,
    onError: (error, request) => console.error(`xoong dev: ${request.method} ${new URL(request.url).pathname}: ${/** @type {Error} */ (error)?.message ?? error}`),
  });
  const running = await serve(handler, { port: options.port ?? config.port ?? 5173, host: options.host ?? '127.0.0.1', allowedHosts: options.allowedHosts ?? config.allowedHosts ?? [] });
  if (!options.quiet) {
    console.log(`xoong dev  ${running.url}   (root: ${root})`);
    for (const [prefix, target] of Object.entries(proxy)) console.log(`  proxy ${prefix} -> ${target}`);
  }
  return running;
}
