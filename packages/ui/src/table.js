// @ts-check
/**
 * <xo-table of="items" columns="name,email:E-mail,status" sortable page-size="25">
 *   <button xo-click="DELETE /users/{id}">Delete</button>     <- children become the last cell of each row
 * </xo-table>
 *
 * Expands into a plain <table> inside the enclosing <xo-view>, so your CSS and tests see ordinary markup.
 * - columns: comma-separated fields, optional "field:Label". Without a label the header is the field name in words: `createdAt` is "Created at", `name` is "Name".
 * - column-picker: a "Columns" dropdown at the right end of the search row to show and hide columns (`hidden-columns="email"` starts with some hidden,
 *   `columns-key="people"` remembers the choice in this browser).
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
import { pagerMarkup } from './pager.js';

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
/** A header from a field name: `createdAt`, `created_at` and `created-at` become "Created at"; a dotted path reads as words (`author.name` is "Author name"). */
const humanize = (/** @type {string} */ field) => { const s = field.replace(/[._-]+/g, ' ').replace(/([a-z\d])([A-Z])/g, '$1 $2').toLowerCase() ?? field; return s.charAt(0).toUpperCase() + s.slice(1); };

defineTemplate('xo-table', (el, { host, take }) => {
  const of = take('of') || 'items';
  const sortable = take('sortable') != null;
  const pageSize = Number(take('page-size')) || 0;
  const columns = (take('columns') || '').split(',').map((c) => c.trim()).filter(Boolean).map((c) => {
    const [field, label, fmt] = c.split(':'); // field, optional label, optional display format (date, datetime, time, relative, number, localized)
    return { field, label: label || humanize(field), fmt }; // no label: "createdAt" is shown as "Created at", not as the field name
  });
  const cellOf = new Map();
  const rest = [];
  const bulk = [];
  let empty = esc(take('empty') ?? '');
  const selectable = take('selectable') != null;
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
  const filters = (take('filters') || '').split(',').map((f) => f.trim()).filter(Boolean).map((f) => { const [field, label] = f.split(':'); return { field, label: label || columns.find((c) => c.field === field)?.label || field }; });
  const sizes = (take('page-sizes') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const hidden = take('hidden-columns') || '', key = take('columns-key');
  if (pageSize && host.params.limit == null) host.params = { ...host.params, limit: pageSize };

  const tickAll = selectable ? `<th scope="col"><input type="checkbox" xo-select="all:${esc(of)}" aria-label="Select all rows" xo-t="aria-label:xoong.table.selectAll"></th>` : '';
  const tickRow = selectable ? '<td><input type="checkbox" xo-select aria-label="Select row" xo-t="aria-label:xoong.table.selectRow"></td>' : '';
  const head = columns.map((c) => `<th scope="col" data-col="${esc(c.field)}">${sortable ? `<button type="button" xo-param="sort~=${esc(c.field)}">${esc(c.label)}</button>` : esc(c.label)}</th>`).join('');
  const cellText = (c) => (['date', 'datetime', 'time', 'relative'].includes(c.fmt) ? `<time datetime="{${esc(c.field)}}">{${esc(c.field)} | ${c.fmt}}</time>` : c.fmt ? `{${esc(c.field)} | ${esc(c.fmt)}}` : `{${esc(c.field)}}`);
  const titleField = take('title') || columns[0]?.field; // the card title of the narrow layout
  const statusField = take('status');
  const cells = columns.map((c) => `<td data-col="${esc(c.field)}" data-label="${esc(c.label)}"${c.field === titleField ? ' data-title' : ''}${c.field === statusField ? ' data-status' : ''}>${cellOf.get(c.field) ?? cellText(c)}</td>`).join('');
  const box = document.createElement('div');
  box.className = take('cards') != null ? 'xo-table xo-cards' : 'xo-table'; // `cards`: rows become cards in a narrow pane (the theme draws them)
  const search = filters.map((f) => `<input type="search" xo-param="${esc(f.field)}" placeholder="${esc(f.label)}" aria-label="${esc(f.label)}">`).join('');
  const bar = bulk.length ? `<div class="xo-bulk" xo-if="$selectedCount"><span xo-t="xoong.table.selected">{$selectedCount} selected</span>${bulk.join('')}</div>` : '';
  const picker = take('column-picker') != null && columns.length > 1
    ? `<details class="xo-columns"><summary xo-t="xoong.table.columns">Columns</summary><div class="xo-columns-panel" role="group" aria-label="Columns" xo-t="aria-label:xoong.table.columns">${columns.map((c) => `<label><input type="checkbox" value="${esc(c.field)}" checked><span>${esc(c.label)}</span></label>`).join('')}</div></details>` : '';
  box.innerHTML = `${bar}${search || picker ? `<div class="xo-filters">${search}${picker}</div>` : ''}<table>
  <thead><tr>${tickAll}${head}${actions ? '<th scope="col"><span class="xo-visually-hidden" xo-t="xoong.table.actions">Actions</span></th>' : ''}</tr></thead>
  <tbody><tr xo-each="${esc(of)}">${tickRow}${cells}${actions ?`<td class="xo-actions">${actions}</td>` : ''}</tr></tbody>
</table>${empty ? `
<div class="xo-empty" xo-if="!${esc(of)}"><div xo-if="!$loading"><div xo-if="!$error">${empty}</div></div></div>` : ''}${pageSize ? pagerMarkup({ pageSize, sizes }) : ''}`;
  if (picker) columnPicker(box, columns.map((c) => c.field), hidden, key);
  return box;
});

/**
 * `column-picker`: the "Columns" dropdown at the right end of the filter row. A checked box shows its column. `hidden-columns="email,role"` starts with those
 * hidden, `columns-key="people"` remembers the choice in this browser; the last visible column cannot be unchecked. Rows are drawn later by the view, so the
 * hidden state is applied to every cell that appears. Fires `xo-columns-change` ({ visible, hidden }).
 * @param {HTMLElement} box @param {string[]} fields @param {string} start @param {string | null} key
 */
function columnPicker(box, fields, start, key) {
  /** @type {Set<string>} */ let hidden = new Set(start.split(',').map((s) => s.trim()).filter((s) => fields.includes(s)));
  const storeKey = `xoong-columns:${key}`;
  if (key) try { const saved = JSON.parse(globalThis.localStorage?.getItem(storeKey) ?? 'null'); if (Array.isArray(saved)) hidden = new Set(saved.filter((s) => fields.includes(s))); } catch { /* storage may be blocked */ }
  const boxes = /** @type {HTMLInputElement[]} */ ([...box.querySelectorAll('.xo-columns input')]);
  const apply = () => {
    for (const cell of /** @type {NodeListOf<HTMLElement>} */ (box.querySelectorAll('[data-col]'))) { const off = hidden.has(cell.dataset.col ?? ''); if (cell.hidden !== off) cell.hidden = off; }
    const shown = boxes.filter((b) => !hidden.has(b.value)).length;
    for (const b of boxes) { b.checked = !hidden.has(b.value); b.disabled = shown === 1 && b.checked; }
  };
  for (const b of boxes) {
    b.addEventListener('change', () => {
      if (b.checked) hidden.delete(b.value); else hidden.add(b.value);
      apply();
      if (key) try { globalThis.localStorage?.setItem(storeKey, JSON.stringify([...hidden])); } catch { /* not saved */ }
      box.dispatchEvent(new CustomEvent('xo-columns-change', { bubbles: true, detail: { visible: fields.filter((f) => !hidden.has(f)), hidden: [...hidden] } }));
    });
  }
  new MutationObserver(apply).observe(box, { childList: true, subtree: true });
  apply();
  const details = /** @type {HTMLDetailsElement} */ (box.querySelector('.xo-columns'));
  const outside = (/** @type {Event} */ e) => { if (!details.isConnected) document.removeEventListener('pointerdown', outside); else if (details.open && !details.contains(/** @type {Node} */ (e.target))) details.open = false; };
  document.addEventListener('pointerdown', outside);
  details.addEventListener('keydown', (e) => { if (e.key === 'Escape' && details.open) { e.stopPropagation(); details.open = false; /** @type {HTMLElement} */ (details.querySelector('summary')).focus(); } });
}
