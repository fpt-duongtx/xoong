// @ts-check
/**
 * Where a popup (menu, option list) is drawn. With the Popover API it goes into the top layer, so a table, a dialog or a scroll area never
 * clips it; the position is set through the CSS object model (allowed under a strict CSP, unlike a style attribute). Without the API the
 * popup stays a normal element that `controls.css` positions under its anchor.
 */

/** Prepare a popup element once. */
export function prepareLayer(/** @type {HTMLElement} */ panel) {
  panel.hidden = true;
  if ('showPopover' in panel) panel.setAttribute('popover', 'manual'); // manual: the control decides when it closes, the same in every browser
}

/**
 * Show the popup under `anchor`. Returns a function that stops following the anchor on scroll and resize.
 * @param {HTMLElement} panel
 * @param {HTMLElement} anchor
 * @param {{ matchWidth?: boolean }} [options]
 */
export function showLayer(panel, anchor, { matchWidth = false } = {}) {
  panel.hidden = false;
  const top = panel.hasAttribute('popover');
  if (top && !panel.matches(':popover-open')) panel.showPopover();
  const MARGIN = 8;
  const place = () => {
    if (!top) return;
    const r = anchor.getBoundingClientRect();
    const vw = globalThis.innerWidth || 1024;
    const vh = globalThis.innerHeight || 768;
    // measure at the natural size, then fit: first the side with room, then a height limit when neither side has enough
    Object.assign(panel.style, { position: 'fixed', inset: 'auto', margin: '0', maxHeight: '', ...(matchWidth ? { width: `${r.width}px`, boxSizing: 'border-box' } : {}) });
    const size = panel.getBoundingClientRect();
    const below = vh - r.bottom - MARGIN;
    const above = r.top - MARGIN;
    const up = below < size.height && above > below; // not enough room below and more above: open upwards
    const room = Math.max(up ? above : below, 80);
    const height = Math.min(size.height, room);
    if (size.height > room) panel.style.maxHeight = `${room}px`; // the panel scrolls (the lists already have overflow)
    const left = Math.min(Math.max(r.left, MARGIN), Math.max(MARGIN, vw - size.width - MARGIN)); // keep it inside the viewport sideways
    Object.assign(panel.style, { left: `${left}px`, top: up ? `${Math.max(MARGIN, r.top - height)}px` : `${r.bottom}px` });
  };
  place();
  if (!top) return () => {};
  addEventListener('resize', place);
  addEventListener('scroll', place, true);
  return () => { removeEventListener('resize', place); removeEventListener('scroll', place, true); };
}

export function hideLayer(/** @type {HTMLElement} */ panel) {
  if (panel.hasAttribute('popover') && panel.matches(':popover-open')) panel.hidePopover();
  panel.hidden = true;
}
