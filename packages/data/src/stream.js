// @ts-check
/**
 * Connect to a stream of entity events (SSE) and apply them to the client's store.
 * Event JSON: {type:'patch'|'upsert'|'delete', entity, id, path?, value?, version?}
 * or {type:'resync'} to invalidate every cached query.
 *
 * Reconnection and Last-Event-ID replay are handled by EventSource itself.
 *
 * @param {{ client: ReturnType<import('./client.js').createClient>, url: string,
 *           EventSource?: typeof EventSource, onStatus?: (s:'open'|'error'|'closed') => void,
 *           onError?: (e: Error) => void }} opts
 */
export function connectStream({ client, url, EventSource = globalThis.EventSource, onStatus, onError }) {
  if (!EventSource) throw new Error('xoong: EventSource is not available in this environment');
  const source = new EventSource(url, { withCredentials: true });
  let reconnected = false;
  source.onopen = () => {
    onStatus?.('open');
    // After an interruption we may have missed events: refetch what is on screen.
    if (reconnected) client.invalidateAll();
  };
  source.onerror = () => { reconnected = true; onStatus?.('error'); };
  source.onmessage = (msg) => {
    let ev;
    try { ev = JSON.parse(msg.data); } catch (e) { onError?.(/** @type {Error} */ (e)); return; }
    if (ev?.type === 'resync') client.invalidateAll();
    else client.store.applyEvent(ev);
  };
  return { close() { source.close(); onStatus?.('closed'); } };
}
