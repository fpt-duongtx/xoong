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
  await import('@xoong/data/view'); // registers <xo-view>
  await import('@xoong/ui'); // registers <xo-table>, <xo-form>, ...
  return /** @type {{ configure: any }} */ (await import('@xoong/data'));
}

/**
 * @param {string} html                     the page
 * @param {{ operations: any, baseUrl?: string, fetch?: typeof fetch, headers?: () => Record<string,string>, timeoutMs?: number }} options
 *   `operations`: contents of .xoong/operations.json. `baseUrl`: where the API is reachable from the server.
 * @returns {Promise<string>}
 */
export function renderPage(html, options) {
  const run = queue.then(() => render(html, options));
  queue = run.then(() => undefined, () => undefined);
  return run;
}

async function render(html, { operations, baseUrl = '', fetch: fetchImpl, headers, timeoutMs = 10_000 }) {
  booted ??= boot();
  const data = await booted;
  const client = data.configure({ api: operations, baseUrl, fetch: fetchImpl, headers, retry: 0 });

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
    originals.forEach((markup, i) => {
      const view = body.querySelector(`xo-view[data-xo-ssr="${i}"]`);
      if (!view) return;
      view.removeAttribute('data-xo-ssr');
      const tpl = parsed.createElement('template');
      tpl.setAttribute('data-xo-template', '');
      tpl.innerHTML = markup;
      view.prepend(tpl);
    });
    const root = parsed.documentElement;
    const attrs = [...root.attributes].map((a) => ` ${a.name}="${a.value.replace(/"/g, '&quot;')}"`).join('');
    return `<!doctype html>\n<html${attrs}>\n<head>${parsed.head.innerHTML}</head>\n<body${[...parsed.body.attributes].map((a) => ` ${a.name}="${a.value.replace(/"/g, '&quot;')}"`).join('')}>${body.innerHTML}</body>\n</html>\n`;
  } finally {
    body.innerHTML = ''; // disconnect the views so nothing keeps running
  }
}
