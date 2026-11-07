// @ts-check
/**
 * `xoong.html-data.json`: custom data for VS Code's HTML language service (`html.customData`).
 * Gives completion and hover for xo-* elements and attributes, and completes operation names
 * for xo-click, xo-submit, <xo-view get> and <xo-form op> from the synced operations table.
 * Format: https://github.com/microsoft/vscode-html-languageservice/blob/main/docs/customData.md
 */
import { XO_ATTRIBUTES, XO_ELEMENTS, XO_UI_ATTRIBUTES, XO_UI_ELEMENTS } from '@xoong/core/syntax';

const ATTRIBUTE_DOCS = {
  'xo-each': 'Repeat this element for each item of the list at the given path (keyed by entity id).',
  'xo-if': 'Render this element only when the path is truthy. Prefix with `!` to negate. An empty array is false.',
  'xo-click': 'Call an operation when clicked: "METHOD /path/{param}" or an operationId. Params come from the current item, then the view\'s p-* params.',
  'xo-submit': 'On a <form>: send the form fields as the request body of the operation. The form is reset on success unless xo-keep is present. Field errors from the server appear beside the inputs.',
  'xo-body': 'With xo-click: take the request body from the item at this path.',
  'xo-keep': 'With xo-submit: keep the field values after a successful send.',
  'xo-param': 'On click, set a view parameter and refetch: `name=value`, `name+=n`, `name-=n`, or `name~=value` (toggle value / -value, for sorting).',
  'xo-open': 'Open the <xo-dialog> matched by this selector, for example `#add`.',
  'xo-close': 'Close the <xo-dialog> this element is in.',
};
const ELEMENT_DOCS = {
  'xo-view': ['Declare a screen: `get` names the GET operation to read. Children are bound to the result. Add `live` to apply server-sent updates.', [['get', 'A path ("/users") or operationId.'], ['live', 'Apply live updates from the event stream.']]],
  'xo-table': ['A table for the list in the enclosing <xo-view get>. Children become the actions cell of each row.', [['of', 'List field of the response (default `items`).'], ['columns', 'Comma-separated fields, optionally `field:Label`.'], ['sortable', 'Header buttons sort on the server through the `sort` query parameter.'], ['page-size', 'Rows per page: sets `limit`, Previous/Next change `offset`. The response needs a `total`.']]],
  'xo-form': ['A form generated from the request schema of an operation.', [['op', 'The operation to submit to.'], ['submit', 'Text of the submit button.']]],
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
    tags: [...XO_ELEMENTS, ...XO_UI_ELEMENTS].map((name) => {
      const [description, attrs] = ELEMENT_DOCS[name] ?? [name, []];
      const attributes = attrs.map(([n, d]) => ({ name: n, description: d, ...(n === 'get' ? { valueSet: 'xo-reads' } : n === 'op' ? { valueSet: 'xo-mutations' } : {}) }));
      if (name === 'xo-view') for (const p of params) attributes.push({ name: `p-${p}`, description: `Value of the path parameter "${p}" for the view's operation.` });
      return { name, description, attributes };
    }),
    globalAttributes: [...XO_ATTRIBUTES, ...XO_UI_ATTRIBUTES].map((name) => ({
      name, description: ATTRIBUTE_DOCS[name] ?? name,
      ...(name === 'xo-click' || name === 'xo-submit' ? { valueSet: 'xo-mutations' } : {}),
    })),
    valueSets: [{ name: 'xo-mutations', values: mutations }, { name: 'xo-reads', values: reads }],
  };
}
