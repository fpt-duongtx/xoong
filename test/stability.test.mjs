// Every package declares a stability tier, docs/stability.md lists each package with that tier, and the package README says it.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dirs = readdirSync(join(root, 'packages')).sort();
const doc = readFileSync(join(root, 'docs/stability.md'), 'utf8');
const TIERS = ['core', 'evolving', 'experimental'];

describe('stability tiers', () => {
  for (const dir of dirs) {
    it(`${dir}: has a valid tier, listed the same in docs/stability.md, and repeated in its README`, () => {
      const pkg = JSON.parse(readFileSync(join(root, 'packages', dir, 'package.json'), 'utf8'));
      const tier = pkg.xoong?.stability;
      expect(TIERS, `${pkg.name} needs "xoong": { "stability": ... }`).toContain(tier);
      const row = doc.split('\n').find((l) => l.startsWith(`| \`${pkg.name}\` |`));
      expect(row, `${pkg.name} is not in the table of docs/stability.md`).toBeTruthy();
      expect(row.split('|')[2].trim(), `${pkg.name}: the tier in docs/stability.md`).toBe(tier);
      const readme = readFileSync(join(root, 'packages', dir, 'README.md'), 'utf8');
      expect(readme).toContain(`Stability: **${tier}**`);
    });
  }

  it('docs/stability.md lists only packages that exist', () => {
    const names = new Set(dirs.map((d) => JSON.parse(readFileSync(join(root, 'packages', d, 'package.json'), 'utf8')).name));
    for (const m of doc.matchAll(/^\| `(@xoong\/[a-z0-9-]+)` \|/gm)) expect(names.has(m[1]), m[1]).toBe(true);
  });
});
