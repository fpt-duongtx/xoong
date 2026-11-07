# ADR-0008: A declarative History-API router in `@xoong/ui`; SPA for admin, one file per page for public sites

Status: Accepted

## Context
An admin has a persistent shell (sidebar, header) around changing content, guards (a 401 sends you to login), forms that must
be able to refuse leaving with unsaved changes, and deep links. All of that needs a document that stays alive between screens.
Public pages (marketing, blog, docs) want the opposite: one HTML file per page, crawlable, prerenderable, no JavaScript needed
to navigate. The first consumer of the admin set (rainlet, for Bloomoz) is an admin.

## Decision
* **Admin: SPA routing. Public pages: one HTML file per page** (the router is optional, `xoong render` prerenders those pages).
  Both work with `p-id="?id"` (the page URL) and with prerendering (`xoong render` takes the URL).
* A router element declares the routes in markup, one `<template>` per route, inert until matched (so no view inside it fetches
  anything before its route is active):

  ```html
  <xo-router base="/admin">
    <template xo-layout="shell"><nav>...<a href="/users">Users</a></nav><main xo-outlet></main></template>
    <template xo-route="/" layout="shell" title="Home">...</template>
    <template xo-route="/users/:id" layout="shell" title="User"><xo-view get="getUser" p-id=":id">...</xo-view></template>
    <template xo-route="/login">...</template>
    <template xo-route="*">Not found</template>
  </xo-router>
  ```
* It uses the **History API** (`pushState`, `popstate`). The Navigation API is not baseline in the supported browsers
  ([browser-support.md](../browser-support.md)), so it is not used.
* New public names (all additive): element `xo-router`; attributes `xo-route`, `xo-layout`, `xo-outlet` (plus the plain attributes
  `base`, `layout`, `title`); `p-<name>=":param"` on a view reads a path parameter, next to the existing `?query`; the JS object
  `router` (`navigate`, `guard`, `beforeNavigate`, `current`).
* Behaviour that is the browser's stays the browser's: normal links keep working without the router; the router only intercepts
  same-origin clicks it can resolve, never modified clicks, `target`, `download` or `rel="external"` links.
* **Guards are JavaScript**, not markup: a guard is a function `(to, from) => true | false | '/redirect'`. `beforeNavigate` may
  veto leaving (unsaved changes). The data layer's 401 is wired by the application:
  `configure({ onUnauthorized: () => router.navigate('/login') })`. One way to do each thing: no second guard dialect.

## Consequences
+ An admin gets a persistent shell, lazy route content, deep links, a leave guard and a 404 with a small declarative surface.
+ Route content is created when the route matches, so views inside a route start (and fetch) then, and stop when leaving.
- A vetoed back/forward button cannot be cancelled by the platform: the router restores the previous URL with `pushState`, so the
  forward history entry is lost. This is a known limit of the History API.
- One more element and three attributes in `llms.txt`, `xoong check`, the editor data and the docs.
