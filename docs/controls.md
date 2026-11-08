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

**A choice menu** (a palette, a sort order, a language): give the items a `value` and the menu a `value`. The items become `menuitemradio` with `aria-checked` (a check mark in the default style), choosing one sets the menu's `value` (an attribute, so CSS can read it, and you can set it from a saved preference) and fires `xo-menu-select` with `{ value }`; choosing the current one fires nothing.

```html
<xo-menu label="Palette" value="calm">
  <button xo-menu-trigger>Palette</button>
  <button value="calm">Calm</button><button value="ember">Ember</button>
</xo-menu>
```

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

## Building elements for your own package

The pieces a package of widgets (a media library, a block editor) usually needs:

* **Children are not there yet.** The parser connects an element before its children exist. `await this.ready()` in `connected()` resolves when they can be read (at once for an element made after load).
* **Props are attribute to property.** Setting `el.value = x` changes the signal, not the attribute; call `setAttribute('value', x)` when CSS or a test should see it (the controls here do).
* **Dynamic style under a strict CSP.** `style="..."` is blocked, so a template binds the CSS object model: `html\`<div style:--x=${() => v.value} style:width=${() => w.value}></div>\`` (a `null` removes the property). Write property names in lower case.
* **A dialog that returns a result.** `const answer = await dialog.open()` resolves when it closes, with the `returnValue`: `<button xo-close value="done">`, `dialog.close('done')`, or an empty string for Escape and Cancel.
* **The form model.** `form.model` exists once the binder attached; the form fires `xo-form-ready` (`detail: { model }`) at that moment, and a child control that needs the model listens for it (and reads `form.model` if it connected later).
* **Words of your package.** Ship `text('rainlet.crop.title', 'Crop')` in the code (the English default needs nothing else), and register translations under your own prefix with `addMessages('vi', { 'rainlet.crop.title': 'Cắt ảnh' })` from `@xoong/i18n`; `xoong i18n extract` lists the keys.
* **Tooling.** `xoong check` and the editor data know the `xo-*` syntax. Elements of other prefixes (`rl-*`) are left alone: no false errors, and no completion for them yet.

## Languages

Strings (`Remove {label}`, `No results`, `Add "{value}"`) are `xoong.controls.*` keys of the built-in catalog (Vietnamese included).
