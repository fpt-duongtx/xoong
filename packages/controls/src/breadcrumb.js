// @ts-check
/**
 * <xo-breadcrumb> is the trail of pages that led here (Home / Products / Shoes).
 *
 *   <xo-breadcrumb label="You are here"><a href="/">Home</a><a href="/products">Products</a><span>Shoes</span></xo-breadcrumb>
 *   <xo-breadcrumb max="3" items='[{"label":"Home","href":"/"},{"label":"Docs","href":"/docs"},{"label":"Controls"}]'></xo-breadcrumb>
 *
 * - The children (`<a>`, or a `<span>` for an item without a link) or the JSON `items` (`[{ label, href }]`) are the trail. It draws
 *   `nav.xo-breadcrumb[aria-label] > ol > li > a`; the last item is the current page (`aria-current="page"`). The separators are CSS (`li + li::before`), not text.
 * - `max` is the most items to show: the first one and the last `max - 1`, with an "…" button (`.xo-breadcrumb__more`) in place of the ones between; its panel
 *   (`.xo-breadcrumb__menu`) lists them as links. When the trail is wider than its space, it collapses the same way, one item more at a time. The hidden items
 *   stay in the list with `hidden`, so a copy of the element draws the same trail.
 * - `label` is the name of the navigation ("Breadcrumb" by default).
 */
import { XoElement, define, text } from '@xoong/core';
import { prepareLayer, showLayer, hideLayer } from './layer.js';

class XoBreadcrumb extends XoElement {
  static props = { label: String, items: String, max: Number };

  /** @type {HTMLElement | null} */ #nav = null;
  /** @type {ResizeObserver | null} */ #watch = null;
  #stop = () => {};

  constructor() {
    super();
    this.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.#panel && !this.#panel.hidden) { e.stopPropagation(); this.#menu(false, true); } });
  }

  get #panel() { return /** @type {HTMLElement | null} */ (this.querySelector('.xo-breadcrumb__menu')); }
  get #list() { return /** @type {HTMLElement[]} */ ([...this.querySelectorAll('.xo-breadcrumb > ol > li:not(.xo-breadcrumb__more)')]); }

  connected() {
    if (!this.#nav) void this.ready().then(() => this.#build());
    this.#observe();
  }
  disconnected() { this.#watch?.disconnect(); this.#menu(false); document.removeEventListener('pointerdown', this.#outside); }

  attributeChangedCallback(attr, old, value) {
    super.attributeChangedCallback(attr, old, value);
    if (!this.#nav) return;
    if (attr === 'items') this.#build(true);
    else if (attr === 'label') this.#nav.setAttribute('aria-label', this.label || text('xoong.breadcrumb.label', 'Breadcrumb'));
    else if (attr === 'max') this.#fit();
  }

  #observe() {
    if (typeof ResizeObserver === 'undefined' || !this.isConnected) return;
    this.#watch?.disconnect();
    this.#watch = new ResizeObserver(() => this.#fit());
    this.#watch.observe(this);
  }

  #build(/** @type {boolean} */ fresh = false) {
    if (!this.isConnected) return;
    /** @type {{ label: string, href: string | null }[]} */
    let trail = [];
    const old = this.querySelector(':scope > nav.xo-breadcrumb');
    if (this.items && (fresh || !old)) {
      try { trail = JSON.parse(this.items).map((/** @type {any} */ i) => ({ label: String(i.label ?? ''), href: i.href ?? null })); } catch { trail = []; }
    } else {
      const from = old ? [...old.querySelectorAll(':scope > ol > li:not(.xo-breadcrumb__more)')].map((li) => li.firstElementChild) : [...this.children];
      trail = from.filter(Boolean).map((el) => ({ label: (el?.textContent ?? '').trim(), href: el?.getAttribute('href') ?? null }));
    }
    const nav = document.createElement('nav');
    nav.className = 'xo-breadcrumb';
    nav.setAttribute('aria-label', this.label || text('xoong.breadcrumb.label', 'Breadcrumb'));
    const ol = document.createElement('ol');
    trail.forEach((it, i) => {
      const li = document.createElement('li');
      const last = i === trail.length - 1;
      const a = document.createElement(it.href ? 'a' : 'span');
      if (it.href) a.setAttribute('href', it.href);
      if (last) a.setAttribute('aria-current', 'page');
      a.textContent = it.label;
      li.append(a);
      ol.append(li);
    });
    nav.append(ol);
    this.replaceChildren(nav);
    this.#nav = nav;
    this.#fit();
  }

  /** Hide the middle items: `max` decides first, then, while the list is wider than its room, one more at a time. */
  #fit() {
    const nav = this.#nav, ol = nav?.firstElementChild;
    if (!nav || !ol) return;
    this.#menu(false);
    ol.querySelector('.xo-breadcrumb__more')?.remove();
    const items = this.#list, n = items.length;
    const apply = (/** @type {number} */ hide) => {
      items.forEach((li, i) => { li.hidden = i >= 1 && i <= hide; });
      ol.querySelector('.xo-breadcrumb__more')?.remove();
      if (hide > 0) ol.insertBefore(this.#more(), items[1]);
    };
    let hide = this.max >= 2 && n > this.max ? n - this.max : 0;
    apply(hide);
    while (nav.scrollWidth > nav.clientWidth + 1 && hide < n - 2) apply(++hide);
  }

  #more() {
    const li = document.createElement('li');
    li.className = 'xo-breadcrumb__more';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ghost sm';
    b.textContent = '…';
    b.setAttribute('aria-label', text('xoong.breadcrumb.more', 'Show hidden pages'));
    b.setAttribute('aria-haspopup', 'true');
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', () => this.#menu(b.getAttribute('aria-expanded') !== 'true'));
    const panel = document.createElement('ul');
    panel.className = 'xo-breadcrumb__menu';
    prepareLayer(panel);
    panel.addEventListener('focusout', (e) => { if (!panel.contains(/** @type {Node | null} */ (e.relatedTarget)) && e.relatedTarget !== b) this.#menu(false); });
    li.append(b, panel);
    return li;
  }

  #outside = (/** @type {Event} */ e) => { if (!this.querySelector('.xo-breadcrumb__more')?.contains(/** @type {Node} */ (e.target))) this.#menu(false); };

  #menu(open, refocus = false) {
    const li = this.querySelector('.xo-breadcrumb__more'), b = li?.firstElementChild, panel = this.#panel;
    if (!li || !panel || !(b instanceof HTMLElement)) return;
    this.#stop();
    document.removeEventListener('pointerdown', this.#outside);
    if (!open) { hideLayer(panel); b.setAttribute('aria-expanded', 'false'); if (refocus) b.focus(); return; }
    panel.replaceChildren(...this.#list.filter((x) => x.hidden).map((x) => { const item = document.createElement('li'); item.append(/** @type {Node} */ (x.firstElementChild?.cloneNode(true))); return item; }));
    b.setAttribute('aria-expanded', 'true');
    this.#stop = showLayer(panel, b);
    document.addEventListener('pointerdown', this.#outside);
    /** @type {HTMLElement | null} */ (panel.querySelector('a'))?.focus();
  }
}
define('xo-breadcrumb', XoBreadcrumb);
