# Browser support

Decided by the owner (2026-11-08): **the latest two versions of Chrome, Edge, Firefox and Safari** (desktop and mobile
engines of the same families). Older browsers are not supported and not tested.

What that allows, and what needs a fallback:

| Platform feature | Use | Notes |
|---|---|---|
| Custom elements, ES modules, import maps, CSS custom properties, `@layer`, `<dialog>` | freely | baseline in all four |
| `ElementInternals` (form-associated custom elements), constraint validation | freely | `XoControl` relies on it |
| Popover API (`popover`, `showPopover`) | freely | |
| CSS anchor positioning | **with a fallback** (position by script or plain CSS) | not in every one of the last two versions of all four browsers |
| `command` / `commandfor` (invoker commands) | **with a fallback** | `xo-open` / `xo-close` stay until it is baseline (issue #14) |
| `light-dark()`, `:has()`, `@scope` | freely | already used by `xoong.css` |
| Customizable `<select>`, `field-sizing` | not yet | build the control or accept the default look |

Tested today: Chromium (Playwright) only. Firefox and WebKit runs are planned for CI; until then Firefox and Safari behaviour is
expected from the platform standards, not verified. A feature that needs a newer browser than this matrix must have a fallback
and an entry here.
