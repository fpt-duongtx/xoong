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
const RUNTIME = { core: [], data: ['@xoong/core'], ui: ['@xoong/core', '@xoong/data'] };

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

describe('size budget (gzip of the unminified source; a regression guard, not the shipped size)', () => {
  // data grew from 15 to 17 KB with unwrap, idempotency keys, multipart and declarative streaming (see docs/data-layer.md).
  // Raised again to 19 for composite ids, untagged unions and filter controls. This is the unminified gzip; the roadmap's
  // single-digit target applies to the minified size, which still has to be measured (docs/roadmap.md, size budgets).
  const budgetKb = { core: 6, data: 19, ui: 6 };
  for (const [name, kb] of Object.entries(budgetKb)) {
    it(`@xoong/${name} stays under ${kb} KB`, () => {
      const all = sources(name).map((s) => s.text).join('\n');
      const size = gzipSync(all).length / 1024;
      expect(size, `@xoong/${name} is ${size.toFixed(1)} KB gzipped, budget ${kb} KB`).toBeLessThanOrEqual(kb);
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
    expect(llms.length / 3.8).toBeLessThan(3000);
  });

  it('only mentions CLI commands that exist', () => {
    const help = readFileSync('packages/cli/src/cli.js', 'utf8');
    const used = new Set([...llms.matchAll(/^[ \t]+xoong (\w+)/gm)].map((m) => m[1]));
    expect(used.size).toBeGreaterThanOrEqual(5);
    for (const cmd of used) expect(help, `llms.txt mentions "xoong ${cmd}"`).toMatch(new RegExp(`cmd === '${cmd}'`));
  });

  it('only mentions xo-* attributes that xoong defines, and documents all of them', async () => {
    const { XO_ATTRIBUTES, XO_ELEMENTS, XO_UI_ATTRIBUTES, XO_UI_ELEMENTS } = await import('../packages/core/src/syntax.js');
    const known = new Set([...XO_ATTRIBUTES, ...XO_UI_ATTRIBUTES]);
    const eventsAndPlanned = new Set([...XO_ELEMENTS, ...XO_UI_ELEMENTS, 'xo-done', 'xo-error', 'xo-card', ...CSS_CLASSES]);
    const mentioned = new Set([...llms.matchAll(/\bxo-[a-z]+\b/g)].map((m) => m[0]));
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

  it('every CSS class llms.txt documents exists in xoong.css', () => {
    const css = readFileSync('packages/ui/src/xoong.css', 'utf8');
    for (const name of CSS_CLASSES) expect(css, `xoong.css has no .${name}`).toContain(`.${name}`);
  });
});
