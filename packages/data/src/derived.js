// @ts-check
import { computed } from '@xoong/core/signals';
import { getClient } from './default.js';

/**
 * A computed value over the shared entity store.
 *
 *   const revenueByRegion = derived(({ all }) =>
 *     groupBy(all('Order'), 'region'))
 *
 * `all(name)` returns every currently loaded entity of that type as plain
 * objects (tracked: recomputes when any of them, or the set, changes).
 * `get(name, id)` returns one entity. `derived` never triggers requests:
 * fetching is declared on a view (`<xo-view get="...">`).
 *
 * @template T
 * @param {(ctx: { all(name: string): any[], get(name: string, id: string|number): any }) => T} fn
 * @param {ReturnType<typeof import('./client.js').createClient>} [client] defaults to the configured client
 */
export function derived(fn, client) {
  return computed(() => {
    const { store } = client ?? getClient();
    return fn({
      all: (name) => store.refs(name).map((r) => store.denormalize(r)).filter((x) => x !== undefined),
      get: (name, id) => store.denormalize({ $ref: `${name}#${id}` }),
    });
  });
}
