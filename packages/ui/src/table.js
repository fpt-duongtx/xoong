// @ts-check
/**
 * <xo-table of="items" columns="name,email:E-mail,status" sortable page-size="25">
 *   <button xo-click="DELETE /users/{id}">Delete</button>     <- children become the last cell of each row
 * </xo-table>
 *
 * Expands into a plain <table> inside the enclosing <xo-view>, so your CSS and tests see ordinary markup.
 * - columns: comma-separated fields, optional "field:Label". Labels default to the field name.
 * - sortable: header buttons set the `sort` query parameter ("name", then "-name").
 * - filters="name,status": a search box above the table per field; typing sets that query parameter (empty removes it).
 * - A child with slot="field" replaces the default cell of that column with the child itself:
 *     <xo-table columns="name,status"><span slot="status" class="badge" data-status="{status}">{status}</span></xo-table>
 * - selectable: a checkbox per row and a select-all checkbox. Children with slot="bulk" appear above the table while rows are
 *   ticked; give them xo-selected to run their operation once per ticked row:
 *     <button slot="bulk" xo-click="DELETE /users/{id}" xo-selected>Delete ticked</button>
 * - filters="q:Search,status": a search box per field, with an optional label (the label is the placeholder and the accessible name).
 * - columns="publishedAt:Published:datetime": a third part formats the cell (date, datetime, time, relative, number, localized).
 * - cards: in a narrow pane every row is drawn as a card (a theme does it: the table gets the class `xo-cards`); every cell has `data-label` with its column's label,
 *   the first column (or `title="field"`) is the card title (`data-title`), `status="field"` marks the status cell (`data-status`).
 * - empty="No results" (or a child `<template slot="empty">`): shown when the list is empty and not loading.
 * - page-sizes="10,25,50": a rows-per-page choice next to the "1–3 of 5" range text.
 * - page-size: sets `limit` and shows Previous/Next, which change `offset`. Needs a `total` field in the response.
 * The operation must declare those query parameters; `xoong check` reports it when it does not (XO250).
 */
import { defineTemplate } from '@xoong/data/view';

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

defineTemplate('xo-table', (el, { host }) => {
  const of = el.getAttribute('of') || 'items';
  const sortable = el.hasAttribute('sortable');
  const pageSize = Number(el.getAttribute('page-size')) || 0;
  const columns = (el.getAttribute('columns') || '').split(',').map((c) => c.trim()).filter(Boolean).map((c) => {
    const [field, label, fmt] = c.split(':'); // field, optional label, optional display format (date, datetime, time, relative, number, localized)
    return { field, label: label || field, fmt };
  });
  const cellOf = new Map();
  const rest = [];
  const bulk = [];
  let empty = el.getAttribute('empty') ? esc(el.getAttribute('empty') ?? '') : '';
  const selectable = el.hasAttribute('selectable');
  /** The child as markup, without its slot attribute. */
  const unslotted = (child) => { const copy = /** @type {Element} */ (child.cloneNode(true)); copy.toggleAttribute('slot', false); return copy.outerHTML; };
  for (const child of [...el.childNodes]) {
    const slot = child.nodeType === 1 ? /** @type {Element} */ (child).getAttribute('slot') : null;
    if (slot === 'bulk') bulk.push(unslotted(child));
    else if (slot === 'empty') empty = /** @type {Element} */ (child).localName === 'template' ? /** @type {HTMLTemplateElement} */ (child).innerHTML : unslotted(child);
    else if (slot && columns.some((c) => c.field === slot)) cellOf.set(slot, unslotted(child));
    else rest.push(child);
  }
  const actions = rest.map((n) => (n.nodeType === 1 ? n.outerHTML : n.textContent)).join('').trim();
  const filters = (el.getAttribute('filters') || '').split(',').map((f) => f.trim()).filter(Boolean).map((f) => { const [field, label] = f.split(':'); return { field, label: label || columns.find((c) => c.field === field)?.label || field }; });
  const sizes = (el.getAttribute('page-sizes') || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (pageSize && host.params.limit == null) host.params = { ...host.params, limit: pageSize };

  const tickAll = selectable ? `<th scope="col"><input type="checkbox" xo-select="all:${esc(of)}" aria-label="Select all rows" xo-t="aria-label:xoong.table.selectAll"></th>` : '';
  const tickRow = selectable ? '<td><input type="checkbox" xo-select aria-label="Select row" xo-t="aria-label:xoong.table.selectRow"></td>' : '';
  const head = columns.map((c) => `<th scope="col">${sortable ? `<button type="button" xo-param="sort~=${esc(c.field)}">${esc(c.label)}</button>` : esc(c.label)}</th>`).join('');
  const cellText = (c) => (['date', 'datetime', 'time', 'relative'].includes(c.fmt) ? `<time datetime="{${esc(c.field)}}">{${esc(c.field)} | ${c.fmt}}</time>` : c.fmt ? `{${esc(c.field)} | ${esc(c.fmt)}}` : `{${esc(c.field)}}`);
  const titleField = el.getAttribute('title') || columns[0]?.field; // the card title of the narrow layout
  const statusField = el.getAttribute('status');
  const cells = columns.map((c) => `<td data-label="${esc(c.label)}"${c.field === titleField ? ' data-title' : ''}${c.field === statusField ? ' data-status' : ''}>${cellOf.get(c.field) ?? cellText(c)}</td>`).join('');
  const box = document.createElement('div');
  box.className = el.hasAttribute('cards') ? 'xo-table xo-cards' : 'xo-table'; // `cards`: rows become cards in a narrow pane (the theme draws them)
  const search = filters.map((f) => `<input type="search" xo-param="${esc(f.field)}" placeholder="${esc(f.label)}" aria-label="${esc(f.label)}">`).join('');
  const bar = bulk.length ? `<div class="xo-bulk" xo-if="$selectedCount"><span xo-t="xoong.table.selected">{$selectedCount} selected</span>${bulk.join('')}</div>` : '';
  box.innerHTML = `${bar}${search ? `<div class="xo-filters">${search}</div>` : ''}<table>
  <thead><tr>${tickAll}${head}${actions ? '<th scope="col"><span class="xo-visually-hidden" xo-t="xoong.table.actions">Actions</span></th>' : ''}</tr></thead>
  <tbody><tr xo-each="${esc(of)}">${tickRow}${cells}${actions ?`<td class="xo-actions">${actions}</td>` : ''}</tr></tbody>
</table>${empty ? `
<div class="xo-empty" xo-if="!${esc(of)}"><div xo-if="!$loading"><div xo-if="!$error">${empty}</div></div></div>` : ''}${pageSize ? `
<nav class="xo-pager" aria-label="Pagination" xo-t="aria-label:xoong.table.pagination">
  <span class="xo-range" xo-if="total" xo-t="xoong.table.range">{$from}–{$to} of {total}</span>${sizes.length ? `
  <select class="xo-page-size" xo-param="limit" aria-label="Rows per page" xo-t="aria-label:xoong.table.rowsPerPage">${sizes.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select>` : ''}
  <button type="button" xo-if="$hasPrev" xo-param="offset-=${pageSize}" xo-t="xoong.table.previous">Previous</button>
  <button type="button" xo-if="$hasNext" xo-param="offset+=${pageSize}" xo-t="xoong.table.next">Next</button>
</nav>` : ''}`;
  return box;
});
