// @ts-check
/**
 * Where `<xo-view url-params="status,q,sort,offset">` keeps its parameters: the query string of the page. Without a router the
 * History API is used directly; a router (in @xoong/ui) replaces this with its own, which also keeps its history positions.
 */

/**
 * @typedef {{
 *   read(): URLSearchParams,
 *   write(params: URLSearchParams, mode: 'push' | 'replace'): void,
 *   subscribe(fn: () => void): () => void,
 * }} UrlSync
 */

/** @type {UrlSync} */
const history = {
  read: () => new URLSearchParams(globalThis.location?.search),
  write(params, mode) {
    const loc = globalThis.location;
    if (!loc) return;
    const query = params.toString();
    const url = loc.pathname + (query ? `?${query}` : '') + loc.hash;
    if (url === loc.pathname + loc.search + loc.hash) return;
    globalThis.history[mode === 'push' ? 'pushState' : 'replaceState'](globalThis.history.state, '', url);
  },
  subscribe(fn) { globalThis.addEventListener('popstate', fn); return () => globalThis.removeEventListener('popstate', fn); },
};

let current = history;
/** The router registers itself here. @param {UrlSync | null} sync */
export function setUrlSync(sync) { current = sync ?? history; }
export const urlSync = () => current;
