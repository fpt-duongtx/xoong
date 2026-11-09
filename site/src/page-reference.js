// The Reference page: a filter box above the entries (hidden until this script runs, because without JavaScript it would do nothing).
// It hides the entries that do not contain every word typed, ignoring case and accents, and says how many are left.
import { fold, tokens } from './search-core.js';

const box = document.getElementById('ref-filter');
const input = /** @type {HTMLInputElement | null} */ (document.getElementById('ref-filter-input'));
const status = document.getElementById('ref-filter-status');
const none = document.getElementById('ref-empty');
const entries = [...document.querySelectorAll('.ref-entry')];
const names = [...document.querySelectorAll('[data-find-for]')];
const keys = new Map(entries.map((e) => [e.id, fold(e.getAttribute('data-find'))]));

function filter() {
  const words = tokens(input?.value ?? '');
  let shown = 0;
  for (const entry of entries) {
    const match = words.every((w) => keys.get(entry.id)?.includes(w));
    entry.hidden = !match;
    if (match) shown++;
  }
  for (const name of names) /** @type {HTMLElement} */ (name).hidden = /** @type {HTMLElement} */ (document.getElementById(/** @type {HTMLElement} */ (name).dataset.findFor ?? '')).hidden;
  for (const group of document.querySelectorAll('.ref-names')) group.hidden = ![...group.children].some((li) => !(/** @type {HTMLElement} */ (li)).hidden);
  if (none) none.hidden = shown > 0;
  if (status) status.textContent = words.length ? `${shown} of ${entries.length} entries` : '';
}

// A very long page: the web fonts, and the filter box shown below, change its height after the browser jumped to #entry (a link of the menu or of the search),
// so the jump is made again when they are in, unless the visitor has scrolled meanwhile.
const target = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
let moved = false;
for (const name of ['wheel', 'touchstart', 'keydown', 'pointerdown']) addEventListener(name, () => { moved = true; }, { once: true, passive: true });
const again = () => { if (target && !moved) target.scrollIntoView(); };

if (box && input) {
  box.hidden = false;
  input.addEventListener('input', filter);
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape' && input.value) { input.value = ''; filter(); } });
}
document.fonts?.ready.then(again);
addEventListener('load', again);
again();
