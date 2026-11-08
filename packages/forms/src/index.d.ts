// Types for @xoong/forms. The runtime is plain JavaScript; this file describes the form model and what the package exports.

/** A node of the request schema (`bodySchema` in operations.json). */
export interface SchemaNode {
  t: 'string' | 'integer' | 'number' | 'boolean' | 'object' | 'array' | 'union' | 'entity' | 'any' | string;
  nullable?: boolean; required?: string[]; props?: Record<string, SchemaNode>; items?: SchemaNode;
  enum?: unknown[]; format?: string; pattern?: string; minLength?: number; maxLength?: number; minimum?: number; maximum?: number; minItems?: number; maxItems?: number;
  default?: unknown; readOnly?: boolean; title?: string; description?: string; widget?: string; emptyAs?: 'null' | 'omit'; pruneEmpty?: boolean;
  [key: string]: unknown;
}

/** A rule returns '' when the value is fine, or the message (it may be asynchronous). `'*'` gets the whole record and returns messages by path. */
export type Rule = (value: any, context: { record: any }) => string | undefined | Promise<string | undefined>;
export type Rules = Record<string, Rule | ((record: any) => Record<string, string> | Promise<Record<string, string>>)>;

export interface ArrayChange { path: string; op: 'add' | 'remove' | 'move'; from?: number; to?: number }

/** The draft of one form. `errors`, `touched`, `filled` and `dirtyAt` are read by path: `model.errors['title.en']`. */
export interface FormModel {
  readonly value: any;
  readonly baseline: any;
  readonly dirty: boolean;
  readonly valid: boolean;
  readonly submitting: boolean;
  readonly pending: boolean;
  readonly stale: boolean;
  rules: Rules;
  serialize: ((draft: any, body: any) => any) | undefined;
  readonly errors: Record<string, string>;
  readonly touched: Record<string, boolean>;
  readonly filled: Record<string, boolean>;
  readonly dirtyAt: Record<string, boolean>;
  field(path: string): any;
  get(path: string): any;
  set(path: string, raw: unknown, options?: { coerced?: boolean }): unknown;
  append(path: string, initial?: unknown): number;
  removeAt(path: string): void;
  moveItem(path: string, delta: number): void;
  onArrayChange(fn: (change: ArrayChange) => void): () => void;
  touch(path: string): void;
  touchAll(): void;
  setServerErrors(map: Record<string, string> | undefined): void;
  reset(): void;
  markPristine(record?: any): void;
  refresh(record: any): void;
  body(): any;
  submit(send: (body: any) => Promise<any>, options?: { after?: () => void }): Promise<{ ok: boolean; result?: any; errors?: Record<string, string> }>;
  [key: string]: any;
}

export function createForm(options?: { schema?: SchemaNode; value?: any; rules?: Rules; serialize?: (draft: any, body: any) => any }): FormModel;
/** What is sent: the draft reduced to the request schema (empty values follow `emptyAs`, nullable required properties become null). */
export function normalize(node: SchemaNode | undefined, value: any): any;
/** Attach a model to a `<form>`: the binder that `<form xo-submit>` uses. */
export function attach(form: HTMLFormElement, options: { schema: SchemaNode; record?: () => any; hadRecord?: boolean }): { model: FormModel; submit(send: (body: any) => Promise<any>): Promise<any>; detach(): void; rescan(): void };
export function isoToLocal(iso: string): string;
export function localToIso(local: string): string;

export function parsePath(path: string): (string | number)[];
export function pathKey(parts: (string | number)[]): string;
export function getAt(value: any, parts: (string | number)[]): any;
export function setAt(value: any, parts: (string | number)[], next: unknown): any;
export function nodeAt(node: SchemaNode | undefined, parts: (string | number)[], value?: any): SchemaNode | undefined;
export function variant(node: SchemaNode | undefined, value: any): SchemaNode | undefined;
export function coerce(node: SchemaNode | undefined, raw: unknown): unknown;
export function defaults(node: SchemaNode | undefined): unknown;
export function validate(node: SchemaNode, value: any, at?: (string | number)[]): Record<string, string>;
export function checkValue(node: SchemaNode, value: unknown): string;
export function setMessages(partial: Record<string, (params: Record<string, any>) => string>): void;
export function resetMessages(): void;
export function message(code: string, params?: Record<string, any>): string;
