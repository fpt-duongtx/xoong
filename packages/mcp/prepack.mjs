// Runs before `npm pack` / `npm publish` (and with --clean afterwards): puts the spec and the documentation inside the package, because the
// tarball may only hold src/. `get_spec` and `search_docs` then work for a project that installed @xoong/mcp from npm.
// The copies are generated, not committed (see .gitignore here); in the repository the server reads llms.txt and docs/ from the root.
//   node prepack.mjs [--clean] [--src <folder>]      --src: another src folder to fill (the test uses a copy of the package)
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const args = process.argv.slice(2);
const src = args.includes('--src') ? args[args.indexOf('--src') + 1] : here('src');

for (const generated of [join(src, 'llms.txt'), join(src, 'docs')]) rmSync(generated, { recursive: true, force: true });
if (!args.includes('--clean')) {
  copyFileSync(here('../../llms.txt'), join(src, 'llms.txt'));
  mkdirSync(join(src, 'docs'));
  for (const file of readdirSync(here('../../docs')).filter((f) => f.endsWith('.md'))) copyFileSync(here(`../../docs/${file}`), join(src, 'docs', file));
}
