// Sets the version of every package (they all share one number) and makes the packages depend on each other by that exact version.
//
//   node tools/set-version.mjs 0.0.30
//
// Updates packages/*/package.json (version and the @xoong/* ranges), the workspace entries of package-lock.json, docs/consuming.md and the
// version line of CHANGELOG-independent docs. An exact range matters once the packages are on npm: "*" would let an install mix versions.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version ?? '')) { console.error('usage: node tools/set-version.mjs 0.0.30'); process.exit(1); }
const root = new URL('../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const write = (p, json) => writeFileSync(new URL(p, root), JSON.stringify(json, null, 2) + '\n');
const own = (name) => name.startsWith('@xoong/');
const pin = (deps) => { for (const name of Object.keys(deps ?? {})) if (own(name)) deps[name] = version; };

const dirs = readdirSync(new URL('packages/', root)).sort();
for (const dir of dirs) {
  const path = `packages/${dir}/package.json`;
  const json = read(path);
  json.version = version;
  pin(json.dependencies); pin(json.devDependencies); pin(json.peerDependencies); pin(json.optionalDependencies);
  write(path, json);
}
const lock = read('package-lock.json');
for (const [key, entry] of Object.entries(lock.packages)) {
  if (key.startsWith('packages/')) { entry.version = version; pin(entry.dependencies); pin(entry.devDependencies); pin(entry.peerDependencies); }
}
write('package-lock.json', lock);
const consuming = new URL('docs/consuming.md', root);
writeFileSync(consuming, readFileSync(consuming, 'utf8').replace(/\bv?0\.0\.\d+(?=[.\-\s`"/])/g, (m) => (m.startsWith('v') ? `v${version}` : version)));
console.log(`set ${dirs.length} packages to ${version}`);
