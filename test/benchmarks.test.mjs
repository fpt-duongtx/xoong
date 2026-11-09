// The benchmark numbers on the site, in the home block and in the READMEs are generated from benchmarks/results/*.json. This test fails when a generated file
// (or a number in it) differs from the data, and when the data has lost what makes it credible: runs, spread, environment, pinned versions.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '../tools/site.mjs';
import { readmeTable, readmeCli, readmeMcp, homeBenchmarks, hasBenchmarks, published, benchmarksPageData } from '../tools/site/benchmarks-page.mjs';
import { pages } from '../tools/site/pages.mjs';
import { layout } from '../tools/site/lib.mjs';

const root = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf8');
const json = (name) => JSON.parse(read(`benchmarks/results/${name}.json`));

describe('benchmark results', () => {
  it('exist for runtime, effort, cli and mcp', () => { expect(benchmarksPageData).toBeTruthy(); });

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
    expect(Object.keys(r.variants)).toContain('angular');
  });

  it('pin every competitor dependency to an exact version', () => {
    for (const dir of ['apps/react', 'apps/vue', 'apps/angular', 'tooling']) {
      const pkg = JSON.parse(read(`benchmarks/${dir}/package.json`));
      for (const [name, range] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) expect(range, `${dir}: ${name}`).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('keep the competitors out of the repository lockfile and workspaces', () => {
    const root_ = JSON.parse(read('package.json'));
    expect(root_.workspaces).toEqual(['packages/*']);
    expect(read('package-lock.json')).not.toContain('@tanstack/react-query');
    expect(read('package-lock.json')).not.toContain('@modelcontextprotocol/sdk');
    expect(read('package-lock.json')).not.toContain('@angular/core');
  });
});

describe('the publish switch (benchmarks/results/publish.json)', () => {
  it('is a boolean file, and is off unless the owner turned it on', () => { expect(typeof JSON.parse(read('benchmarks/results/publish.json')).publish).toBe('boolean'); expect(published).toBe(JSON.parse(read('benchmarks/results/publish.json')).publish === true); });

  it('forced off: nothing is generated (no home block, no README table, no page registered)', () => {
    expect(homeBenchmarks(false)).toBe('');
    expect(readmeTable({ on: false })).toBe('');
    expect(readmeCli(false)).toBe('');
    expect(readmeMcp(false)).toBe('');
  });

  it('forced on: the page, the home block and the README tables are generated from the data', () => {
    const html = layout({ pages: [...pages.filter((p) => p !== benchmarksPageData), benchmarksPageData], page: benchmarksPageData });
    expect(html).toContain('Benchmarks');
    const r = json('runtime');
    const fmt = (x) => (x >= 100 ? Math.round(x) : x).toLocaleString('en-US', { minimumFractionDigits: x >= 100 ? 0 : 1, maximumFractionDigits: x >= 100 ? 0 : 1 });
    const text = html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&');
    for (const [id, v] of Object.entries(r.variants)) for (const p of ['local', 'mobile']) for (const key of ['fcp', 'usable', 'render1000', 'render10000']) expect(text, `${id}/${p}/${key}`).toContain(`${fmt(v.profiles[p][key].median)} ms`);
    expect(homeBenchmarks(true)).toContain('href="benchmarks.html');
    expect(readmeTable({ on: true })).toContain('| The same people screen |');
    expect(readmeCli(true)).toContain('xoong sync');
    expect(readmeMcp(true)).toContain('xoong-mcp');
  });

  it('the files on disk follow the switch', () => {
    const home = read('site/index.html');
    if (published) {
      const page = render().find((p) => p.file === 'benchmarks.html');
      expect(read('site/benchmarks.html')).toBe(page.html);
      expect(home.replace(/\s+/g, ' ')).toContain(homeBenchmarks().replace(/\s+/g, ' ').trim());
      expect(read('README.md')).toContain(readmeTable());
      expect(read('packages/xoong/README.md')).toContain(readmeTable());
      expect(read('packages/cli/README.md')).toContain(readmeCli());
      expect(read('packages/mcp/README.md')).toContain(readmeMcp());
    } else {
      expect(existsSync(join(root, 'site/benchmarks.html'))).toBe(false);
      expect(render().some((p) => p.file === 'benchmarks.html')).toBe(false);
      expect(read('site/search-index.json')).not.toContain('benchmarks.html');
      for (const f of ['site/index.html', 'README.md', 'packages/xoong/README.md', 'packages/cli/README.md', 'packages/mcp/README.md']) expect(read(f), f).not.toContain('Measured, not promised');
    }
  });

  it('every file of benchmarks/results is valid JSON', () => {
    for (const f of readdirSync(join(root, 'benchmarks/results')).filter((n) => n.endsWith('.json'))) expect(() => json(f.replace('.json', '')), f).not.toThrow();
  });
});
