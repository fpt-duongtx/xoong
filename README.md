# xoong

> A small, standards-first web framework. Declare a screen, point it at an
> OpenAPI document, write plain CSS. That is the whole job.

**Status: working prototype (0.0.x), not published.** The core, data layer, CLI, dev server and test
helpers exist and are tested (150+ tests, including a real-browser end-to-end run of
[`examples/admin`](examples/admin)). The HTML syntax is still **Draft** and may change before 0.1.
Planned parts (admin components, SSR, MCP server, editor extension) are marked as such in
[`docs/`](docs). Picking this project up? Read [HANDOVER.md](HANDOVER.md) first.

```bash
npm install
npm test                         # everything
node packages/cli/src/cli.js new /tmp/demo --spec examples/admin/openapi.json
node examples/admin/backend.mjs  # example backend on :8080 ...
(cd examples/admin && node ../../packages/cli/src/cli.js sync openapi.json --hints xoong.hints.json \
  && node ../../packages/cli/src/cli.js dev)   # ... and the app on http://127.0.0.1:5173
```

## Why

Mainstream frameworks make developers chase the framework: new concepts every
major version (hooks, signals, OnPush-by-default, server components), a deep
toolchain tied to the Node version, and a different state, form and UI-control
library in every project. xoong takes the opposite position: **the browser
platform is the framework, and xoong's own surface stays tiny and stable.**

## Principles (short form)

1. **One way to do each thing.** Fewer choices means fewer wrong ones, for
   people and for AI assistants.
2. **Platform first.** Custom elements, the DOM, ES modules, CSS. No virtual
   DOM, no JSX, no hooks, no compiler required.
3. **Light DOM only.** Your CSS and your tests see the real DOM. No Shadow DOM,
   no scoped-style magic.
4. **Plain CSS/SCSS.** Design tokens as custom properties, `@layer`, `@scope`.
   No utility-class system, no CSS-in-JS.
5. **OpenAPI is the data contract.** Typed client, cache, invalidation and
   error handling are derived from it. You never hand-write an HTTP client.
6. **Zero runtime dependencies.** Upgrading Node must never break the
   runtime, because the runtime runs in the browser.
7. **Stable by default.** Semver, a tiny API, and every breaking change ships
   with a codemod.

Full text: [docs/design-principles.md](docs/design-principles.md).

## What a screen looks like (Draft syntax)

```html
<xo-view get="/users">
  <xo-table of="users" columns="name,email,role"></xo-table>
  <button xo-click="POST /users/{id}/disable">Disable</button>
</xo-view>
```

When you need computation, drop to plain JavaScript:

```js
import { derived } from 'xoong'
export const revenueByRegion = derived(({ orders }) => groupBy(orders, 'region'))
```

## Documentation map

| Document | Read it to learn |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Layers, packages, runtime flows (with diagrams) |
| [docs/architecture.html](docs/architecture.html) | The same architecture as a single visual diagram |
| [docs/design-principles.md](docs/design-principles.md) | The rules every feature must obey |
| [docs/admin.md](docs/admin.md) | `xoong.css`, `xo-table`, `xo-form`, `xo-dialog`: the admin set |
| [docs/data-layer.md](docs/data-layer.md) | OpenAPI client, cache, entity store, derived views, streaming |
| [docs/styling.md](docs/styling.md) | CSS conventions and design tokens |
| [docs/editor-integration.md](docs/editor-integration.md) | Planned VS Code extension and lint integrations |
| [docs/test-corpus.md](docs/test-corpus.md) | How xoong is checked against real-world OpenAPI documents |
| [docs/testing.md](docs/testing.md) | Unit, screen and end-to-end testing with Vitest |
| [docs/typescript.md](docs/typescript.md) | TypeScript support plan |
| [docs/server.md](docs/server.md) | The server: dev, proxy (done); SSR, stream gateway (planned) |
| [llms.txt](llms.txt) | The whole public API in under 3k tokens, for AI assistants |
| [docs/ai-integration.md](docs/ai-integration.md) | `llms.txt`, `xoong check`, the MCP server |
| [docs/roadmap.md](docs/roadmap.md) | Milestones and exit criteria |
| [docs/glossary.md](docs/glossary.md) | Terms used across the docs |
| [docs/decisions/](docs/decisions) | Architecture Decision Records (the *why*) |

## License

[MIT](LICENSE)
