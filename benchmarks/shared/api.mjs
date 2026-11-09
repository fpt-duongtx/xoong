// The mock API every benchmarked screen talks to: the same process, the same data, the same answers, so the only difference between
// the screens is the front end. In-memory, deterministic (seeded), no artificial latency unless a mode asks for it.
//
//   GET    /api/people?q=&sort=name|-name&limit=&offset=   -> { items, total }
//   POST   /api/people                                      -> 201 | 422 { error: { code, message, fields } }
//   POST   /api/people/delete   { ids: [..] }               -> 204   (bulk delete)
//   POST   /api/people/{id}/disable                         -> 200 person
//   POST   /__bench/mode { mode, rows }                     (test control, not part of the screen's API)
//        mode: normal | error (list answers 500) | empty (list answers no rows) | slow (list answers after 700 ms)

const FIRST = ['Ada', 'Alan', 'Grace', 'Linus', 'Margaret', 'Dennis', 'Barbara', 'Ken', 'Edsger', 'Radia', 'Tim', 'Hedy', 'Donald', 'Frances', 'Niklaus', 'Sophie'];
const LAST = ['Lovelace', 'Turing', 'Hopper', 'Torvalds', 'Hamilton', 'Ritchie', 'Liskov', 'Thompson', 'Dijkstra', 'Perlman', 'Berners-Lee', 'Lamarr', 'Knuth', 'Allen', 'Wirth', 'Wilson'];

/** `rows` people with ids 1..rows: names and emails come from a fixed pattern, so every run and every screen sees the same list. */
export function seed(rows) {
  const out = [];
  for (let i = 1; i <= rows; i++) {
    const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]} ${i}`;
    out.push({ id: i, name, email: `person${i}@example.com`, role: i % 5 === 0 ? 'admin' : 'member', status: 'active' });
  }
  return out;
}

const collator = new Intl.Collator('en', { numeric: true });

export function createApi({ rows = 10000 } = {}) {
  let people = seed(rows);
  // Sorted copies (ascending, same objects) per field, so a request costs a slice, not a 10,000-element sort: the benchmark measures the front end, not this mock.
  // Kept in step by hand: a create or delete drops them all, a disable drops the one for `status`.
  let sorted = new Map();
  const sortedBy = (key) => {
    if (!sorted.has(key)) sorted.set(key, [...people].sort((a, b) => collator.compare(String(a[key]), String(b[key])) || a.id - b.id));
    return sorted.get(key);
  };
  let nextId = rows + 1;
  let mode = 'normal';
  const send = (res, status, body) => {
    res.writeHead(status, { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' });
    res.end(body === undefined ? undefined : JSON.stringify(body));
  };
  const fail = (res, status, code, message, fields) => send(res, status, { error: { code, message, ...(fields ? { fields } : {}) } });
  const readJson = async (req) => { let t = ''; for await (const c of req) t += c; try { return t ? JSON.parse(t) : {}; } catch { return null; } };

  /** @returns {Promise<boolean>} true when the request was an API request (and has been answered) */
  async function handle(req, res) {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    if (p === '/__bench/mode' && req.method === 'POST') {
      const b = await readJson(req);
      mode = b.mode ?? 'normal';
      if (b.rows !== undefined) { people = seed(b.rows); nextId = b.rows + 1; sorted = new Map(); sortedBy('name'); }
      send(res, 200, { mode, rows: people.length });
      return true;
    }
    if (!p.startsWith('/api/')) return false;
    const m = /^\/api\/people\/(\d+)(\/disable)?$/.exec(p);
    if (req.method === 'GET' && p === '/api/people') {
      if (mode === 'error') { fail(res, 500, 'internal', 'The list could not be loaded'); return true; }
      if (mode === 'slow') await new Promise((r) => setTimeout(r, 700));
      const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
      const limit = Number(url.searchParams.get('limit') ?? 25);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const sort = url.searchParams.get('sort');
      let list = mode === 'empty' ? [] : people;
      if (sort) {
        const key = sort.replace(/^-/, '');
        if (!['id', 'name', 'email', 'role', 'status'].includes(key)) { fail(res, 400, 'bad_sort', `cannot sort by ${key}`); return true; }
        if (mode !== 'empty') list = sort.startsWith('-') ? [...sortedBy(key)].reverse() : sortedBy(key);
      }
      if (q) list = list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
      send(res, 200, { items: list.slice(offset, offset + limit), total: list.length });
      return true;
    }
    if (req.method === 'POST' && p === '/api/people') {
      const body = await readJson(req);
      if (!body) { fail(res, 400, 'bad_json', 'body is not valid JSON'); return true; }
      const fields = {};
      if (!String(body.name ?? '').trim()) fields.name = 'name is required';
      if (!/^\S+@\S+\.\S+$/.test(String(body.email ?? ''))) fields.email = 'email is not valid';
      else if (people.some((u) => u.email === body.email)) fields.email = 'email is already taken';
      if (!['admin', 'member'].includes(body.role)) fields.role = 'role must be admin or member';
      if (Object.keys(fields).length) { fail(res, 422, 'validation_failed', Object.values(fields)[0], fields); return true; }
      const person = { id: nextId++, name: String(body.name).trim(), email: body.email, role: body.role, status: 'active' };
      people.push(person);
      sorted = new Map();
      send(res, 201, person);
      return true;
    }
    if (req.method === 'POST' && p === '/api/people/delete') {
      const body = await readJson(req);
      if (!body || !Array.isArray(body.ids)) { fail(res, 400, 'bad_json', 'ids is required'); return true; }
      const gone = new Set(body.ids.map(Number));
      people = people.filter((u) => !gone.has(u.id));
      sorted = new Map();
      send(res, 204);
      return true;
    }
    if (m && req.method === 'POST' && m[2]) {
      const person = people.find((u) => u.id === Number(m[1]));
      if (!person) { fail(res, 404, 'not_found', 'no such person'); return true; }
      person.status = 'disabled';
      sorted.delete('status');
      send(res, 200, person);
      return true;
    }
    if (m && req.method === 'DELETE' && !m[2]) {
      const before = people.length;
      people = people.filter((u) => u.id !== Number(m[1]));
      sorted = new Map();
      if (people.length === before) fail(res, 404, 'not_found', 'no such person'); else send(res, 204);
      return true;
    }
    fail(res, 404, 'not_found', `${req.method} ${p}`);
    return true;
  }
  return { handle, get people() { return people; } };
}
