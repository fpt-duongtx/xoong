// Real browser (Chromium, and Firefox / WebKit when XOONG_BROWSER is set): a template host is never painted,
// and the first painted result already has the author's attributes. The script is delayed so a frame can
// happen before it runs. xoong.css hides the page while a view still holds an unexpanded xo-table, xo-pager
// or xo-form, which does not depend on blocking="render" (Firefox ignores that attribute unless a preference
// is set). The observer is inserted after the stylesheet on the prerendered page, so it does not sample the
// tree from before CSS. Also asserts a hidden pager and form compute to display:none with no height.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { withBrowser } from '../../../tools/browser.mjs';
import { renderPage } from '../../ssr/src/render.js';

const operations = {
  version: 1,
  entities: { User: { id: 'id' } },
  operations: {
    createUser: { id: 'createUser', method: 'POST', path: '/users', body: true, response: { t: 'entity', name: 'User' }, bodyFields: [{ name: 'name', type: 'string', required: true }] },
  },
};

const MARKUP = `<xo-table id="outside"><button type="button">Raw</button></xo-table>
<p id="above">Above</p>
<xo-view>
  <xo-table columns="name" class="wide" sticky="end" style="color: red"><button type="button">Edit</button></xo-table>
  <xo-pager page-size="5" id="p" hidden></xo-pager>
  <xo-form op="createUser" submit="Add" hidden></xo-form>
</xo-view>
<p id="below">Below</p>`;

const OBSERVER = `<script>
window.__fouc = { hosts: [], frames: [], shifts: [] };
(function () {
  var shown = function (el) {
    var s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  var sample = function () {
    document.querySelectorAll('xo-table, xo-pager, xo-form').forEach(function (el) {
      if (shown(el)) window.__fouc.hosts.push(el.id || el.localName);
    });
    var below = document.getElementById('below');
    var table = document.querySelector('div.xo-table.wide');
    if (!below || !table) return;
    var b = below.getBoundingClientRect();
    var t = table.getBoundingClientRect();
    window.__fouc.frames.push({
      y: Math.round(b.top),
      top: Math.round(t.top),
      h: Math.round(t.height),
      sticky: table.getAttribute('sticky'),
      cls: table.className,
      style: table.getAttribute('style'),
    });
  };
  new MutationObserver(sample).observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  var loop = function () { sample(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  try {
    new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) { if (!e.hadRecentInput) window.__fouc.shifts.push(e.value); });
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) { window.__fouc.shifts = null; }
})();
</script>`;

const CLIENT = `import { configure } from '@xoong/data';
import '@xoong/ui';
configure({ api: ${JSON.stringify(operations)}, baseUrl: '/api', retry: 0 });
`;

const page = (body) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/packages/ui/src/xoong.css">
${OBSERVER}
<script type="importmap">{"imports":{
 "@xoong/core":"/packages/core/src/index.js",
 "@xoong/core/signals":"/packages/core/src/signals.js",
 "@xoong/core/closest":"/packages/core/src/closest.js",
 "@xoong/data":"/packages/data/src/index.js",
 "@xoong/data/view":"/packages/data/src/view.js",
 "@xoong/forms":"/packages/forms/src/index.js",
 "@xoong/ui":"/packages/ui/src/index.js"
}}</script>
<script type="module" src="/client.js"></script>
</head><body>${body}</body></html>`;

const routes = {
  // Late on purpose: a frame can be painted before the module. The stylesheet has to hold that frame still.
  'GET /client.js': (_q, res) => { res.setHeader('content-type', 'text/javascript'); setTimeout(() => res.end(CLIENT), 200); },
};

function assertQuiet(errors) {
  assert.deepEqual(errors, []);
}

/** Hosts never visible, the first frame of the result already carries the author's attributes, and that frame does not move. */
function assertStill(out) {
  assert.deepEqual(out.hosts, [], 'a template host was painted');
  assert.ok(out.frames.length > 0, 'the expanded table never became visible');
  const first = out.frames[0];
  assert.equal(first.sticky, 'end');
  assert.equal(first.cls, 'xo-table wide');
  assert.equal(first.style, 'color: red');
  for (const frame of out.frames) {
    assert.equal(frame.y, first.y, 'the content below the table moved after the first painted frame');
    assert.equal(frame.top, first.top);
    assert.equal(frame.h, first.h);
    assert.equal(frame.sticky, 'end');
    assert.equal(frame.cls, 'xo-table wide');
  }
  if (out.shifts) assert.equal(out.shifts.reduce((s, n) => s + n, 0), 0);
  assert.equal(out.pagerHidden, true);
  assert.equal(out.formHidden, true);
  assert.equal(out.pagerDisplay, 'none'); // .xo-pager { display: flex } must not beat [hidden]
  assert.equal(out.formDisplay, 'none');
  assert.equal(out.pagerH, 0);
  assert.equal(out.formH, 0);
  assert.equal(out.rawShown, false);
  assert.equal(out.outsideTag, 'xo-table'); // it was not expanded, and it stays hidden
}

const read = `(() => {
  const raw = document.querySelector('#outside button');
  const rawShown = !!raw && (() => { const s = getComputedStyle(raw); return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0' && raw.getBoundingClientRect().height > 0; })();
  const pager = document.querySelector('nav.xo-pager'), form = document.querySelector('form.xo-form');
  return { hosts: window.__fouc.hosts, frames: window.__fouc.frames, shifts: window.__fouc.shifts,
    pagerHidden: pager?.hidden ?? null, formHidden: form?.hidden ?? null,
    pagerDisplay: pager ? getComputedStyle(pager).display : null, formDisplay: form ? getComputedStyle(form).display : null,
    pagerH: pager ? pager.getBoundingClientRect().height : null, formH: form ? form.getBoundingClientRect().height : null,
    rawShown, outsideTag: document.querySelector('#outside')?.localName ?? null };
})()`;

test('client render: hosts are never painted, and the table does not shift once it is visible', async () => {
  const { out, errors } = await withBrowser(async (page, base, errors) => {
    await page.goto(base + '/fouc', { waitUntil: 'networkidle' });
    await page.waitForSelector('div.xo-table.wide', { timeout: 5000 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    return { out: await page.evaluate(read), errors: [...errors] };
  }, { routes: { ...routes, 'GET /fouc': (_q, res) => { res.setHeader('content-type', 'text/html'); res.end(page(MARKUP)); } } });
  assertQuiet(errors);
  assertStill(out);
});

test('ssr hydrate: the prerender is already expanded, hosts never paint, and hydration does not move the table', async () => {
  const rendered = await renderPage(page(MARKUP).replace(OBSERVER, ''), { operations, fetch: async () => new Response('{}', { status: 200 }) });
  assert.match(rendered, /<div class="xo-table wide"/); // the HTML the browser will paint first
  const served = rendered.replace('</head>', OBSERVER + '</head>');
  const { out, errors } = await withBrowser(async (page, base, errors) => {
    await page.goto(base + '/ssr', { waitUntil: 'networkidle' });
    await page.waitForSelector('div.xo-table.wide', { timeout: 5000 });
    await page.waitForFunction(() => !document.querySelector('xo-view > template[data-xo-template]'), null, { timeout: 5000 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    return { out: await page.evaluate(read), errors: [...errors] };
  }, { routes: { ...routes, 'GET /ssr': (_q, res) => { res.setHeader('content-type', 'text/html'); res.end(served); } } });
  assertQuiet(errors);
  assertStill(out);
});
