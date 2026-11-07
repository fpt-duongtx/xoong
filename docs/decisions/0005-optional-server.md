# ADR-0005: A small, optional, web-standard server

Status: Accepted (design phase)

## Context
Next.js ships an application server (SSR, API routes, BFF); Vite ships only a
dev server and build tool. xoong needs some server-side help (CORS-free proxy,
credential handling, SSR for public pages, a gateway for live updates) but must
not become the place business logic lives or reintroduce Node coupling.

## Decision
Provide `@xoong/server`: one `(Request) => Response` handler with four opt-in
capabilities (static, proxy, SSR, stream gateway). No API routes, no business
logic. A site with no server remains a fully supported mode.

## Consequences
+ Runs on Node, Deno, Bun, edge runtimes or behind existing proxies.
+ Small sites stay zero-ops.
- Proxy and gateway are security-sensitive and need clear guidance.
- Very high-volume streaming needs separate infrastructure.
