# Changelog

All notable changes are listed here. The project follows semantic versioning; it stays `0.x` until at least three real
projects run xoong in production. Nothing has been published yet.

## Unreleased

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
