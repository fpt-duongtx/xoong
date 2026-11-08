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
3. The view reads its parameters (below), then runs its query. While the query runs, `$loading` is true (or `$refreshing` if there is a previous result).
4. A change of any parameter starts the next query. The previous result stays on screen until the next one arrives; an **error clears it**.
5. A mutation (`xo-click`, `xo-submit`) invalidates every cached query whose path overlaps the mutated path, so views showing that data refetch.

When a request fails the view emits `xo-error` and the global `onError` runs; when an action succeeds it emits `xo-done`. On an invalid submit the order
is `xo-reveal` (the tab with the first invalid field is shown) and then `xo-invalid`.

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
