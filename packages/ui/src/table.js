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
    const [field, ...label] = c.split(':');
    return { field, label: label.join(':') || field };
  });
  const cellOf = new Map();
  const rest = [];
  const bulk = [];
  const selectable = el.hasAttribute('selectable');
  /** The child as markup, without its slot attribute. */
  const unslotted = (child) => { const copy = /** @type {Element} */ (child.cloneNode(true)); copy.toggleAttribute('slot', false); return copy.outerHTML; };
  for (const child of [...el.childNodes]) {
    const slot = child.nodeType === 1 ? /** @type {Element} */ (child).getAttribute('slot') : null;
    if (slot === 'bulk') bulk.push(unslotted(child));
    else if (slot && columns.some((c) => c.field === slot)) cellOf.set(slot, unslotted(child));
    else rest.push(child);
  }
  const actions = rest.map((n) => (n.nodeType === 1 ? n.outerHTML : n.textContent)).join('').trim();
  const filters = (el.getAttribute('filters') || '').split(',').map((f) => f.trim()).filter(Boolean);
  if (pageSize && host.params.limit == null) host.params = { ...host.params, limit: pageSize };

  const tickAll = selectable ? `<th scope="col"><input type="checkbox" xo-select="all:${esc(of)}" aria-label="Select all rows"></th>` : '';
  const tickRow = selectable ? '<td><input type="checkbox" xo-select aria-label="Select row"></td>' : '';
  const head = columns.map((c) => `<th scope="col">${sortable ? `<button type="button" xo-param="sort~=${esc(c.field)}">${esc(c.label)}</button>` : esc(c.label)}</th>`).join('');
  const cells = columns.map((c) => `<td>${cellOf.get(c.field) ?? `{${esc(c.field)}}`}</td>`).join('');
  const box = document.createElement('div');
  box.className = 'xo-table';
  const search = filters.map((f) => {
    const label = columns.find((c) => c.field === f)?.label ?? f;
    return `<input type="search" xo-param="${esc(f)}" placeholder="${esc(label)}" aria-label="Filter by ${esc(label)}">`;
  }).join('');
  const bar = bulk.length ? `<div class="xo-bulk" xo-if="$selectedCount"><span>{$selectedCount} selected</span>${bulk.join('')}</div>` : '';
  box.innerHTML = `${bar}${search ? `<div class="xo-filters">${search}</div>` : ''}<table>
  <thead><tr>${tickAll}${head}${actions ? '<th scope="col"><span class="xo-visually-hidden">Actions</span></th>' : ''}</tr></thead>
  <tbody><tr xo-each="${esc(of)}">${tickRow}${cells}${actions ?`<td class="xo-actions">${actions}</td>` : ''}</tr></tbody>
</table>${pageSize ? `
<nav class="xo-pager" aria-label="Pagination">
  <button type="button" xo-if="$hasPrev" xo-param="offset-=${pageSize}">Previous</button>
  <button type="button" xo-if="$hasNext" xo-param="offset+=${pageSize}">Next</button>
</nav>` : ''}`;
  return box;
});
