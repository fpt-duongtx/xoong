// The Tools pages of the documentation site (cli.html, mcp.html, editor.html, codes.html) cannot drift from the code they describe.
// The tables are generated from packages/cli/src/usage.js and packages/mcp/src/server.js; these tests make sure nothing is missing from what is
// written around them (the glance table, the configuration keys, the hints) and that the pages on disk show every command, option, tool and code.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { USAGE, GLOBAL_OPTIONS, EXIT_CODES, commandUsage } from '../packages/cli/src/usage.js';
import { HINT_KEYS } from '../packages/cli/src/openapi.js';
import { TOOLS, EXPLANATIONS } from '../packages/mcp/src/server.js';
import { createLanguageServer } from '../packages/lsp/src/server.js';
import { CODE_FAMILIES } from '../tools/site/tooling-pages.mjs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
/** The text of a page's content column: no tags, entities decoded, one space between words. */
const textOf = (html) => html.match(/<main class="content"[\s\S]*<\/main>/)[0].replace(/<\/(td|th|tr|li|p|h\d|pre|div|section|aside)>/g, ' ').replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
/** The part of cli.html between the heading of one command (h2 `xoong sync`) and the next h2. */
const section = (html, command) => {
  const id = `xoong-${command.split(' ')[0]}`;
  const start = html.indexOf(`<h2 id="${id}"`);
  expect(start, `cli.html has no section for "xoong ${command}"`).toBeGreaterThan(-1);
  const end = html.indexOf('<h2 ', start + 1);
  return textOf(`<main class="content">${html.slice(start, end < 0 ? undefined : end)}</main>`);
};

describe('cli.html (the command line)', () => {
  const html = read('site/cli.html');
  const text = textOf(html);

  it('has a section for every command, with its usage line, and every option with its default and its description', () => {
    for (const command of USAGE) {
      const part = section(html, command.name);
      expect(part, `${command.name}: usage line`).toContain(`xoong ${commandUsage(command)}`);
      for (const option of command.options) {
        expect(part, `${command.name} ${option.flag}`).toContain(option.flag);
        expect(part, `${command.name} ${option.flag}: description`).toContain(option.doc.replace(/`/g, ''));
        if (option.default !== undefined) expect(part, `${command.name} ${option.flag}: default`).toContain(option.default);
      }
    }
  });

  it('names the options that belong to no command, the exit codes and the install forms', () => {
    for (const option of GLOBAL_OPTIONS) { expect(text).toContain(option.flag); expect(text).toContain(option.alias); }
    for (const { code, text: meaning } of EXIT_CODES) expect(text, `exit code ${code}`).toContain(meaning);
    for (const name of ['@xoong/xoong', '@xoong/cli', 'npx xoong', 'Node 22.12']) expect(text, name).toContain(name);
  });

  it('documents every key of xoong.config.json that the code reads, and every key of the hints file', () => {
    const readBy = [read('packages/cli/src/dev.js'), read('packages/cli/src/build.js'), read('packages/cli/src/cli.js')].join('\n');
    const keys = ['root', 'port', 'proxy', 'spa', 'base', 'allowedHosts', 'packages', 'build.exclude', 'build.preload', 'build.bundle', 'build.inlineScripts', 'check.exclude'];
    for (const key of keys) {
      expect(text, `config key ${key}`).toContain(key);
      const [head, tail] = key.split('.');
      expect(readBy, `${key} is not read by the code any more`).toMatch(tail ? new RegExp(`${head}[^\\n]*${tail}`) : new RegExp(`config\\.${head}\\b|\\.${head}\\b`));
    }
    for (const key of HINT_KEYS) expect(text, `hint ${key}`).toContain(key);
  });

  it('shows every family of the rules of xoong check, and points at the full list', () => {
    for (const family of CODE_FAMILIES.filter((f) => f.tool === 'check')) expect(text, family.title).toContain(family.title);
    expect(html).toContain('href="codes.html"');
  });

  it('links to the MCP server, the editor page and the install page', () => {
    for (const file of ['mcp.html', 'editor.html', 'install.html']) expect(html, file).toContain(`href="${file}"`);
  });
});

describe('mcp.html (the MCP server)', () => {
  const html = read('site/mcp.html');
  const text = textOf(html);

  it('lists every tool with every input, and shows each in the recorded session or the table', () => {
    for (const tool of TOOLS) {
      expect(text, `tool ${tool.name}`).toContain(tool.name);
      for (const input of Object.keys(tool.inputSchema.properties ?? {})) expect(text, `${tool.name} input ${input}`).toContain(input);
    }
  });

  it('names the two families of codes explain_error knows, and links to the list', () => {
    expect(text).toContain('XO1xx');
    expect(text).toContain('XO2xx');
    expect(html).toContain('href="codes.html"');
    expect(Object.keys(EXPLANATIONS).some((k) => k.startsWith('XO1'))).toBe(true);
    expect(Object.keys(EXPLANATIONS).some((k) => k.startsWith('XO2'))).toBe(true);
  });

  it('documents every option of xoong-mcp, and what it does not do', () => {
    const cli = read('packages/mcp/src/cli.js');
    for (const flag of ['--operations', '--llms', '--docs']) { expect(cli, `${flag} is not an option of xoong-mcp any more`).toContain(`'${flag}'`); expect(text, flag).toContain(flag); }
    expect(text).toContain('No scaffold tool');
    expect(text).toContain('No resources and no prompts');
  });

  it('shows the recorded session: a finding with its fix, and a clean check at the end', () => {
    expect(text).toContain('"code": "XO201"');
    expect(text).toContain('deletePerson');
    expect(text).toContain('No findings.');
  });

  it('registers the server in the clients it names, with the real program name', () => {
    const bin = Object.keys(JSON.parse(read('packages/mcp/package.json')).bin);
    expect(bin).toEqual(['xoong-mcp']);
    for (const client of ['claude mcp add', 'claude_desktop_config.json', '.cursor/mcp.json', 'mcpServers']) expect(text, client).toContain(client);
  });
});

describe('codes.html (the error codes)', () => {
  const html = read('site/codes.html');

  it('lists every code that explain_error knows, with its explanation, in a family', () => {
    for (const [code, explanation] of Object.entries(EXPLANATIONS)) {
      expect(html, code).toContain(`id="${code.toLowerCase()}"`);
      expect(textOf(html), `${code}: explanation`).toContain(explanation.replace(/`/g, '').slice(0, 60));
      expect(CODE_FAMILIES.some((f) => code.startsWith(f.prefix)), `${code} has no family`).toBe(true);
    }
  });

  it('every family has a heading and at least one code', () => {
    for (const family of CODE_FAMILIES) {
      expect(html, family.title).toContain(`<h3>${family.title.replace(/&/g, '&amp;')}</h3>`);
      expect(Object.keys(EXPLANATIONS).some((k) => k.startsWith(family.prefix)), family.prefix).toBe(true);
    }
  });
});

describe('editor.html (editor support)', () => {
  const html = read('site/editor.html');
  const text = textOf(html);

  it('gives the setting that points VS Code at the file xoong sync writes, and the server program', () => {
    expect(text).toContain('html.customData');
    expect(text).toContain('./.xoong/xoong.html-data.json');
    expect(read('packages/cli/src/commands.js')).toContain("'xoong.html-data.json'");
    expect(text).toContain('xoong-lsp');
    expect(Object.keys(JSON.parse(read('packages/lsp/package.json')).bin)).toEqual(['xoong-lsp']);
  });

  it('describes the features the language server announces, and the quick fixes it has', async () => {
    const reply = await createLanguageServer({ operations: async () => null }).handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    const capabilities = reply[0].result.capabilities;
    expect(capabilities.completionProvider).toBeTruthy();
    expect(capabilities.hoverProvider).toBe(true);
    expect(capabilities.codeActionProvider).toBe(true);
    for (const word of ['Diagnostics', 'Completion', 'Hover', 'Quick fixes']) expect(text, word).toContain(word);
    for (const code of ['XO201', 'XO230', 'XO271']) expect(text, `quick fix for ${code}`).toContain(code);
    expect(read('packages/lsp/src/server.js'), 'the quick fixes of the server').toMatch(/XO201[\s\S]*XO271[\s\S]*XO230/);
  });
});
