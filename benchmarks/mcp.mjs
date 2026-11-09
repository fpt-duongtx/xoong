// MCP benchmark: xoong-mcp (no SDK) over real stdio JSON-RPC, and a minimal server on the official TypeScript SDK answering the same tool.
//   node benchmarks/mcp.mjs [--runs 10] [--calls 200] [--out results/mcp.json]
import { spawn, execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { summary, round } from './lib/stats.mjs';
import { apps, repo, root } from './lib/apps.mjs';
import { environment, pinned } from './lib/env.mjs';
import { EXPLANATIONS, VERSION } from '../packages/mcp/src/server.js';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const RUNS = Number(arg('runs', 10));
const CALLS = Number(arg('calls', 200));
const out = arg('out', join(root, 'results/mcp.json'));
const cache = join(root, '.cache'); await mkdir(cache, { recursive: true });
await writeFile(join(cache, 'explanations.json'), JSON.stringify(EXPLANATIONS));
const ops = join(apps.xoong.dir, '.xoong/operations.json');
const now = () => Number(process.hrtime.bigint()) / 1e6;
const rss = (pid) => Number(execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8' }).trim()) / 1024; // MB

class Client {
  constructor(cmd, args) {
    this.t0 = now();
    this.child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'inherit'] });
    this.pending = new Map(); this.id = 0;
    createInterface({ input: this.child.stdout }).on('line', (l) => { const m = JSON.parse(l); this.pending.get(m.id)?.(m); this.pending.delete(m.id); });
  }
  send(method, params) { const id = ++this.id; return new Promise((res) => { this.pending.set(id, res); this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); }); }
  notify(method) { this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n'); }
  async init() { const r = await this.send('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'bench', version: '1' } }); this.notify('notifications/initialized'); return r; }
  call(name, args) { return this.send('tools/call', { name, arguments: args }); }
  kill() { this.child.kill('SIGKILL'); }
}
const servers = {
  'xoong-mcp': () => new Client('node', [join(repo, 'packages/mcp/src/cli.js'), '--operations', ops]),
  'TypeScript SDK reference': () => new Client('node', [join(root, 'tooling/mcp-reference.mjs'), join(cache, 'explanations.json')]),
};
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]; };
const lat = (xs) => ({ p50: round(pct(xs, 0.5), 3), p95: round(pct(xs, 0.95), 3), max: round(Math.max(...xs), 3), n: xs.length });

const screen = await readFile(join(apps.xoong.dir, 'index.html'), 'utf8');
const big = screen.replace('<main>', '<main>' + (screen.match(/<main>([\s\S]*)<\/main>/)[1]).repeat(100));
const inputs = {
  get_spec: {}, list_operations: {}, check_small: { html: '<xo-view get="listPeople"><xo-table columns="name"></xo-table></xo-view>' },
  check_large: { html: big }, explain_error: { code: 'XO201' }, explain_syntax: { name: 'xo-table' }, search_docs: { query: 'defineTemplate' },
};
const toolOf = (k) => k.replace(/_small|_large/, '');
const results = { environment: environment({ mcpVersion: VERSION }), runs: RUNS, calls: CALLS, inputBytes: { check_small: inputs.check_small.html.length, check_large: big.length }, versions: { '@modelcontextprotocol/sdk': pinned(join(root, 'tooling'))['@modelcontextprotocol/sdk'] }, servers: {} };

for (const [name, make] of Object.entries(servers)) {
  const r = (results.servers[name] = { startup: null, toolsList: null, calls: {}, throughput: null, rssMB: {} });
  const starts = [];
  for (let i = 0; i < RUNS + 1; i++) { const c = make(); await c.init(); if (i) starts.push(now() - c.t0); c.kill(); }
  const s = summary(starts); for (const k of ['median', 'min', 'max', 'q1', 'q3']) s[k] = round(s[k], 1); s.runs = s.runs.map((x) => round(x, 1)); r.startup = s;
  const c = make(); await c.init();
  await new Promise((res) => setTimeout(res, 300));
  r.rssMB.idle = round(rss(c.child.pid), 1);
  const tl = []; for (let i = 0; i < CALLS + 20; i++) { const t = now(); await c.send('tools/list'); if (i >= 20) tl.push(now() - t); }
  r.toolsList = lat(tl);
  const keys = name === 'xoong-mcp' ? Object.keys(inputs) : ['explain_error'];
  for (const k of keys) {
    for (let i = 0; i < 20; i++) await c.call(toolOf(k), inputs[k]);
    const xs = []; let size = 0;
    for (let i = 0; i < CALLS; i++) { const t = now(); const m = await c.call(toolOf(k), inputs[k]); xs.push(now() - t); if (m.error || m.result?.isError) throw new Error(`${name} ${k}: ${JSON.stringify(m).slice(0, 200)}`); size = m.result.content[0].text.length; }
    r.calls[k] = { ...lat(xs), responseChars: size };
  }
  // throughput: 20,000 explain_error requests written back to back, answered in whatever order the server likes. The client of this harness parses every answer too,
  // so for a fast server this number is partly the harness's own limit: read it as "at least".
  const N = 20000; const t = now();
  await Promise.all(Array.from({ length: N }, () => c.call('explain_error', inputs.explain_error)));
  r.throughput = { requests: N, perSecond: Math.round(N / ((now() - t) / 1000)) };
  c.kill();
  // memory: a fresh process each, so earlier bursts do not count. Idle after start; after 1,000 sequential explain_error calls (the same call for both servers);
  // and, for xoong-mcp, after 1,000 calls that cycle through every tool.
  const fresh = async (calls) => { const m = make(); await m.init(); await new Promise((res) => setTimeout(res, 300)); for (let i = 0; i < 1000; i++) await m.call(...calls(i)); const v = round(rss(m.child.pid), 1); m.kill(); return v; };
  r.rssMB.after1000ExplainError = await fresh(() => ['explain_error', inputs.explain_error]);
  if (name === 'xoong-mcp') { const ks = Object.keys(inputs); r.rssMB.after1000Mixed = await fresh((i) => [toolOf(ks[i % ks.length]), inputs[ks[i % ks.length]]]); }
  console.log(name, JSON.stringify({ startup: r.startup.median, tl: r.toolsList, throughput: r.throughput, rss: r.rssMB }), Object.fromEntries(Object.entries(r.calls).map(([k, v]) => [k, v.p50])));
}
await writeFile(out, JSON.stringify(results, null, 1) + '\n');
console.log('wrote', out);
