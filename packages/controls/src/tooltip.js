// @ts-check
/**
 * xo-tooltip="Save the draft" on any element shows a short text next to it (the WAI-ARIA tooltip pattern).
 *
 *   <button xo-tooltip="Save the draft">Save</button>
 *   <button xo-tooltip="Delete" aria-label="Delete">🗑</button>
 *
 * - Shown after a short delay on hover, at once on keyboard focus; hidden on leave, blur, Escape or a click. The pointer may move onto the
 *   tooltip without it closing (WCAG 1.4.13: dismissible, hoverable, persistent).
 * - The element gets `aria-describedby` while it is shown. The text is a description, not the accessible name: an icon-only button
 *   still needs `aria-label`.
 * - One shared `<div role="tooltip" class="xo-tooltip">` for the page, placed above the element (below when there is no room).
 */
const DELAY = 400;

/** @type {HTMLElement | null} */ let tip = null;
/** @type {Element | null} */ let current = null;
/** @type {ReturnType<typeof setTimeout> | undefined} */ let timer;

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

function show(/** @type {Element} */ target) {
  clearTimeout(timer);
  const text = target.getAttribute('xo-tooltip');
  if (!text) return;
  const t = element();
  if (current && current !== target) current.removeAttribute('aria-describedby');
  current = target;
  t.textContent = text;
  t.hidden = false;
  if (t.hasAttribute('popover') && !t.matches(':popover-open')) t.showPopover();
  target.setAttribute('aria-describedby', t.id);
  const r = target.getBoundingClientRect();
  const tr = t.getBoundingClientRect();
  const above = r.top - tr.height - 6 >= 0;
  const left = Math.max(4, Math.min(r.left + r.width / 2 - tr.width / 2, (globalThis.innerWidth || 1024) - tr.width - 4));
  Object.assign(t.style, { position: 'fixed', inset: 'auto', margin: '0', left: `${left}px`, top: `${above ? r.top - tr.height - 6 : r.bottom + 6}px` });
}

function hide() {
  clearTimeout(timer);
  if (!tip || tip.hidden) return;
  current?.removeAttribute('aria-describedby');
  current = null;
  if (tip.hasAttribute('popover') && tip.matches(':popover-open')) tip.hidePopover();
  tip.hidden = true;
}

const owner = (/** @type {EventTarget | null} */ n) => /** @type {Element | null} */ (n instanceof Element ? n.closest('[xo-tooltip]') : null);

document.addEventListener('mouseover', (event) => {
  const target = owner(event.target);
  if (!target || target === current) return;
  clearTimeout(timer);
  timer = setTimeout(() => show(target), DELAY);
});
document.addEventListener('mouseout', (event) => {
  const from = owner(event.target);
  if (!from) return;
  const to = /** @type {Node | null} */ (event.relatedTarget);
  if (to && (from.contains(to) || tip?.contains(to))) return; // still on the element, or moving onto the tooltip
  hide();
});
document.addEventListener('focusin', (event) => { const target = owner(event.target); if (target) show(target); });
document.addEventListener('focusout', (event) => { if (owner(event.target)) hide(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && tip && !tip.hidden) hide(); });
document.addEventListener('pointerdown', () => hide());
