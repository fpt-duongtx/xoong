// Tests for the promises made in docs/design-principles.md and docs/architecture.md.
// If one of these fails, either the code or the design document has to change on purpose.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const pkgDir = (name) => join('packages', name);
const manifest = (name) => JSON.parse(readFileSync(join(pkgDir(name), 'package.json'), 'utf8'));
const sources = (name) => {
  const dir = join(pkgDir(name), 'src');
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => ({ file: join(dir, f), text: readFileSync(join(dir, f), 'utf8') })) : [];
};
/** Module specifiers imported by a source file (static and dynamic). */
const imports = (text) => [...text.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g)].map((m) => m[1] ?? m[2] ?? m[3]);
const isBare = (s) => !s.startsWith('.') && !s.startsWith('/');

/** Runtime packages ship to the browser; each may only depend on the ones listed. */
const RUNTIME = { core: [], data: ['@xoong/core'], forms: ['@xoong/core', '@xoong/data'], i18n: ['@xoong/core', '@xoong/data'], ui: ['@xoong/core', '@xoong/data', '@xoong/forms'], controls: ['@xoong/core'], richtext: ['@xoong/core'] };

describe('zero runtime dependencies (ADR-0004)', () => {
  for (const [name, allowed] of Object.entries(RUNTIME)) {
    it(`${name}: package.json declares only ${allowed.length ? allowed.join(', ') : 'nothing'}`, () => {
      expect(Object.keys(manifest(name).dependencies ?? {}).sort()).toEqual(allowed);
    });

    it(`${name}: source imports only xoong packages it is allowed to, and no Node built-ins`, () => {
      for (const { file, text } of sources(name)) {
        for (const spec of imports(text).filter(isBare)) {
          expect(spec.startsWith('node:'), `${file} imports Node built-in ${spec}`).toBe(false);
          const ok = allowed.some((a) => spec === a || spec.startsWith(a + '/'));
          expect(ok, `${file} imports "${spec}", which is not an allowed dependency of @xoong/${name}`).toBe(true);
        }
      }
    });
  }
});

describe('dependency direction (docs/architecture.md)', () => {
  it('core imports nothing from other xoong packages', () => {
    for (const { file, text } of sources('core')) expect(imports(text).filter((s) => s.startsWith('@xoong/')), file).toEqual([]);
  });

  it('data reaches into core only through its public entries', () => {
    const exportsMap = manifest('core').exports;
    for (const { file, text } of sources('data')) {
      for (const spec of imports(text).filter((s) => s.startsWith('@xoong/core'))) {
        const sub = spec === '@xoong/core' ? '.' : './' + spec.slice('@xoong/core/'.length);
        expect(Object.keys(exportsMap), `${file} imports ${spec}`).toContain(sub);
      }
    }
  });

  it('no runtime package imports tooling (cli, server, mcp, test)', () => {
    for (const name of Object.keys(RUNTIME)) {
      for (const { file, text } of sources(name)) {
        const bad = imports(text).filter((s) => /^@xoong\/(cli|server|mcp|test)\b/.test(s));
        expect(bad, file).toEqual([]);
      }
    }
  });

  it('pure logic entries do not need a DOM at import time (SSR and tooling can import them)', () => {
    // signals.js and everything in data except view.js must load in plain Node without touching `document`/`window`.
    const pure = [join(pkgDir('core'), 'src/signals.js'), ...sources('data').map((s) => s.file).filter((f) => !f.endsWith('view.js'))];
    for (const file of pure) {
      const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      const topLevel = code.split('\n').filter((l) => /^(const|let|var|export|import|class)\b/.test(l)).join('\n');
      expect(topLevel, file).not.toMatch(/\b(document|window|HTMLElement|customElements)\b/);
    }
  });
});

describe('size budget (gzip of the source without comments; a regression guard, not the shipped size)', () => {
  // Comments and documentation grew with every feature and made the old budget (gzip of the raw files) move without the code
  // growing, so the budget now measures code only. The roadmap's single-digit KB target applies to the *minified* size,
  // which still has to be measured (docs/roadmap.md, size budgets, and the benchmark issue).
  // Budgets sit about 5-10% above the measured values (core 5.0, 5.8 budget since the element names of the new controls in syntax.js, 5.6 since style:name bindings and ready() (the CSP-safe style binding and the children-parsed hook), data ~16.3 (18.3 budget since template xo-each (rows without a host element) and boolean attribute binding, 17.8 since the warning for a path parameter without a value, mutate keeping programming errors apart from network errors and invalid JSON as a XoongError, 17.4 since options-op: options for a combobox from a list operation, and keeping the previous result while the next loads; focus follows a moved or removed row, xo-drag: raised from 15.5 for that), forms ~6, i18n 5.6 for the English catalog of the new controls, ui ~9, controls ~6.5 (30 budget since twelve more elements (otp, avatar, progress, spinner, steps, inline-edit, range slider, segmented, split button, textarea, stat; one entry point each, an app imports what it uses), xo-accordion, xo-popover, xo-consent, xo-file, xo-command and xo-chart (one entry point each; an app imports what it uses), xo-image and xo-theme-toggle, after xo-slider, xo-stepper, xo-password and xo-copy (each its own entry point), xo-date (calendar popover, range, locale text parsing, keyboard) and xo-switch (boolean form control, ARIA switch) after xo-carousel: scroll snap, ARIA pattern, autoplay, dots and thumbnails; each control also has its own entry point, e.g. @xoong/controls/carousel), richtext ~8 KB (two toolbar sizes, More menu, text style, expand dialog: raised from 6 for those); raising one needs a reason in the commit.
  const budgetKb = { core: 5.9, data: 19.2, forms: 9.5, i18n: 5.6, ui: 11.5, controls: 30, richtext: 8.5 }; // forms: schema rules, model, binder, array editing; ui: router, toast, confirm, table, the schema form generator; 11.5 (from 10): the built-in dialogs alert, prompt and ask beside confirm (kinds with icons, titles, a field) and the titled xo-dialog (heading, size, dismiss) // data: url state, confirm, notices, bulk, formats, selection; ui: router, toast, confirm, table
  const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
  for (const [name, kb] of Object.entries(budgetKb)) {
    it(`@xoong/${name} stays under ${kb} KB`, () => {
      const all = sources(name).map((s) => stripComments(s.text)).join('\n');
      const size = gzipSync(all).length / 1024;
      expect(size, `@xoong/${name} is ${size.toFixed(1)} KB gzipped (code only), budget ${kb} KB`).toBeLessThanOrEqual(kb);
    });
  }
});

describe('workspace hygiene', () => {
  it('every package is MIT licensed', () => {
    for (const name of readdirSync('packages')) expect(manifest(name).license, name).toBe('MIT');
  });
  it('a LICENSE file exists at the root', () => {
    expect(readFileSync('LICENSE', 'utf8')).toMatch(/MIT License/);
  });
});

/** CSS classes of xoong.css that llms.txt documents; a test below checks each one exists in the stylesheet. */
const CSS_CLASSES = ['xo-admin'];

describe('llms.txt cannot drift from the code (docs/ai-integration.md)', () => {
  const llms = readFileSync('llms.txt', 'utf8');

  it('stays within the ~3,000 token budget', () => {
    expect(llms.length / 3.8).toBeLessThan(3200); // raised from 3000 for the list of the new controls, then 3150 -> 3200 for the built-in dialogs
  });

  it('only mentions CLI commands that exist', () => {
    const help = readFileSync('packages/cli/src/cli.js', 'utf8');
    const used = new Set([...llms.matchAll(/^[ \t]+xoong (\w+)/gm)].map((m) => m[1]));
    expect(used.size).toBeGreaterThanOrEqual(5);
    for (const cmd of used) expect(help, `llms.txt mentions "xoong ${cmd}"`).toMatch(new RegExp(`cmd === '${cmd}'`));
  });

  it('only mentions xo-* attributes that xoong defines, and documents all of them', async () => {
    const { XO_ATTRIBUTES, XO_ELEMENTS, XO_UI_ATTRIBUTES, XO_UI_ELEMENTS, XO_CONTROL_ATTRIBUTES, XO_CONTROL_ELEMENTS } = await import('../packages/core/src/syntax.js');
    const known = new Set([...XO_ATTRIBUTES, ...XO_UI_ATTRIBUTES, ...XO_CONTROL_ATTRIBUTES]);
    const eventsAndPlanned = new Set([...XO_ELEMENTS, ...XO_UI_ELEMENTS, ...XO_CONTROL_ELEMENTS, 'xo-tab-change', 'xo-search', 'xo-pick-media', 'xo-menu-open', 'xo-menu-close', 'xo-done', 'xo-error', 'xo-card', 'xo-reveal', 'xo-invalid', 'xo-array-change', 'xo-menu-select', 'xo-navigate', 'xo-dirty', ...CSS_CLASSES]);
    const mentioned = new Set([...llms.matchAll(/\bxo-[a-z]+(?:-[a-z]+)*\b/g)].map((m) => m[0]));
    for (const name of mentioned) if (!eventsAndPlanned.has(name)) expect(known.has(name), `llms.txt mentions ${name}, which xoong does not define`).toBe(true);
    for (const name of known) expect(mentioned.has(name), `xoong defines ${name}, but llms.txt does not document it`).toBe(true);
  });

  it('the runtime (view.js) handles every attribute and element xoong defines', async () => {
    const { XO_ATTRIBUTES, XO_ELEMENTS } = await import('../packages/core/src/syntax.js');
    const view = readFileSync('packages/data/src/view.js', 'utf8');
    for (const name of XO_ATTRIBUTES) expect(view, `view.js does not mention ${name}`).toContain(name);
    for (const name of XO_ELEMENTS) expect(view, `view.js does not define <${name}>`).toContain(`define('${name}'`);
  });

  it('@xoong/ui implements every UI attribute and element xoong defines', async () => {
    const { XO_UI_ATTRIBUTES, XO_UI_ELEMENTS } = await import('../packages/core/src/syntax.js');
    const ui = sources('ui').map((s) => s.text).join('\n');
    for (const name of XO_UI_ATTRIBUTES) expect(ui, `@xoong/ui does not mention ${name}`).toContain(name);
    for (const name of XO_UI_ELEMENTS) expect(ui, `@xoong/ui does not define <${name}>`).toMatch(new RegExp(`(define|defineTemplate)\\('${name}'`));
  });

  it('@xoong/controls and @xoong/richtext implement every control attribute and element xoong defines', async () => {
    const { XO_CONTROL_ATTRIBUTES, XO_CONTROL_ELEMENTS } = await import('../packages/core/src/syntax.js');
    const text = [...sources('controls'), ...sources('richtext')].map((s) => s.text).join('\n');
    for (const name of XO_CONTROL_ATTRIBUTES) expect(text, `the control packages do not mention ${name}`).toContain(name);
    for (const name of XO_CONTROL_ELEMENTS) expect(text, `the control packages do not define <${name}>`).toMatch(new RegExp(`define\\('${name}'`));
  });

  it('every CSS class llms.txt documents exists in xoong.css', () => {
    const css = readFileSync('packages/ui/src/xoong.css', 'utf8');
    for (const name of CSS_CLASSES) expect(css, `xoong.css has no .${name}`).toContain(`.${name}`);
  });

  it('the documentation pages in site/ are what tools/site/pages.mjs generates (run: npm run site)', async () => {
    const { render } = await import('../tools/site.mjs');
    for (const { file, html } of render()) expect(readFileSync(`site/${file}`, 'utf8'), `site/${file} is out of date`).toBe(html);
  });
});

// The tools that read the syntax lists. Adding an element or an attribute to packages/core/src/syntax.js has to reach all of them:
// the editor data and the checker (packages/cli), the MCP server, the language server, llms.txt and the docs. Each test names what is missing.
describe('the tooling cannot drift from the syntax lists (docs/ai-integration.md, docs/editor-integration.md)', () => {
  const llms = readFileSync('llms.txt', 'utf8');
  const docsText = readdirSync('docs').filter((f) => f.endsWith('.md')).map((f) => readFileSync(join('docs', f), 'utf8')).join('\n');
  const word = (name) => new RegExp(`(?<![\\w-])${name}(?![\\w-])`);
  const uri = 'file:///app/index.html';
  const syntax = async () => (await import('../packages/cli/src/html-data.js')).SYNTAX;

  /** Elements that llms.txt (~3,000 tokens) does not name. Each is documented in docs/ and reachable through the MCP tool `explain_syntax`; remove an entry when llms.txt gains it. */
  const NOT_IN_LLMS = ['xo-pager', 'xo-range-slider', 'xo-segmented', 'xo-split-button', 'xo-textarea', 'xo-stat', 'xo-otp', 'xo-avatar', 'xo-avatars', 'xo-progress', 'xo-spinner', 'xo-steps', 'xo-inline-edit'];

  it('html-data.js has a real description for every element and attribute (editor completion and hover, the MCP server, the language server)', async () => {
    const { SYNTAX, ELEMENT_DOCS, ATTRIBUTE_DOCS, htmlData } = await import('../packages/cli/src/html-data.js');
    for (const name of SYNTAX.elements) expect(ELEMENT_DOCS[name]?.[0]?.length ?? 0, `html-data.js has no description for <${name}>`).toBeGreaterThan(40);
    for (const name of SYNTAX.attributes) expect(ATTRIBUTE_DOCS[name]?.length ?? 0, `html-data.js has no description for ${name}`).toBeGreaterThan(30);
    const data = htmlData({ operations: {} });
    expect(data.tags.map((t) => t.name)).toEqual(SYNTAX.elements);
    expect(data.globalAttributes.map((a) => a.name)).toEqual(SYNTAX.attributes);
    for (const name of Object.keys(ELEMENT_DOCS)) expect(SYNTAX.elements, `html-data.js describes <${name}>, which syntax.js does not list`).toContain(name);
    for (const name of Object.keys(ATTRIBUTE_DOCS)) expect(SYNTAX.attributes, `html-data.js describes ${name}, which syntax.js does not list`).toContain(name);
  });

  it('the MCP server explains every element and attribute (tool explain_syntax)', async () => {
    const { createServer } = await import('../packages/mcp/src/server.js');
    const server = createServer({ llms: async () => '', operations: async () => ({ operations: {} }) });
    const { elements, attributes } = await syntax();
    for (const name of [...elements, ...attributes]) {
      const { result } = await server.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'explain_syntax', arguments: { name } } });
      expect(result.isError, `the MCP server cannot explain ${name}`).toBeUndefined();
      expect(result.content[0].text.length, `the MCP server has only a name for ${name}: describe it in html-data.js`).toBeGreaterThan(name.length + 40);
    }
  });

  it('the language server completes and explains (hover) every element and attribute', async () => {
    const { createLanguageServer } = await import('../packages/lsp/src/server.js');
    const s = createLanguageServer({ operations: async () => null });
    const { elements, attributes } = await syntax();
    const ask = async (text, method, character, line = 0) => {
      await s.handle({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: { textDocument: { uri, text } } });
      return (await s.handle({ jsonrpc: '2.0', id: 1, method, params: { textDocument: { uri }, position: { line, character } } }))[0].result;
    };
    const tags = (await ask('<xo-', 'textDocument/completion', 4)).map((i) => i.label);
    const attrs = (await ask('<p xo-', 'textDocument/completion', 6)).map((i) => i.label);
    for (const name of elements) {
      expect(tags, `the language server does not complete <${name}>`).toContain(name);
      expect((await ask(`<${name}>`, 'textDocument/hover', 3))?.contents.value, `the language server has no hover for <${name}>`).toContain(`**${name}**`);
    }
    for (const name of attributes) {
      expect(attrs, `the language server does not complete ${name}`).toContain(name);
      expect((await ask(`<p ${name}="x">`, 'textDocument/hover', 5))?.contents.value, `the language server has no hover for ${name}`).toContain(`**${name}**`);
    }
  });

  it('every element is named in llms.txt (or listed above as documented elsewhere, and then not named in llms.txt)', async () => {
    const { elements } = await syntax();
    for (const name of elements) {
      if (NOT_IN_LLMS.includes(name)) expect(word(name).test(llms), `llms.txt now names ${name}: remove it from NOT_IN_LLMS in this test`).toBe(false);
      else expect(word(name).test(llms), `llms.txt does not name <${name}> (add it, or add it to NOT_IN_LLMS if the token budget has no room)`).toBe(true);
    }
    for (const name of NOT_IN_LLMS) expect(elements, `NOT_IN_LLMS lists ${name}, which syntax.js no longer has`).toContain(name);
  });

  it('every element is documented in docs/ (the MCP tool search_docs reads that folder)', async () => {
    const { elements } = await syntax();
    for (const name of elements) expect(new RegExp(`<${name}(?![\\w-])`).test(docsText), `no page in docs/ shows <${name}>`).toBe(true);
  });

  it('docs/ai-integration.md lists every MCP tool and every code that `xoong check` and `xoong doctor` print', async () => {
    const doc = readFileSync('docs/ai-integration.md', 'utf8');
    const { createServer } = await import('../packages/mcp/src/server.js');
    for (const { name } of createServer({ llms: async () => '', operations: async () => ({ operations: {} }) }).tools) expect(doc, `docs/ai-integration.md does not mention the MCP tool ${name}`).toContain(name);
    const codes = [...new Set(['packages/cli/src/check.js', 'packages/cli/src/openapi.js'].flatMap((f) => readFileSync(f, 'utf8').match(/\bXO\d{3}\b/g)))];
    expect(codes.length).toBeGreaterThan(40);
    for (const code of codes) expect(doc, `docs/ai-integration.md does not list ${code}`).toContain(code);
  });

  it('the language server and the MCP server report the version of their package', async () => {
    const { VERSION: lsp } = await import('../packages/lsp/src/server.js');
    const { VERSION: mcp } = await import('../packages/mcp/src/server.js');
    expect(lsp).toBe(manifest('lsp').version);
    expect(mcp).toBe(manifest('mcp').version);
  });

  it('the MCP package ships the spec and the docs it serves (prepack.mjs), so `get_spec` works outside this repository', () => {
    const m = manifest('mcp');
    expect(m.scripts?.prepack, 'packages/mcp needs a prepack script that copies llms.txt and docs/ into src/').toContain('prepack.mjs');
    expect(m.files).toEqual(['src']);
    const prepack = readFileSync('packages/mcp/prepack.mjs', 'utf8');
    expect(prepack).toContain('llms.txt');
    expect(prepack).toContain('docs');
  });
});
