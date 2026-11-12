# ADR-0014: Attributes on a template host survive expansion

Status: Accepted

## Context

`<xo-table>`, `<xo-pager>` and `<xo-form>` are not custom elements. `defineTemplate` replaces the host with ordinary markup before binding. Anything the author wrote on the host was thrown away, except the ten `xo-*` modifiers `<xo-form>` copied by hand onto its `<form>`. `class="wide"`, `hidden`, `aria-label`, `data-*`, `dir`, a future `size` or `variant`, and `{theme}` all disappeared. `<xo-pager hidden>` failed for a second reason: the template returned a `display: contents` wrapper, and `hidden` on that wrapper does not hide the `<nav>`.

A template that returns a `DocumentFragment` had a separate bug. `replaceWith` moves the fragment's children into the parent and leaves the fragment empty, so the code that then walked `childNodes` bound nothing.

The survey of how other libraries treat this is in [attribute-fallthrough.md](../research/attribute-fallthrough.md). Vue falls attributes through to a single root at render time and merges `class` and `style`. Ember and Svelte require the component to place the attributes, and they treat `class` as a merge. Angular, Lit and Stencil keep the host, so the attributes never have to move. Alpine and htmx enhance the element in place. htmx's only attribute copy is the settle step, which writes twice on a live node so a CSS transition can run. That second write is a frame of the wrong attributes.

Two rules already cover the flash of raw markup, and this decision must not open a hole in them:

* `xoong.css` hides `xo-view:not(:defined)` unless the view is a prerender (`:has(> template[data-xo-template])`). The upgrade, `#start` and `bindNode` run in one turn, before the next paint, when `configure()` has already been called.
* `@xoong/ssr` runs that same `bindNode` and emits the expanded markup. The saved `<template data-xo-template>` is what the client renders from; the visible HTML is already the result.

## Decision

The copy lives in `bindNode`, not in each template.

`defineTemplate(tag, (el, { host, client, take }) => Node)`. `take(name)` returns the attribute value (an empty string when the attribute is present with no value, `null` when it is absent) and removes it from the host. A component calls `take` for every attribute it handles. An attribute it does not take is not the component's.

After `expand` returns, and before the output is inserted:

* Remember the fragment's child nodes first. `replaceWith` empties a fragment.
* Find the first element node. A fragment's later nodes do not receive the attributes. When the output has no element node, nothing is copied and the host is still replaced.
* Copy each remaining attribute onto that element. `class` is appended after the component's classes. `style` is the component's value, then `;`, then the author's, so the author wins a property conflict. Any other attribute is set to the author's value.
* The value is copied as written. `{path}` and `p-*` are bound once, afterwards, in the view's scope. They are not bound on the host as well.

`<xo-table>` takes `of`, `columns`, `sortable`, `selectable`, `page-size`, `page-sizes`, `filters`, `empty`, `title`, `status`, `cards`, `column-picker`, `hidden-columns` and `columns-key`. `<xo-pager>` takes `page-size` and `page-sizes` and returns the `<nav>` itself, so an attribute such as `hidden` applies to the pager. `<xo-form>` takes `op`, `submit` and `xo-submit`. The fixed list of modifiers it used to forward is deleted; those attributes, and any other the author wrote, land on the `<form>` by the shared rule. `xo-submit` is taken, not copied: the form sets `xo-submit` to `op`, and an author `xo-submit` would submit a different operation than the one the fields were built from. Change `op` to change the target.

The copy is `setAttribute` on a node that is not in the document yet, then one `replaceWith`. It does not paint the component's attributes and then the author's, and it does not do a second layout of its own.

`xo-table`, `xo-pager` and `xo-form` are `display: none` in `xoong.css` for as long as those tags are in the tree. They are only in the tree before expansion, or when they were written outside `<xo-view>` (where `bindNode` never walks them, so they never expand). Outside a view they used to render their children; they now take no box. An HTML `<template>` is inert either way; its contents are not rendered, inside or outside a view. A prerendered view does not contain those tags in the visible tree (they are inside the saved template), so it stays visible.

A class that sets `display` beats the user-agent `[hidden]` rule, because both have the same specificity and the class comes later. `.xo-pager` is `flex` and `.xo-form` is `grid`, so a copied `hidden` would leave the pager and the form on screen. The same is true of any control host that sets `display` (`xo-carousel { display: block }` and the rest). `xoong.css`, `controls.css` and `richtext.css` each end with an unlayered `[hidden] { display: none }`. Unlayered CSS beats those layered rules. A stylesheet loaded after them still wins.

An `aria-label` the author wrote on `<xo-popover>`, `<xo-carousel>` or `<xo-avatar>` is left alone, including one that still says `aria-label="{path}"`. Those elements stay in the document, so this is not fallthrough: each one used to set or remove `aria-label` on every paint, including when the author had set it and the component had not. `ownLabel` in `@xoong/controls` marks a label the component computed with `data-xo-label` (the marker survives a clone) and updates it, or removes it when the component clears it.

`blocking="render"` on the module that calls `configure()` is recommended where the browser supports it. Chromium and Safari do not paint while that module downloads, so the first paint is the expanded tree. Firefox ignores the attribute unless `dom.element.blocking.enabled` is set, so the attribute alone does not give Firefox a zero shift. The hosts are `display: none` either way, so raw content is not shown. `xoong.css` also hides the page while a view still contains an unexpanded `xo-table`, `xo-pager` or `xo-form` (`body:has(xo-view :is(xo-table, xo-pager, xo-form)):not(:has(xo-view :is(.xo-table, .xo-pager, .xo-form)))`). Defining the element is not enough to show the page: when the module arrives after the document was parsed, the view starts on a later turn, and a paint in between would move the content under the view. The page stays hidden until those hosts are replaced, including in Firefox. A prerender has the host tags only inside the saved template, so it stays visible. Without `xoong.css`, Firefox can still shift. The snippets in the docs, the site and the CLI scaffold do not put `blocking="render"` on the script: it is recommended, not part of the required markup.

## Consequences

+ An attribute the author writes on a template host is on the rendered element, including attributes xoong does not know yet.
+ `class` and `style` combine with the component's instead of replacing them. The author's style wins per property.
+ `<xo-pager hidden>` hides the pager. `<xo-form class="wide" data-x="1">` reaches the form, and so does `xo-notice`.
+ Every node of a fragment template is bound, which a fragment return never was.
+ Server render and the client use one `bindNode`, so the prerendered attributes match the client.
- A third-party template must `take` an attribute it handles. Otherwise that attribute is also copied onto the root.
- On a fragment, only the first element receives the author's attributes.
- An output with no element root does not keep them.
- `<xo-table>`, `<xo-pager>` and `<xo-form>` outside `<xo-view>` do nothing visible (`display: none`). Move them inside a view.
- Once `<xo-view>` is defined, `xo-view:not(:defined)` no longer hides it. Expansion is synchronous, so a `configure()` in the same turn still paints the expanded tree. A module that `await`s before `configure()` can show raw `{name}` text until the view starts; the template hosts stay hidden. Chromium and Safari can also use `blocking="render"` so they do not paint while the module downloads. Firefox does not honor that attribute by default. The `body:has(xo-view :is(xo-table, xo-pager, xo-form))` rule is what keeps that first paint from shifting there. The prerender path is unchanged: the expanded HTML is what is visible, and the client replaces it from the saved template in one turn.
