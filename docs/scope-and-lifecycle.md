# Scope and lifecycle rules

The rules behind `{path}`, `xo-each`, `xo-click` and the view parameters, in one page. They are what `packages/data/src/view.js` does; if
something here and the code disagree, the code is right and this page has a bug.

## Where `{path}` comes from (the scope chain)

Every binding is resolved against a **scope**. A scope has a value and a parent; a lookup tries the value, then the parent, and so on outward.
The first scope whose value *has* that field wins, even if the field is empty.

| Where you are | The scope chain, innermost first |
|---|---|
| Directly inside `<xo-view>` | the view's **result** (the response of `get`), then the view's **parameters** (`p-*`, `url-params`, `xo-param`) |
| Inside `xo-each="items"` | the **item**, then the view result, then the parameters. `.` is the item; `$index` is its position |
| Inside nested `xo-each`s | the nearest item first; `$i0`, `$i1`, ... are the positions of the enclosing rows, outermost first |
| Inside `<form xo-submit>` | the form's **model** (`$form`: `$form.dirty`, `$form.errors['title']`), then the scopes above |
| Inside a nested `<xo-view>` | the **inner** view's own result and parameters only (see below) |

Variables start with `$` and live on the view: `$loading` (a request runs and there is nothing to show yet), `$refreshing` (a request runs and the
previous result is still on screen), `$error`, `$hasPrev`, `$hasNext`, `$from`, `$to`, `$selected`, `$selectedCount`.

Operation parameters in `xo-click="DELETE /users/{id}"` are resolved the same way: the item first (the row's `id`), then the result, then `p-*`.

### Which braces are bindings

A `{...}` is a binding only when its content is a path (`name`, `a.b[0]`, `a['x y']`, `$loading`, `.`), optionally followed by `| format`
(`{publishedAt | date}`; a date-only string such as `2026-11-07` is a calendar date and shows as that day in every time zone). Braces around anything
else are text: `<pre>{ "a": 1 }</pre>`, `body { color: red }`, `pattern="\d{3}"` and `{n, plural, ...}` stay as written. `{{name}}` is also left
alone (it is not xoong syntax), and a backslash turns one binding into text: `\{name}` shows `{name}`. A name that is not path-like (it starts with a
digit or holds a space or a colon) is reached with a quoted key: `{['a b']}`.

## Nested views

An `<xo-view>` inside another one is its own screen: it fetches its own operation and binds **its own children** against **its own** data. The outer view
does not touch them. Only the nested element's attributes belong to the outer scope, so `p-id="{id}"` inside an `xo-each` row gives each row's inner view
that row's id:

```html
<xo-view get="listMedia">
  <div xo-each="items"><xo-view get="getAsset" p-id="{id}"><b>{name}</b></xo-view></div>
</xo-view>
```

## Repeating several elements, and boolean attributes

`xo-each` repeats the element it is on. To repeat a group of children with no wrapper (an article body of mixed blocks), put it on a `<template>`:

```html
<article><template xo-each="blocks"><h2>{title}</h2><p>{text}</p></template></article>
```

A boolean attribute whose whole value is one `{path}` is present when the value is true and absent when it is false: `hidden="{closed}"`,
`disabled="{saving}"`, `checked="{done}"`. (`aria-selected="{open}"` gets the text `true` or `false`, as ARIA wants.)

An `<img src="{cover.url}">` inside a view is requested by the browser with the literal text before the data is bound. Use `<xo-image src="{cover.url}" alt="...">`,
which waits for the data (`xoong check` warns about the plain `<img>`, XO243).

## When a view starts

1. The element connects. Its children are **copied as its template** and the view starts in a microtask, so the order in which custom elements are
   defined does not matter, and a page can be parsed in any order.
2. **Route views**: a view with `p-x=":param"` needs the router. If the router is not running yet, the view waits for it and starts when it is.
   Likewise a view that starts before `configure()` (the page's module `await`s something first, such as the API document) waits for it and starts when it is called; if it has not been called after three seconds the console says so once.
3. The view reads its parameters (below), then runs its query. While the query runs, `$loading` is true (or `$refreshing` if there is a previous result).
4. A change of any parameter starts the next query. The previous result stays on screen until the next one arrives; an **error clears it**.
5. A mutation (`xo-click`, `xo-submit`) invalidates every cached query whose path overlaps the mutated path, so views showing that data refetch.

While a request runs the view has `aria-busy="true"` (and `data-refreshing` when the old result is still shown). When a request fails the global `onError` runs first, then the view (or the button or form that made the call) emits `xo-error`, which bubbles and can be prevented to handle the error in your own code (`view.error` holds the latest read error); when an action succeeds it emits `xo-done`. These events (`xo-done`, `xo-error`, `xo-invalid`, `xo-notice`) are dispatched on the element that ran the action (the button or form), so they bubble through a dialog or panel around it, up to the view and the page; a button the result removed (a deleted row) reports from the view instead. On an invalid submit the order
is `xo-reveal` (the tab with the first invalid field is shown) and then `xo-invalid`.

## What loads when: the router and the question dialogs

`import '@xoong/ui'` registers the table, pager, form, dialog and toast at once. Two larger parts load only when they are needed, and the exports stay the same:

* **`router`** (and `<xo-router>`, 21 KB): `router.js` loads when a `<xo-router>` is on the page (at start, or added later) or when `router` is first used. `xoong build` adds a `modulepreload` for it to a page that has `<xo-router>`; a page without one never fetches it. The exported `router` is an object from the start. Until the module has loaded, `router.current` is `null`, `router.navigate()` waits for the module and then goes (it still resolves with `true` when the navigation happened), and `router.guard()` / `router.beforeNavigate()` return the remover at once and register when the module has loaded (calling the remover before that cancels the registration). A route view (`p-id=":id"`) waits for the router as before.
* **`confirm`, `alert`, `prompt`, `ask`** and the built-in question behind `xo-confirm` (`dialogs.js`, 10 KB): the module loads on the first question. They were already asynchronous; the first question waits for the module (one request), the following ones present at once. `confirmLabels` exists from the start.

The schema-driven form (`@xoong/forms`, `<xo-form>`) is not lazy: its engine attaches while the view binds, so a form's prefill, leave guard and first paint of a prerendered form depend on it being there.

## Parameters: `p-*`, `url-params`, `?param`

| You write | What it means | Changes later? |
|---|---|---|
| `p-id="42"` | a fixed value for `{id}` of the operation, and for the whole view | `view.params = {...}` or `xo-param` |
| `p-id=":id"` | the **route** parameter `:id` of `<xo-router>` (read at start) | no (read at start) |
| `p-id="?id"` | `?id=...` from the page URL, **read once at start**; missing or empty is left out | no |
| `url-params="q,offset"` | those parameters **live in the page URL** (`?q=...&offset=20`) | yes: written on every change, and read again on Back and Forward |
| `xo-param="status=draft"` / `xo-param="q"` | a button or an input that sets a parameter (and refetches) | that is how they change |

Order of precedence at start: `p-*` values, then **the page URL for the names in `url-params`** (it wins), then anything set at runtime. A parameter an
operation needs in its path (`/media/{id}`) and that has no value logs a warning in the console, once, naming it.

## Reactive bindings never track child elements

Content that a binding inserts (an `xo-each` row, an `xo-if` block) connects child custom elements. What those children read or write while connecting does
not subscribe the parent binding, so controls drawn inside a list do not redraw the whole list. An effect that keeps triggering itself stops with an error that
names the effect (`effect loop did not settle ...`) instead of hanging the tab.

## Paging a list that is not a table

`<xo-table page-size="25">` has a pager. For tiles or threads use `<xo-pager page-size="12">` inside the same view: it sets `limit`, its buttons change
`offset`, and it shows "1–12 of 48" when the response has a `total`. The operation must declare `limit` and `offset`.
When the response has a numeric `total` and the page asked for is past the end (the last row of the last page was deleted, or an old link) the view goes to the last page that exists.
