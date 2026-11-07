export const api = {
  entities: {
    User: { id: 'id' },
    Order: { id: 'id', props: { customer: { t: 'entity', name: 'User' } } },
  },
  operations: {
    listUsers: { id: 'listUsers', method: 'GET', path: '/users', query: ['page', 'tag'], response: { t: 'array', items: { t: 'entity', name: 'User' } } },
    getUser: { id: 'getUser', method: 'GET', path: '/users/{id}', response: { t: 'entity', name: 'User' } },
    getUserPosts: { id: 'getUserPosts', method: 'GET', path: '/users/{id}/posts', response: null },
    createUser: { id: 'createUser', method: 'POST', path: '/users', body: true, response: { t: 'entity', name: 'User' } },
    disableUser: { id: 'disableUser', method: 'POST', path: '/users/{id}/disable', response: { t: 'entity', name: 'User' } },
    listOrders: { id: 'listOrders', method: 'GET', path: '/orders', response: { t: 'object', props: { items: { t: 'array', items: { t: 'entity', name: 'Order' } } } } },
    getDashboard: { id: 'getDashboard', method: 'GET', path: '/dashboard', response: null },
    shipOrder: { id: 'shipOrder', method: 'POST', path: '/orders/{id}/ship', response: null },
  },
};

/** Fake fetch: routes is { "GET /users": (req) => body | Response-like }. Records calls. */
export function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, init = {}) => {
    const u = new URL(url, 'http://x');
    const key = `${init.method ?? 'GET'} ${u.pathname}`;
    calls.push({ key, search: u.search, body: init.body ? JSON.parse(init.body) : undefined, headers: init.headers });
    const handler = routes[key];
    if (!handler) return json(404, { title: 'Not Found' });
    const out = await handler({ url: u, body: init.body ? JSON.parse(init.body) : undefined, calls });
    if (out instanceof Response) return out;
    return json(200, out);
  };
  fn.calls = calls;
  return fn;
}
export const json = (status, body) => new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' } });
export const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
