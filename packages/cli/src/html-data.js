// @ts-check
/**
 * `xoong.html-data.json`: custom data for VS Code's HTML language service (`html.customData`).
 * Gives completion and hover for xo-* elements and attributes, and completes operation names
 * for xo-click, xo-submit, <xo-view get> and <xo-form op> from the synced operations table.
 * Format: https://github.com/microsoft/vscode-html-languageservice/blob/main/docs/customData.md
 */
import { XO_ATTRIBUTES, XO_ELEMENTS, XO_UI_ATTRIBUTES, XO_UI_ELEMENTS, XO_CONTROL_ATTRIBUTES, XO_CONTROL_ELEMENTS } from '@xoong/core/syntax';

export const ATTRIBUTE_DOCS = {
  'xo-each': 'Repeat this element for each item of the list at the given path (keyed by entity id).',
  'xo-if': 'Render this element only when the path is truthy. Prefix with `!` to negate. An empty array is false.',
  'xo-click': 'Call an operation when clicked: "METHOD /path/{param}" or an operationId. Params come from the current item, then the view\'s p-* params.',
  'xo-submit': 'On a <form>: send the form fields as the request body of the operation. The form is reset on success unless xo-keep is present. Field errors from the server appear beside the inputs.',
  'xo-body': 'With xo-click: take the request body from the item at this path.',
  'xo-keep': 'With xo-submit: keep the field values after a successful send.',
  'xo-t': 'Translate this element with @xoong/i18n: `xo-t="key"` for its text, `xo-t="attr:key; attr2:key2"` for attributes. The text written in the HTML is the default. `{placeholders}` come from the enclosing xo-view.',
  'xo-add': 'In a form: append an item to the array at this path (`blocks`); `xo-with="type=image"` gives a union item its tag.',
  'xo-remove': 'In a form row: remove the array item at this path (`blocks[{$index}]`).',
  'xo-move': 'In a form row: move the array item at this path, `blocks[{$index}]:up` or `:down`.',
  'xo-select': 'On a checkbox in a row (inside xo-each): tick that row. `all:items` in the header ticks every row of the list. <xo-table selectable> does this for you.',
  'xo-selected': 'On an xo-click button: run the operation once for every ticked row, one after another; the first failure stops the rest. With a value (`xo-selected="ids"`): ONE request whose body has the ticked ids in that field.',
  'xo-with': 'On xo-click/xo-submit: fixed fields added to the request body, `field=value,other={path}` (typed from the request schema).',
  'xo-confirm': 'On xo-click/xo-submit: ask before running, with a native dialog. `{path}` names the item: `xo-confirm="Delete {title}?"`.',
  'xo-notice': 'On xo-click/xo-submit: after success, show this message in <xo-toast> (`{path}` and `{$selectedCount}` work).',
  'xo-guard': 'On a <form xo-submit>: with unsaved changes the router asks before the page is left. `xo-guard="off"` disables it; any other text is the question to ask.',
  'xo-route': 'On a <template> inside <xo-router>: the path this route answers, for example `/users/:id`; `*` is the not-found route. The content is inert until the route matches.',
  'xo-layout': 'On a <template> inside <xo-router>: a layout (shell) that routes use with `layout="name"`. It must contain one element with xo-outlet.',
  'xo-outlet': 'In a layout: the element where the matched route content is shown. The layout stays while only this content changes.',
  'xo-optimistic': 'On xo-click: set these fields (`field=value,field2={path}`) on the current item immediately, and undo them if the call fails.',
  'xo-param': 'On an <input> or <select>: set the view parameter of that name to its value. On other elements, on click, set a view parameter and refetch: `name=value`, `name+=n`, `name-=n`, or `name~=value` (toggle value / -value, for sorting).',
  'xo-open': 'Open the <xo-dialog> matched by this selector, for example `#add`.',
  'xo-close': 'Close the <xo-dialog> this element is in.',
  'xo-menu-trigger': 'On the button of <xo-menu> that opens it (the first button when none is marked).',
  'xo-tooltip': 'On any element: a short description shown on hover and focus (and hidden on Escape). It is a description, not the accessible name.',
  'xo-tab': 'On a section inside <xo-tabs>: the tab label. The section id is the tab key (its position when it has none).',
};
export const ELEMENT_DOCS = {
  'xo-view': ['Declare a screen: `get` names the GET operation to read. Children are bound to the result. Add `live` to apply server-sent updates.', [['get', 'A path ("/users") or operationId.'], ['live', 'Apply live updates from the event stream.'], ['url-params', 'Comma-separated param names kept in the page URL (shareable, survive reload and Back): `status,q,sort,offset`.']]],
  'xo-table': ['A table for the list in the enclosing <xo-view get>. Children become the actions cell of each row.', [['of', 'List field of the response (default `items`).'], ['columns', 'Comma-separated fields, optionally `field:Label`.'], ['sortable', 'Header buttons sort on the server through the `sort` query parameter.'], ['selectable', 'A checkbox per row and a select-all box; slot="bulk" children act on the ticked rows.'], ['filters', 'Comma-separated fields that get a search box above the table; typing sets the query parameter of the same name.'], ['page-size', 'Rows per page: sets `limit`, Previous/Next change `offset`. The response needs a `total`.']]],
  'xo-form': ['A form generated from the request schema of an operation.', [['op', 'The operation to submit to.'], ['submit', 'Text of the submit button.']]],
  'xo-toast': ['Shows the message of the latest xo-error event on the page; hides on the next xo-done or after `timeout` seconds.', [['timeout', 'Seconds before it hides (default 6, 0 = until the next success).']]],
  'xo-router': ['A History-API router declared in markup: one <template xo-route> per route, optional <template xo-layout> shells. Links are intercepted, aria-current marks the active one. Guards and leave-vetoes are JavaScript (`router.guard`, `router.beforeNavigate`).', [['base', 'Path prefix the app lives under, for example `/admin`.']]],
  'xo-tabs': ['Accessible tabs (@xoong/controls) from the sections that have xo-tab. Panels stay in the DOM, so form controls on other tabs still count; xo-reveal selects the tab of an invalid field.', [['value', 'Key of the selected tab (default: the first).'], ['label', 'Accessible name of the tab list.']]],
  'xo-menu': ['An action menu (@xoong/controls): a trigger button and items (buttons or links) with arrow keys, Home/End, type-ahead and Escape. Drawn in the top layer where the browser supports the Popover API.', [['label', 'Accessible name of the menu.']]],
  'xo-combobox': ['A form control (@xoong/controls) to pick from a list you can filter by typing. <option> children are the choices; `multiple` shows chips; the value is a string, or an array with `multiple`.', [['name', 'Form field path.'], ['multiple', 'Pick several values (chips).'], ['creatable', 'Allow a value that is not in the list.'], ['remote', 'Do not filter locally: listen to xo-search and set `el.options`.'], ['placeholder', 'Hint text of the empty field.'], ['label', 'Accessible name when there is no <label>.']]],
  'xo-tags': ['A free-text tag input (@xoong/controls): type and press Enter or a comma to add a chip; Backspace removes the last. Value: an array of strings.', [['name', 'Form field path.'], ['placeholder', 'Hint text of the empty field.']]],
  'xo-dialog': ['A modal on the native <dialog>. Open it with xo-open, close it with xo-close or by submitting a form inside.', []],
};

/** @param {{ operations: Record<string, any> }} table */
export function htmlData(table) {
  const ops = Object.values(table.operations);
  const refs = (filter) => ops.filter(filter).flatMap((o) => [o.id, `${o.method} ${o.path}`]);
  const values = (list) => [...new Set(list)].sort().map((name) => ({ name }));
  const mutations = values(refs((o) => o.method !== 'GET'));
  const reads = values(ops.filter((o) => o.method === 'GET').flatMap((o) => [o.id, o.path]));
  const params = [...new Set(ops.flatMap((o) => [...o.path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1])))].sort();

  return {
    version: 1.1,
    tags: [...XO_ELEMENTS, ...XO_UI_ELEMENTS, ...XO_CONTROL_ELEMENTS].map((name) => {
      const [description, attrs] = ELEMENT_DOCS[name] ?? [name, []];
      const attributes = attrs.map(([n, d]) => ({ name: n, description: d, ...(n === 'get' ? { valueSet: 'xo-reads' } : n === 'op' ? { valueSet: 'xo-mutations' } : {}) }));
      if (name === 'xo-view') for (const p of params) attributes.push({ name: `p-${p}`, description: `Value of the path parameter "${p}" for the view's operation.` });
      return { name, description, attributes };
    }),
    globalAttributes: [...XO_ATTRIBUTES, ...XO_UI_ATTRIBUTES, ...XO_CONTROL_ATTRIBUTES].map((name) => ({
      name, description: ATTRIBUTE_DOCS[name] ?? name,
      ...(name === 'xo-click' || name === 'xo-submit' ? { valueSet: 'xo-mutations' } : {}),
    })),
    valueSets: [{ name: 'xo-mutations', values: mutations }, { name: 'xo-reads', values: reads }],
  };
}
