// @ts-check
/**
 * <xo-table of="items" columns="name,email:E-mail,status" sortable page-size="25">
 *   <button xo-click="DELETE /users/{id}">Delete</button>     <- children become the last cell of each row
 * </xo-table>
 *
 * Expands into a plain <table> inside the enclosing <xo-view>, so your CSS and tests see ordinary markup.
 * - columns: comma-separated fields, optional "field:Label". Labels default to the field name.
 * - sortable: header buttons set the `sort` query parameter ("name", then "-name").
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
  const actions = el.innerHTML.trim();
  if (pageSize && host.params.limit == null) host.params = { ...host.params, limit: pageSize };

  const head = columns.map((c) => `<th scope="col">${sortable ? `<button type="button" xo-param="sort~=${esc(c.field)}">${esc(c.label)}</button>` : esc(c.label)}</th>`).join('');
  const cells = columns.map((c) => `<td>{${esc(c.field)}}</td>`).join('');
  const box = document.createElement('div');
  box.className = 'xo-table';
  box.innerHTML = `<table>
  <thead><tr>${head}${actions ? '<th scope="col"><span class="xo-visually-hidden">Actions</span></th>' : ''}</tr></thead>
  <tbody><tr xo-each="${esc(of)}">${cells}${actions ? `<td class="xo-actions">${actions}</td>` : ''}</tr></tbody>
</table>${pageSize ? `
<nav class="xo-pager" aria-label="Pagination">
  <button type="button" xo-if="$hasPrev" xo-param="offset-=${pageSize}">Previous</button>
  <button type="button" xo-if="$hasNext" xo-param="offset+=${pageSize}">Next</button>
</nav>` : ''}`;
  return box;
});
