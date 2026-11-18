# Stability

xoong is 0.0.x and moves fast: a release can change anything, and each change is a `breaking:` line in `CHANGELOG.md`. That is honest, but it does not say which
parts are *meant* to settle first. Each package declares a tier in its `package.json` (`"xoong": { "stability": "..." }`), and its README repeats it.

| Tier | Meaning | What to expect |
|---|---|---|
| **core** | The parts a 1.0 promise will cover first: the HTML syntax of a screen, the data layer, forms, the shell and the command line. | Still Draft in 0.0.x. A change needs a reason, a `breaking:` line and a migration note; the aim is to stop changing it. |
| **evolving** | Complete and tested, but its API still moves with real use. | Changes are expected, listed in the CHANGELOG. Pin the exact version (the packages already pin each other). |
| **experimental** | New, optional, or an area where the right shape is not known yet. | May change shape or be removed in any release. Do not build a long-lived project on it without reading the CHANGELOG at each upgrade. |

| Package | Tier | Why |
|---|---|---|
| `@xoong/core` | core | Signals, elements and templates: the base everything stands on. |
| `@xoong/data` | core | The OpenAPI client, the cache and the screen bindings: the centre of the model. |
| `@xoong/forms` | core | The schema-driven form engine. |
| `@xoong/ui` | core | The admin shell: table, dialogs, toasts, tokens. |
| `@xoong/cli` | core | `xoong sync`, `check`, `build`, `dev`. |
| `@xoong/xoong` | core | The umbrella that installs the parts above. |
| `@xoong/controls` | evolving | Many controls (about thirty); each is small, the set is still growing. |
| `@xoong/i18n` | evolving | Catalogs and formats; the key naming rules may still change. |
| `@xoong/server` | evolving | The dev handler and proxy. |
| `@xoong/test` | evolving | Test helpers; they follow the syntax. |
| `@xoong/ssr` | evolving | Prerendering of public pages; no hydration step by design. |
| `@xoong/richtext` | experimental | An editor and its own HTML sanitiser (see [richtext.md](richtext.md)): the profile and tool model is new. |
| `@xoong/icons` | experimental | The icon set and the `xi` classes: the drawings and names are being settled. |
| `@xoong/lsp` | experimental | The language server; no editor extension yet. |
| `@xoong/mcp` | experimental | The MCP server for assistants. |

A package moves up a tier when it has gone a few releases without a breaking change and at least one project other than xoong's own uses it. Moving a package down is
also allowed, and is said in the CHANGELOG.
