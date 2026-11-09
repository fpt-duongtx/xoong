// A minimal MCP server on the official TypeScript SDK (pinned in package.json), answering the same `explain_error` call as xoong-mcp with the same text.
// It is the reference for "what does the protocol framework cost": one tool, nothing else. Usage: node mcp-reference.mjs <explanations.json>
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const explanations = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const server = new McpServer({ name: 'reference', version: '1.0.0' });
server.registerTool('explain_error', { description: 'Explain an XO error code and how to fix it.', inputSchema: { code: z.string() } }, async ({ code }) => ({
  content: [{ type: 'text', text: explanations[code.toUpperCase()] ?? `unknown code ${code}` }],
}));
await server.connect(new StdioServerTransport());
