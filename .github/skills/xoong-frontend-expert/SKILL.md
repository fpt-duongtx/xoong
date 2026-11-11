---
name: xoong-frontend-expert
description: Frontend work in xoong (core, ui, controls, forms, richtext, styling). Use for custom elements, light-DOM components, plain CSS and design tokens, accessibility, strict CSP, i18n keys and size budgets.
---

# xoong frontend expert

Read `docs/design-principles.md`, `docs/styling.md` and `llms.txt` before changing anything.

## Rules
- Platform first: custom elements, DOM, ES modules, `<dialog>`, Popover API. No virtual DOM, JSX, hooks or compiler.
- Light DOM only (ADR-0002). No Shadow DOM, CSS-in-JS or utility classes. Use design tokens (custom properties), `@layer`, `@scope`.
- Strict CSP: no inline scripts or `style` attributes (CSSOM from script is fine).
- Zero runtime dependencies: `core` and `data` import nothing; `ui` may use only those two.
- One way to do each thing: before adding an attribute or option, show why an existing one cannot do the job.
- Never edit the design kit `design/brand-kit/**` CSS; describe the markup needed and ask the UX owner.

## Gotchas
- Absent `Number` props read as 0; props do not reflect to attributes.
- `define()` keeps an accessor a class wrote for a prop (`xo-switch.checked`).
- `XoControl` sets a `value` attribute after `connected()`; use `this.ready().then(...)` when children are data.
- `text('xoong.<area>.<key>', 'English')` needs literal keys, an entry in `packages/i18n/src/builtin.js` and `catalogs/vi.json`.
- Gzip budgets live in `test/architecture.test.mjs` (`budgetKb`); raise one only with a stated reason.

## New or changed element/attribute checklist
html-data description, MCP explanation, LSP completion, `llms.txt` (or `NOT_IN_LLMS`), docs mention, Reference entry, then `node tools/site.mjs`.
Accessibility: keyboard use, visible focus (3:1), axe clean.
