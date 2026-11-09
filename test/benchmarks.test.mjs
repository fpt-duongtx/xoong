// The benchmark numbers on the site, in the home block and in the READMEs are generated from benchmarks/results/*.json. This test fails when a generated file
// (or a number in it) differs from the data, and when the data has lost what makes it credible: runs, spread, environment, pinned versions.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '../tools/site.mjs';
import { readmeTable, readmeCli, readmeMcp, homeBenchmarks, hasBenchmarks } from '../tools/site/benchmarks-page.mjs';

const root = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf8');
const json = (name) => JSON.parse(read(`benchmarks/results/${name}.json`));

describe('benchmark results', () => {
  it('exist for runtime, effort, cli and mcp', () => { expect(hasBenchmarks).toBe(true); });

  it('record environment, number of runs, every run and the spread', () => {
    for (const name of ['runtime', 'effort', 'cli', 'mcp']) {
      const d = json(name);
      expect(d.environment.machine, name).toBeTruthy();
      expect(d.environment.node, name).toMatch(/^v\d+/);
      expect(d.environment.commit, name).toBeTruthy();
    }
    const r = json('runtime');
    expect(r.runs).toBeGreaterThanOrEqual(5);
    expect(r.environment.browser).toMatch(/^Chromium /);
    for (const [id, v] of Object.entries(r.variants)) for (const [p, m] of Object.entries(v.profiles)) {
      for (const key of ['fcp', 'lcp', 'usable', 'render1000', 'render10000', 'sort1000', 'update1000']) {
        const s = m[key];
        expect(s.runs.length, `${id}/${p}/${key} runs`).toBe(r.runs);
        expect(s.min <= s.median && s.median <= s.max, `${id}/${p}/${key} spread`).toBe(true);
      }
      expect(m.cspViolations, `${id}/${p} CSP`).toBe(0);
    }
    expect(Object.keys(r.versions.react).length).toBeGreaterThan(3);
  });

  it('pin every competitor dependency to an exact version', () => {
    for (const dir of ['apps/react', 'apps/vue', 'tooling']) {
      const pkg = JSON.parse(read(`benchmarks/${dir}/package.json`));
      for (const [name, range] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) expect(range, `${dir}: ${name}`).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('keep the competitors out of the repository lockfile and workspaces', () => {
    const root_ = JSON.parse(read('package.json'));
    expect(root_.workspaces).toEqual(['packages/*']);
    expect(read('package-lock.json')).not.toContain('@tanstack/react-query');
    expect(read('package-lock.json')).not.toContain('@modelcontextprotocol/sdk');
  });
});

describe('published numbers follow the data', () => {
  it('site/benchmarks.html is what the generator writes from the JSON', () => {
    const page = render().find((p) => p.file === 'benchmarks.html');
    expect(page, 'benchmarks.html is registered').toBeTruthy();
    expect(read('site/benchmarks.html')).toBe(page.html);
  });

  it('every median of the runtime table is on the page', () => {
    const html = read('site/benchmarks.html').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&');
    const r = json('runtime');
    const fmt = (x) => (x >= 100 ? Math.round(x) : x).toLocaleString('en-US', { minimumFractionDigits: x >= 100 ? 0 : 1, maximumFractionDigits: x >= 100 ? 0 : 1 });
    for (const [id, v] of Object.entries(r.variants)) for (const p of ['local', 'mobile']) for (const key of ['fcp', 'usable', 'render1000', 'render10000']) {
      expect(html, `${id}/${p}/${key}`).toContain(`${fmt(v.profiles[p][key].median)} ms`);
    }
  });

  it('the home page block is what the generator writes, and links to the page', () => {
    const home = read('site/index.html');
    const block = homeBenchmarks().replace(/\s+/g, ' ');
    expect(home.replace(/\s+/g, ' ')).toContain(block.trim());
    expect(home).toContain('href="benchmarks.html"');
  });

  it('the root README and the npm READMEs carry the generated tables', () => {
    expect(read('README.md')).toContain(readmeTable());
    expect(read('packages/xoong/README.md')).toContain(readmeTable());
    expect(read('packages/cli/README.md')).toContain(readmeCli());
    expect(read('packages/mcp/README.md')).toContain(readmeMcp());
  });

  it('every file of benchmarks/results is valid JSON', () => {
    for (const f of readdirSync(join(root, 'benchmarks/results')).filter((n) => n.endsWith('.json'))) expect(() => json(f.replace('.json', '')), f).not.toThrow();
  });
});
