// @ts-check
/**
 * An accessible name for a control that computes one.
 * A label the author wrote stays, including a still-unbound `aria-label="{path}"`.
 * A label this component computed is marked `data-xo-label` (the marker survives a clone) and is updated, or removed when `value` is empty.
 * @param {Element} el
 * @param {string} [value]
 */
export function ownLabel(el, value) {
  if (!el.hasAttribute('data-xo-label') && el.hasAttribute('aria-label')) return;
  if (value) { el.setAttribute('aria-label', value); el.setAttribute('data-xo-label', ''); }
  else { el.removeAttribute('aria-label'); el.removeAttribute('data-xo-label'); }
}
