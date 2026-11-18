// A seeded fuzz of the sanitiser. Inputs are random mixes of the shapes that break HTML sanitisers (raw-text elements, foreign content, misnested
// tags, comments, entities, obfuscated URL schemes, attribute quoting tricks). Each is sanitised in Node, and the output is judged by a real
// browser (Chromium): it must parse to a document that holds no script-capable element, no event handler, no style, and no URL that is not on the
// allow-list; and sanitising it again must not change it (so nothing gets through on a second pass, client then server). The seed is fixed, so a
// failure reproduces; set FUZZ_SEED and FUZZ_RUNS to look further.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { launchChromium } from '../../../tools/browser.mjs';
import { sanitizeHtml } from '../src/sanitize.js';

const SEED = Number(process.env.FUZZ_SEED ?? 20261118);
const RUNS = Number(process.env.FUZZ_RUNS ?? 3000);

/** mulberry32: a small seeded generator */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAGS = ['p', 'b', 'strong', 'em', 'i', 'u', 'a', 'img', 'ul', 'ol', 'li', 'h1', 'h2', 'blockquote', 'code', 'pre', 'br', 'figure', 'figcaption', 'aside', 'span', 'div',
  'table', 'tr', 'td', 'select', 'option', 'form', 'input', 'button', 'textarea', 'title', 'style', 'script', 'svg', 'math', 'mi', 'mtext', 'mglyph', 'malignmark', 'annotation-xml',
  'foreignObject', 'desc', 'template', 'noscript', 'noembed', 'noframes', 'iframe', 'xmp', 'plaintext', 'listing', 'object', 'embed', 'base', 'link', 'meta', 'details', 'summary', 'marquee', 'video', 'audio', 'source', 'xss'];
const ATTRS = ['href', 'src', 'srcset', 'style', 'class', 'id', 'title', 'alt', 'target', 'rel', 'onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'autofocus', 'formaction', 'action', 'data', 'xlink:href', 'width', 'height', 'name', 'type', 'is', 'contenteditable', 'srcdoc', 'background', 'ping', 'poster'];
const URLS = ['javascript:alert(1)', ' javascript:1', 'JaVaScRiPt:1', 'java\tscript:1', 'java&#10;script:1', 'jav&#x61;script:1', '&#106;avascript:1', '\u0001javascript:1', '​javascript:1', 'data:text/html,<script>1</script>',
  'vbscript:1', '//evil.test/a.png', '\\\\evil.test/a', '/\\evil.test', 'https://x.test/a', 'http://x.test', 'mailto:a@b.test', 'tel:+1', '/a.png', 'a/b.png', '#frag', '?q=1', 'file:///etc/passwd', 'blob:x', 'about:blank', 'jar:http://x!/', 'https:\\\\x.test', '  https://x.test  '];
const TEXTS = ['x', 'text', '&lt;b&gt;', '&amp;', '&copy', '&bogus;', '&#0;', '&#x1F600;', '&NotEqualTilde;', '\u0000', ' ', 'a>b', '"', "'", '`', '</', '<', '>', '--!>', ']]>', '<!--', '-->'];
const SPECIAL = ['<!-- c -->', '<!--> t', '<!--->', '<![CDATA[x]]>', '<?php x?>', '<!DOCTYPE html>', '</noscript>', '</title>', '</style>', '</textarea>', '</script>', '</svg>', '</math>', '</template>',
  '</p>', '</a>', '</b>', '</i>', '</td>', '</table>', '<\u0000a>', '< p>', '<p/>', '<p\u000bonclick=1>', '<a/href=x>', '<a href="x"onclick=1>', '<a href=x\u000cx>', '<!=x>', '</ x>'];

function make(rnd) {
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const quote = () => pick(['"', "'", '', '`']);
  const attr = () => {
    const n = pick(ATTRS);
    const v = n === 'href' || n === 'src' || n === 'srcset' || n === 'action' || n === 'formaction' || n === 'data' || n === 'xlink:href' || n === 'poster' || n === 'background' ? pick(URLS) : pick(TEXTS);
    const q = quote();
    return rnd() < 0.1 ? n : `${n}=${q}${v}${q}`;
  };
  const open = () => `<${rnd() < 0.15 ? pick(TAGS).toUpperCase() : pick(TAGS)}${Array.from({ length: Math.floor(rnd() * 3) }, () => ' ' + attr()).join('')}${pick(['', '', '', '/', ' '])}>`;
  const close = () => `</${pick(TAGS)}>`;
  const parts = [];
  const n = 1 + Math.floor(rnd() * 14);
  for (let i = 0; i < n; i++) {
    const r = rnd();
    parts.push(r < 0.4 ? open() : r < 0.6 ? close() : r < 0.8 ? pick(TEXTS) : pick(SPECIAL));
  }
  return parts.join('');
}

let browser, page;
beforeAll(async () => {
  browser = await launchChromium();
  page = await (await browser.newContext()).newPage();
  await page.setContent('<!doctype html><html><body></body></html>');
}, 60000);
afterAll(async () => { await browser?.close(); });

/** In the browser: what is wrong with this output? */
const judge = (outputs) => page.evaluate((list) => {
  const BAD_TAG = /^(script|style|iframe|object|embed|link|meta|base|form|input|button|select|textarea|title|svg|math|template|noscript|noembed|noframes|xmp|plaintext|listing|frame|frameset|applet|video|audio|source|track|details|marquee|font|center)$/i;
  const OK_SCHEME = /^(https?:|mailto:|tel:)$/;
  const problems = [];
  for (const out of list) {
    const doc = new DOMParser().parseFromString(`<!doctype html><body>${out}`, 'text/html');
    const why = [];
    for (const el of doc.body.querySelectorAll('*')) {
      if (BAD_TAG.test(el.localName) || el.namespaceURI !== 'http://www.w3.org/1999/xhtml') why.push(`element ${el.namespaceURI.split('/').pop()}:${el.localName}`);
      for (const a of el.attributes) {
        if (/^on/i.test(a.name)) why.push(`handler ${a.name}`);
        if (/^(style|srcdoc|formaction|action|ping|background|poster|srcset|is|xlink:href)$/i.test(a.name)) why.push(`attribute ${a.name}`);
        if (a.name === 'href' || a.name === 'src') {
          let u;
          try { u = new URL(a.value.trim(), 'https://base.test/'); } catch { why.push(`unparsable ${a.name}=${a.value}`); continue; }
          const relative = !/^[a-z][a-z0-9+.-]*:/i.test(a.value.trim());
          if (!relative && !OK_SCHEME.test(u.protocol)) why.push(`${a.name} scheme ${u.protocol}`);
          if (a.name === 'src' && !relative && !/^https?:$/.test(u.protocol)) why.push('img src scheme');
          if (/^\\/.test(a.value.trim()) || /^\/\\/.test(a.value.trim())) why.push(`${a.name} backslash host ${a.value}`); // //host is as safe as https (allowed); a backslash host is read differently by browsers
        }
      }
    }
    if (doc.body.innerHTML.includes('<!--')) why.push('comment survived');
    if (why.length) problems.push({ out, why: [...new Set(why)] });
  }
  return problems;
}, outputs);

describe(`sanitizeHtml fuzz (seed ${SEED}, ${RUNS} inputs per profile)`, () => {
  for (const profile of ['default', 'rich']) {
    it(`${profile}: nothing dangerous reaches a browser, and a second pass changes nothing`, async () => {
      const rnd = prng(SEED + (profile === 'rich' ? 1 : 0));
      const inputs = Array.from({ length: RUNS }, () => make(rnd));
      const outputs = inputs.map((i) => sanitizeHtml(i, profile));
      const unstable = [];
      inputs.forEach((input, i) => { const again = sanitizeHtml(outputs[i], profile); if (again !== outputs[i]) unstable.push({ input, out: outputs[i], again }); });
      const bad = await judge(outputs);
      const shown = bad.slice(0, 5).map((b) => ({ ...b, input: inputs[outputs.indexOf(b.out)] }));
      expect(shown, `${bad.length} dangerous outputs`).toEqual([]);
      expect(unstable.slice(0, 5), `${unstable.length} outputs changed on a second pass`).toEqual([]);
    }, 120000);
  }
});
