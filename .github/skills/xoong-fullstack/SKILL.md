---
name: xoong-fullstack
description: Data and tooling work in xoong (data, server, ssr, cli, mcp, lsp). Use for the OpenAPI client, cache and entity store, dev server/proxy, SSR, the xoong CLI, MCP server and editor tooling.
---

# xoong fullstack

Read `docs/data-layer.md`, `docs/server.md`, `docs/ai-integration.md` and `llms.txt` first.

## Rules
- The contract is OpenAPI (ADR-0003): types, URLs, cache identity, invalidation, entity identity and error shapes derive from it. Never hand-write an HTTP client. If the document is insufficient, `xoong doctor` must say what to add.
- Forms come from the API schema (ADR-0009).
- Server features (proxy, SSR, stream gateway) are optional (ADR-0005); a static site needs no server or build.
- Runtime packages have zero dependencies; tooling (cli, server, mcp, lsp) may depend on others but never ships to the browser.
- Errors must state the fix. `xoong check` detects rule violations.
- Anonymise external OpenAPI documents and sample data before adding them to the repo.

## Try changes
```bash
node packages/cli/src/cli.js new /tmp/demo --spec examples/admin/openapi.json --link $(pwd)
node examples/admin/backend.mjs   # backend on :8080
(cd examples/admin && node ../../packages/cli/src/cli.js sync openapi.json --hints xoong.hints.json && node ../../packages/cli/src/cli.js dev)
```

## Keep in sync on public API changes
`llms.txt` (size limit `length / 3.8 < 3220`), `xoong check`, `html-data.js`, MCP, LSP, docs, `CHANGELOG.md`.
