// @ts-check
/**
 * The HTML that <xo-richtext> keeps. Anything else is removed, whether it comes from a paste, from `value`, or from the server.
 *
 * Allowed: p, h2, h3, strong, em, u, ul, ol, li, blockquote, br, a (href, title) and img (src, alt, width, height).
 * Mapped: b -> strong, i -> em, h1 -> h2, h4 to h6 -> h3, div -> p. Everything else is unwrapped (its text stays); script, style, iframe, object,
 * embed, svg, math, template and noscript go with their content. No attribute other than the ones above survives (no style, class, id, on*).
 * Links keep only http, https, mailto and tel; images keep only http, https and relative URLs. Loose text at the top level is wrapped in <p>.
 * Non-breaking spaces become plain spaces; empty paragraphs at the very start or end are removed; a line break at the very end of a block
 * (a browser's placeholder) is removed.
 *
 * The result is built as a string with its own escaping from an inert parse (`<template>`), so what is returned never goes through the parser again
 * in a different shape than the one that was checked.
 */

const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE', 'NOSCRIPT', 'HEAD', 'TITLE', 'META', 'LINK', 'BASE', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'CANVAS', 'AUDIO', 'VIDEO']);
const RENAME = { B: 'strong', STRONG: 'strong', I: 'em', EM: 'em', U: 'u', H1: 'h2', H2: 'h2', H3: 'h3', H4: 'h3', H5: 'h3', H6: 'h3', DIV: 'p', P: 'p', UL: 'ul', OL: 'ol', LI: 'li', BLOCKQUOTE: 'blockquote' };
const BLOCK = new Set(['p', 'h2', 'h3', 'ul', 'ol', 'blockquote', 'li']);
const LINK_SCHEMES = /^(https?:|mailto:|tel:)/i;

const esc = (/** @type {string} */ s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

/** A link target the editor allows: http, https, mailto or tel. */
export function isSafeLink(/** @type {string} */ url) {
  return LINK_SCHEMES.test(url.replace(/[\u0000- \u007f-\u009f]/g, ''));
}

/** An image source the editor allows: http, https, or a URL without a scheme (relative or root-relative). */
export function isSafeImage(/** @type {string} */ url) {
  const u = url.replace(/[\u0000- \u007f-\u009f]/g, '');
  return /^https?:/i.test(u) || (!/^[a-z][a-z0-9+.-]*:/i.test(u) && !u.startsWith('//'));
}

/**
 * @param {string} html
 * @param {{ images?: boolean }} [options] `images: false` removes <img>
 * @returns {string}
 */
export function sanitizeHtml(html, { images = true } = {}) {
  const template = document.createElement('template');
  template.innerHTML = String(html ?? '');

  /** A line break at the very end of a block is a browser's placeholder, not content (`<li>text<br></li>`); a block with only a break is a blank line and keeps it. */
  const trimBreak = (/** @type {string} */ body) => (body.endsWith('<br>') && body !== '<br>' ? body.slice(0, -4) : body);

  /** Inline content of a node, as a string (no block tags inside: they are unwrapped). */
  function inline(/** @type {Node} */ node) {
    let out = '';
    for (const child of node.childNodes) out += one(child, true);
    return out;
  }

  /** @returns {string} */
  function one(/** @type {Node} */ node, /** @type {boolean} */ inInline) {
    if (node.nodeType === 3) return esc((node.nodeValue ?? '').replace(/\u00a0/g, ' ')); // browsers type non-breaking spaces and Word pastes them everywhere: plain spaces
    if (node.nodeType !== 1) return '';
    const el = /** @type {Element} */ (node);
    const tag = el.tagName.toUpperCase();
    if (DROP.has(tag)) return '';
    if (tag === 'BR') return '<br>';
    if (tag === 'IMG') {
      const src = el.getAttribute('src') ?? '';
      if (!images || !src || !isSafeImage(src)) return '';
      const size = ['width', 'height'].map((k) => { const v = el.getAttribute(k); return v && /^\d{1,5}$/.test(v) ? ` ${k}="${v}"` : ''; }).join('');
      return `<img src="${esc(src)}" alt="${esc(el.getAttribute('alt') ?? '')}"${size}>`;
    }
    if (tag === 'A') {
      const href = el.getAttribute('href') ?? '';
      const body = inline(el);
      if (!href || !isSafeLink(href)) return body;
      const title = el.getAttribute('title');
      return `<a href="${esc(href.trim())}"${title ? ` title="${esc(title)}"` : ''} rel="noopener noreferrer">${body}</a>`;
    }
    const name = /** @type {Record<string, string>} */ (RENAME)[tag];
    if (name === 'strong' || name === 'em' || name === 'u') { const body = inline(el); return body ? `<${name}>${body}</${name}>` : ''; }
    if (name && BLOCK.has(name)) {
      if (inInline) return inline(el); // a block inside inline content (a heading in a link, a list in a paragraph) becomes its text
      return block(el, name);
    }
    return inline(el); // unknown element: keep what is inside
  }

  /** A block element with its content. */
  function block(/** @type {Element} */ el, /** @type {string} */ name) {
    if (name === 'ul' || name === 'ol') {
      const items = [...el.childNodes].map((c) => (c.nodeType === 1 && /** @type {Element} */ (c).tagName === 'LI' ? block(/** @type {Element} */ (c), 'li') : '')).join('');
      return items ? `<${name}>${items}</${name}>` : '';
    }
    if (name === 'li') {
      let out = '';
      for (const child of el.childNodes) {
        const tag = child.nodeType === 1 ? /** @type {Element} */ (child).tagName : '';
        out += tag === 'UL' || tag === 'OL' ? one(child, false) : one(child, true); // nested lists stay; other blocks flatten to text
      }
      return `<li>${trimBreak(out)}</li>`;
    }
    if (name === 'blockquote') {
      const inner = blocks(el);
      return inner ? `<blockquote>${inner}</blockquote>` : '';
    }
    const body = trimBreak(inline(el));
    return body.replace(/<br>$/, '') === '' && !body.includes('<img') ? (name === 'p' ? '<p><br></p>' : '') : `<${name}>${body}</${name}>`;
  }

  /** The children of a container as blocks: loose inline runs are wrapped in a paragraph. */
  function blocks(/** @type {Node} */ container) {
    let out = '';
    let run = '';
    const flush = () => { if (run.replace(/<br>/g, '').trim() !== '' || run.includes('<img')) out += `<p>${run}</p>`; run = ''; };
    for (const child of container.childNodes) {
      const tag = child.nodeType === 1 ? /** @type {Element} */ (child).tagName.toUpperCase() : '';
      const name = /** @type {Record<string, string>} */ (RENAME)[tag];
      if (name && BLOCK.has(name) && name !== 'li') { flush(); out += one(child, false); }
      else if (DROP.has(tag)) continue;
      else if (tag && !name && hasBlock(child)) { flush(); out += blocks(child); } // an unknown wrapper around blocks: look inside
      else run += one(child, true);
    }
    flush();
    return out;
  }

  /** Whether an element has a block element somewhere inside (so an unknown wrapper such as <section> must not hide it). */
  function hasBlock(/** @type {Node} */ node) {
    for (const child of node.childNodes) {
      if (child.nodeType !== 1) continue;
      const tag = /** @type {Element} */ (child).tagName.toUpperCase();
      if (DROP.has(tag)) continue;
      const name = /** @type {Record<string, string>} */ (RENAME)[tag];
      if ((name && BLOCK.has(name)) || hasBlock(child)) return true;
    }
    return false;
  }

  // blank lines at the very start or end are editor leftovers (a browser leaves them around a list); blank lines inside the text are the author's
  return blocks(template.content).replace(/^(?:<p><br><\/p>)+|(?:<p><br><\/p>)+$/g, '');
}

/** The text of sanitised or raw HTML, for "is it empty" checks and length limits. */
export function textOf(/** @type {string} */ html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.textContent ?? '';
}
