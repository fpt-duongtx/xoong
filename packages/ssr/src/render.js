// @ts-check
/**
 * Prerender a page with data: the same <xo-view> runtime that runs in the browser runs here, on a DOM from happy-dom, so
 * there is one implementation of the syntax, not two. The output is plain HTML that already shows the data. It is not
 * hydrated: every top-level <xo-view> keeps its original markup in a <template data-xo-template>, and in the browser the
 * view renders again from that template (same result, then live updates and actions work as usual).
 *
 *   const html = await renderPage(pageHtml, { operations, baseUrl: 'http://localhost:8080' });
 *
 * Render pages one after another: the DOM globals are process-wide, so calls are queued.
 *
 * Two things to know: (1) the first render installs `window`, `document` and friends on `globalThis` for the rest of the process,
 * so libraries that detect a browser by `typeof window` will think they run in one: prerender in a build script or a
 * dedicated process, not inside a server that also runs such code. (2) A page whose API calls fail still renders (its
 * `$error` branches show); pass `failOnError: true`, or collect them with `onError`, to treat that as a failure.
 */
import { Window } from 'happy-dom';

/** @type {Promise<{ configure: any }> | null} */
let booted = null;
let queue = Promise.resolve();

async function boot() {
  const window = new Window({
    url: 'http://xoong.local/',
    settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true, handleDisabledFileLoadingAsSuccess: true }, // scripts and styles of the page are not run or fetched here
  });
  const g = /** @type {any} */ (globalThis);
  for (const name of ['window', 'document', 'customElements', 'HTMLElement', 'Element', 'Node', 'DocumentFragment', 'Text', 'Comment', 'Event', 'CustomEvent', 'HTMLTemplateElement', 'DOMParser']) {
    if (name === 'window') g.window = window;
    else Object.defineProperty(g, name, { value: /** @type {any} */ (window)[name], configurable: true, writable: true });
  }
  Object.defineProperty(g, 'location', { get: () => window.location, configurable: true }); // p-id="?id" reads it
  await import('@xoong/data/view'); // registers <xo-view>
  await import('@xoong/ui'); // registers <xo-table>, <xo-form>, ...
  await import('@xoong/ui/router'); // a prerendered page must have its <xo-router> now, not after a lazy load
  return /** @type {{ configure: any }} */ (await import('@xoong/data'));
}

/**
 * @param {string} html                     the page
 * @param {{ operations: any, baseUrl?: string, fetch?: typeof fetch, headers?: () => Record<string,string>, timeoutMs?: number, url?: string, onError?: (e: any) => void, failOnError?: boolean }} options
 *   `operations`: contents of .xoong/operations.json. `baseUrl`: where the API is reachable from the server.
 * @returns {Promise<string>}
 */
export function renderPage(html, options) {
  const run = queue.then(() => render(html, options));
  queue = run.then(() => undefined, () => undefined);
  return run;
}

async function render(html, { operations, baseUrl = '', fetch: fetchImpl, headers, timeoutMs = 10_000, url = 'http://xoong.local/', onError, failOnError = false }) {
  booted ??= boot();
  /** @type {any} */ let data;
  try { data = await booted; } catch (e) { booted = null; throw e; } // a failed boot (happy-dom missing) is not cached
  const failures = [];
  /** @type {any} */ (globalThis).window.happyDOM.setURL(url); // so p-id="?id" sees the request's query string
  const client = data.configure({ api: operations, baseUrl, fetch: fetchImpl, headers, retry: 0, onError: (e) => { failures.push(e); onError?.(e); } });

  const parsed = new /** @type {any} */ (globalThis).DOMParser().parseFromString(html, 'text/html');
  // Remember each top-level view's original markup before it renders.
  const views = [...parsed.body.querySelectorAll('xo-view')].filter((v) => !v.parentElement?.closest('xo-view'));
  views.forEach((v, i) => v.setAttribute('data-xo-ssr', String(i)));
  const originals = views.map((v) => v.innerHTML);

  const body = /** @type {any} */ (globalThis).document.body;
  body.innerHTML = parsed.body.innerHTML;
  try {
    const deadline = Date.now() + timeoutMs;
    for (let calm = 0; calm < 3;) { // wait until nothing is loading for a few turns
      await new Promise((r) => setTimeout(r, 0));
      calm = client.pending === 0 ? calm + 1 : 0;
      if (Date.now() > deadline) throw new Error(`xoong ssr: the page did not finish loading its data within ${timeoutMs} ms`);
    }
    if (failOnError && failures.length) throw Object.assign(new Error(`xoong ssr: ${failures.length} API call(s) failed: ${failures.map((e) => e.operation ?? e.message).join(', ')}`), { errors: failures });
    originals.forEach((markup, i) => {
      const view = body.querySelector(`xo-view[data-xo-ssr="${i}"]`);
      if (!view) return;
      view.removeAttribute('data-xo-ssr');
      const tpl = parsed.createElement('template');
      tpl.setAttribute('data-xo-template', '');
      tpl.innerHTML = markup;
      view.prepend(tpl);
    });
    const live = /** @type {any} */ (globalThis).document; // a router (or anything else) may have set the title and description
    if (live.title && live.title !== parsed.title) parsed.title = live.title;
    const description = live.head.querySelector('meta[name="description"]')?.getAttribute('content');
    if (description !== undefined && description !== null) {
      let meta = parsed.head.querySelector('meta[name="description"]');
      if (!meta) { meta = parsed.createElement('meta'); meta.setAttribute('name', 'description'); parsed.head.append(meta); }
      meta.setAttribute('content', description);
    }
    const root = parsed.documentElement;
    const attrs = (el) => [...el.attributes].map((a) => ` ${a.name}="${a.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`).join('');
    return `<!doctype html>\n<html${attrs(root)}>\n<head>${parsed.head.innerHTML}</head>\n<body${attrs(parsed.body)}>${body.innerHTML}</body>\n</html>\n`;
  } finally {
    body.innerHTML = ''; // disconnect the views so nothing keeps running
  }
}
