# ADR-0011: A failed lazy `src` on Back or Forward aborts the traversal

Status: Accepted

## Context

An empty `<template xo-route src>` or `<template xo-layout src>` is fetched the first time that route is shown. A link click and `router.navigate()` fetch before they write the URL, so a failed fetch leaves the address bar and the screen where they were. Back and Forward are different: the browser has already moved the URL when `popstate` fires. If the fetch then fails, the address bar and the screen can disagree, and the history index stored in `history.state` can be left pointing at an entry the screen is not showing.

xoong has no per-route error view. The screen still shows the page that was current when Back or Forward was pressed. This note records how other routers treat the same failure, and which of those behaviours this router follows. The user-facing rules are in [docs/admin.md](../admin.md) (Router).

## What the others do

Sources read for this decision: Vue Router 4 `packages/router/src/router.ts` (the `routerHistory.listen` callback), React Router 7 `packages/react-router/lib/router/router.ts` (`completeNavigation`, `handleLoaders`), Angular `packages/router/src/navigation_transition.ts` and `packages/router/src/statemanager/state_manager.ts`, SvelteKit `packages/kit/src/runtime/client/client.js` (`load_route`, `native_navigation`, the `popstate` listener), and the WHATWG Navigation API (HTML, `NavigateEvent.intercept`).

| Router | URL after a failed load on Back/Forward | Content | History position | How the error is surfaced | A superseded navigation |
| --- | --- | --- | --- | --- | --- |
| Vue Router 4 | Put back with `routerHistory.go(-info.delta, false)` | The previous page. `finalizeNavigation` does not run | The `go(-delta)` returns to the entry that was current. Forward entries stay | `router.onError` (or `console.error` when nothing is listening). The promise rejects | A `NAVIGATION_CANCELLED` failure is not an `onError`. The same callback skips `go(-delta)` when a newer navigation has started, so it does not move the entry a different screen is showing |
| React Router 7 (data router) | Kept. `completeNavigation` does nothing for `POP` because the URL has already changed, including when loaders returned errors | The route `errorElement` at the destination | Stays on the destination entry | `state.errors`, rendered by the route error boundary | `request.signal.aborted` makes `handleLoaders` return before `completeNavigation`, so the stale loader error is not committed |
| Angular | Put back. `NavigationError` calls `restoreHistory`. The default `canceledNavigationResolution: 'replace'` uses `replaceState`, which replaces the current entry and keeps the entries after it. `'computed'` uses `historyGo` so Back undoes with a forward and the reverse | The previous page. Activation is after the load | The restored entry, or the replaced URL | A `NavigationError` event. The navigation promise rejects unless `resolveNavigationPromiseOnError` | `NavigationCancel` with `SupersededByNewNavigation`, not `NavigationError`. With `'computed'`, a newer navigation must not call `historyGo` (that would start a third navigation) |
| SvelteKit | Kept, then an error page is committed. If `updated.check()` says the build changed, `location.href` (or `location.replace`) loads the destination as a document instead | Nearest `+error.svelte`, or the reloaded document | Stays on the destination. A full document load replaces the session from there | `handle_error`, then the error page. A document load does not resolve the navigation promise | `navigation_token` mismatch rejects `"navigation aborted"` and does not commit. A preload failure does not navigate. `beforeNavigate` cancel on `popstate` is the path that calls `history.go(-delta)` |
| Navigation API | A rejecting `precommitHandler` aborts the navigation, so the URL and the session history do not change. A rejecting `handler` runs after commit: the URL stays on the destination | Whatever the page left in place. The platform does not roll the document back after commit | Unchanged when the failure is pre-commit. The new entry when the failure is post-commit | `navigateerror`. `committed` rejects only for a pre-commit failure. `finished` rejects for both | A newer navigation aborts the previous one (`AbortError`). Rolling back is the wrong response when the abort reason is that newer navigation ([whatwg/html#12821](https://github.com/whatwg/html/issues/12821)) |

Links:

* Vue Router: [navigation failures](https://router.vuejs.org/guide/advanced/navigation-failures.html), and `routerHistory.go(-info.delta, false)` followed by `triggerError` in [`packages/router/src/router.ts`](https://github.com/vuejs/router/blob/main/packages/router/src/router.ts).
* React Router: [`completeNavigation`](https://github.com/remix-run/react-router/blob/main/packages/react-router/lib/router/router.ts) ("Do nothing for POP - URL has already been updated") and the `request.signal.aborted` short-circuit in `handleLoaders`. Errors render through the route [error boundary](https://reactrouter.com/start/framework/route-module#errorboundary).
* Angular: [canceled navigations](https://angular.dev/guide/routing/customizing-route-behavior#handle-canceled-navigations), `NavigationError` in [`navigation_transition.ts`](https://github.com/angular/angular/blob/main/packages/router/src/navigation_transition.ts), `restoreHistory` in [`state_manager.ts`](https://github.com/angular/angular/blob/main/packages/router/src/statemanager/state_manager.ts).
* SvelteKit: `native_navigation` sets `location.href` to the destination; `load_route` calls it only after `updated.check()` finds a new deployment, and otherwise renders the error page ([`client.js`](https://github.com/sveltejs/kit/blob/master/packages/kit/src/runtime/client/client.js)).
* Navigation API: [`NavigateEvent.intercept`](https://developer.mozilla.org/en-US/docs/Web/API/NavigateEvent/intercept) and the HTML spec section [navigate and traverse the history by a delta](https://html.spec.whatwg.org/dev/nav-history-apis.html#navigateevent).

## Decision

A `src` fetch is a pre-commit step. The route is not shown until the markup has arrived. That is the Navigation API's `precommitHandler`, and it is already how a link click and `navigate()` work here.

Back and Forward cannot be pre-committed: the History API has moved the URL before script runs (the Navigation API is not baseline; [ADR-0008](0008-spa-router.md)). Aborting that traversal is `history.go(-delta)`, the same call a veto already uses. Vue Router does this for a failed async component on pop. Angular restores as well. Both leave the previous page on screen, which is the page xoong is still showing.

React Router and SvelteKit keep the destination URL and render an error view (`errorElement`, `+error.svelte`). xoong has no such view. Keeping the new URL would show one page at another page's address. SvelteKit's document load is for a stale hashed chunk after a deploy, not for an HTML template that returned an error, and it would drop the running page.

A navigation that a newer one has replaced does not restore and does not emit `xo-error`. Vue skips `go` for a cancelled navigation, React Router does not commit an aborted loader, SvelteKit drops a stale token, Angular emits `NavigationCancel` rather than `NavigationError`, and the Navigation API's abort must not be rolled back when a newer navigation caused it.

The failed fetch is not kept. The next visit tries again.

Rules that follow:

* **URL.** After a failed route or layout `src` on Back or Forward, `location` is the page that was current when the button was pressed.
* **Content.** That same page stays on screen. The destination is not rendered.
* **History position.** `history.go(-delta)` returns to that entry, so the stored index and the session history still match. Forward entries are still there. One further Back, then Forward, land on those entries.
* **Error.** One `xo-error` on the router, the same event a failed link click already uses.
* **Superseded.** If a newer navigation started while the fetch was in flight, the older fetch does not restore, does not render, and does not emit `xo-error`. The last navigation wins.
* **Retry.** The next visit to that route fetches again. A later success renders it.

## Consequences

+ The address bar and the screen match after a failed Back or Forward, and a later Back or Forward uses the real entries.
+ Link clicks and `navigate()` stay as they were: the URL changes only after a successful fetch.
- A failed Back does not leave the user on the URL they asked for. An application that wants that URL kept has to render its own error state and navigate there itself.
