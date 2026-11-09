import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repo } from './apps.mjs';

const sh = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: 'utf8', cwd: repo }).trim(); } catch { return ''; } };
/** Where and with what the numbers were measured: published next to them, because they depend on it. */
export function environment(extra = {}) {
  const version = JSON.parse(readFileSync(join(repo, 'packages/cli/package.json'), 'utf8')).version;
  return {
    date: new Date().toISOString().slice(0, 10),
    machine: `${os.cpus()[0].model}, ${os.cpus().length} cores, ${Math.round(os.totalmem() / 2 ** 30)} GB RAM`,
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    node: process.version,
    xoong: version,
    commit: sh('git', ['rev-parse', '--short', 'HEAD']),
    ...extra,
  };
}
export const pinned = (dir) => {
  const lock = JSON.parse(readFileSync(join(dir, 'package-lock.json'), 'utf8'));
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  return Object.fromEntries(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).map((n) => [n, lock.packages[`node_modules/${n}`].version]));
};
