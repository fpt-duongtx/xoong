# Changelog

All notable changes are listed here. The project follows semantic versioning; it stays `0.x` until at least three real
projects run xoong in production. Nothing has been published yet.

## Unreleased

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
