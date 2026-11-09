import { spawn, execFile } from 'node:child_process';
import { summary, round } from './stats.mjs';

/** Wall time of one process from spawn to exit (Node start-up included, as a user's shell sees it), in ms. */
export const timeProcess = (cmd, args, opts = {}) => new Promise((resolve, reject) => {
  const t0 = process.hrtime.bigint();
  const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'], ...opts });
  let err = '';
  child.stderr.on('data', (d) => { err += d; });
  child.on('exit', (code) => { const ms = Number(process.hrtime.bigint() - t0) / 1e6; code === 0 ? resolve(ms) : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}: ${err.slice(0, 300)}`)); });
});

/** `runs` timed runs after `warmup` untimed ones (OS file cache, V8 code cache): the summary in ms, rounded. */
export async function bench(fn, { runs = 10, warmup = 1, digits = 1 } = {}) {
  for (let i = 0; i < warmup; i++) await fn();
  const xs = [];
  for (let i = 0; i < runs; i++) xs.push(await fn());
  const s = summary(xs);
  for (const k of ['median', 'min', 'max', 'q1', 'q3']) s[k] = round(s[k], digits);
  s.runs = xs.map((x) => round(x, digits));
  return s;
}
export const sh = (cmd, args, opts) => new Promise((res, rej) => execFile(cmd, args, opts, (e, out) => (e ? rej(e) : res(out))));
