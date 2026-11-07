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
  const place = () => {
    if (!top) return;
    const r = anchor.getBoundingClientRect();
    const room = (globalThis.innerHeight || 768) - r.bottom;
    const height = panel.getBoundingClientRect().height;
    const flip = room < height + 8 && r.top > room; // not enough room below and more above: open upwards
    Object.assign(panel.style, {
      position: 'fixed', inset: 'auto', margin: '0', left: `${r.left}px`,
      top: flip ? `${Math.max(4, r.top - height)}px` : `${r.bottom}px`,
      ...(matchWidth ? { width: `${r.width}px`, boxSizing: 'border-box' } : {}),
    });
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
