# TypeScript

Status: **Draft**. Goal: full type safety during development with **no change
to the zero-dependency runtime**.

## What exists today

* `xoong dev` strips types from `.ts` on request (erasable syntax only; `enum`/`namespace` are rejected
  with an explanation). Write `import './x.ts'` with the extension. Verified in a real browser by
  `examples/admin`.

* `xoong sync` generates `.xoong/api.d.ts`: a type for every schema and an
  `Operations` map (`method`, `path`, `params`, `body`, `response` per `operationId`).
* Runtime packages are plain JS with JSDoc, so editors type-check them without
  a build step.
* `createClient<Operations>()` (**done**, `packages/data/src/index.d.ts`): `load`, `query`, `mutate` and `stream` check
  the operation name, its parameters and its body, and return the response type. A test compiles a fixture with
  `tsc --strict` against a client generated from `examples/admin` and requires every mistake in it to be an error.

```ts
import type { Operations } from './.xoong/api.d.ts';
const client = createClient<Operations>({ api, baseUrl: '/api' });
const page = await client.load('listUsers', { limit: 10 });   // page: UserPage
```

## Plan

| Concern | Approach |
|---|---|
| Writing `.ts` | Supported in app code. **Erasable syntax only** (no `enum`, no `namespace`, no parameter properties): the transform is then just "strip types", which is predictable and fast |
| Browser delivery | Browsers do not run `.ts`. `xoong dev` strips types on request; `xoong build` is optional and also only strips. The tool that does this is a tooling dependency and never reaches the browser |
| Typed calls | `createClient<Operations>()` types `query`, `load`, `mutate` from `api.d.ts`: wrong operation names, missing params and wrong bodies become compile errors |
| Typed screens | `xoong check` validates `xo-click` operations, `{path}` interpolations and `p-*` params against `api.d.ts` and reports the fix |
| Typed components | `static props` map to typed properties through a generic helper; custom-element tags are declared via `HTMLElementTagNameMap` |
| Tests | Vitest runs `.ts` specs natively; `mockApi` handlers are typed from `Operations` |
| Strictness | The scaffold ships a minimal `tsconfig.json` used only by the editor and `tsc --noEmit`; no build config to maintain |

## Why erasable-only

If TypeScript only annotates, upgrading TypeScript or Node cannot change what
runs. This directly serves the stability goal in
[design-principles.md](design-principles.md).

## Milestone

The typed client is done; `xoong check` for JS/TS templates is open (0.6) (see [roadmap.md](roadmap.md)); `.ts`
transpile in `xoong dev` is **done**.
