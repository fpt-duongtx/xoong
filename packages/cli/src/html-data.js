// @ts-check
/**
 * `xoong.html-data.json`: custom data for VS Code's HTML language service (`html.customData`).
 * Gives completion and hover for xo-* elements and attributes, and completes operation names
 * for xo-click, xo-submit, <xo-view get> and <xo-form op> from the synced operations table.
 * Format: https://github.com/microsoft/vscode-html-languageservice/blob/main/docs/customData.md
 */
import { XO_ATTRIBUTES, XO_ELEMENTS, XO_UI_ATTRIBUTES, XO_UI_ELEMENTS, XO_CONTROL_ATTRIBUTES, XO_CONTROL_ELEMENTS } from '@xoong/core/syntax';
import { nearest } from '@xoong/core/closest';

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
  'xo-drag': 'On a handle inside an array row of a form: drag the row onto another row of the same list to move it (`blocks[{$index}]`). The xo-move buttons stay for keyboards.',
  'xo-select': 'On a checkbox in a row (inside xo-each): tick that row. `all:items` in the header ticks every row of the list. <xo-table selectable> does this for you.',
  'xo-selected': 'On an xo-click button: run the operation once for every ticked row, one after another; the first failure stops the rest. With a value (`xo-selected="ids"`): ONE request whose body has the ticked ids in that field.',
  'xo-with': 'On xo-click/xo-submit: fixed fields added to the request body, `field=value,other={path}` (typed from the request schema).',
  'xo-confirm': 'On xo-click/xo-submit: ask before running, with a native dialog. `{path}` names the item: `xo-confirm="Delete {title}?"`.',
  'xo-confirm-title': 'With xo-confirm: a heading for the question (`xo-confirm-title="Delete person"`).',
  'xo-confirm-ok': 'With xo-confirm: the text of the confirming button (`xo-confirm-ok="Delete"`) instead of "Confirm".',
  'xo-confirm-cancel': 'With xo-confirm: the text of the cancelling button instead of "Cancel".',
  'xo-confirm-kind': 'With xo-confirm: `danger`, `warning`, `info` or `success`: an icon and the matching colour; the confirming button is red unless a kind says otherwise.',
  'xo-notice': 'On xo-click/xo-submit: after success, show this message in <xo-toast> (`{path}` and `{$selectedCount}` work).',
  'xo-then': 'On xo-click/xo-submit: after success, go to this path; `{id}` comes from the result (a created record), then from the item acted on: `xo-then="/articles/{id}"`, or `xo-then="/articles"` after a delete. <xo-router> navigates.',
  'xo-guard': 'On a <form xo-submit>: with unsaved changes the router asks before the page is left. `xo-guard="off"` disables it; any other text is the question to ask.',
  'xo-route': 'On a <template> inside <xo-router>: the path this route answers, for example `/users/:id`; `*` is the not-found route. The content is inert until the route matches.',
  'xo-layout': 'On a <template> inside <xo-router>: a layout (shell) that routes use with `layout="name"`. It must contain one element with xo-outlet.',
  'xo-outlet': 'In a layout: the element where the matched route content is shown. The layout stays while only this content changes.',
  'xo-optimistic': 'On xo-click: set these fields (`field=value,field2={path}`) on the current item immediately, and undo them if the call fails.',
  'xo-refresh': 'On a button inside an <xo-view>: on click, fetch the view\'s data again (a "Try again" button after an error, or a refresh button).',
  'xo-param': 'On an <input> or <select>: set the view parameter of that name to its value. On other elements, on click, set a view parameter and refetch: `name=value`, `name+=n`, `name-=n`, or `name~=value` (toggle value / -value, for sorting).',
  'xo-open': 'Open the <xo-dialog> matched by this selector, for example `#add`.',
  'xo-close': 'Close the <xo-dialog> this element is in.',
  'xo-menu-trigger': 'On the button of <xo-menu> that opens it (the first button when none is marked).',
  'xo-consent-open': 'On any element: a click shows the <xo-consent> bar again (cookie settings).',
  'xo-tooltip': 'On any element: a short description shown on hover and focus (and hidden on Escape). It is a description, not the accessible name.',
  'xo-tab': 'On a section inside <xo-tabs>: the tab label. The section id is the tab key (its position when it has none).',
};
export const ELEMENT_DOCS = {
  'xo-view': ['Declare a screen: `get` names the GET operation to read. Children are bound to the result. Add `live` to apply server-sent updates.', [['get', 'A path ("/users") or operationId.'], ['live', 'Apply live updates from the event stream.'], ['url-params', 'Comma-separated param names kept in the page URL (shareable, survive reload and Back): `status,q,sort,offset`.']]],
  'xo-table': ['A table for the list in the enclosing <xo-view get>. Children become the actions cell of each row.', [['of', 'List field of the response (default `items`).'], ['columns', 'Comma-separated fields, optionally `field:Label`.'], ['sortable', 'Header buttons sort on the server through the `sort` query parameter.'], ['selectable', 'A checkbox per row and a select-all box; slot="bulk" children act on the ticked rows.'], ['filters', 'Comma-separated fields that get a search box above the table; typing sets the query parameter of the same name.'], ['page-size', 'Rows per page: sets `limit`, Previous/Next change `offset`. The response needs a `total`.'], ['cards', 'Draw each row as a card in a narrow pane (a theme does it; the table gets the class xo-cards). Cells carry data-label.'], ['title', 'The column that is the card title (default: the first).'], ['status', 'The column that is the status badge of the card (data-status).'], ['empty', 'Text shown when the list has no rows.'], ['page-sizes', 'Comma-separated rows-per-page choices: a select beside the pager (needs `page-size`).']]],
  'xo-form': ['A form generated from the request schema of an operation.', [['op', 'The operation to submit to.'], ['submit', 'Text of the submit button.']]],
  'xo-toast': ['Shows the message of the latest xo-error event on the page; hides on the next xo-done or after `timeout` seconds.', [['timeout', 'Seconds before it hides (default 6, 0 = until the next success).']]],
  'xo-router': ['A History-API router declared in markup: one <template xo-route> per route, optional <template xo-layout> shells. Links are intercepted, aria-current marks the active one. Guards and leave-vetoes are JavaScript (`router.guard`, `router.beforeNavigate`).', [['base', 'Path prefix the app lives under, for example `/admin`.'], ['base-links', 'A root-relative link such as `/users` inside the router means `/admin/users`, so the same screens mount under any base. `rel="external"` leaves the app.']]],
  'xo-tabs': ['Accessible tabs (@xoong/controls) from the sections that have xo-tab. Panels stay in the DOM, so form controls on other tabs still count; xo-reveal selects the tab of an invalid field.', [['value', 'Key of the selected tab (default: the first).'], ['label', 'Accessible name of the tab list.']]],
  'xo-menu': ['An action menu (@xoong/controls): a trigger button and items (buttons or links) with arrow keys, Home/End, type-ahead and Escape. Drawn in the top layer where the browser supports the Popover API. Items with a `value` make it a choice menu: `xo-menu-select` fires with the value.', [['label', 'Accessible name of the menu.'], ['value', 'The chosen value of a choice menu (the items that have a `value` attribute are radio items).']]],
  'xo-combobox': ['A form control (@xoong/controls) to pick from a list you can filter by typing. <option> children are the choices; `multiple` shows chips; the value is a string, or an array with `multiple`.', [['name', 'Form field path.'], ['multiple', 'Pick several values (chips).'], ['creatable', 'Allow a value that is not in the list.'], ['remote', 'Do not filter locally: listen to xo-search and set `el.options`.'], ['options-op', 'A GET operation whose list is the options (needs @xoong/data/view). With `option-value` and `option-label` (paths in each item, default id and name) and `p-<name>` parameters; a mutation of the list refreshes the options.'], ['option-value', 'With options-op: the path in each item that is the value (default `id`).'], ['option-label', 'With options-op: the path in each item that is the label (default `name`).'], ['placeholder', 'Hint text of the empty field.'], ['label', 'Accessible name when there is no <label>.']]],
  'xo-carousel': ['A row of slides you move through (@xoong/controls): cards, a banner, a gallery. The children are the slides; they sit in a scroll container with scroll snap, so swiping is native. WAI-ARIA carousel pattern, slides out of view are inert.', [['items', 'Slides visible at once (default 1; 1.15 lets the next peek). Also --xo-carousel-items in CSS.'], ['dots', 'A button per position; a slide with data-thumb="url" shows that picture instead.'], ['counter', 'Show "1 / 5".'], ['no-arrows', 'Hide the previous and next buttons.'], ['loop', 'Next at the end returns to the first slide.'], ['autoplay', 'Move on by itself every n milliseconds (pauses on hover and focus; off with reduced motion; adds a pause button).'], ['label', 'Accessible name of the carousel.']]],
  'xo-tags': ['A free-text tag input (@xoong/controls): type and press Enter or a comma to add a chip; Backspace removes the last. Value: an array of strings.', [['name', 'Form field path.'], ['label', 'Accessible name when there is no <label>.'], ['placeholder', 'Hint text of the empty field.']]],
  'xo-richtext': ['A rich text editor form control (@xoong/richtext): toolbar, headings, bold, italic, lists, quote, links. The value is sanitised HTML (p, h2, h3, strong, em, ul, ol, li, blockquote, br, a, img). `xo-pick-media` (cancelable) asks the app for an image.', [['name', 'Form field path.'], ['tools', 'Space-separated tools: undo redo style bold italic underline ul ol quote link image (h2 as a toggle).'], ['toolbar', '`full` or `compact` forces a toolbar size; by default the editor\'s own width decides (full from 580px).'], ['media', 'Show the image tool; it fires xo-pick-media.'], ['placeholder', 'Hint text of the empty editor.'], ['label', 'Accessible name of the editor.'], ['maxlength', 'Maximum number of text characters.']]],
  'xo-switch': ['One setting on or off (@xoong/controls, WAI-ARIA switch). A form control with a boolean value; the text inside is the visible label (`label.xo-switch-row`); `change` fires when the person toggles it.', [['name', 'Form field path.'], ['checked', 'Start on.'], ['label', 'Accessible name.'], ['size', '`sm` for the compact switch.'], ['busy', 'A save is running: aria-busy, clicks ignored.'], ['disabled', 'Not available.'], ['readonly', 'Shown but not changeable.']]],
  'xo-date': ['A date field with a calendar popover (@xoong/controls). The value is ISO `YYYY-MM-DD` (with `range`: `{ start, end }`); the field shows the locale format and accepts typing.', [['name', 'Form field path.'], ['label', 'Accessible name.'], ['min', 'Earliest date, `YYYY-MM-DD`.'], ['max', 'Latest date, `YYYY-MM-DD`.'], ['range', 'Pick a start and an end (Clear and Apply in the calendar).'], ['week-start', 'First day of the week, 1 = Monday ... 7 = Sunday (default: the locale).'], ['placeholder', 'Hint text of the empty field.']]],
  'xo-time': ['A time of day as two selects, hour and minute (@xoong/controls). The value is `HH:mm` or empty.', [['name', 'Form field path.'], ['label', 'Accessible name of the group.'], ['step', 'Minutes between choices (default 5).'], ['min', 'Earliest time, `HH:mm`.'], ['max', 'Latest time, `HH:mm`.']]],
  'xo-slider': ['A number on a track (@xoong/controls, a native range input). `input` while dragging, `change` on release.', [['name', 'Form field path.'], ['label', 'Accessible name.'], ['min', 'Lowest value (default 0).'], ['max', 'Highest value (default 100).'], ['step', 'Step (default 1).'], ['labels', 'Comma-separated names of the stops, read by screen readers (`Low,Medium,High`).']]],
  'xo-stepper': ['A number with minus and plus buttons (@xoong/controls); arrows change by step, Page by ten steps, the value is clamped.', [['name', 'Form field path.'], ['label', 'Accessible name.'], ['min', 'Lowest value.'], ['max', 'Highest value.'], ['step', 'Step (default 1).']]],
  'xo-password': ['A password field with a show/hide button (@xoong/controls).', [['name', 'Form field path.'], ['label', 'Accessible name.'], ['autocomplete', '`new-password` or `current-password`, for password managers.'], ['placeholder', 'Hint text of the empty field.']]],
  'xo-copy': ['A read-only value with a Copy button (@xoong/controls); fires `copied`.', [['value', 'The text to show and copy.'], ['label', 'Accessible name of the field.']]],
  'xo-image': ['An image that loads lazily, keeps its space (no layout jump), shows a placeholder while loading and a fallback on error (@xoong/controls). `data-state`: empty, loading, loaded, error.', [['src', 'The image URL (in an xo-view: `src="{cover.url}"`).'], ['alt', 'Required: the text for the image, or `alt=""` when it is decorative.'], ['width', 'Intrinsic width, reserves the space with height.'], ['height', 'Intrinsic height.'], ['ratio', 'Aspect ratio to reserve instead of width/height: `16/9`, `1.5`.'], ['fit', '`cover` (default) or `contain`.'], ['position', 'object-position, e.g. `top`.'], ['srcset', 'Responsive sources, passed to the img.'], ['sizes', 'Display sizes for srcset.'], ['priority', 'The image above the fold: loads at once with high priority (not lazy).'], ['loading', '`lazy` (default) or `eager`.'], ['fallback', 'A src to use once when the image fails.']]],
  'xo-theme-toggle': ['A button that switches between the light and the dark theme (@xoong/controls): sets `data-theme` on <html>, saves the choice, follows the system until chosen. Fires `xo-theme-change`.', [['storage', 'localStorage key (default `xoong-theme`).']]],
  'xo-accordion': ['A stack of native <details> as an accordion (@xoong/controls); `single` allows one open at a time; arrows move between summaries. Fires `xo-accordion-change`.', [['single', 'Only one section open at a time.']]],
  'xo-popover': ['A small panel opened by a button (@xoong/controls): Escape or an outside click closes it and the focus returns to the trigger. `xo-popover-open` / `xo-popover-close`.', [['anchor', 'Selector of the trigger (default: the element before it).'], ['label', 'Accessible name of the panel.'], ['open', 'Open at the start.']]],
  'xo-consent': ['A cookie consent bar that remembers the choice (@xoong/controls). The text inside is the message. Fires `xo-consent` with the choices.', [['categories', 'Comma-separated categories: `analytics,marketing`.'], ['storage', 'localStorage key (default `xoong-consent`).'], ['label', 'Accessible name of the bar.']]],
  'xo-file': ['A file field with a drop zone (@xoong/controls). The value is a File (an array with `multiple`). Refused files fire `xo-file-reject`.', [['name', 'Form field path.'], ['label', 'Accessible name.'], ['accept', 'Allowed types: `image/*`, `.pdf`.'], ['max-size', 'Largest file: bytes or `2MB`.'], ['multiple', 'Several files.'], ['hint', 'Text under the prompt.']]],
  'xo-command': ['A command palette (@xoong/controls): Ctrl/Cmd+K, type to filter, arrows, Enter. The children (links, buttons with `data-group`) are the commands. Fires `xo-command-run`.', [['shortcut', 'The key used with Ctrl/Cmd (default `k`).'], ['label', 'Accessible name of the dialog.']]],
  'xo-chart': ['A bar or line chart drawn from data, with a table of the same numbers (@xoong/controls).', [['type', '`bar` (default) or `line`.'], ['label', 'Accessible name of the chart.'], ['data', 'JSON: `[{"label":"Mon","value":12}]` or `[12, 18]`; or set `el.rows`.'], ['unit', 'Appended to values: `k`, `%`.'], ['heading', 'Label column of the table.'], ['value-heading', 'Value column of the table.']]],
  'xo-range-slider': ['A minimum and a maximum on one track (@xoong/controls): two native range inputs, thumbs cannot cross. The value is `[min, max]`; the attribute is `value="20,70"`.', [['name', 'Form field path.'], ['label', 'Accessible name of the group.'], ['min', 'Lowest value (default 0).'], ['max', 'Highest value (default 100).'], ['step', 'Step (default 1).'], ['min-label', 'Accessible name of the minimum thumb.'], ['max-label', 'Accessible name of the maximum thumb.']]],
  'xo-segmented': ['A group of buttons where one is chosen (@xoong/controls). The children `<button value>` are the segments; `aria-pressed` on each; arrows move the focus.', [['name', 'Form field path.'], ['label', 'Accessible name of the group.'], ['multiple', 'Each segment toggles on its own; the value is an array.'], ['clearable', 'A click on the chosen segment unchooses it.']]],
  'xo-split-button': ['A main action with a menu of related actions (@xoong/controls). The first child is the main button; the others are the menu items.', [['more', 'Accessible name of the arrow button (default "More options").']]],
  'xo-textarea': ['A textarea with a character counter and a thin progress bar toward `maxlength` (@xoong/controls); over the limit it is invalid and the text is kept.', [['name', 'Form field path.'], ['label', 'Accessible name.'], ['maxlength', 'Character limit.'], ['rows', 'Visible rows (default 3).'], ['placeholder', 'Hint text of the empty field.']]],
  'xo-stat': ['A KPI tile (@xoong/controls): label, value, a change against before and a sparkline from a series.', [['label', 'What is measured.'], ['value', 'The number as text (formatted by you).'], ['delta', 'Change in percent; positive shows an up arrow, negative a down arrow.'], ['delta-label', 'Text after the change, e.g. "vs last week".'], ['series', 'Comma-separated numbers for the sparkline.'], ['trend', '`down-is-good` when a fall is an improvement.']]],
  'xo-otp': ['One-time code: one box per digit (@xoong/controls); the value is the digit string; fires `complete` when all are filled. Paste splits across the boxes.', [['name', 'Form field path.'], ['label', 'Accessible name of the group.'], ['length', 'Number of digits (default 6).'], ['value', 'The start value.'], ['required', 'Must be filled.'], ['disabled', 'Not available.'], ['readonly', 'Shown but not changeable.']]],
  'xo-avatar': ['A round badge with initials from the name, or a picture (@xoong/controls); `aria-label` is the name and the status.', [['name', 'Full name (initials and accessible name).'], ['src', 'Picture URL; the initials stay when it fails.'], ['size', '`sm` or `lg`.'], ['status', '`ok`, `warn` or `muted`.']]],
  'xo-avatars': ['A stack of avatars with a +N badge for the rest (@xoong/controls); a list.', [['max', 'How many to show.'], ['label', 'Accessible name of the list.']]],
  'xo-progress': ['A progress bar (@xoong/controls); no `value` means indeterminate.', [['value', 'Current amount.'], ['max', 'Full amount (default 100).'], ['label', 'Accessible name.'], ['thin', 'The thin variant.']]],
  'xo-spinner': ['A loading spinner (@xoong/controls), `role=status`; `label=""` makes it decorative.', [['label', 'What is loading.'], ['size', '`md` or `lg`.']]],
  'xo-steps': ['Progress through a flow of steps (@xoong/controls): the children are the step titles; `aria-current=step` marks the current one; done steps show a check.', [['current', 'Index of the current step (from 0).'], ['label', 'Accessible name of the list.']]],
  'xo-inline-edit': ['Text you rename in place (@xoong/controls): select it or press the Rename button; Enter saves, Escape cancels. Fires `save` and `cancel`.', [['name', 'Form field path.'], ['value', 'The text.'], ['label', 'Accessible name of the Rename button.'], ['disabled', 'Not available.'], ['readonly', 'Not editable.']]],
  'xo-pager': ['Previous and Next (and the "1–12 of 48" text) for any list in the enclosing <xo-view>: a tile grid, a thread list. The same pager <xo-table page-size> draws.', [['page-size', 'Rows per page: sets `limit`; the buttons change `offset`. The response needs a `total`.'], ['page-sizes', 'Comma-separated rows-per-page choices.']]],
  'xo-dialog': ['A modal on the native <dialog>. Open it with xo-open, close it with xo-close or by submitting a form inside. With `heading` it is a titled modal: a header with the title and a Close button, the content as the body, and the elements marked `slot="footer"` as the footer.', [['heading', 'The title: makes it a titled modal (header, body, footer).'], ['size', '`sm`, `wide` or `full` (the default is 40rem).'], ['dismiss', 'Close it on a click outside the dialog.']]],
};

/** Every element and attribute name xoong defines (the lists of @xoong/core/syntax), for tools that explain or complete them. */
export const SYNTAX = {
  elements: [...XO_ELEMENTS, ...XO_UI_ELEMENTS, ...XO_CONTROL_ELEMENTS],
  attributes: [...XO_ATTRIBUTES, ...XO_UI_ATTRIBUTES, ...XO_CONTROL_ATTRIBUTES],
};

/**
 * Attributes whose value is one of a fixed set. Key: the attribute (`xo-confirm-kind`) or `element attribute` (`xo-dialog size`).
 * Editors offer the values (`valueSets` below, LSP completion); `xoong check` warns about any other (XO271), because the runtime
 * silently falls back to the default for a value it does not know.
 */
export const VALUE_SETS = {
  'xo-confirm-kind': ['danger', 'warning', 'info', 'success'],
  'xo-dialog size': ['sm', 'wide', 'full'],
  'xo-switch size': ['sm'],
  'xo-spinner size': ['md', 'lg'],
  'xo-avatar size': ['sm', 'lg'],
  'xo-avatar status': ['ok', 'warn', 'muted'],
  'xo-chart type': ['bar', 'line'],
  'xo-richtext toolbar': ['full', 'compact'],
  'xo-image loading': ['lazy', 'eager'],
};

/** The controls that are form fields (they extend XoControl): beside their own attributes they take the three of CONTROL_ATTRIBUTES. */
export const FORM_CONTROLS = ['xo-combobox', 'xo-tags', 'xo-richtext', 'xo-switch', 'xo-date', 'xo-time', 'xo-slider', 'xo-stepper', 'xo-password', 'xo-copy', 'xo-file', 'xo-range-slider', 'xo-segmented', 'xo-textarea', 'xo-otp', 'xo-inline-edit'];
const CONTROL_ATTRIBUTES = [['required', 'The field must be filled before the form can be sent.'], ['disabled', 'Not available: not editable, not sent with the form.'], ['readonly', 'Shown and sent, but not changeable.']];

/** The documented attributes of an element, as `[name, description]`: its own, and for a form control the shared ones. */
export function elementAttributes(tag) {
  const own = ELEMENT_DOCS[tag]?.[1] ?? [];
  if (!FORM_CONTROLS.includes(tag)) return own;
  const have = new Set(own.map(([name]) => name));
  return [...own, ...CONTROL_ATTRIBUTES.filter(([name]) => !have.has(name))];
}

/** The name of the value set an attribute of an element (or the attribute anywhere) takes, if it has one. */
export const valueSetOf = (tag, name) => (VALUE_SETS[`${tag} ${name}`] ? `${tag}-${name}` : VALUE_SETS[name] ? name : undefined);

/**
 * What an element or attribute is, from the same descriptions the editors show, for the MCP server's explain_syntax.
 * @param {string} input "xo-dialog", "<xo-dialog>", "xo-then", "xo-dialog size" (also "xo-dialog/size" and "xo-dialog.size")
 * @returns {{ found: true, text: string } | { found: false, suggestions: string[] }}
 */
export function explainSyntax(input) {
  const [first = '', second] = String(input ?? '').trim().split(/[\s/.]+/).filter(Boolean).map((x) => x.replace(/^<|>$/g, ''));
  const valuesOf = (tag, name) => VALUE_SETS[`${tag} ${name}`] ?? VALUE_SETS[name];
  const describe = (label, doc, values) => ({ found: /** @type {const} */ (true), text: `${label}: ${doc}${values ? `\nValues: ${values.join(', ')}.` : ''}` });
  if (SYNTAX.elements.includes(first)) {
    const attributes = elementAttributes(first);
    if (!second) {
      const lines = attributes.map(([n, d]) => `  ${n}${valuesOf(first, n) ? ` (${valuesOf(first, n)?.join(' | ')})` : ''}: ${d}`);
      return { found: true, text: `<${first}>: ${ELEMENT_DOCS[first]?.[0] ?? first}${lines.length ? `\nAttributes:\n${lines.join('\n')}` : ''}` };
    }
    const own = attributes.find(([n]) => n === second);
    if (own) return describe(`<${first} ${second}>`, own[1], valuesOf(first, second));
    if (SYNTAX.attributes.includes(second)) return describe(second, ATTRIBUTE_DOCS[second], valuesOf('', second));
    const near = nearest(second, attributes.map(([n]) => n));
    return { found: false, suggestions: near ? [`${first} ${near}`] : attributes.slice(0, 8).map(([n]) => `${first} ${n}`) };
  }
  if (SYNTAX.attributes.includes(first)) return describe(first, ATTRIBUTE_DOCS[first], valuesOf('', first));
  if (/^p-[\w-]+$/.test(first)) return describe(first, `the value of the path parameter "${first.slice(2)}" of the <xo-view get> operation (p-id="42"; p-id="?id" reads ?id= from the page URL; p-id=":id" reads a route parameter).`);
  const near = first.startsWith('xo-') ? nearest(first, [...SYNTAX.elements, ...SYNTAX.attributes]) : undefined; // a word that is not xo-something is not a typo of one
  return { found: false, suggestions: near ? [near] : [] };
}

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
    tags: SYNTAX.elements.map((name) => {
      const description = ELEMENT_DOCS[name]?.[0] ?? name;
      const attributes = elementAttributes(name).map(([n, d]) => ({ name: n, description: d, ...(n === 'get' ? { valueSet: 'xo-reads' } : n === 'op' ? { valueSet: 'xo-mutations' } : valueSetOf(name, n) ? { valueSet: valueSetOf(name, n) } : {}) }));
      if (name === 'xo-view') for (const p of params) attributes.push({ name: `p-${p}`, description: `Value of the path parameter "${p}" for the view's operation.` });
      return { name, description, attributes };
    }),
    globalAttributes: SYNTAX.attributes.map((name) => ({
      name, description: ATTRIBUTE_DOCS[name] ?? name,
      ...(name === 'xo-click' || name === 'xo-submit' ? { valueSet: 'xo-mutations' } : valueSetOf('', name) ? { valueSet: name } : {}),
    })),
    valueSets: [{ name: 'xo-mutations', values: mutations }, { name: 'xo-reads', values: reads }, ...Object.entries(VALUE_SETS).map(([key, list]) => ({ name: key.replace(' ', '-'), values: list.map((value) => ({ name: value })) }))],
  };
}
