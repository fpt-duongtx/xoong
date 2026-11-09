// @ts-check
import { createClient } from './client.js';

/** @type {ReturnType<typeof createClient> | null} */
let current = null;

/**
 * Create the app-wide client once, at startup.
 * @param {import('./client.js').ClientOptions} options
 */
export function configure(options) {
  stream?.close(); // a stream is bound to its client; start fresh
  stream = null;
  current = createClient(options);
  setStreamUrl(options.streamUrl);
  warnedNoStream = false;
  for (const start of waiting.splice(0)) start(); // views that were waiting for it
  return current;
}

/** Views that tried to start before configure() ran (a module that awaits something first): they start when it is called. */
const waiting = /** @type {(() => void)[]} */ ([]);
let waitTimer;
/** Has configure() been called? */
export const configured = () => current !== null;
/** Run `start` once configure() has been called. A page whose configure() never comes gets one clear message, instead of a view that fails silently. */
export function whenConfigured(start) {
  waiting.push(start);
  waitTimer ??= setTimeout(() => { if (!current) console.error('xoong: views are waiting for configure({ api, ... }), which has not been called yet'); }, 3000);
  waitTimer.unref?.();
}

/** The app-wide client. Throws a clear error if configure() was not called. */
export function getClient() {
  if (!current) throw new Error('xoong: call configure({ api, ... }) before using views or derived()');
  return current;
}

let streamUrl = null;
/** @type {{ close(): void } | null} */
let stream = null;
let streamUsers = 0;
let warnedNoStream = false;

/** Set the SSE endpoint used by `live` views. Called by configure(). */
export function setStreamUrl(url) { streamUrl = url ?? null; }

/**
 * Share one stream connection between all `live` views (ref-counted).
 * Returns a release function.
 */
export function acquireStream() {
  streamUsers++;
  if (!streamUrl && !warnedNoStream) { warnedNoStream = true; console.warn('xoong: <xo-view live> needs `streamUrl` in configure({ ... }); live updates are disabled'); } // once, not once per view
  if (!stream && streamUrl) {
    // Imported lazily so non-live apps never pay for it.
    import('./stream.js').then(({ connectStream }) => {
      if (streamUsers > 0 && !stream && current) stream = connectStream({ client: current, url: streamUrl });
    });
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--streamUsers === 0 && stream) { stream.close(); stream = null; }
  };
}
