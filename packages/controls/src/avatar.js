// @ts-check
/**
 * <xo-avatar> is a person (or a team) as a round badge: their picture when there is one, their initials when there is not.
 * <xo-avatars> stacks several of them.
 *
 *   <xo-avatar name="Nguyễn Văn An" src="/img/an.jpg" size="lg" status="ok"></xo-avatar>
 *   <xo-avatars max="3"><xo-avatar name="An Dao"></xo-avatar> <xo-avatar name="Linh Tran"></xo-avatar> ... </xo-avatars>
 *
 * - The element itself is the `.xo-avatar` badge (it gets the classes `xo-avatar`, `xo-avatar--sm|lg` from `size`, and `xo-avatar--ok|warn|muted` from
 *   `status`). Colour is never the only signal: the status is added to the accessible name ("An Dao, online").
 * - Initials: the first letter of the first and of the last word ("Nguyễn Văn An" is "NA"); a single word gives its first two letters. Without a
 *   name the user icon is drawn.
 * - `src` is tried first: the image replaces the initials once it loads and the initials stay when it fails (`data-state` is `loaded` or `error`).
 * - The accessible name is the full name: `role=img` with `aria-label`; inside <xo-avatars> it is a `role=listitem` with the same label.
 * - <xo-avatars max="3"> is a `role=list` of its avatars. Only `max` are shown; a last badge "+N" (labelled "N more") stands for the rest.
 *   Without `max` all are shown.
 */
import { XoElement, define, text } from '@xoong/core';
import { ownLabel } from './label.js';

/** Initials for a name: first letter of the first and the last word, or the first two letters of a single word. */
export function initialsOf(/** @type {string} */ name) {
  const words = String(name ?? '').trim().split(/\s+/).map((w) => Array.from(w.replace(/^[^\p{L}\p{N}]+/u, ''))).filter((w) => w.length);
  if (!words.length) return '';
  const letters = words.length === 1 ? words[0].slice(0, 2) : [words[0][0], words[words.length - 1][0]];
  return letters.join('').toLocaleUpperCase();
}

const STATUS = ['ok', 'warn', 'muted'];
const SIZE = ['sm', 'lg'];

class XoAvatar extends XoElement {
  static props = { name: String, src: String, size: String, status: String };

  /** @type {HTMLImageElement | null} */ #img = null;
  /** @type {HTMLElement | null} */ #initials = null;

  connected() {
    const initials = document.createElement('span');
    initials.setAttribute('aria-hidden', 'true');
    this.#initials = initials;
    this.replaceChildren(initials);
    this.#img = null;
    this.#loadImage();
    this.#paint();
  }

  attributeChangedCallback(attr, old, value) {
    super.attributeChangedCallback(attr, old, value);
    if (attr === 'src' && this.#initials) this.#loadImage();
    this.#paint();
  }

  /** The stack (or the page) calls this when the avatar is moved into or out of an <xo-avatars>. */
  refresh() { this.#paint(); }

  #loadImage() {
    this.#img?.remove();
    this.#img = null;
    delete this.dataset.state;
    this.#initials?.removeAttribute('hidden');
    if (!this.src) return;
    const img = document.createElement('img');
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.decoding = 'async';
    // The picture fills the badge: set through the CSS object model (no style attribute, strict CSP) so it works with or without a stylesheet rule.
    for (const [k, v] of [['width', '100%'], ['height', '100%'], ['objectFit', 'cover'], ['borderRadius', '50%'], ['display', 'none']]) /** @type {any} */ (img.style)[k] = v;
    img.addEventListener('load', () => { if (this.#img !== img) return; img.style.display = 'block'; this.#initials?.setAttribute('hidden', ''); this.dataset.state = 'loaded'; });
    img.addEventListener('error', () => { if (this.#img !== img) return; img.remove(); this.#img = null; this.#initials?.removeAttribute('hidden'); this.dataset.state = 'error'; });
    this.#img = img;
    this.append(img);
    img.src = this.src;
  }

  #paint() {
    const el = this.#initials;
    if (!el) return;
    const name = (this.name ?? '').trim();
    const initials = initialsOf(name);
    if (initials) el.textContent = initials;
    else el.innerHTML = '<span class="ic" data-ic="user" aria-hidden="true"></span>';
    const cls = this.classList;
    cls.add('xo-avatar');
    for (const s of SIZE) cls.toggle(`xo-avatar--${s}`, this.size === s);
    for (const s of STATUS) cls.toggle(`xo-avatar--${s}`, this.status === s);
    const status = this.status === 'ok' ? text('xoong.avatar.ok', 'online') : this.status === 'warn' ? text('xoong.avatar.warn', 'needs attention') : this.status === 'muted' ? text('xoong.avatar.muted', 'inactive') : '';
    const label = name ? (status ? `${name}, ${status}` : name) : text('xoong.avatar.unknown', 'Unknown user');
    ownLabel(this, label);
    this.setAttribute('role', this.closest('xo-avatars') ? 'listitem' : 'img');
  }
}
define('xo-avatar', XoAvatar);

class XoAvatars extends XoElement {
  static props = { max: Number, label: String };

  /** @type {HTMLElement | null} */ #more = null;
  /** @type {MutationObserver | null} */ #watch = null;

  connected() {
    this.classList.add('xo-avatars');
    this.setAttribute('role', 'list');
    void this.ready().then(() => {
      this.#layout();
      this.#watch = new MutationObserver(() => this.#layout());
      this.#watch.observe(this, { childList: true });
    });
  }
  disconnected() { this.#watch?.disconnect(); this.#watch = null; }

  attributeChangedCallback(attr, old, value) {
    super.attributeChangedCallback(attr, old, value);
    if (this.isConnected && this.#watch) this.#layout();
  }

  #layout() {
    this.#watch?.disconnect();
    const items = /** @type {HTMLElement[]} */ ([...this.children].filter((c) => c !== this.#more));
    const max = this.max > 0 ? Math.floor(this.max) : items.length;
    const rest = Math.max(0, items.length - max);
    items.forEach((el, i) => {
      if (!el.hasAttribute('role') || el.getAttribute('role') === 'img') el.setAttribute('role', 'listitem');
      if (/** @type {any} */ (el).refresh) /** @type {any} */ (el).refresh();
      const hide = i >= max;
      el.toggleAttribute('hidden', hide);
      if (hide) el.style.display = 'none'; else el.style.removeProperty('display');
    });
    if (rest > 0) {
      if (!this.#more) {
        const more = document.createElement('span');
        more.className = 'xo-avatar xo-avatar--muted';
        more.setAttribute('role', 'listitem');
        this.#more = more;
      }
      this.#more.textContent = `+${rest}`;
      this.#more.setAttribute('aria-label', text('xoong.avatar.more', '{count} more', { count: rest }));
      if (this.lastElementChild !== this.#more) this.append(this.#more);
    } else if (this.#more) { this.#more.remove(); this.#more = null; }
    this.#watch?.observe(this, { childList: true });
  }
}
define('xo-avatars', XoAvatars);
