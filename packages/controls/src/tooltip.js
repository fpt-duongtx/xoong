// @ts-check
/**
 * xo-tooltip="Save the draft" on any element shows a short text next to it (the WAI-ARIA tooltip pattern).
 *
 *   <button xo-tooltip="Save the draft">Save</button>
 *   <button xo-tooltip="Delete" aria-label="Delete">Delete</button>
 *
 *   <body xo-tooltip-delay="800">                       the delay (ms) for everything under it; on one element for that element only
 *   <button xo-tooltip="Save" xo-tooltip-placement="bottom">   top (default), bottom, left or right; flips when there is no room
 *
 * - The element is not touched: no wrapper, no child, no class. The tip is one shared `<div role="tooltip" class="xo-tooltip">` drawn
 *   `position: fixed` in the top layer (Popover API), so no `overflow: hidden` ancestor clips it.
 * - Hover shows it after a delay (400 ms, `tooltip.delay` or `xo-tooltip-delay`, 0 = at once). Moving to a neighbour within 300 ms of a tooltip
 *   closing shows the next one at once, so a toolbar does not wait on every button. Keyboard focus shows it at once; a click or tap that
 *   focuses the element does not.
 * - Hidden on leave, blur, Escape, a press, and when the element is removed, disabled or scrolled out of view; a scroll or resize moves it with the element. The pointer may move onto the tooltip without
 *   it closing, and it stays until dismissed (WCAG 1.4.13). Escape closes the tooltip first and leaves the dialog or menu it sits in open.
 * - Inside a modal `<dialog>` the page behind is inert and the dialog is in the top layer; the tip is placed in the open dialog while it describes
 *   an element in it, so it is above the dialog and still reachable. It goes back to `<body>` for any other element.
 * - Touch does not hover: no tooltip on a tap (focus and long text belong to the page, not to a hint).
 * - The element gets our id added to `aria-describedby` while it is shown (an author's own ids stay). The text is a description, not the accessible
 *   name: an icon-only button still needs `aria-label`.
 */
const GAP = 6;
const MARGIN = 4;
/** After a tooltip closed, a new hover inside this window (ms) shows at once. */
const SKIP_WINDOW = 300;

/** Defaults you can change from script: `tooltip.delay = 700;` (the object is exported by the package entry). */
export const tooltip = { delay: 400 };

/** @type {HTMLElement | null} */ let tip = null;
/** @type {Element | null} */ let current = null;
/** @type {ReturnType<typeof setTimeout> | undefined} */ let timer;
/** @type {MutationObserver | undefined} */ let observer;
let closedAt = 0;
let pointerType = 'mouse';
let byPointer = false;

/** @param {Element} el @param {string} name the nearest value of an attribute on the element or an ancestor */
const inherited = (el, name) => el.closest(`[${name}]`)?.getAttribute(name) ?? null;

/** @param {Element} el */
function delayOf(el) {
  const value = Number.parseInt(inherited(el, 'xo-tooltip-delay') ?? '', 10);
  return Number.isFinite(value) && value >= 0 ? value : tooltip.delay;
}

function element() {
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'xo-tooltip';
    tip.className = 'xo-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    if ('showPopover' in tip) tip.setAttribute('popover', 'manual');
    tip.addEventListener('pointerleave', () => hide());
  }
  if (!tip.isConnected) document.body.append(tip); // a page that replaced the body gets it back
  return tip;
}

/** The element that holds the tip: an open dialog around the target (so a modal's inert page does not swallow the pointer), else the body. */
function hostOf(/** @type {Element} */ target) {
  return target.closest('dialog[open]') ?? document.body;
}

/** @param {HTMLElement} t @param {DOMRect} r the target's box @param {string} want */
function place(t, r, want) {
  Object.assign(t.style, { position: 'fixed', inset: 'auto', margin: '0', left: '0px', top: '0px' }); // measure at the origin, not squeezed against the right edge
  const tr = t.getBoundingClientRect();
  const vw = globalThis.innerWidth || 1024;
  const vh = globalThis.innerHeight || 768;
  const fits = {
    top: r.top - tr.height - GAP >= MARGIN,
    bottom: r.bottom + tr.height + GAP <= vh - MARGIN,
    left: r.left - tr.width - GAP >= MARGIN,
    right: r.right + tr.width + GAP <= vw - MARGIN,
  };
  const opposite = /** @type {Record<string, 'top' | 'bottom' | 'left' | 'right'>} */ ({ top: 'bottom', bottom: 'top', left: 'right', right: 'left' });
  let side = /** @type {'top' | 'bottom' | 'left' | 'right'} */ (want);
  if (!fits[side] && fits[opposite[side]]) side = opposite[side];
  let left;
  let top;
  if (side === 'top' || side === 'bottom') {
    left = r.left + r.width / 2 - tr.width / 2;
    top = side === 'top' ? r.top - tr.height - GAP : r.bottom + GAP;
  } else {
    top = r.top + r.height / 2 - tr.height / 2;
    left = side === 'left' ? r.left - tr.width - GAP : r.right + GAP;
  }
  const clamp = (/** @type {number} */ v, /** @type {number} */ max) => Math.max(MARGIN, Math.min(v, max));
  t.style.left = `${clamp(left, vw - tr.width - MARGIN)}px`;
  t.style.top = `${clamp(top, vh - tr.height - MARGIN)}px`;
  t.dataset.placement = side;
}

/** @param {Element} el @param {string} id @param {boolean} on */
function describe(el, id, on) {
  const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((x) => x && x !== id);
  if (on) ids.push(id);
  if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
  else el.removeAttribute('aria-describedby');
}

/** What can change under a tooltip that is shown: the element leaves, gets disabled or hidden, or its text changes. */
function watch(/** @type {Element} */ target) {
  if (typeof MutationObserver === 'undefined') return;
  observer ??= new MutationObserver(() => {
    if (!current) return;
    const text = current.getAttribute('xo-tooltip');
    if (!current.isConnected || !text || current.hasAttribute('disabled') || current.hasAttribute('hidden')) hide();
    else if (tip && tip.textContent !== text) tip.textContent = text;
  });
  observer.disconnect();
  observer.observe(document.documentElement, { childList: true, subtree: true });
  observer.observe(target, { attributes: true, attributeFilter: ['xo-tooltip', 'disabled', 'hidden'] });
}

function show(/** @type {Element} */ target) {
  clearTimeout(timer);
  const text = target.getAttribute('xo-tooltip');
  if (!text || !target.isConnected) return;
  const t = element();
  if (current && current !== target) describe(current, t.id, false);
  current = target;
  const host = hostOf(target);
  if (t.parentNode !== host) {
    if (t.hasAttribute('popover') && t.matches(':popover-open')) t.hidePopover(); // moving it would close it anyway; do it cleanly
    host.append(t);
  }
  t.textContent = text;
  t.hidden = false;
  if (t.hasAttribute('popover') && !t.matches(':popover-open')) t.showPopover(); // after the dialog: later in the top layer is on top
  describe(target, t.id, true);
  const want = inherited(target, 'xo-tooltip-placement');
  place(t, target.getBoundingClientRect(), want === 'bottom' || want === 'left' || want === 'right' ? want : 'top');
  watch(target);
}

function hide() {
  clearTimeout(timer);
  if (!tip || tip.hidden) return;
  observer?.disconnect();
  if (current) describe(current, tip.id, false);
  current = null;
  closedAt = Date.now();
  if (tip.hasAttribute('popover') && tip.matches(':popover-open')) tip.hidePopover();
  tip.hidden = true;
}

const owner = (/** @type {EventTarget | null} */ n) => /** @type {Element | null} */ (n instanceof Element ? n.closest('[xo-tooltip]') : null);

document.addEventListener('mouseover', (event) => {
  if (pointerType === 'touch') return; // a tap makes a mouseover too: touch has no hover
  const target = owner(event.target);
  if (!target || target === current) return;
  clearTimeout(timer);
  const wait = Date.now() - closedAt < SKIP_WINDOW ? 0 : delayOf(target);
  if (wait === 0) show(target);
  else timer = setTimeout(() => show(target), wait);
});
document.addEventListener('mouseout', (event) => {
  const from = owner(event.target);
  if (!from) return;
  const to = /** @type {Node | null} */ (event.relatedTarget);
  if (to && (from.contains(to) || tip?.contains(to))) return; // still on the element, or moving onto the tooltip
  hide();
});
document.addEventListener('focusin', (event) => {
  if (byPointer) return; // focus that came from a click or a tap is not a request for the hint
  const target = owner(event.target);
  if (target) show(target);
});
document.addEventListener('focusout', (event) => { if (owner(event.target)) hide(); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && tip && !tip.hidden) {
    hide();
    event.preventDefault(); // the first Escape closes the hint, not the dialog or menu it sits in
    event.stopPropagation();
    return;
  }
  if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) byPointer = false; // the keyboard is in use again: focus may show hints
}, true);
document.addEventListener('pointerdown', (event) => {
  byPointer = true;
  pointerType = event.pointerType || 'mouse';
  hide();
}, true);
document.addEventListener('pointerover', (event) => { pointerType = event.pointerType || pointerType; }, true);
/** A fixed tip does not follow its element: put it back next to it, or close it when the element has scrolled out of view. */
function follow() {
  if (!current || !tip || tip.hidden) return;
  const r = current.getBoundingClientRect();
  if (r.bottom < 0 || r.top > (globalThis.innerHeight || 768) || r.right < 0 || r.left > (globalThis.innerWidth || 1024)) { hide(); return; }
  const want = inherited(current, 'xo-tooltip-placement');
  place(tip, r, want === 'bottom' || want === 'left' || want === 'right' ? want : 'top');
}
document.addEventListener('scroll', follow, true); // also fires after a keyboard focus scrolled the element into view: follow, do not close
globalThis.addEventListener?.('resize', follow);
document.addEventListener('close', () => hide(), true); // a dialog closing takes the tip with it (the event does not bubble)
