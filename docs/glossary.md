# Glossary

| Term | Meaning |
|---|---|
| **Custom element** | A browser-native way to define your own HTML tag (`customElements.define`). The basis of every xoong component |
| **Light DOM** | Rendering into the regular DOM tree (no Shadow DOM), so global CSS and tests see it |
| **Signal** | A reactive value; code that reads it re-runs when it changes |
| **Derived** | A signal computed from the entity store; recomputed only when its inputs change |
| **Operation** | One OpenAPI endpoint+method, identified by `operationId` |
| **Entity** | An object with a stable identity (e.g. `User#42`) stored once in the entity store |
| **Entity store** | The shared, normalized client-side data holder |
| **Normalization** | Splitting responses into entities stored by `Schema#id` |
| **Invalidation** | Marking cached results stale after a mutation |
| **Stream event** | A `patch`, `upsert` or `delete` message that updates the store live |
| **Stream gateway** | Optional server component that turns backend changes into stream events |
| **No hydration** | The server's HTML is already the component's DOM; the browser upgrades tags in place |
| **`llms.txt`** | A short, machine-oriented spec of the public API for AI assistants |
| **MCP** | Model Context Protocol: lets AI assistants call xoong tools |
| **ADR** | Architecture Decision Record: a short note on why a decision was made |
