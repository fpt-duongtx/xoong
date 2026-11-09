export interface Person { id: number; name: string; email: string; role: string; status: string }
export interface Page { items: Person[]; total: number }

export class ApiError extends Error {
  code: string;
  fields: Record<string, string>;
  constructor(status: number, body: any) {
    super(body?.error?.message ?? `HTTP ${status}`);
    this.code = body?.error?.code ?? String(status);
    this.fields = body?.error?.fields ?? {};
  }
}

async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`/api${path}`, { method, signal, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return (res.status === 204 ? null : res.json()) as Promise<T>;
}

export const listPeople = (params: Record<string, string | number | undefined>, signal: AbortSignal) =>
  request<Page>('GET', `/people?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]))}`, undefined, signal);
export const createPerson = (person: unknown) => request<Person>('POST', '/people', person);
export const deletePeople = (ids: number[]) => request<null>('POST', '/people/delete', { ids });
export const disablePerson = (id: number) => request<Person>('POST', `/people/${id}/disable`);
