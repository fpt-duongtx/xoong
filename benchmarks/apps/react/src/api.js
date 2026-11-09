export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message ?? `HTTP ${status}`);
    this.code = body?.error?.code ?? String(status);
    this.fields = body?.error?.fields ?? {};
  }
}

async function request(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return res.status === 204 ? null : res.json();
}

export const listPeople = ({ q, sort, limit, offset }) => {
  const p = new URLSearchParams({ limit, offset });
  if (q) p.set('q', q);
  if (sort) p.set('sort', sort);
  return request('GET', `/people?${p}`);
};
export const createPerson = (person) => request('POST', '/people', person);
export const deletePeople = (ids) => request('POST', '/people/delete', { ids });
export const disablePerson = (id) => request('POST', `/people/${id}/disable`);
