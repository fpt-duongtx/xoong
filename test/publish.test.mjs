// What a published package must look like (checked without the network): one version, exact lockstep dependencies, a LICENSE and a README in
// every package, only src in the tarball, every export and bin target present. `npm pack --dry-run` lists the tarball without writing it.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dirs = readdirSync(join(root, 'packages')).sort();
const manifest = (dir) => JSON.parse(readFileSync(join(root, 'packages', dir, 'package.json'), 'utf8'));
const licence = readFileSync(join(root, 'LICENSE'), 'utf8');
const targets = (value) => (typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(targets) : []);

describe('packages are ready for npm', () => {
  const versions = new Set(dirs.map((d) => manifest(d).version));

  it('share one version, and depend on each other by exactly that version', () => {
    expect([...versions]).toHaveLength(1);
    const [version] = versions;
    for (const dir of dirs) {
      const m = manifest(dir);
      for (const deps of [m.dependencies, m.devDependencies, m.peerDependencies, m.optionalDependencies]) {
        for (const [name, range] of Object.entries(deps ?? {})) if (name.startsWith('@xoong/')) expect(range, `${m.name} depends on ${name}`).toBe(version);
      }
    }
  });

  for (const dir of dirs) {
    it(`${dir}: metadata, LICENSE, README, exports and a tarball with only src`, () => {
      const m = manifest(dir);
      expect(m.private).toBeUndefined();
      expect(m.license).toBe('MIT');
      expect(m.description.length).toBeGreaterThan(30);
      expect(m.repository?.directory).toBe(`packages/${dir}`);
      expect(m.publishConfig).toEqual({ access: 'public' });
      expect(m.engines?.node).toBe('>=22.12');
      expect(m.files).toEqual(['src']);
      expect(readFileSync(join(root, 'packages', dir, 'LICENSE'), 'utf8')).toBe(licence);
      const readme = readFileSync(join(root, 'packages', dir, 'README.md'), 'utf8');
      expect(readme.startsWith(`# ${m.name}\n`), 'README starts with the package name').toBe(true);
      for (const t of [...targets(m.exports), ...targets(m.bin), ...(m.main ? [m.main] : [])]) {
        if (/\.(js|css|json|ts)$/.test(t)) expect(existsSync(join(root, 'packages', dir, t)), `${m.name} points at ${t}`).toBe(true);
      }
      const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: join(root, 'packages', dir), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
      const names = pack.files.map((f) => f.path);
      for (const name of names) expect(/^(src\/|package\.json$|README\.md$|LICENSE$)/.test(name), `unexpected file in the tarball of ${m.name}: ${name}`).toBe(true);
      expect(names.some((n) => /\.(test|spec)\./.test(n)), 'no tests in the tarball').toBe(false);
      expect(names).toContain('README.md');
      expect(names).toContain('LICENSE');
      expect(pack.unpackedSize, `${m.name} unpacked size`).toBeLessThan(600 * 1024);
    });
  }
});
