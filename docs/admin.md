# Admin set (`@xoong/ui`)

Status: 0.5, first version. Everything here is **Draft** like the rest of the HTML syntax.

An admin area is built from four things, all declarations:

| Piece | What it does |
|---|---|
| `xoong.css` | Design tokens (custom properties in `@layer xoong.tokens`), base styles, the admin layout and the look of the elements below. Plain CSS; override tokens on `:root`. |
| `<xo-table>` | A table for a list: columns, server-side sorting, server-side paging, row actions. |
| `<xo-form>` | A form generated from the request schema of an operation, with server field errors. |
| `<xo-dialog>` | A modal on the native `<dialog>`; with `heading` a titled window (header, body, `slot="footer"` footer; `size`, `dismiss`). |
| `<xo-toast>` | Shows the message of the latest `xo-error` on the page. |

```html
<link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
<script type="module">import '@xoong/ui'</script>

<body class="xo-admin">
  <header>…</header> <nav>…</nav>
  <main>
    <button xo-open="#add">Add a person</button>
    <xo-view live get="/users">
      <xo-table columns="name,email:E-mail,role" sortable page-size="25">
        <button xo-click="DELETE /users/{id}">Delete</button>
      </xo-table>
    </xo-view>
    <xo-dialog id="add">
      <xo-view><xo-form op="POST /users" submit="Add"></xo-form></xo-view>
      <button xo-close>Cancel</button>
    </xo-dialog>
  </main>
</body>
```

[`examples/admin`](../examples/admin) is this page, running against a fake backend and tested in a real
browser. Its application script is only `configure()`.

## List state, tabs and bulk actions

* `<xo-view url-params="status,q,sort,offset">` keeps those params in the page URL (a click on a tab or a page adds a history entry, typing replaces it; reload,
  Back and a shared link restore them). Filter boxes show the current value. With a router the query is written through it without rendering the route again.
* A button with `xo-param="status=draft"` gets `aria-current="true"` while that is the current value; `status=` matches "unset" (an "All" tab).
* `xo-selected="ids"` on a bulk button sends **one** request with the ticked ids (as the API knows them: numbers stay numbers) plus `xo-with="status=published"` fields typed from the
  schema; bare `xo-selected` runs once per row. `$selected` is the list of ticked rows (`xo-body="$selected"`).
* `xo-then="/articles/{id}"` on an xo-click or xo-submit goes to that path after success: `{id}` comes from the result (the created record), then from the item acted on (`xo-then="/articles"` after a delete). `<xo-router>` navigates; without a router the browser loads the path.
* `xo-confirm="Delete {title}?"` asks first in a native dialog (`confirm()` from `@xoong/ui` replaces the browser's, labels in `confirmLabels`); `xo-confirm-title`, `xo-confirm-ok`, `xo-confirm-cancel` and `xo-confirm-kind` (`danger`, `warning`, `info`, `success`) tune it. `xo-notice="Saved"` raises a toast
  after success; from JavaScript `toast.show({ message, action: { label: 'Undo', run } })`.
* Table: `empty="..."` or a `<template slot="empty">`, `filters="q:Search"`, `page-sizes="10,25,50"`, "1–3 of 5" text, and a column format `publishedAt:Published:datetime`
  (date, datetime, time, relative, number, localized); the same formats work anywhere as `{publishedAt | datetime}`.

## Router: `<xo-router>`

Decision and reasons: [ADR-0008](decisions/0008-spa-router.md). For an admin use SPA routing; public pages stay one HTML file per page.
One `<template>` per route, inert until it matches (views inside it do not fetch before then), optional layouts that stay while only the
content changes:

```html
<xo-router base="/admin" base-links>
  <template xo-layout="shell"><nav><a href="/users">Users</a></nav><main xo-outlet></main></template>
  <template xo-route="/" layout="shell" title="Home">...</template>
  <template xo-route="/users/:id" layout="shell" title="User"><xo-view get="getUser" p-id=":id">...</xo-view></template>
  <template xo-route="/login">...</template>
  <template xo-route="*">Not found</template>
</xo-router>
```

With `base-links`, a root-relative link inside the router (`href="/users"`) is relative to the base, like the `xo-route` paths: the same screens mount under `/admin` or `/admin-next` without editing a link, and the address shown on hover and opened in a new tab is the real one (`/admin/users`). A link that already starts with the base, one with `rel="external"` or a `target`, is left as written (use `rel="external"` to leave the app: `/logout`). Without `base-links` links are as written, so write the base in them.

* **Routes.** `xo-route="/users/:id"` (static segments beat `:param` beats `*`). `title` sets `document.title`. `layout` names an
  `xo-layout` template (layouts nest with `layout=` on a layout). Inside the route, `p-id=":id"` hands the path parameter to a view
  (`p-id="?id"` still reads the query string).
* **Links.** Same-origin links inside `base` are intercepted and use `pushState`. The router never touches modified clicks, other
  mouse buttons, `target`, `download`, `rel="external"`, links to other origins or outside `base`, and in-page anchors. The link to the
  current page gets `aria-current="page"`; a link to a section above it gets `aria-current="true"`.
* **Navigation.** After each navigation the new content gets focus (`xo-outlet` becomes focusable) and the page scrolls to the top, like a page
  load. Not for the first render. `xo-navigate` bubbles with `{ to, from }`.
* **JavaScript.** `router.navigate(path, { replace })`, `router.current` (`path`, `params`, `query`, `url`, `route`),
  `router.guard((to, from) => true | false | '/redirect')`, `router.beforeNavigate((to, from, type) => false)` to veto leaving
  (type: `link`, `api`, `popstate`). Both return a function that removes them. Redirect loops stop after 10 with an error.
* **401 to login.** `configure({ onUnauthorized: () => router.navigate('/login') })` plus a guard for pages that need a session.
* **Unsaved changes.** `router.beforeNavigate(() => !form.dirty || confirm('Leave without saving?'))`. A vetoed Back/Forward cannot be
  prevented by the browser, so the router cancels it the way Vue Router does: each entry carries its position in `history.state`, and
  a veto runs `history.go(-delta)`, which leaves the history (forward entries included) as it was. Closing the tab is `beforeunload`,
  which is yours to handle.
* **Behaviour borrowed from Vue Router and React Router:** going to the URL you are already on is a no-op (`navigate` resolves
  `false`); a hash-only change does not re-render, it scrolls to the element with that id; Back/Forward restores the scroll position
  of the entry you return to (the router sets `history.scrollRestoration = "manual"`), a new navigation starts at the top or at the
  anchor; a malformed escape in the URL (`%zz`) is kept raw instead of throwing; a navigation started by a newer click wins over a
  pending one.
* **Hosting.** The server must answer every path under `base` with the app's HTML (`xoong dev --spa`, `"spa": true`).
* **SEO and prerendering.** Yes, a site that needs search engines can use the router: prerender every public URL to a static file, and the
  router takes over in the browser. `xoong render index.html --api http://backend --url /users/7 --out dist/users/7/index.html` renders the
  route of that URL with its data (JavaScript: `renderPage(html, { url })`); the output has the route's content, `<title>` (route
  `title`) and `<meta name="description">` (route `description`). With JavaScript on, the router replaces the prerendered content with
  the same page, so there is no flicker and no hydration mismatch. Limits, stated plainly: this is **prerendering at build time**, not
  request-time SSR, so the data is as fresh as the last render; you list the URLs yourself (no sitemap generation); only title and
  description are managed per route; the server must serve the right file per path. For a public site with few, mostly static pages,
  one HTML file per page (no router) is simpler and equally indexable.
* **Checks.** `xoong check`: XO260 (route path), XO261 (undeclared layout), XO262 (layout without `xo-outlet`), XO263 (route parameter).
* Not done: nested routers, route-level data loading hooks, per-route code splitting, relative paths in `navigate()` (paths are absolute under `base`).

## Custom controls: `XoControl`

`XoControl` (in `@xoong/core`) is the base class for controls that behave like native inputs: a rich text editor, a combobox, a
tag input, your own image field. A control built on it submits its value in `FormData`, takes part in the form's constraint
validation (`required`, `setCustomValidity`, `checkValidity`, `reportValidity`, blocking an invalid submit), resets with the form,
is disabled by a disabled `<fieldset>`, and exposes the same state as signals everywhere: `value`, `dirty`, `pristine`, `touched`,
`valid`. The host also carries `data-dirty`, `data-touched` and `data-invalid` for CSS. Override `render()`, call `userInput(value)`
when the person changes the value, and optionally `validate(value)` (return a message, `''` when fine), `serialize(value)` (what the
form submits) and `isEmpty(value)` (what `required` means for it). Where `ElementInternals` is missing (happy-dom) it keeps its own
model; real behaviour is tested in Chromium (`packages/core/test/control.test.mjs`).

## `<xo-table>`

Must be inside an `<xo-view get>`. It expands into an ordinary `<table class="xo-table">` (Light DOM; your CSS and
tests see plain markup).

* `of="items"`: the list field of the response (default `items`).
* `columns="name,email:E-mail"`: fields, with an optional label after a colon.
* Children become the last cell of every row (usually `xo-click` buttons).
* `filters="name,status"`: a search box per field above the table. Typing (after a short pause) sets the query parameter of the same name; clearing it removes the parameter; the table returns to page one.
* A child with `slot="field"` replaces that column's cell with the child itself, bound to the row: `<span slot="status" class="badge" data-status="{status}">{status}</span>`.
* `selectable`: a checkbox per row and a select-all checkbox in the header (both are plain `<input type="checkbox" xo-select>`).
  While rows are ticked, children with `slot="bulk"` appear above the table with a count (`$selectedCount`). Give a bulk button
  `xo-selected` and it runs its operation **once per ticked row**, one after another, with the params taken from each row:
  `<button slot="bulk" xo-click="DELETE /users/{id}" xo-selected>Delete ticked</button>`. The first failure stops the rest and keeps the
  selection (the error arrives as `xo-error`); success clears it. The selection is dropped whenever sort, page or filter changes.
  This needs no bulk endpoint on the backend. Rows must be entities (an `id` in the OpenAPI schema).
* `sortable`: header buttons set the query parameter `sort` to `field`, then `-field`, then `field` again. The
  server sorts.
* `page-size="25"`: sets `limit`, and Previous/Next change `offset`. Next is shown only while
  `offset + limit < total`, so the response needs a numeric `total`. Changing the sort goes back to the first page.
* The operation must declare `sort`, `limit` and `offset` as query parameters. `xoong check` reports a table that
  asks for something its operation does not offer (XO250), or a table outside `<xo-view get>` (XO251).

Other children (typically buttons) form the actions cell. For layouts the table cannot express, write the table by hand with `xo-each`; it composes with everything else.

### Narrow panes: `cards`

`<xo-table cards>` asks the theme to draw each row as a card when the table's own box is narrow (a container query, not the screen). The table only provides the hooks: the frame gets the class `xo-cards`, every `td` has `data-label` (the column label, also handy in tests), the first column (or `title="field"`) is the card title (`data-title`) and `status="field"` marks the status cell (`data-status`); the select and actions cells are recognised by their own markup. The Mist skin in `design/brand-kit/css/mist.css` is an example.

## Forms: `<form xo-submit>` and `<xo-form>`

Design and reasons: [ADR-0009](decisions/0009-forms-from-the-api-schema.md). Short version: a **model** (a typed draft of the record, the baseline it came
from, state per path) with the DOM as a view; the rules come from the OpenAPI **request schema** (`bodySchema` in `operations.json`).

```html
<xo-view get="getArticle" p-id=":id">
  <form xo-submit="updateArticle">
    <label>Slug <input name="slug"></label>              <!-- type, required, pattern, maxlength: from the schema -->
    <label>Title <input name="title.en"></label>         <!-- nested path -->
    <label>Publish <input name="publishedAt"></label>    <!-- date-time: a datetime-local control; the ISO string is kept until the person edits it -->
    <p xo-if="$form.dirty">Unsaved changes</p>
    <button>Save</button>
  </form>
</xo-view>
```

* **Binding by `name`** (`a.b`, `items[0].x`; `items.0.x` is the same). Attributes the author did not write are completed from the schema
  (`type`, `required`, `min`/`max`/`step`, `minlength`/`maxlength`, `pattern`, enum options); the author's attributes win. Any `XoControl` with a
  `name` is a field too; it receives `schema`, `hints` (every hint key, unknown ones included) and `xoForm` (the model, to read other paths).
  Several `<input type="checkbox" name="roles" value="admin">` with one name over an array node bind to membership in the array (checked = the value is in it). A native reset
  button or `form.reset()` brings the model and the controls back to the baseline together.
* **Prefill.** An *edit* form (the operation has path parameters, is a `PUT` or `PATCH`, or `xo-body="path"` names a record) starts from the record of its view; a *create*
  form starts from the schema's defaults and empties after success (`xo-keep` keeps the values). After an edit succeeds the saved record is the new baseline when the server answers with it
  (an object sharing a property with the request schema); any other answer (`{ ok: true }`, `{}`, nothing) leaves what was typed as the baseline.
  If the record changes underneath (a live update) a pristine form follows it; a dirty form keeps its draft and `$form.stale` becomes true.
* **Validation** is the model's, not the browser's: the form gets `novalidate`, so a hidden or off-screen invalid control can never block submit. Rules from the
  schema: required, type, min/max and exclusive bounds, multipleOf, minLength/maxLength, pattern, format (email, uri, uuid, date, date-time), enum,
  minItems/maxItems/uniqueItems. Messages are a replaceable catalogue (`setMessages` from `@xoong/forms`). Errors show once the field has been left
  (or after submit), with `aria-invalid`, `aria-describedby` and a `<small class="xo-error">`; they update live while the field has an error.
* **Custom rules** are plain functions by path on the form element, async allowed (`$form.pending`):
  `form.rules = { slug: (v, { record }) => '' | 'message', 'items[].title': (v) => ..., '*': (record) => ({ 'a.b': 'message' }) }`.
  The schema error of a path wins over a custom one; a throwing rule becomes an error, not a crash.
* **State** in markup and JavaScript: `$form.dirty`, `valid`, `submitting`, `pending`, `stale`, and per path `$form.errors['title.vi']`,
  `$form.touched[...]`, `$form.filled[...]`, `$form.dirtyAt[...]` (a tab can show a "missing translation" dot). The model is `form.model` (`field(path)`,
  `set`, `body()`, `reset()`, `markPristine()`, `validate()`); per-path signals wake only that path's readers (tested with 800 fields).
* **Payload.** Only properties of the request schema are sent (ids and timestamps of the record never go out); empty optional values follow `emptyAs`
  (omit by default, `null` when asked); `pruneEmpty` on an object schema drops empty members and an object left empty follows its own `emptyAs`;
  `form.serialize = (draft, body) => body` is the escape hatch. Dirty uses the same normalisation, so typing and deleting is pristine again.
  A field hidden with `xo-if`, or disabled (`disabled="{$form.submitting}"` is common), stays in the draft and is sent: drop it in `form.serialize` (recipe on the Recipes page).
* **Submit.** Touch all, validate (async rules included), and when invalid nothing is sent: a cancelable `xo-reveal` `{ path }` lets the
  application show the field (switch a tab) before it is focused, then `xo-invalid` fires. Server field errors (problem+json pointers, FastAPI, envelopes) land on the same paths and
  clear when the field is edited.
* **Lists.** `xo-array-change` bubbles from the form when an array gains, loses or reorders an item (the add, remove and move buttons, a drag, or `model.append`, `removeAt`, `moveItem`): `detail: { path, op: 'add' | 'remove' | 'move', from, to }`. A UI that keeps a selected row follows it; `model.onArrayChange(fn)` is the same for code.
* **Hints** for presentation (`xoong.hints.json`, `fields["Schema.property"]`): `label`, `hint`, `placeholder`, `widget` (a built-in name or the tag of an `XoControl`),
  `order`, `readOnly`, `hidden`, `group`, `emptyAs`, `pruneEmpty`; any other key is passed through to the widget (`schema.hints`). The same can be written **in the OpenAPI document**
  on any node, inline objects included: `x-xoong-widget`, `x-xoong-prune-empty: true`, `x-xoong-empty-as: "null"`; every other `x-*` extension (for example `x-rainlet-localized`)
  reaches custom widgets untouched in `schema.hints`.
* **Writing a widget (an `XoControl`).** Call `this.userInput(value)` when the person changes it: the value is set and `input` fires, and the form model takes it.
  Setting `control.value` or `setValue()` from code does not change the model (as with a native input). In `connectedCallback` the `xoForm` property and the value may not be
  set yet: read the model (`xoForm.get(path)`, `xoForm.field(path).value`), not the control, to decide things such as "follow another field until edited".
* **Width.** Generated forms are capped at `--xo-form-max-width` (28rem by default, a token like the others: `:root { --xo-form-max-width: none }` for editors that use the whole width).
  Tables, views and dialogs have no fixed width on the content area.
* **Leaving.** A dirty form makes the router ask first (`xo-guard="off"` disables, other text is the question); closing the tab uses `beforeunload`.
  What the person sees: importing `@xoong/ui` installs a native modal `<dialog class="xo-confirm">` (message, Cancel, Confirm; Escape answers no; focus starts on Cancel;
  texts in `confirmLabels` or the `xoong.confirm.*` catalog keys; style `.xo-confirm`). Without `@xoong/ui` (only the router module) the browser's own `confirm()` is used,
  which headless browsers dismiss silently. To use **your own dialog**, for this question and for `xo-confirm`: `setConfirm(async (message, context) => ...)` (from `@xoong/ui`
  or `@xoong/data/view`); resolve to `true` to go on. `context` is `{ kind: 'leave', forms }` for the leave question and `{ kind: 'action', element }` for `xo-confirm`.
* **Built-in dialogs from JavaScript** (`import { confirm, alert, prompt, ask } from '@xoong/ui'`): `await confirm(message, { kind, title, detail, ok, cancel })` is true or false;
  `await alert(message, { kind, title })` resolves when closed; `await prompt(message, { value, label, type, required, pattern })` is the text or `null`; `await ask(message, { buttons: [{ label, value, primary, danger, cancel }] })` is the pressed button's `value`.
  `kind` (`info`, `success`, `warning`, `danger`) adds an icon and the colour. All are native modal dialogs; the guide with live examples is the "Dialogs and modals" page of the site.
* **Arrays, objects and unions in a hand-written form** (the form's scope is its draft): `<div xo-each="blocks">` over the array with `name="blocks[{$index}].title.en"` (inside a nested
  array use `{$i0}` for the outer row, `{$i1}` for the next), `xo-add="blocks" xo-with="type=image"` (a union item needs its tag), `xo-remove="blocks[{$index}]"`,
  `xo-move="blocks[{$index}]:up"` (or `:down`), and `xo-if="type=image"` to show the fields of one variant (`path=value` and `path!=value` compare with a literal).
  Rows are plain buttons, so everything is keyboard accessible. Touched state follows an item that moves; errors, server errors and rules recompute for the new positions.
  The focus does not get lost: after Move up or Move down it stays on the same button of the row that now holds the item; after Remove it goes to the same button of the row now at that
  position, else the previous row, else the list's add button. For the pointer, a handle with `xo-drag="blocks[{$index}]"` inside the row (the generated form draws one, `.xo-handle`) drags the row onto another
  row of the same list (`.xo-dragging` and `.xo-drop` mark the source and the target); the buttons stay for keyboards and touch.
* **`<xo-form op="...">`** writes that markup for you from the request schema (`bodySchema`): labelled controls, enums as selects, booleans as checkboxes, formats choosing the input type, nested objects as
  fieldsets, arrays as rows with add/remove/up/down buttons, unions as one "Add <variant>" button each with the fields of the row's variant. Hints change it: `order`, `group` (a fieldset with
  a legend), `widget` (textarea, password, url, email, color, date, datetime, select, or the tag of any `XoControl`), `hidden` (kept in the model and sent, not drawn), `readOnly` (not drawn, not sent), `label`/`hint`.
  The same binder does the rest. An operation without a request schema (a multipart body) gets the flat generator, and `xoong check` XO255 warns when it cannot draw a required nested field.

## `<xo-dialog>`

Wraps its content in a native `<dialog>` the first time it is connected.

* `xo-open="#id"` on any element opens the dialog (as a modal).
* `xo-close` on any element inside closes it.
* It closes when a form inside succeeds (`xo-done` bubbles up).
* Escape, focus trap and backdrop are the browser's. Style `xo-dialog > dialog::backdrop` as usual.

## `<xo-toast>`

`<xo-toast timeout="8"></xo-toast>` once in the layout: shows the message of the latest `xo-error` (any view, any button), hides on the
next `xo-done` or after `timeout` seconds (default 6, `0` = until the next success). It is a `<p class="xo-toast" role="alert">`; style it as you like.
Without it, a failed `xo-click` (a Delete that is refused) is silent unless you listen for `xo-error` yourself.

## `xo-param`

A small addition to `<xo-view>` that the table is built on, also usable by hand for filters:
`<button xo-param="status=disabled">Disabled</button>` sets the view's `status` param and refetches. On an `<input>` or `<select>`, `xo-param="status"` sets the param to the control's value as it changes (empty removes it).
Forms: `k=v`, `k+=n`, `k-=n` (never below 0), `k~=v` (toggle `v` and `-v`). Changing any param other than `offset`
resets `offset` to 0. `{path}` in the value is resolved from the current item. `$hasPrev` and `$hasNext` are
available inside the view.

## Extending

`@xoong/ui` is built on `defineTemplate(tag, (el, { host, client }) => Node)` from `@xoong/data/view`: a function
that turns an element into plain markup, which is then bound like hand-written markup. Your own components can use
the same hook; keep them plain, one way to do each thing.

## Not done yet

Inline editing, a single bulk request for many ids, form fields for nested objects and arrays (write that form by hand),
column filters other than text, tabs. They are tracked as issues for milestone 0.5.
