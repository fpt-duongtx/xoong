// @ts-check
/**
 * <xo-pager page-size="12" page-sizes="12,24,48"></xo-pager>: Previous and Next for any list in the enclosing <xo-view> (a tile grid, a thread
 * list), the same pager <xo-table page-size> draws under its table.
 *
 * - page-size: rows per page; sets `limit`, and the buttons change `offset`. The operation must declare `limit` and `offset`, and the response
 *   needs a `total` field for the "1–12 of 48" text and for the end of the list.
 * - page-sizes="12,24,48": a rows-per-page choice.
 * - Draws `nav.xo-pager` (`span.xo-range`, `select.xo-page-size`, two icon buttons named Previous and Next by `aria-label` and `title`); Previous shows while `$hasPrev`, Next while `$hasNext`.
 */
import { defineTemplate } from '@xoong/data/view';

const esc = (/** @type {string} */ s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

/** Previous and Next are icon buttons: a button with a word looked like the table's own action buttons. */
const chevron = (/** @type {string} */ d) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

/** The pager markup (also used by <xo-table>). @param {{ pageSize: number, sizes?: string[] }} options */
export function pagerMarkup({ pageSize, sizes = [] }) {
  return `
<nav class="xo-pager" aria-label="Pagination" xo-t="aria-label:xoong.table.pagination">
  <span class="xo-range" xo-if="total" xo-t="xoong.table.range">{$from}–{$to} of {total}</span>${sizes.length ? `
  <select class="xo-page-size" xo-param="limit" aria-label="Rows per page" xo-t="aria-label:xoong.table.rowsPerPage">${sizes.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select>` : ''}
  <button type="button" class="icon-only xo-pager-prev" xo-if="$hasPrev" xo-param="offset-={limit}" aria-label="Previous" title="Previous" xo-t="aria-label:xoong.table.previous; title:xoong.table.previous">${chevron('m15 6-6 6 6 6')}</button>
  <button type="button" class="icon-only xo-pager-next" xo-if="$hasNext" xo-param="offset+={limit}" aria-label="Next" title="Next" xo-t="aria-label:xoong.table.next; title:xoong.table.next">${chevron('m9 6 6 6-6 6')}</button>
</nav>`;
}

defineTemplate('xo-pager', (el, { host }) => {
  const pageSize = Number(el.getAttribute('page-size')) || 25;
  if (host.params.limit == null) host.params = { ...host.params, limit: pageSize }; // the view asks for one page
  const sizes = (el.getAttribute('page-sizes') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const box = document.createElement('div');
  box.style.display = 'contents'; // the pager sits where the element was, in the layout of its parent
  box.innerHTML = pagerMarkup({ pageSize, sizes });
  return box;
});
