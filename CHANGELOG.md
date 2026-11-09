# Changelog

All notable changes are listed here. The project follows semantic versioning; it stays `0.x` until at least three real
projects run xoong in production. The `@xoong/*` packages are published to npm under the tag `next`; the repository is public and each version is also a GitHub prerelease.

## 0.0.46 (dialogs, recipes, edge cases, animated diagrams)

breaking: a `{...}` in a view binds only when it holds a path (optionally with `| format`), so JSON, CSS and `\d{3}` stay as written; `{{name}}` is literal now (it rendered `{value}`), and `\{name}` escapes one binding. `packages/ui/src/confirm.js` is now `dialogs.js` (the package exports are unchanged and grew).

* Fixed: `<xo-switch>`'s `checked` property read the old state inside the `change` listener and, set from code before the button was drawn, never repainted it. `define()` replaced the class's own `checked` accessor with the default prop accessor (which only follows the attribute); it now keeps an accessor a class wrote itself for one of its props. `@xoong/core` budget 5.9 KB (was 5.8).
* Fixed (forms): a form whose save answers something that is not the record (`{ ok: true }`, `{}`, an array, nothing) no longer blanks itself: the answer replaces the baseline only when it shares a property with the request schema, otherwise the draft stays and is marked saved. A native `<button type="reset">` (or `form.reset()`) now resets the model too (Save used to send the old values). Checkboxes that share a `name` over an array node bind to membership in the array (they used to turn it into a boolean).
* Fixed (data): an edit that deletes the only row of the last page no longer shows an empty page ("5–4 of 4"): the view moves to the last page that exists. A dialog that holds its form inside the same `<xo-view>` closes when the form succeeds (`xo-done`, `xo-error`, `xo-invalid` and `xo-notice` now come from the button or form that ran the action and bubble). A `data:image/...` or `blob:` image source is allowed on `img` and `xo-image`; `xo-then` goes only to a relative path or the same origin. A module that awaits something before `configure()` no longer leaves the views stuck: they wait for it (and log one error after 3 s). Views set `aria-busy` while loading; a sort button in a `th` sets `aria-sort`. A date-only string (`2026-11-07`) is formatted as that calendar day in every time zone (it showed the day before west of UTC). `p-id=""` counts as a missing path parameter. Field errors of Laravel/Rails, Django REST, Spring, Zod and JSON:API are mapped onto the fields. `xo-param` accepts bracketed names (`filter[status]=open`). Behaviour change: a `{...}` binds only when it holds a path (optionally with `| format`), so JSON, CSS and `\d{3}` in a view stay as written; `{{name}}` is literal now and `\{name}` escapes one binding.
* Added (data): `getClient().reset()` for a sign-out: aborts requests in flight and drops cached queries and records; mounted views fetch again. `@xoong/data` budget 19.2 KB (was 18.3).
* Fixed (cli): `oneOf` with a `discriminator` but no `mapping`, where each member pins the tag with a one-value `enum` or `const`, now keys the union by the pinned values (`card`, `bank`), so a form draft with `kind: 'card'` picks that member and keeps it in the body (the response side had the same problem). `xoong build` rewrites and copies every URL of an `srcset` (`<img>`, `<source>`, `imagesrcset`), also under `--base`. `xoong sync` warns (XO113, once per kind) about what it leaves out of `operations.json`: required header parameters, cookie parameters, HEAD/OPTIONS operations, `servers`, and query parameters with `deepObject`, `pipeDelimited`, `spaceDelimited` or `explode: false`.
* Fixed (core): one update that ran more than 10,000 effects in total (a table of 2,000 rows by 4 cells where every record changes, select-all over 10,000 rows) threw "effect loop did not settle" and left cells stale; only an effect that keeps re-triggering itself (200 runs) is stopped now, and the other queued effects still run.
* Fixed (controls): Enter, `,`, Escape and the arrow keys are ignored while an IME is composing (Vietnamese Telex/VNI, Japanese, Chinese) in combobox, tags, command, inline-edit, date, stepper and popover. Combobox and command search ignore accents and case (`nguyen` finds "Nguyễn", `dong` finds "Đồng"). Tabs, segmented, otp and date follow the visual direction under `dir="rtl"`.
* Fixed (i18n): two quick `setLocale()` calls end on the last one, not on whichever catalog arrived last.
* Fixed (router): a route without a `title` restores the title the page came with instead of keeping the previous route's.
* Fixed (CSS): an `<xo-view>` that is not defined yet (the script is still loading) is hidden instead of showing raw `{name}` text; a prerendered view (`@xoong/ssr`) stays visible.
* Added: `<xo-form op>` hands `xo-then`, `xo-notice`, `xo-confirm` (and its `xo-confirm-*` details), `xo-guard`, `xo-keep` and `xo-with` to the form it draws, so `<xo-form op="createPerson" xo-notice="Saved" xo-then="/people">` works.
* Tooling: `xoong check` gains XO270–XO276 (modifiers without an action, bad values of `xo-confirm-kind` and `<xo-dialog size>`, malformed `xo-with` and `xo-param`, `xo-open` with no dialog, `xo-guard` and route attributes in the wrong place), the pager is checked, and `xoong sync` checks hints (XO171, XO172); every command now refuses unknown options and bad values, and has `--version`; `xoong new` writes the editor data. The MCP server gains `explain_syntax`, explains every XO1xx and XO2xx code, and bundles `llms.txt` and the docs into the package (`get_spec` and `search_docs` used to fail when installed from npm). The language server completes and explains the attributes of an element and their values, offers quick fixes and reports the real version. Drift tests fail when an element or attribute lacks an html-data description, an MCP explanation, an editor completion, an llms.txt or a docs mention.
* Site: ten animated figures (How it works and the Architecture pages) with a Pause button, still when reduced motion is set; a Recipes page with what xoong leaves to you (load more, polling, token refresh, uploads, wizard, autosave, routes, deployment).
* Added in `@xoong/ui`: built-in dialogs beside `confirm()`: `alert()`, `prompt()` (native field: `type`, `required`, `pattern`) and `ask()` (any set of named choices). All take `kind` (`info`, `success`, `warning`, `danger`: an icon and the matching colour), `title` and `detail`; `confirm()` takes them too, and `xo-confirm` reads `xo-confirm-title`, `xo-confirm-ok`, `xo-confirm-cancel` and `xo-confirm-kind` from the button.
* Added: `<xo-dialog heading="...">` is a titled modal (header with Close, body, `slot="footer"` footer); `size="sm|wide|full"` and `dismiss` (a click outside closes it). Without `heading` it is the plain wrapper it was.
* Changed: `packages/ui/src/confirm.js` is now `dialogs.js` (the exports of `@xoong/ui` are unchanged and grew). New texts `xoong.dialog.ok` and `xoong.dialog.close` (Vietnamese included). The `@xoong/ui` size budget is 11.5 KB (was 10).
* Site: the sidebar is regrouped (Start, Guides, Overlays, Controls, Design, Extend, Architecture, Live demos) with group labels that cannot be mistaken for pages; a "Dialogs and modals" page; the Demo page picks between the admin app, the landing site and the People admin, and the full-page demos have a bar back to the docs.

## 0.0.45 (modulepreload, controls drawn once, no page jumps)

breaking: none.

* Fixed: `<xo-combobox>` and `<xo-tags>` on a page that already holds the drawn control (a prerendered page, a copied snapshot) drew a second box next to it; the old box and list are now replaced, so it is drawn once.
* Fixed: a copy of a built `<xo-menu>` (a cloned row) took its drawn panel for a menu item and built a second, empty panel; the items are now taken back out of the old panel first.
* Added: `xoong build` writes `<link rel="modulepreload">` on every page for the modules its scripts import, so the browser fetches the whole chain at once (`--no-preload` or `"build": { "preload": false }` turns it off). Measured on the site's own pages over HTTP/2 with 100 ms latency: the last script arrives 17% sooner on the home page (847 to 703 ms) and 34% sooner on the controls page (758 to 497 ms). Tests: `build-preload.test.mjs`; `redraw.spec.mjs` checks that every control on the site's pages is drawn once after being moved or copied.
* Mist (kit ux/preupgrade): `:not(:defined)` guards so the page does not jump while the elements upgrade (tabs, carousel, combobox, richtext and the script-drawn controls reserve their size).

## 0.0.44 (menu trigger in a form, toast z-index, no flash of the header)

breaking: none.

* Fixed: the `xo-menu` trigger inside a `<form>` stayed a submit button (the code tested the `type` property, which is never empty, instead of the attribute): opening the menu submitted the form and could swallow the click on an item. The trigger is now `type="button"` unless you set a type.
* Fixed: `.xo-toast` has a z-index (`--xo-z-toast`, 60) so a sticky bar at the bottom of the page does not cover its Undo button.
* Mist (kit ux/palette-flash): the header's Palette menu and theme toggle no longer jump while the page loads (the menu items are hidden and the toggle keeps its 40px until the elements are defined).
* Live demo pages: `live-admin.html` and `live-landing.html` are published on the site.

## 0.0.43 (nested views, template rows, boolean attributes)

breaking: none.

* Mist kit ux/more-controls: stat, spinner animation, indeterminate progress, inline edit.
* CI: one job at a time with capped workers (the shared home server was overloaded).
* Fixed: an `<xo-view>` inside another `<xo-view>` bound its children against the outer data (the inner view stayed on `$loading`); it now binds its own children against its own data, and `p-id="{id}"` on a nested view in an `xo-each` row takes the row's id.
* Added: `<xo-pager page-size="12">` (Previous, Next and "1–12 of 48") for lists that are not tables; `<xo-table>` uses the same markup.
* Dev diagnostics: a view with no value for a path parameter logs a warning naming it (`add p-id="..."`); an effect that keeps triggering itself stops with an error that names it instead of hanging the tab.
* Added: `<template xo-each>` repeats its children without a wrapper element; boolean attributes bind (`hidden="{flag}"`, `disabled`, `checked`, ...: present when true, absent when false); `xoong check` XO243 for an `<img src="{path}">` inside a view.
* Docs: `docs/scope-and-lifecycle.md`, the rules of scopes, nested views, view start and `p-*` vs `url-params` vs `?param`.

## 0.0.42 (the rest of the Mist controls, types, docs)

breaking: none.

* Fixed: `<xo-stepper>` and `<xo-slider>` read an absent `min`/`max` as 0: a stepper without limits clamped everything to 0 and a slider without `max` stopped at 0. An absent limit is now no limit (slider: 0 to 100), and a `value` attribute becomes a number. `<xo-date>` puts `aria-expanded` on its button (a text input may not carry it).
* Added in `@xoong/controls` (one entry point each): `<xo-range-slider>`, `<xo-segmented>`, `<xo-split-button>`, `<xo-textarea>` (counter), `<xo-stat>`, `<xo-otp>`, `<xo-avatar>` and `<xo-avatars>`, `<xo-progress>`, `<xo-spinner>`, `<xo-steps>`, `<xo-inline-edit>`; `<xo-switch>` shows its text. Reference in `docs/controls.md`; a live page "More controls" on the site, covered by the axe, focus and 390px gates.
* Added: type declarations for `@xoong/core`, `@xoong/controls` and `@xoong/richtext` (every element and event typed, tag map for `querySelector`).
* Fixed: `client.mutate` no longer disguises a programming error (a thrown TypeError) as a network error; a 2xx response with invalid JSON is a `XoongError`; the MCP server reports the real package version.
* Docs: `docs/data-layer.md`, `docs/architecture.md` and ADR-0009 now describe what the code does; the Install page and README use `npm install @xoong/xoong@next`; packages link to the site as homepage.

## 0.0.41 (exclude, viewport fit, switch text)

breaking: none.

* CI and Pages run on the maintainer's home server runners; the CI jobs run one run per branch at a time.
* `<xo-switch>`: text inside the element is the visible label (`label.xo-switch-row > button + span.xo-switch-text`, a click on the text toggles it and it names the switch).
* `xoong build --exclude <glob>` (repeatable) and `"build": { "exclude": [...] }` in `xoong.config.json` keep HTML that is not a page (partials, fixtures, drafts) out of the start list; `xoong check` has `--exclude` and `"check": { "exclude": [...] }` too. Popups (menu, combobox, date, popover) stay inside the viewport; carousel `<article>` slides no longer carry `role="group"`; styles of the six new controls (kit ux/polish).

## 0.0.40 (theme toggle, six more controls)

breaking: none.

* Added: `<xo-theme-toggle>` in `@xoong/controls` (`@xoong/controls/theme-toggle`): a button that sets `data-theme` light or dark on `<html>`, saves the choice, follows the system until chosen, fires `xo-theme-change`.
* The documentation site has the toggle in its header (light/dark, remembered, the logo follows).
* Added in `@xoong/controls` (one entry point each): `<xo-accordion>`, `<xo-popover>`, `<xo-consent>` (+ `xo-consent-open`), `<xo-file>` (drop zone, type and size checks, thumbnails, progress), `<xo-command>` (Ctrl/Cmd+K palette), `<xo-chart>` (bar/line with a table fallback). Reference table in `docs/controls.md`.
* Fixed: `xoong build` and the dev server treat `@xoong/xoong` (and `/view`, `/ui`) as an installed xoong package (it was still looking for the unscoped `xoong`).
* Budgets: controls 22.5 KB, core 5.8, i18n 5.6 (the English catalog of the new controls), llms.txt ~3,150 tokens, each for the new controls.
* Kit ux/live-demos taken (two live demo pages, `demo-pages.css`, icons; not part of the site or `mist.css`).

## 0.0.39 (xo-image style)

breaking: none.

* Mist (kit ux/image): the look of `<xo-image>` (shimmer while loading, image icon and note for empty and error).

## 0.0.38 (xo-image)

breaking: none.

* Added: `<xo-image>` in `@xoong/controls` (`@xoong/controls/image`): lazy and async by default, space reserved from `width`/`height` or `ratio`, `fit`, `position`, `srcset`/`sizes`, `priority` for the image above the fold, a loading state, a one-time `fallback` and an error state with the alt text (`data-state`). `xoong check` rule XO242: an `<xo-image>` needs `alt` (an empty alt is allowed).

## 0.0.37 (fixes from the admin screens)

breaking: none.

* Fixed: content inserted by a reactive binding (`html`) is no longer tracked: a child element that read or wrote state while it connected (an `XoControl` registering with a form) subscribed the parent binding and could redraw all controls in a loop.
* Fixed: a `PUT`/`PATCH` form inside a view with data is an edit form even when the path has no parameter (a singleton such as site settings): it starts from the record without `xo-body="."`.
* Added: `xo-then="/articles/{id}"` on xo-click/xo-submit: go to a path after success; `{id}` from the result, then from the item acted on. `<xo-router>` navigates (event `xo-go`).

## 0.0.36 (publishing through Trusted Publishing)

breaking: none.

* The publish workflow uses npm Trusted Publishing (OIDC) instead of a stored token; the 14 packages trust `fpt-duongtx/xoong` and `publish.yml`.

## 0.0.35 (first npm release: the umbrella is @xoong/xoong)

breaking: the umbrella package is now `@xoong/xoong` (npm refused the bare name `xoong`, "too similar to long"). Import from `@xoong/xoong`, `@xoong/xoong/view`, `@xoong/xoong/ui`; the `xoong` command is unchanged.

* The `@xoong/*` packages are on npm under the tag `next` (0.0.34 was published without the umbrella; 0.0.35 is the first complete set).
* Mist (kit ux/four-controls): styles for `<xo-slider>`, `<xo-stepper>`, `<xo-password>` (eye-off icon), `<xo-copy>`.

## 0.0.34 (slider, stepper, password, copy)

breaking: none.

* Added in `@xoong/controls`, each with its own entry point: `<xo-slider>` (native range, fill, stop labels), `<xo-stepper>` (spinbutton semantics, clamping, keys), `<xo-password>` (show/hide button, `aria-pressed`), `<xo-copy>` (read-only value, Copy then Copied, `copied` event). Controls budget raised to 15.8 KB for them.
* Mist (kit ux/time-style): the layout of `<xo-time>`.

## 0.0.33 (xo-time, date picker style)

breaking: none.

* Added: `<xo-time>` in `@xoong/controls` (`@xoong/controls/time`): a time of day as two native selects (Hour, Minute), `HH:mm` value, `step`, `min`/`max`.
* Mist (kit ux/date-style): the look of `<xo-date>` (field button, calendar panel, header, day states).

## 0.0.32 (xo-date, check XO222)

breaking: none.

* Added: `<xo-date>` in `@xoong/controls` (`@xoong/controls/date`): a date field with a calendar popover; ISO value, locale text that also accepts typing, `min`/`max`, `week-start`, arrow/PageUp/Home/End keys, `range` with Clear and Apply. Controls budget raised to 13.5 KB for it.
* Added: `xoong check` rule XO222, a `<form xo-submit>` outside `<xo-view>` never binds.
* Mist (kit ux/mist-4): admin shell box-sizing reset, the content width cap is opt-in (`.xo-content--readable`), `aria-current` styled in `.xo-seg`, `summary.button`, mobile drawer menu.

## 0.0.31 (xo-switch, admin shell)

breaking: none.

* Added: `<xo-switch>` in `@xoong/controls` (`@xoong/controls/switch`): one setting on or off, ARIA switch, boolean `value`/`checked`, `change` and `input`, `busy`, `size="sm"`, `disabled`, `readonly`, form value "on" or nothing. Controls budget raised to 10 KB for it.
* Added to `@xoong/ui/mist.css`: the admin app shell (`.xo-app`, `.xo-side`, `.xo-nav`, `.xo-topbar`, `.xo-page-head`, ...), `a.button` (a link that looks like a button) and the kit's other small fixes.

## 0.0.30 (Mist as a package file)

breaking: none.

* Added: `@xoong/ui/mist.css` (`src/mist.css`): the Mist look (the Rainlet design system) as one self-sufficient stylesheet for an app: the tokens and a dark scheme, the `--xo-*` mapping straight from them, the component skin and the controls of the Mist spec, in the layer `xoong-mist`, without the documentation site's chrome. Generated from the design kit by `tools/build-mist.mjs`; `test/mist.test.mjs` checks it is up to date, self-contained and draws 40px controls and the Mist primary in a page with only the four framework files.

## Unreleased

* Publishing to npm is prepared, not done: every package has a LICENSE, a README, `publishConfig`, `engines` and exact lockstep dependencies (`node tools/set-version.mjs`, `node tools/package-files.mjs`); `@xoong/forms` and `@xoong/i18n` now ship the type declarations their `exports` already promised; `test/publish.test.mjs` checks the tarballs; the manual workflow `publish.yml` (dry run by default) and the runbook `docs/publishing.md` are in.
* Docs site: Architecture section (data flow, forms, rendering, router, build, tooling) with diagrams; the theme builder preview sets every palette variable of its region.

## 0.0.29 (Mist, table cards)

breaking: none.

* Fixed: sorting, paging or filtering a table (any change of a view's parameters) no longer empties it while the next result loads, which made the page collapse and jump. The previous result stays on screen, dimmed (`xo-view[data-refreshing]`), until the new one arrives; an error clears it. New variable `$refreshing` (a request runs and the old result is shown); `$loading` now means "a request runs and there is nothing to show yet", so a skeleton shows only on the first load.
* Added: `<xo-table cards>`: rows become cards in a narrow pane (a theme draws them: the table gets `xo-cards`). Every cell now carries `data-label` (its column's label); the first column, or `title="field"`, is the card title (`data-title`); `status="field"` marks the status cell (`data-status`).
* Docs site and design kit: the Mist look (the Rainlet design system: tokens verbatim, a derived dark, Be Vietnam Pro, the xoong lockup), the Mist/Calm/Ember palette menu with a link to the theme builder page, the kit's component standard in one cascade layer (`xoong-standard`). The kit is in `design/brand-kit` (see `MIST.md` there for the token map, the load order and what the Rainlet admin can drop).
* Tests: the carousel peek test no longer depends on how a browser re-snaps after a layout change.

## 0.0.28 (options from the API)

breaking: none.

* Added: `options-op`, `option-value` and `option-label` on `<xo-combobox>` and `<xo-tags>`: the options come from a list operation through the shared cache (`p-<name>` parameters, paths for value and label, `items` or `data` unwrapped); a mutation of the list refreshes them. Needs `@xoong/data/view`.
* Fixed: setting `el.options` after a value was already there did not redraw the chips, so a saved record showed raw ids as labels.

## 0.0.27 (menu divider)

breaking: none.

* Added: an `<hr>` inside `<xo-menu>` is a divider (`role="separator"`), not an item; the keys skip it.

## 0.0.26 (focus indicators)

breaking: none.

* Fixed (found by tabbing through the docs site): items of `<xo-menu>` and the rich text More menu showed focus with a background change only (1.3:1); they now draw a 2px ring inside the item (`--xo-focus-thin`).
* Added: `--xo-focus-thin` and `--xo-focus-inverse` (a ring in `--xo-color-inverse-text` for buttons on an inverse surface such as a toast action, where the accent ring can fall under 3:1).
* Tests: `tools/focus.mjs` tabs through pages and measures every focus indicator against what surrounds it (3:1, WCAG 1.4.11); it runs on five pages in Calm light and Ember dark next to axe. Docs: the focus audit page from the design kit.

## 0.0.25 (table cells, required marker, docs polish)

breaking: none.

* Fixed: the actions cell of `<xo-table>` was `display: flex`, so it stopped being a table cell (its row border was missing, rows misaligned); it is a cell again.
* Fixed: `.xo-table` is positioned, so a visually hidden label in a header cell cannot widen the page.
* Added: a generated field that must be filled in shows a `*` after its label (`.xo-field` with a `required` control).
* Docs site: the design kit's polish round 1 (no sideways scroll on a phone, slim mobile header, print styles, fluid home), the Standard, All controls and Icons pages generated from the kit, placeholders from `xoong.hints.json`, topics as badges, an icon on the Save button; tests: no page scrolls sideways at 390px.

## 0.0.24 (nullable fields, base-relative links)

breaking: none (`base-links` is opt-in; the nullable change only affects schemas that list a nullable property as required or set `emptyAs: "null"`).

* Fixed: a field the person never touched is empty like any other: with `emptyAs: "null"` it is sent as `null` instead of being left out (an object that was never created still sends nothing).
* Fixed: a nullable property that the schema lists as required (zod `.nullable()`) may be left empty: the control is not `required`, the form does not block, and the request carries `null` for it (the key must be there).
* Added: `<xo-router base-links>`: a root-relative link inside the router (`href="/users"`) is relative to the base, so the same screens mount under any base; the `href` is rewritten after each navigation (hover and "open in a new tab" show the real address) and a link added later is resolved on click. `rel="external"` or a `target` leave the app.

## 0.0.23 (control scale, brand shell)

breaking: none.

* Added: control scale and state tokens with neutral defaults in `xoong.css`: `--xo-control-height` (-sm, -lg), `--xo-control-padding`, `--xo-control-gap`, `--xo-touch`, `--xo-field-gap`, `--xo-icon`, `--xo-shadow-pop`, `--xo-color-accent-soft`, `--xo-color-subtle`, `--xo-color-success`, `--xo-color-warning`, `--xo-color-inverse`, `--xo-color-inverse-text`; buttons, fields and selects use the height scale; the focus ring is 3px. See docs/styling.md.
* Added: `data-state="playing|paused"` on the carousel's pause button, for themes that draw icons.
* Docs site: the design kit's fluid shell (navigation, content, "On this page" rail generated from the h2 headings), one Copy icon button per example, the standard component look (`components.css`, `standard.css`, `icons.css` as CSS masks), code blocks reachable by keyboard.

## 0.0.22 (states, refresh, control border)

breaking: none.

* Added: `xo-refresh` on a button inside an `<xo-view>` fetches the view's data again ("Try again" after an error, a refresh button).
* Added: `--xo-color-control-border` (3:1 against the page, WCAG 1.4.11) for the edge of buttons, fields, the combobox box and the rich text box; `--xo-color-border` stays the soft divider colour.
* Fixed: `<xo-table>`'s empty content no longer shows after a failed request.
* Docs site: loading, empty and error states, the mobile Menu disclosure, a 404 page, a social card per section, the focus ring and selected tab on Ember Deep (3:1), and the carousel in the brand (arrows at the sides, a pill for the current dot, thumbnails).

## 0.0.21 (accessibility checks with axe-core)

breaking: none.

* Added: axe-core (dev dependency, `tools/axe.mjs`) runs over every docs page in Calm and Ember, light and dark, and over open states (menus, dialogs, confirm, the rich text More menu, a form with validation errors and a toast) under the strict CSP. Zero violations are required.
* Fixed (found by axe): the rich text More menu gave toggles `aria-pressed` on `menuitem`s; they are now `menuitemcheckbox` with `aria-checked`. Toolbar symbols (`1.`, `B`) are drawn by CSS from `data-face`, so the accessible name is the caption alone (WCAG 2.5.3).
* Fixed: the rich text box showed an outline when a toolbar button had the focus as well as the button's own; the box ring now shows only while the editor has the focus.
* Docs site: Controls is a group with a page each (overview, tabs, menu and tooltip, combobox and tags, carousel, your own control); contrast of muted text and code comments raised to 4.5:1.

## 0.0.20 (one cache key per query)

breaking: none.

* Fixed: query params are keyed by their text in the URL, so `{ offset: 1 }` and `{ offset: '1' }` (a number from code, a string from the page URL) are one query: `client.seed`, `query()` and views find the same entry.

## 0.0.19 (carousel)

breaking: none.

* Added: `<xo-carousel>` in `@xoong/controls` (also `@xoong/controls/carousel`; each control now has its own entry point). Slides in a scroll container with CSS scroll snap, the WAI-ARIA carousel pattern, `items` (several at a time, fractional to peek, `--xo-carousel-items` in CSS), `dots` (or thumbnails from `data-thumb`), `counter`, `no-arrows`, `loop`, `autoplay` (pause button, pause on hover and focus, off under reduced motion), slides out of view are `inert`, slides from `xo-each` in an `xo-view`. Covers cards, banners, testimonials, peek sliders and galleries; crossfade, 3D, cloned endless loops and logo tickers are not included on purpose.
* Controls size budget raised 7 to 9.5 KB for it.

## 0.0.18 (building blocks for widget packages)

breaking: none.

* Added: `style:--x=${...}` / `style:width=${...}` in `html` templates (CSS object model, strict-CSP safe; null removes).
* Added: `await dialog.open()` on `<xo-dialog>` resolves with the `returnValue`; `xo-close value="..."` and `close(value)` set it.
* Added: `this.ready()` on `XoElement` (children can be read) and the `xo-form-ready` event (`detail: { model }`).
* Docs: "Building elements for your own package" in `docs/controls.md` (props are attribute to property, package texts with `addMessages`, tooling).

## 0.0.17 (cache seeding)

breaking: none.

* Added: `client.seed(operation, params, data)` puts data the server already has into the cache as if the GET had run (entities shared, no request until stale), for a page whose server embeds its first data.
* Docs: "One client, one place for paths and settings" in `docs/data-layer.md`.

## 0.0.16 (brand site, choice menu)

breaking: none.

* Added: a choice menu. `<xo-menu value="calm">` with items that have a `value` makes them `menuitemradio` with `aria-checked` (a check mark in the default style); choosing one sets the menu's `value` attribute and fires `xo-menu-select` with `{ value }`.
* Docs site: rebuilt in the xoong brand (Calm and Ember palettes as token overrides on the `--xo-*` tokens, the mark as inline SVG that follows the palette, a Home page, a Brand page with downloads in `site/brand/`, a palette menu made with `<xo-menu>`). The site uses xoong's own elements for tabs, menu, tooltip, tables, dialog and toast.

## 0.0.15 (docs site, array change event)

breaking: none.

* Added: a bubbling `xo-array-change` event on the form with `detail: { path, op: 'add' | 'remove' | 'move', from, to }`, fired for the add, remove and move buttons, a drag reorder and code (`model.append`, `removeAt`, `moveItem`); `model.onArrayChange(fn)` is the same for code. For UIs that keep a selected row.

* Docs site: nine pages (overview, install, how it works, data and tables, forms, controls, rich text, styling, live demo) with side navigation, code tabs (made with `<xo-tabs>`, highlighted when the pages are generated, Copy buttons) and live examples that run on an in-page fake API (`configure({ fetch })`). Pages are generated by `npm run site` from `tools/site/pages.mjs`; a test fails when they drift.
* Fixed: `<xo-tabs>` inside an `<xo-view>` got two tab lists when the view cloned already-built tabs; the build now starts over on a copy.
* Fixed: a generated form's submit button lost its accent style after a form-level error was shown (styled by `:last-child`); it is now `.xo-submit`.
* Fixed: after a successful create the emptied form showed its required errors again, and the summary of an earlier failed attempt stayed under it; the form starts clean and the summary goes with the next attempt (`data-xo-summary`).

## 0.0.14 (richtext image insert under strict CSP)

breaking: none.

* Fixed: inserting an image no longer goes through `execCommand`, so Chromium does not copy a `style=""` attribute that a strict CSP reports (`style-src-attr`). The image is inserted with a Range; with the caret in a heading it lands in a paragraph of its own after the heading.

## 0.0.13 (control baseline)

breaking: none.

* Fixed: a custom control prefilled by the form binder (a record on open, a live refresh, a saved value) now counts the value as its baseline: `control.dirty` and `data-dirty` stay false until the person edits, in step with `$form.dirty`.

## 0.0.12 (form width token, richtext toolbar sizes)

breaking: none for markup. The default `@xoong/richtext` toolbar changed (new tools and order: `undo redo style bold italic underline ul ol quote link image`); set `tools` to keep a previous set.

* `--xo-form-max-width` (default 28rem) replaces the fixed `max-width` of `.xo-form`; `none` lifts it. Nothing else in `xoong.css` fixes the width of the content area.
* `<xo-richtext>`: two toolbar sizes chosen by the editor's own width (Full from 580px, Compact with a More menu below; `toolbar="full|compact"` forces one, never wraps or scrolls sideways), new Underline (`u` is allowed in the output) and Text style (Paragraph, Heading 2, Heading 3, Mixed) tools, and `expand()`/`collapse()` with `xo-richtext-expand` and `xo-richtext-done` to edit in a 960px dialog (the whole screen under 768px). The default tool order is now `undo redo style bold italic underline ul ol quote link image`. The `@xoong/richtext` size budget is raised from 6 to 8.5 KB for this.

## 0.0.11 (late-defined controls, reordering)

breaking: none.

* Array editors in forms: after Move up/down the focus stays on the moved row's button; after Remove it goes to the neighbouring row or the add button; `xo-drag="blocks[{$index}]"` on a handle drags a row onto another row of the same list (the generated form draws a handle). The `@xoong/data` size budget is raised from 15.5 to 16.5 KB for this.

* Fixed: a custom control used before its element is defined (a route rendered before a lazy widget loaded). The form binder now binds it once the browser upgrades it, a `value` set before the upgrade becomes the start value instead of hiding the accessor, and `<xo-combobox>` keeps `options` and `schema` set early.

## 0.0.10 (@xoong/richtext)

breaking: none. New package `@xoong/richtext` (add its tarball and override from consume.json).

* New package `@xoong/richtext` (zero dependencies besides core): `<xo-richtext>`, a sanitised-HTML rich text control (accessible toolbar, bold, italic, h2, lists, quote, links limited to http, https, mailto and tel, undo and redo, sanitised paste and drop, the cancelable `xo-pick-media` hook for images) and the exported `sanitizeHtml()` for the server side. Docs: docs/richtext.md. Tested in happy-dom and in Chromium, Firefox and WebKit.

## 0.0.9 (@xoong/controls)

breaking: none. New package `@xoong/controls` (add its tarball and override from consume.json).

* New package `@xoong/controls` (zero dependencies besides core): `<xo-tabs>` (ARIA tabs, keyboard, `xo-reveal` selects the tab of an invalid field, `data-invalid` marker), `<xo-menu>` (menu button pattern, Popover API top layer, type-ahead), `xo-tooltip` (hover and focus, dismissible, hoverable), `<xo-combobox>` (filterable single or multiple choice with chips, `creatable`, `remote`, options from `<option>`, JavaScript or the schema enum) and `<xo-tags>`; optional `controls.css`. Docs: docs/controls.md.
* `<xo-form>`: a `widget` hint that is a tag name now replaces the editor of an array, object or union node too (a custom control owns the whole value). Tested in happy-dom and in Chromium, Firefox and WebKit.
* `xoong dev` and `xoong build` find `@xoong/i18n` and `@xoong/controls` without configuration.

## 0.0.8 (binder revert on edit forms)

breaking: none.

* Fixed: on an edit form (record with a stored value) typing in a custom `XoControl` was still reverted: the binder's first write set the control inside its effect, which subscribed the effect to the control's own signals. The whole write and the error display now run untracked.

* `site/`: the end-user documentation site (home, install, how it works, a live demo table), built with `xoong build`; `.github/workflows/pages.yml` deploys it to GitHub Pages (manual run until Pages is enabled).
* Fixed: `xoong build` read `href="src/app.css"` (a relative URL without `./`) in HTML and `url(img.png)` in CSS as a package name and left it unresolved.

* `npm run lint` (oxlint, rule `no-shadow`) runs in CI; nine shadowed names renamed.

## 0.0.7 (confirm regression, symlinked packages)

breaking: none.

### Fixed
* `@xoong/ui`: `confirm()` threw `text is not a function` (a local variable hid the imported `text`), so `xo-confirm` and the dirty-form leave question never opened. Real-browser test added; a source test now fails when a declaration reuses the name of an import (`no-shadow` class).
* `xoong build`: an app inside the package it consumes (`"rainlet": "file:.."`, workspaces) keeps its pages at the site root instead of under `/@pkg/...`; the root and output folder are compared by real path.

## 0.0.6 (custom controls, inline unions, config packages)

breaking: none.

* `xoong.config.json` `"packages": [...]`: dev server and `xoong build` serve and resolve installed packages beyond xoong's own (exports maps with wildcards and subpaths, `./server` skipped).
* Unions whose members are inline objects are told apart by the fixed value of the tag; a union that cannot be told apart is reported at sync as `XO161` (was silently free-form).
* Fixed: `userInput()` of a custom `XoControl` in a form never reached the form model (the binder reverted the control before the `input` event). Docs for widget authors in docs/admin.md.
* Generated array rows have a numbered title (`.xo-row-title`) with the variant; two-letter child names are drawn as language codes (`EN`, `VI`).

## 0.0.5 (arrays, unions, generated forms, i18n)

breaking: none for markup. `xoong build` and `xoong check` are stricter: unknown `build` options are refused, `filters` accept `name:Label`.

### Added
* Forms: arrays and unions (`xo-add`, `xo-remove`, `xo-move`, `xo-if="path=value"`), nested objects, `<xo-form op="...">` draws every field from the request schema with hints (`order`, `group`, `widget`, `hidden`, `emptyAs`, `pruneEmpty`; OpenAPI `x-xoong-widget`, `x-xoong-prune-empty`, `x-xoong-empty-as`, other `x-*` keys reach widgets in `schema.hints`).
* `@xoong/i18n`: ICU-subset catalogs, `xo-t`, `locale` signal, Intl formats, Vietnamese for built-in strings; `xoong i18n extract|check`.
* `setConfirm(fn(message, context))` replaces the confirm and leave dialogs; `confirm()` and `toast.show()` exported from `@xoong/ui`.
* Tests and CI run in Firefox and WebKit as well (`npm run test:browsers`).

### Fixed
* `xoong build` ignores its own output folder and validates its options; `xoong --help` exits before any work.

## 0.0.4 (forms, list state, build)

### Added
* `@xoong/forms`: the schema-driven form model (draft, baseline, per-path state, rules by path incl. async, server errors, payload normalisation) and the
  DOM binder every `<form xo-submit>` with a request schema now uses (ADR-0009). `xoong sync` writes `bodySchema` (request schemas) and hint fields.
* `<xo-view url-params>`, `aria-current` on matching `xo-param` buttons, `xo-selected="ids"` (one request), `xo-with`, `xo-confirm` (native dialog),
  `xo-notice` toasts with actions, dirty-form leave guard (`xo-guard`), `{value | format}` formats and `localized`, table empty state, labels, range, page size.
* `xoong build`: static output for strict-CSP hosting (docs/security.md), tested under `default-src 'none'; script-src 'self'; style-src 'self'`.
* ADR-0010 (internationalization) accepted; implementation follows.

### Changed
* The shell (`xo-admin`) works through the router's wrapper elements; `xo-toast` has an error region (`role="alert"`) and a notice region (`role="status"`).
* Filter boxes in `<xo-table>`: the label is the placeholder and the accessible name (was "Filter by x").

## 0.0.3 (router)

### Fixed (after the tag, in the next drop)
* A route view (`p-id=":id"`) in prerendered content no longer starts before the router; prerendered router pages take over without duplicating content; the router no longer needs browser globals (works in `@xoong/ssr`); `xoong render --url`; route `description`.

### Added
* `@xoong/ui`: `<xo-router>`, a declarative History-API router (routes, nested layouts, `p-id=":id"`, link interception, `aria-current`, guards, leave veto, 404, base path) and the `router` object. ADR-0008. New attributes: `xo-route`, `xo-layout`, `xo-outlet`. `xoong check` rules XO260-XO263. Nothing shipped earlier changed.

## 0.0.2 (first drop for other projects, private)

Everything below, as of this version. All packages carry the same version. Install by tarball (see docs/consuming.md); nothing is published to npm.

### Added
* `@xoong/core`: signals, `html` templates, Light DOM custom elements.
* `@xoong/data`: OpenAPI-driven client, auto cache and invalidation, entity store with replace/merge rules, eviction and
  cancellation, `derived`, server-sent events, `<xo-view>` with `xo-each`, `xo-if`, `xo-click`, `xo-submit`, `xo-param`;
  hints for `unwrap`, idempotency keys, composite ids; multipart bodies, event streams and untagged unions detected;
  typed client `createClient<Operations>()`.
* `@xoong/cli`: `sync`, `doctor`, `check` (HTML, JavaScript, TypeScript), `new` (`--link` for unpublished packages), `dev`;
  editor data `xoong.html-data.json`.
* `@xoong/server`: portable `(Request) => Response` dev handler (static files, proxy, TypeScript stripping, import map).
* `@xoong/test`: `mount`, `mockApi`, live-event delivery on Vitest.
* `@xoong/ui`: `xoong.css`, `<xo-table>`, `<xo-form>`, `<xo-dialog>`, `<xo-toast>`.
* `@xoong/core`: `XoControl`, a base class for form-associated custom controls (value in FormData, constraint validation, reset, fieldset,
  `dirty` / `touched` / `pristine` / `valid` signals). `xoong browser-support` matrix documented in docs/browser-support.md.
* `tools/pack.mjs`: tarballs of every package and a `consume.json`, so another project can use a checkout without npm publishing.
* `xoong`: the umbrella package: one install and import name for core, data, the admin set and the `xoong` command.
* `@xoong/mcp`: MCP server (`get_spec`, `list_operations`, `check`, `explain_error`, `search_docs`).
