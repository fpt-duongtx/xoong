# Admin set (`@xoong/ui`)

Status: 0.5, first version. Everything here is **Draft** like the rest of the HTML syntax.

An admin area is built from four things, all declarations:

| Piece | What it does |
|---|---|
| `xoong.css` | Design tokens (custom properties in `@layer xoong.tokens`), base styles, the admin layout and the look of the elements below. Plain CSS; override tokens on `:root`. |
| `<xo-table>` | A table for a list: columns, server-side sorting, server-side paging, row actions. |
| `<xo-form>` | A form generated from the request schema of an operation, with server field errors. |
| `<xo-dialog>` | A modal on the native `<dialog>`. |
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

## `<xo-table>`

Must be inside an `<xo-view get>`. It expands into an ordinary `<table class="xo-table">` (Light DOM; your CSS and
tests see plain markup).

* `of="items"`: the list field of the response (default `items`).
* `columns="name,email:E-mail"`: fields, with an optional label after a colon.
* Children become the last cell of every row (usually `xo-click` buttons).
* `filters="name,status"`: a search box per field above the table. Typing (after a short pause) sets the query parameter of the same name; clearing it removes the parameter; the table returns to page one.
* A child with `slot="field"` replaces that column's cell with the child itself, bound to the row: `<span slot="status" class="badge" data-status="{status}">{status}</span>`.
* `sortable`: header buttons set the query parameter `sort` to `field`, then `-field`, then `field` again. The
  server sorts.
* `page-size="25"`: sets `limit`, and Previous/Next change `offset`. Next is shown only while
  `offset + limit < total`, so the response needs a numeric `total`. Changing the sort goes back to the first page.
* The operation must declare `sort`, `limit` and `offset` as query parameters. `xoong check` reports a table that
  asks for something its operation does not offer (XO250), or a table outside `<xo-view get>` (XO251).

Other children (typically buttons) form the actions cell. For layouts the table cannot express, write the table by hand with `xo-each`; it composes with everything else.

## `<xo-form>`

`op` is any operation with a JSON or multipart request body made of simple fields. Generated from `bodyFields`, which
`xoong sync` writes into `operations.json`:

| Schema | Control |
|---|---|
| `string` | `text`; `format: email`, `password`, `date`, `date-time`, `uri` choose the input type; `maxLength` sets `maxlength` |
| `integer`, `number` | `number` |
| `boolean` | checkbox |
| `string` + `format: binary` | file input (multipart operations; an empty file input is left out) |
| `enum` | `<select>` (with a blank choice when optional) |
| `required` | `required` attribute |

Nested objects, arrays and read-only properties are not generated; `xoong check` warns when nothing can be
generated (XO252), and you write that `<form xo-submit>` by hand. `submit="Add"` sets the button text.

Values are typed when sent: numbers as numbers, checkboxes as booleans, empty optional fields left out. This also
applies to hand-written `xo-submit` forms whose operation has `bodyFields`.

### Field errors

When a mutation fails with field messages, the matching input gets `aria-invalid="true"` and
`aria-describedby` pointing at a `<small class="xo-error">` placed after it. If no field matches, the error text
is shown under the form (`role="alert"`). The messages are cleared on the next submit. This works for every
`xo-submit` form. The server reports them in any of these shapes (see `XoongError.fields`):

* FastAPI: `{ "detail": [{ "loc": ["body", "email"], "msg": "…" }] }`
* envelope: `{ "error": { "code": "…", "message": "…", "fields": { "email": "…" } } }`
* problem+json extension: `{ "errors": [{ "pointer": "#/email", "detail": "…" }] }`

Errors of `xo-click` actions (a Delete that fails) still arrive as the bubbling `xo-error` event; show them with
your own listener.

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

Row selection and bulk actions, inline editing, form fields for nested objects and arrays (write that form by hand),
column filters other than text, tabs. They are tracked as issues for milestone 0.5.
