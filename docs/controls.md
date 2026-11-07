# Controls (`@xoong/controls`)

Accessible controls that every admin and form needs, as custom elements in the Light DOM with plain CSS. The package has no dependency except
`@xoong/core`, so it can be used with or without `@xoong/ui`. What is business-specific (media pickers, block editors, a language switcher with
badges) is built by the application on top of these and on `XoControl`.

```js
import '@xoong/controls';   // registers every element; or import one: '@xoong/controls/tabs'
```
```html
<link rel="stylesheet" href="/@xoong/controls/controls.css">  <!-- optional; one @layer, uses the --xo-* tokens of @xoong/ui with fallbacks -->
```

## `<xo-tabs>`

```html
<xo-tabs label="Article" value="seo">
  <section xo-tab="General">...</section>
  <section xo-tab="SEO" id="seo">...</section>
</xo-tabs>
```

The WAI-ARIA tabs pattern with automatic activation: Left and Right (wrapping), Home and End move and select; only the selected tab is in the tab order.
`xo-tab` is the label, the section `id` is the key (its position without one); `value` selects, `tabs.select(key)` too; `xo-tab-change` fires with `{ value }`.

Panels are hidden, not removed, so their form controls stay in the form. In a `<form xo-submit>`, when a field on another tab is invalid, the form fires
`xo-reveal` and the tab that holds the field is selected before the focus moves there. A tab whose panel has an `aria-invalid="true"` control gets `data-invalid`.

## `<xo-menu>` and `xo-tooltip`

```html
<xo-menu label="Row actions">
  <button xo-menu-trigger>Actions</button>
  <button xo-click="POST /users/{id}/disable">Disable</button>
  <a href="/users/{id}">Open</a>
</xo-menu>

<button xo-tooltip="Save the draft" aria-label="Save">&#128190;</button>
```

The menu button pattern: click, Enter, Space or ArrowDown opens (ArrowUp opens on the last item); arrows wrap, Home and End jump, a letter jumps to the next
item that starts with it, Escape closes (wherever the focus is) and returns to the trigger, Tab closes. Choosing an item closes the menu and runs the item as it is
(`xo-click`, a link, a handler). The list is drawn in the **top layer** when the browser has the Popover API, so a table cell or a scroll area never clips it; the
position is set through the CSS object model, which a strict CSP allows. `xo-menu-open` and `xo-menu-close` fire on the element.

`xo-tooltip` shows a short description after a delay on hover and at once on keyboard focus; it hides on leave, blur, Escape or a press, and the pointer may move onto it
(WCAG 1.4.13). It sets `aria-describedby` while shown. It is a description, not the accessible name: an icon-only button still needs `aria-label`.

## `<xo-combobox>` and `<xo-tags>`

```html
<xo-combobox name="author" label="Author" placeholder="Choose">
  <option value="1">Ada Lovelace</option>
  <option value="2">Grace Hopper</option>
</xo-combobox>
<xo-combobox name="topics" multiple>...</xo-combobox>
<xo-tags name="keywords" placeholder="Add a keyword"></xo-tags>
```

Both are `XoControl`s: they have `name`, `required`, `disabled`, `value`, validity, `dirty` and `touched`, and they work in `<form xo-submit>` like a native field. The value is a
string, or an array of strings with `multiple` and for `<xo-tags>`.

* **Options:** `<option>` children (`selected` sets the start value), or `el.options = ['a', { value: 'b', label: 'B', disabled: true }]`, or the field's schema: `enum` for a single
  choice, an array of an `enum` for several.
* **`creatable`** lets the person add a value that is not in the list. **`remote`** leaves the filtering to you: listen to `xo-search` (`detail.query`) and set `el.options`.
* **Keys:** ArrowDown and ArrowUp open and move (the focus stays in the input, `aria-activedescendant` follows), Enter picks, Escape closes, Backspace on an empty field removes the
  last chip; in `<xo-tags>` Enter or a comma adds the typed text and leaving the field commits it. Enter never submits the form while the list is open.
* The inner field's own `input` and `change` events do not leave the control; the control fires its own, like any `XoControl`.
* Style `.xo-chip`, `.xo-combobox-list [role=option]`, `.xo-active`.

### In a generated form

The `<xo-form>` generator draws a control for any node with a `widget` hint that is a tag name, and gives it its `schema`, `hints` and the form model. For an array or object node
the control replaces the row editor:

```json
{ "fields": { "Page.topics": { "widget": "xo-combobox" }, "Page.keywords": { "widget": "xo-tags" }, "Page.role": { "widget": "xo-combobox" } } }
```

or `x-xoong-widget: xo-tags` in the OpenAPI document.

## Languages

Strings (`Remove {label}`, `No results`, `Add "{value}"`) are `xoong.controls.*` keys of the built-in catalog (Vietnamese included).
