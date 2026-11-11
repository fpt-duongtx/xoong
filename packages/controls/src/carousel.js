// @ts-check
/**
 * <xo-carousel> is a row of slides you move through: cards, a banner, testimonials, a gallery. The slides are its children.
 *
 *   <xo-carousel label="Services" items="3" counter>
 *     <article>...</article>
 *     <article>...</article>
 *   </xo-carousel>
 *
 * It is made on the platform: the slides sit in a scroll container with CSS scroll snap, so touch swiping, the mouse wheel, momentum and
 * keyboard scrolling are the browser's own, and the buttons only ask the container to scroll. The markup follows the WAI-ARIA carousel
 * pattern: a region with `aria-roledescription="carousel"`, slides as groups ("2 of 5"), previous and next buttons, and when it plays by
 * itself a pause button, a pause on hover and on focus, and no automatic movement under `prefers-reduced-motion`.
 *
 * - `items` slides are visible at once (default 1; `1.15` lets the next one peek). Set it in CSS for breakpoints:
 *   `xo-carousel { --xo-carousel-items: 2 } @media (min-width: 60rem) { xo-carousel { --xo-carousel-items: 4 } }`. The gap is `--xo-carousel-gap`.
 * - `dots` adds a button per position (a slide with `data-thumb="url"` shows that picture instead: a gallery with thumbnails), `counter` shows
 *   "1 / 5", `no-arrows` hides the arrows, `loop` makes Next at the end return to the first slide, `autoplay="5000"` moves on by itself every 5 seconds.
 * - Slides outside the view are `inert`, so the Tab key never lands on something that is not on screen. A slide that is partly visible stays usable.
 * - Slides may come from data: `<xo-carousel><article xo-each="items">` inside an `<xo-view>`; the carousel follows its children.
 * - API: `index`, `count`, `next()`, `prev()`, `goTo(i)`, `play()`, `pause()`; `xo-carousel-change` fires with `{ index, count }`.
 *   `index` is the first visible slide.
 */
import { XoElement, define, text } from '@xoong/core';
import { ownLabel } from './label.js';

class XoCarousel extends XoElement {
  static props = { label: String, items: Number, autoplay: Number, loop: Boolean, dots: Boolean, counter: Boolean, noArrows: Boolean };

  /** @type {HTMLElement | null} */ #track = null;
  /** @type {HTMLButtonElement | null} */ #prev = null;
  /** @type {HTMLButtonElement | null} */ #next = null;
  /** @type {HTMLButtonElement | null} */ #toggle = null;
  /** @type {HTMLElement | null} */ #dots = null;
  /** @type {HTMLElement | null} */ #count = null;
  /** @type {MutationObserver | null} */ #watch = null;
  /** @type {ResizeObserver | null} */ #size = null;
  #index = 0;
  #positions = 1;
  #settle = 0;
  #timer = 0;
  #held = false; // the pointer or the focus is inside
  #stopped = false; // the person pressed pause

  get index() { return this.#index; }
  get count() { return this.#slides.length; }
  get #slides() { return /** @type {HTMLElement[]} */ ([...(this.#track?.children ?? [])]); }
  get #reduced() { return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; }

  connected() {
    this.effect(() => { const n = this.items; if (n > 0) this.style.setProperty('--xo-carousel-items', String(n)); else this.style.removeProperty('--xo-carousel-items'); });
    this.effect(() => { this.label; this.dots; this.counter; this.noArrows; this.autoplay; this.#refresh(true); }); // attributes may arrive after the build
    queueMicrotask(() => this.#build());
  }

  disconnected() {
    clearTimeout(this.#timer);
    clearTimeout(this.#settle);
    this.#watch?.disconnect();
    this.#size?.disconnect();
  }

  #button(/** @type {string} */ cls, /** @type {string} */ glyph, /** @type {string} */ label, /** @type {() => void} */ run) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.setAttribute('aria-label', label);
    const g = document.createElement('span');
    g.setAttribute('aria-hidden', 'true');
    g.textContent = glyph;
    b.append(g);
    b.addEventListener('click', run);
    return b;
  }

  #build() {
    if (this.#track || !this.isConnected) return;
    const old = this.querySelector(':scope > .xo-carousel-track'); // a copy of a carousel that was already built (a view clones its content): take it apart, then build again
    if (old) { old.replaceWith(...old.childNodes); this.querySelector(':scope > .xo-carousel-controls')?.remove(); }
    this.setAttribute('role', 'region');
    this.setAttribute('aria-roledescription', 'carousel');
    const track = document.createElement('div');
    track.className = 'xo-carousel-track';
    track.tabIndex = 0;
    track.setAttribute('role', 'group');
    track.setAttribute('aria-label', text('xoong.carousel.slides', 'Slides'));
    track.append(...this.childNodes);
    const controls = document.createElement('div');
    controls.className = 'xo-carousel-controls';
    const nav = document.createElement('div');
    nav.className = 'xo-carousel-nav';
    this.#toggle = this.#button('xo-carousel-toggle', '', '', () => { this.#stopped = !this.#stopped; this.#refresh(true); });
    this.#prev = this.#button('xo-carousel-prev', '←', text('xoong.carousel.previous', 'Previous slide'), () => this.prev());
    this.#next = this.#button('xo-carousel-next', '→', text('xoong.carousel.next', 'Next slide'), () => this.next());
    nav.append(this.#toggle, this.#prev, this.#next);
    this.#dots = document.createElement('div');
    this.#dots.className = 'xo-carousel-dots';
    this.#dots.setAttribute('role', 'group');
    this.#dots.setAttribute('aria-label', text('xoong.carousel.choose', 'Choose a slide'));
    this.#count = document.createElement('span');
    this.#count.className = 'xo-carousel-count';
    controls.append(nav, this.#dots, this.#count);
    this.append(track, controls);
    this.#track = track;

    track.addEventListener('scroll', () => { clearTimeout(this.#settle); this.#settle = /** @type {any} */ (setTimeout(() => this.#refresh(), 90)); }, { passive: true });
    track.addEventListener('scrollend', () => { clearTimeout(this.#settle); this.#refresh(); }); // where the browser says the scrolling ended; the timer above is the fallback
    track.addEventListener('keydown', (event) => {
      if (event.target !== track || event.altKey || event.ctrlKey || event.metaKey) return;
      const rtl = getComputedStyle(this).direction === 'rtl';
      if (event.key === 'ArrowRight') this[rtl ? 'prev' : 'next']();
      else if (event.key === 'ArrowLeft') this[rtl ? 'next' : 'prev']();
      else if (event.key === 'Home') this.goTo(0);
      else if (event.key === 'End') this.goTo(this.#positions - 1);
      else return;
      event.preventDefault();
    });
    for (const [on, off] of [['pointerenter', 'pointerleave'], ['focusin', 'focusout']]) {
      this.addEventListener(on, () => { this.#held = true; this.#schedule(); });
      this.addEventListener(off, () => { this.#held = this.matches(':hover') || this.contains(document.activeElement); this.#schedule(); });
    }
    this.#watch = new MutationObserver(() => {
      for (const node of [...this.childNodes]) if (node !== track && node !== controls) track.append(node); // slides added to the element, not to the track
      this.#refresh(true);
    });
    this.#watch.observe(this, { childList: true });
    this.#watch.observe(track, { childList: true });
    if (typeof ResizeObserver !== 'undefined') { this.#size = new ResizeObserver(() => this.#refresh()); this.#size.observe(track); }
    this.#refresh(true);
  }

  /** The distance between the start of one slide and the next, and how many fit in the view. */
  #measure() {
    const track = /** @type {HTMLElement} */ (this.#track);
    const slides = this.#slides;
    const step = slides.length > 1 ? Math.abs(slides[1].offsetLeft - slides[0].offsetLeft) : track.clientWidth;
    const gap = slides.length > 1 ? Math.max(0, step - slides[0].offsetWidth) : 0;
    const view = step > 0 ? Math.max(1, Math.floor((track.clientWidth + gap + 1) / step)) : 1;
    return { step, view, laidOut: track.clientWidth > 0 && step > 0 };
  }

  /** @param {boolean} [rebuild] */
  #refresh(rebuild = false) {
    const track = this.#track;
    if (!track) return;
    const slides = this.#slides;
    const n = slides.length;
    const { step, view, laidOut } = this.#measure();
    this.#positions = Math.max(1, n - view + 1);
    if (laidOut) {
      const atEnd = Math.abs(track.scrollLeft) >= track.scrollWidth - track.clientWidth - 2;
      this.#index = Math.min(this.#positions - 1, atEnd && n > view ? this.#positions - 1 : Math.round(Math.abs(track.scrollLeft) / step));
    } else this.#index = Math.min(this.#index, this.#positions - 1);
    const index = this.#index;
    slides.forEach((slide, i) => {
      if (!slide.hasAttribute('aria-label') || slide.hasAttribute('data-xo-label')) { slide.setAttribute('aria-label', text('xoong.carousel.slide', '{n} of {count}', { n: i + 1, count: n })); slide.setAttribute('data-xo-label', ''); }
      if (slide.localName === 'article') slide.removeAttribute('role'); // an <article> already has a role, and group is not allowed on it (axe aria-allowed-role); the roledescription and label stay
      else slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'slide');
      if (laidOut) { // a slide completely out of view is not reachable by Tab or by a reader's browse mode; a peeking one is
        const a = slide.getBoundingClientRect(), b = track.getBoundingClientRect();
        slide.inert = a.right <= b.left + 1 || a.left >= b.right - 1;
      }
    });
    ownLabel(this, this.label);
    const wraps = this.loop && this.#positions > 1;
    /** @type {HTMLButtonElement} */ (this.#prev).disabled = !wraps && index <= 0;
    /** @type {HTMLButtonElement} */ (this.#next).disabled = !wraps && index >= this.#positions - 1;
    /** @type {HTMLButtonElement} */ (this.#prev).hidden = /** @type {HTMLButtonElement} */ (this.#next).hidden = this.noArrows || this.#positions < 2;
    /** @type {HTMLElement} */ (this.#count).hidden = !this.counter || n === 0;
    /** @type {HTMLElement} */ (this.#count).textContent = `${index + 1} / ${n}`;
    const dots = /** @type {HTMLElement} */ (this.#dots);
    dots.hidden = !this.dots || this.#positions < 2;
    if (!dots.hidden) {
      if (rebuild || dots.children.length !== this.#positions) {
        dots.replaceChildren(...Array.from({ length: this.#positions }, (_, i) => {
          const dot = document.createElement('button');
          dot.type = 'button';
          dot.setAttribute('aria-label', text('xoong.carousel.goto', 'Go to slide {n}', { n: i + 1 }));
          const thumb = slides[i]?.getAttribute('data-thumb');
          if (thumb) { const img = document.createElement('img'); img.src = thumb; img.alt = ''; dot.append(img); dot.classList.add('xo-carousel-thumb'); }
          dot.addEventListener('click', () => this.goTo(i));
          return dot;
        }));
      }
      [...dots.children].forEach((dot, i) => dot.setAttribute('aria-current', String(i === index)));
    }
    const playing = this.#playing;
    const toggle = /** @type {HTMLButtonElement} */ (this.#toggle);
    toggle.hidden = !(this.autoplay > 0);
    const label = this.#stopped ? text('xoong.carousel.play', 'Start automatic slide show') : text('xoong.carousel.pause', 'Pause automatic slide show');
    toggle.setAttribute('aria-label', label);
    toggle.dataset.state = this.#stopped ? 'paused' : 'playing'; // a theme can draw its own icons from this
    /** @type {HTMLElement} */ (toggle.firstElementChild).textContent = this.#stopped ? '▶' : '❚❚';
    track.setAttribute('aria-live', this.autoplay > 0 && playing ? 'off' : 'polite');
    this.#announce();
    this.#schedule();
  }
  #announced = 0;

  #announce() {
    if (this.#index === this.#announced) return;
    this.#announced = this.#index;
    this.dispatchEvent(new CustomEvent('xo-carousel-change', { bubbles: true, detail: { index: this.#index, count: this.#slides.length } }));
  }

  get #playing() { return !this.#stopped && !this.#held && !this.#reduced && this.autoplay > 0; }

  #schedule() {
    clearTimeout(this.#timer);
    if (!this.#playing || this.#positions < 2) return;
    this.#timer = /** @type {any} */ (setTimeout(() => { this.#step(1, true); }, this.autoplay));
  }

  #step(/** @type {number} */ delta, /** @type {boolean} */ wrap) {
    const to = this.#index + delta;
    if (to < 0 || to >= this.#positions) { if (wrap || this.loop) this.goTo(to < 0 ? this.#positions - 1 : 0); return; }
    this.goTo(to);
  }

  next() { this.#step(1, false); }
  prev() { this.#step(-1, false); }

  /** Scroll so that slide `i` is the first visible one. */
  goTo(/** @type {number} */ i) {
    const track = this.#track;
    const slides = this.#slides;
    if (!track || !slides.length) return;
    this.#index = Math.max(0, Math.min(this.#positions - 1, i));
    const left = slides[this.#index].offsetLeft - slides[0].offsetLeft;
    const dir = getComputedStyle(track).direction === 'rtl' ? -1 : 1;
    if (track.scrollTo) track.scrollTo({ left: left * dir, behavior: this.#reduced ? 'auto' : 'smooth' }); else track.scrollLeft = left * dir;
    this.#refreshLabels();
  }

  /** The buttons and dots answer at once; the scroll position settles a moment later and corrects them. */
  #refreshLabels() {
    const index = this.#index;
    /** @type {HTMLButtonElement} */ (this.#prev).disabled = !this.loop && index <= 0;
    /** @type {HTMLButtonElement} */ (this.#next).disabled = !this.loop && index >= this.#positions - 1;
    /** @type {HTMLElement} */ (this.#count).textContent = `${index + 1} / ${this.#slides.length}`;
    [.../** @type {HTMLElement} */ (this.#dots).children].forEach((dot, i) => dot.setAttribute('aria-current', String(i === index)));
    this.#announce();
    this.#schedule();
  }

  play() { this.#stopped = false; this.#refresh(); }
  pause() { this.#stopped = true; this.#refresh(); }
}
define('xo-carousel', XoCarousel);
