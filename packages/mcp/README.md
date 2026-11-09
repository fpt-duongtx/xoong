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

## More

* Documentation, guides and live demos: https://fpt-duongtx.github.io/xoong/
* Source: https://github.com/fpt-duongtx/xoong/tree/main/packages/mcp
* All packages share one version number and are released together: https://github.com/fpt-duongtx/xoong/releases
* xoong is a working prototype (0.0.x): the HTML syntax is still Draft.

MIT licence.
