export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message ?? `HTTP ${status}`);
    this.code = body?.error?.code ?? String(status);
    this.fields = body?.error?.fields ?? {};
  }
}

async function request(method, path, body) {
  const res = await fetch(`/api${path}`, { method, headers: body && { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return res.status === 204 ? null : res.json();
}

export const listPeople = (params) => request('GET', `/people?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))}`);
export const createPerson = (person) => request('POST', '/people', person);
export const deletePeople = (ids) => request('POST', '/people/delete', { ids });
export const disablePerson = (id) => request('POST', `/people/${id}/disable`);
