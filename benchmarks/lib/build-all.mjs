// Builds the three screens: `xoong sync` + `xoong build` (with and without modulepreload) and `vite build` for the competitors.
// The competitors' dependencies are installed from their own package-lock.json (`npm ci` inside apps/react and apps/vue), never by the repository's `npm ci`.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { apps, repo } from './apps.mjs';

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });
const xoong = join(repo, 'packages/cli/src/cli.js');
const x = apps.xoong.dir;
run('node', [xoong, 'sync', join(x, '../../shared/openapi.json'), '--out', join(x, '.xoong'), '--hints', join(x, 'xoong.hints.json')], repo);
run('node', [xoong, 'build', '--root', x, '--out', join(x, 'dist')], repo);
run('node', [xoong, 'build', '--root', x, '--out', join(x, 'dist-nopreload'), '--no-preload'], repo);
if (!existsSync(join(x, 'node_modules'))) run('npm', ['ci', '--no-audit', '--no-fund'], x); // esbuild, for the optional minified build only
run('node', [xoong, 'build', '--root', x, '--out', join(x, 'dist-min'), '--minify'], repo);
for (const name of ['react', 'vue', 'angular']) {
  const dir = apps[name].dir;
  if (!existsSync(join(dir, 'node_modules'))) run('npm', ['ci', '--no-audit', '--no-fund'], dir);
  run('npx', name === 'angular' ? ['ng', 'build'] : ['vite', 'build'], dir);
}
