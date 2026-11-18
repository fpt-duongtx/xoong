# @xoong/mcp

An MCP server for xoong: gives AI assistants the spec (`llms.txt`) and the docs, the operations of your API, `xoong check`, and explanations of every error code, element and attribute, over stdio.

Stability: **experimental**, see [docs/stability.md](https://github.com/fpt-duongtx/xoong/blob/main/docs/stability.md).

## Install

```bash
npm install @xoong/mcp
```

## Use

```bash
npx xoong-mcp
```
Add it to your assistant's MCP configuration as a stdio server running `xoong-mcp`. Tools: `get_spec`, `list_operations`, `check`, `explain_error`, `explain_syntax`, `search_docs`. The spec and the docs come with the package.

## Measured, not promised

Real stdio JSON-RPC, 200 sequential calls per tool, 10 start-ups, on Apple M5 Pro (2026-11-17). The reference is a one-tool server on the official TypeScript SDK 1.32.2 answering the same call: it shows what the protocol layer costs, it is not a product comparison. Every tool and the method: [benchmarks/](https://github.com/fpt-duongtx/xoong/tree/main/benchmarks).

| | xoong-mcp (no SDK) | SDK reference |
|---|---|---|
| Start to `initialize` answer | 82.1 ms | 155 ms |
| `tools/list`, p50 / p95 | 0.03 / 0.07 ms | 0.21 / 0.63 ms |
| `explain_error`, p50 / p95 | 0.01 / 0.02 ms | 0.11 / 0.99 ms |
| Throughput, back-to-back requests | 447,099 per second | 21,310 per second |
| Memory (RSS), idle / after 1,000 calls | 48.2 / 53.1 MB | 70.8 / 98.2 MB |

## More

* Documentation, guides and live demos: https://fpt-duongtx.github.io/xoong/
* Source: https://github.com/fpt-duongtx/xoong/tree/main/packages/mcp
* All packages share one version number and are released together: https://github.com/fpt-duongtx/xoong/releases
* xoong is a working prototype (0.0.x): the HTML syntax is still Draft.

MIT licence.
