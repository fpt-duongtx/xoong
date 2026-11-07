// Types for @xoong/data. The runtime is plain JavaScript; this file adds the typed client.
// Use it with the file `xoong sync` generates:
//
//   import type { Operations } from './.xoong/api.d.ts';
//   const client = createClient<Operations>({ api, baseUrl: '/api' });
//   const page = await client.load('listUsers', { limit: 10 });   // page: UserPage
//   await client.mutate('createUser', {}, { name: 'Ada' });       // body is checked

/** Shape of one entry of the generated `Operations` interface. */
export interface OperationType { method: string; path: string; params: any; body: any; response: any }

/** Arguments after the operation name: params may be left out when the operation has none that are required. */
type ParamsArg<O extends OperationType> = {} extends O['params'] ? [params?: O['params']] : [params: O['params']];
type Id<Ops> = keyof Ops & string;

type Signal<T> = { readonly value: T; peek(): T };

export class XoongError extends Error {
  status: number;
  title?: string;
  detail?: string;
  code?: string;
  retryAfterS?: number;
  problem?: any;
  operation?: string;
  /** Per-field messages when the server reports them (`{ email: 'is not valid' }`). */
  fields: Record<string, string>;
}

export interface ClientOptions {
  /** Contents of .xoong/operations.json */
  api: { operations: Record<string, any>; entities?: Record<string, any> };
  baseUrl?: string;
  fetch?: typeof fetch;
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  credentials?: RequestCredentials;
  staleTime?: number;
  gcTime?: number;
  evictEntities?: boolean;
  retry?: number;
  retryDelay?: number;
  invalidate?: Record<string, string[]>;
  onError?: (e: XoongError) => void;
  onUnauthorized?: (e: XoongError) => void;
  streamUrl?: string;
}

export interface SseEvent { event: string; data: string; json?: unknown; id?: string }

export interface TypedQuery<O extends OperationType> {
  readonly data: Signal<O['response'] | undefined>;
  readonly status: Signal<'idle' | 'loading' | 'success' | 'error'>;
  readonly error: Signal<XoongError | null>;
  retain(): void;
  release(): void;
  invalidate(): void;
  fetch(): Promise<O['response']>;
}

/**
 * `Ops` is the generated `Operations` interface. Without it every operation name is a string and nothing is checked.
 */
export interface Client<Ops extends Record<keyof Ops, OperationType> = any> {
  store: unknown;
  op(ref: string): any;
  query<K extends Id<Ops>>(op: K, ...params: ParamsArg<Ops[K]>): TypedQuery<Ops[K]>;
  load<K extends Id<Ops>>(op: K, ...params: ParamsArg<Ops[K]>): Promise<Ops[K]['response']>;
  mutate<K extends Id<Ops>>(op: K, params: Ops[K]['params'], ...body: [Ops[K]['body']] extends [never] ? [] : [body: Ops[K]['body']]): Promise<Ops[K]['response']>;
  stream<K extends Id<Ops>>(op: K, params: Ops[K]['params'], body?: Ops[K]['body'], options?: { signal?: AbortSignal }): AsyncGenerator<SseEvent>;
  invalidateAll(): void;
  readonly pending: number;
  readonly size: number;
}

export function createClient<Ops extends Record<keyof Ops, OperationType> = any>(options: ClientOptions): Client<Ops>;
export function configure<Ops extends Record<keyof Ops, OperationType> = any>(options: ClientOptions): Client<Ops>;
export function getClient<Ops extends Record<keyof Ops, OperationType> = any>(): Client<Ops>;
export function derived<T>(fn: (ctx: { all(name: string): any[]; get(name: string, id: string | number): any }) => T, client?: Client<any>): Signal<T>;
export function connectStream(options: { client: Client<any>; url: string; EventSource?: typeof EventSource; onStatus?: (s: 'open' | 'error' | 'closed') => void; onError?: (e: Error) => void }): { close(): void };
export function createStore(entityDefs?: Record<string, any>): unknown;
export function isRef(v: unknown): v is { $ref: string };
