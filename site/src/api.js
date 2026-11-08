// A backend for the demos, in the page: GitHub Pages serves files only, so a function plays the API.
// The data layer takes any `fetch` (configure({ fetch })), so everything on the demo pages goes through the same code path
// as a real server: typed operations, caching, loading and error states. Data lives in memory: reload to start again.
import { configure } from '@xoong/data';
import operations from '/.xoong/operations.json' with { type: 'json' };

const people = [
  { id: 1, name: 'Ada Lovelace', email: 'ada@example.org', role: 'admin', topics: ['web', 'data'], keywords: ['analysis', 'engine'], bio: '<p>Wrote the first program for the <strong>Analytical Engine</strong>.</p>' },
  { id: 2, name: 'Grace Hopper', email: 'grace@example.org', role: 'editor', topics: ['ops'], keywords: ['compiler'], bio: '<p>Built the first compiler.</p>' },
  { id: 3, name: 'Edsger Dijkstra', email: 'edsger@example.org', role: 'viewer', topics: ['data'], keywords: ['graphs', 'semaphores'], bio: '' },
  { id: 4, name: 'Barbara Liskov', email: 'barbara@example.org', role: 'editor', topics: ['design', 'data'], keywords: ['abstraction'], bio: '' },
  { id: 5, name: 'Donald Knuth', email: 'donald@example.org', role: 'viewer', topics: ['data'], keywords: ['literate programming'], bio: '' },
  { id: 6, name: 'Margaret Hamilton', email: 'margaret@example.org', role: 'admin', topics: ['ops'], keywords: ['software engineering'], bio: '' },
  { id: 7, name: 'Tim Berners-Lee', email: 'tim@example.org', role: 'editor', topics: ['web'], keywords: ['http', 'html'], bio: '' },
  { id: 8, name: 'Linus Torvalds', email: 'linus@example.org', role: 'viewer', topics: ['ops'], keywords: ['kernel'], bio: '' },
];
let nextId = people.length + 1;

const json = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const problem = (status, code, message, fields) => json(status, { error: { code, message, ...(fields ? { fields } : {}) } });
const clean = (b) => ({
  name: String(b.name ?? '').trim(), email: String(b.email ?? '').trim(), role: b.role || 'viewer',
  topics: Array.isArray(b.topics) ? b.topics : [], keywords: Array.isArray(b.keywords) ? b.keywords : [], bio: b.bio ?? '',
});

let failed = false; // the demo of an error state: the first search for "fail" is refused, the retry works

function list(q) {
  if (!failed && q.get('name') === 'fail') { failed = true; return problem(500, 'unavailable', 'The people service is not answering'); }
  let rows = people.filter((p) => (!q.get('name') || p.name.toLowerCase().includes(q.get('name').toLowerCase())) && (!q.get('role') || p.role === q.get('role')));
  const sort = q.get('sort');
  if (sort) {
    const key = sort.replace(/^-/, ''), dir = sort.startsWith('-') ? -1 : 1;
    rows = [...rows].sort((a, b) => (typeof a[key] === 'number' ? a[key] - b[key] : String(a[key] ?? '').localeCompare(String(b[key] ?? ''))) * dir);
  }
  const offset = Number(q.get('offset') || 0), limit = Number(q.get('limit') || rows.length);
  return json(200, { items: rows.slice(offset, offset + limit), total: rows.length });
}

async function handle(url, init = {}) {
  const { pathname, searchParams } = new URL(url, location.origin);
  const method = (init.method || 'GET').toUpperCase();
  await new Promise((r) => setTimeout(r, 120)); // a little latency, so loading states are visible
  const m = pathname.match(/^\/api\/people(?:\/(\d+))?$/);
  if (!m) return problem(404, 'not_found', 'No such route');
  const id = m[1] && Number(m[1]);
  const found = id ? people.find((p) => p.id === id) : null;
  if (!id && method === 'GET') return list(searchParams);
  if (!id && method === 'POST') {
    const body = clean(JSON.parse(init.body));
    if (people.some((p) => p.email === body.email)) return problem(409, 'email_taken', `${body.email} is already used. Try another address.`);
    const person = { id: nextId++, ...body };
    people.push(person);
    return json(201, person);
  }
  if (!found) return problem(404, 'not_found', `Person ${id} does not exist`);
  if (method === 'GET') return json(200, found);
  if (method === 'PUT') {
    const body = clean({ ...found, ...JSON.parse(init.body) });
    if (people.some((p) => p.id !== id && p.email === body.email)) return problem(409, 'email_taken', `${body.email} is already used. Try another address.`);
    Object.assign(found, body);
    return json(200, found);
  }
  if (method === 'DELETE') { people.splice(people.indexOf(found), 1); return json(204); }
  return problem(405, 'method_not_allowed', 'Not allowed');
}

configure({ api: operations, baseUrl: '', fetch: handle });
