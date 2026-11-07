// A small in-memory backend for the admin example. Not part of xoong: it stands in for "your backend".
// It follows the live-update contract from docs/data-layer.md: field changes are pushed as `patch`,
// membership changes (create/delete) as `resync`, so clients refetch what they show.
import http from 'node:http';

export function startBackend({ port = 0 } = {}) {
  let nextId = 4;
  let version = 0;
  const users = new Map([
    [1, { id: 1, name: 'Ada Lovelace', email: 'ada@example.com', status: 'active' }],
    [2, { id: 2, name: 'Grace Hopper', email: 'grace@example.com', status: 'active' }],
    [3, { id: 3, name: 'Alan Turing', email: 'alan@example.com', status: 'active' }],
  ]);
  /** @type {Set<import('node:http').ServerResponse>} */
  const streams = new Set();
  const hits = { list: 0, get: 0, create: 0, disable: 0, delete: 0 };

  const push = (event) => { for (const res of streams) res.write(`data: ${JSON.stringify(event)}\n\n`); };
  const send = (res, status, body) => {
    res.writeHead(status, { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' });
    res.end(body === undefined ? undefined : JSON.stringify(body));
  };
  const fail = (res, status, code, message) => send(res, status, { error: { code, message } });
  const readJson = async (req) => { let t = ''; for await (const c of req) t += c; try { return t ? JSON.parse(t) : {}; } catch { return null; } };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const m = /^\/users\/(\d+)(\/disable)?$/.exec(url.pathname);
    if (req.method === 'GET' && url.pathname === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      res.write(': connected\n\n');
      streams.add(res);
      req.on('close', () => streams.delete(res));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/users') {
      hits.list++;
      const status = url.searchParams.get('status');
      const limit = Number(url.searchParams.get('limit') ?? 100);
      const items = [...users.values()].filter((u) => !status || u.status === status).slice(0, limit);
      return send(res, 200, { items, total: items.length });
    }
    if (req.method === 'POST' && url.pathname === '/users') {
      const body = await readJson(req);
      if (!body) return fail(res, 400, 'bad_json', 'body is not valid JSON');
      if (!String(body.name ?? '').trim()) return fail(res, 422, 'validation_failed', 'name is required');
      if (!/^\S+@\S+$/.test(String(body.email ?? ''))) return fail(res, 422, 'validation_failed', 'email is not valid');
      hits.create++;
      const user = { id: nextId++, name: String(body.name).trim(), email: body.email, status: 'active' };
      users.set(user.id, user);
      push({ type: 'resync' });
      return send(res, 201, user);
    }
    if (m && req.method === 'GET' && !m[2]) {
      hits.get++;
      const user = users.get(Number(m[1]));
      return user ? send(res, 200, user) : fail(res, 404, 'not_found', 'no such user');
    }
    if (m && req.method === 'POST' && m[2]) {
      const user = users.get(Number(m[1]));
      if (!user) return fail(res, 404, 'not_found', 'no such user');
      hits.disable++;
      user.status = 'disabled';
      push({ type: 'patch', entity: 'User', id: user.id, path: '/status', value: 'disabled', version: ++version });
      return send(res, 200, user);
    }
    if (m && req.method === 'DELETE' && !m[2]) {
      if (!users.delete(Number(m[1]))) return fail(res, 404, 'not_found', 'no such user');
      hits.delete++;
      push({ type: 'resync' });
      return send(res, 204);
    }
    fail(res, 404, 'not_found', `${req.method} ${url.pathname}`);
  });

  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({
    port: server.address().port, url: `http://127.0.0.1:${server.address().port}`, users, hits, streams,
    close: () => new Promise((r) => { for (const s of streams) s.end(); server.closeAllConnections?.(); server.close(() => r()); }),
  })));
}

// `node backend.mjs` runs it on :8080 (matches the proxy in xoong.config.json).
if (import.meta.url === `file://${process.argv[1]}`) {
  const b = await startBackend({ port: 8080 });
  console.log(`example backend on ${b.url}`);
}
