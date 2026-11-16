# @xoong/mcp

An MCP server for xoong: gives AI assistants the spec (`llms.txt`) and the docs, the operations of your API, `xoong check`, and explanations of every error code, element and attribute, over stdio.

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

Real stdio JSON-RPC, 200 sequential calls per tool, 10 start-ups, on Apple M1 (2026-11-09). The reference is a one-tool server on the official TypeScript SDK 1.32.2 answering the same call: it shows what the protocol layer costs, it is not a product comparison. Every tool and the method: [benchmarks/](https://github.com/fpt-duongtx/xoong/tree/main/benchmarks).

| | xoong-mcp (no SDK) | SDK reference |
|---|---|---|
| Start to `initialize` answer | 40.8 ms | 85.8 ms |
| `tools/list`, p50 / p95 | 0.10 / 0.15 ms | 0.16 / 0.23 ms |
| `explain_error`, p50 / p95 | 0.02 / 0.03 ms | 0.09 / 0.13 ms |
| Throughput, back-to-back requests | 259,826 per second | 33,111 per second |
| Memory (RSS), idle / after 1,000 calls | 58.2 / 64.0 MB | 82.3 / 112.4 MB |

## More

* Documentation, guides and live demos: https://fpt-duongtx.github.io/xoong/
* Source: https://github.com/fpt-duongtx/xoong/tree/main/packages/mcp
* All packages share one version number and are released together: https://github.com/fpt-duongtx/xoong/releases
* xoong is a working prototype (0.0.x): the HTML syntax is still Draft.

MIT licence.
