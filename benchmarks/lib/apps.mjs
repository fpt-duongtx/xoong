// The benchmarked implementations of the same screen. `dist` is what gets served; `build` is run inside `dir`.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
export const root = join(here, '..');
export const repo = join(root, '..');
export const apps = {
  xoong: { label: 'xoong', dir: join(root, 'apps/xoong'), dist: 'dist', kind: 'xoong' },
  // the measured build (xoong build --bundle --minify); `xoong` above is the readable copy, kept for the re-render probe and the acceptance test of the plain build
  'xoong-bundle': { label: 'xoong (bundled, minified)', dir: join(root, 'apps/xoong'), dist: 'dist-bundle', kind: 'xoong', variantOf: 'xoong' },
  react: { label: 'React', dir: join(root, 'apps/react'), dist: 'dist', kind: 'vite' },
  angular: { label: 'Angular', dir: join(root, 'apps/angular'), dist: 'dist/browser', kind: 'angular' },
  vue: { label: 'Vue', dir: join(root, 'apps/vue'), dist: 'dist', kind: 'vite' },
};
export const appDir = (name) => join(apps[name].dir, apps[name].dist);
