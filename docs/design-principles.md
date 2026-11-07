# Design principles

Every proposal to xoong is checked against these rules. If a feature breaks
one, it needs an Architecture Decision Record (ADR) explaining why.

## 1. One way to do each thing

If two ways to achieve the same result exist, one of them is removed. Choice is
the source of inconsistency in teams and of mistakes in AI-generated code.

*Test:* can the whole public API be explained in under ~3,000 tokens
(`llms.txt`)? If not, the surface is too large.

## 2. The platform is the framework

Prefer a web standard over an invention: custom elements over a component
model, ES modules over a module system, `<dialog>` and the Popover API over a
dropdown library, CSS `@layer`/`@scope` over a style-isolation scheme.

*Consequence:* the framework ages as slowly as the browser does. Before using a
newer platform feature, check support against the browsers a project targets.

## 3. No hidden rules

No hooks-style call-order rules, no `use client` boundaries, no hydration
mismatches, no implicit global magic. If behaviour depends on a rule, a tool
(`xoong check`) must detect violations and explain the fix.

## 4. Light DOM only

Components render into the regular DOM. Styles, tests, analytics and
accessibility tooling all see what the user sees. Style safety comes from
conventions and tooling, not from walls. See
[ADR-0002](decisions/0002-light-dom-only.md).

## 5. CSS is CSS

Authors write CSS or SCSS. xoong ships design tokens and a few class
conventions, nothing more. No utility-class vocabulary to learn, no
CSS-in-JS. See [styling.md](styling.md).

## 6. Declare first, script second

Roughly 80% of a screen should be declarations: which API it reads, which
operation a button calls. The remaining 20% is plain JavaScript. There is no
third dialect.

## 7. The contract is OpenAPI

Types, URLs, cache identity, invalidation hints, entity identity and error
shapes come from the OpenAPI document. If the document is insufficient,
`xoong doctor` says exactly what to add. See
[ADR-0003](decisions/0003-openapi-driven-data.md).

## 8. Zero runtime dependencies

The runtime packages import nothing outside xoong. Tooling may depend on
other packages, but never ships to the browser. See
[ADR-0004](decisions/0004-zero-runtime-dependencies.md).

## 9. Stability is a feature

- Semver strictly; `0.x` until at least three real projects run in production.
- Deprecate before removing; ship a codemod with every breaking change.
- Small surface = small blast radius.

## 10. Optional means optional

A small marketing site needs no server and no build. Every server feature
(proxy, SSR, stream gateway) is opt-in. See [ADR-0005](decisions/0005-optional-server.md).

## 11. Built for humans and AI assistants equally

Errors state the fix. Docs are short and example-first. A machine-readable spec
(`llms.txt`) and an MCP server exist from the start. See
[ai-integration.md](ai-integration.md).

## Non-goals

- Replacing React, Angular or Next for every use case.
- A third-party component marketplace (the built-in set is deliberately small).
- Supporting browsers that lack custom elements, ES modules or CSS custom
  properties.
- Owning your backend. xoong never contains business logic.
