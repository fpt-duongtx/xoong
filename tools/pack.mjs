// Build installable tarballs of every package, so another project can use this checkout without npm publishing.
//
//   node tools/pack.mjs [outFolder] [--prefix ./vendor/xoong]        (default folder: dist-pack)
//
// Writes one .tgz per package plus `consume.json`, the exact dependencies and overrides to paste into the consumer's
// package.json. The packages depend on each other by name, so the overrides are what makes npm take the tarballs
// instead of looking for them on the registry.
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** @returns {Promise<{ file: string, name: string, version: string }[]>} */
export async function pack(outFolder = 'dist-pack', { prefix } = {}) {
  const out = resolve(outFolder);
  await mkdir(out, { recursive: true });
  const names = (await readdir(join(root, 'packages'))).sort();
  const packed = [];
  for (const dir of names) {
    const manifest = JSON.parse(await readFile(join(root, 'packages', dir, 'package.json'), 'utf8'));
    const { stdout } = await run('npm', ['pack', '--json', '--pack-destination', out], { cwd: join(root, 'packages', dir) });
    const [info] = JSON.parse(stdout);
    packed.push({ file: join(out, info.filename), name: manifest.name, version: manifest.version });
  }
  // `prefix`: where the consumer keeps the tarballs relative to its package.json (e.g. ./vendor/xoong); default: the absolute path here.
  const where = (p) => (prefix ? `file:${prefix.replace(/\/$/, '')}/${p.file.split('/').pop()}` : `file:${p.file}`);
  const dependencies = Object.fromEntries(packed.map((p) => [p.name, where(p)]));
  await writeFile(join(out, 'consume.json'), JSON.stringify({
    note: 'Paste into the consumer package.json: "dependencies" for what the project imports, and the whole "overrides" so the packages find each other.',
    commit: (await run('git', ['rev-parse', '--short', 'HEAD'], { cwd: root })).stdout.trim(),
    dependencies,
    overrides: dependencies,
  }, null, 2) + '\n');
  return packed;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--prefix');
  const prefix = i >= 0 ? args.splice(i, 2)[1] : undefined;
  const packed = await pack(args[0], { prefix });
  for (const p of packed) console.log(`${p.name}@${p.version}  ${p.file}`);
  console.log(`\n${packed.length} packages. See consume.json next to the tarballs.`);
}
