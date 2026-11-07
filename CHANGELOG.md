# Changelog

All notable changes are listed here. The project follows semantic versioning; it stays `0.x` until at least three real
projects run xoong in production. Nothing has been published yet.

## Unreleased

## 0.0.3 (router)

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
