import { createClient, XoongError } from '@xoong/data';
import type { Operations, User, UserPage } from './api.d.ts';
import api from './operations.json' with { type: 'json' };

const client = createClient<Operations>({ api, baseUrl: '/api' });

// Correct calls compile, and results are typed.
const page: UserPage = await client.load('listUsers', { limit: 10, sort: '-name' });
const first: User = page.items[0];
const created: User = await client.mutate('createUser', {}, { name: 'Ada', email: 'a@x.test', role: 'admin' });
await client.load('listUsers'); // every parameter is optional here
const one: User = await client.load('getUser', { id: 1 });
await client.mutate('disableUser', { id: 1 });
await client.mutate('deleteUser', { id: 1 });
const q = client.query('getUser', { id: 2 });
const name: string | undefined = q.data.value?.name;
void [first, created, one, name];

try { await client.load('listUsers'); } catch (e) { if (e instanceof XoongError) console.log(e.fields.email); }

// Mistakes are compile errors.
// @ts-expect-error unknown operation name
await client.load('listUser');
// @ts-expect-error a required path parameter is missing
await client.load('getUser');
// @ts-expect-error wrong parameter type
await client.load('getUser', { id: 'one' });
// @ts-expect-error unknown parameter
await client.load('listUsers', { colour: 'red' });
// @ts-expect-error body is required and checked
await client.mutate('createUser', {}, { name: 'Ada' });
// @ts-expect-error enum value not allowed
await client.mutate('createUser', {}, { name: 'Ada', email: 'a@x.test', role: 'root' });
// @ts-expect-error GET result is not a string
const wrong: string = await client.load('getUser', { id: 1 });
void wrong;
