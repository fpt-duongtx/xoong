import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { htmlData } from '../src/html-data.js';
import { sync } from '../src/index.js';
import { XO_ATTRIBUTES, XO_ELEMENTS, XO_UI_ATTRIBUTES, XO_UI_ELEMENTS, XO_CONTROL_ATTRIBUTES, XO_CONTROL_ELEMENTS } from '@xoong/core/syntax';

const table = { operations: {
  listUsers: { id: 'listUsers', method: 'GET', path: '/users' },
  getUser: { id: 'getUser', method: 'GET', path: '/users/{id}' },
  disableUser: { id: 'disableUser', method: 'POST', path: '/users/{id}/disable' },
} };

test('every element and attribute xoong defines has custom data with a description', () => {
  const data = htmlData(table);
  assert.deepEqual(data.tags.map((t) => t.name).sort(), [...XO_ELEMENTS, ...XO_UI_ELEMENTS, ...XO_CONTROL_ELEMENTS].sort());
  assert.deepEqual(data.globalAttributes.map((a) => a.name).sort(), [...XO_ATTRIBUTES, ...XO_UI_ATTRIBUTES, ...XO_CONTROL_ATTRIBUTES].sort());
  for (const item of [...data.tags, ...data.globalAttributes]) assert.ok(item.description.length > 20, `${item.name} needs a real description`);
});

test('operations from the synced table complete xo-click, xo-submit, get and op; p-* come from path params', () => {
  const data = htmlData(table);
  const set = (name) => data.valueSets.find((v) => v.name === name).values.map((v) => v.name);
  assert.deepEqual(set('xo-mutations'), ['POST /users/{id}/disable', 'disableUser']); // reads are not offered for xo-click
  assert.deepEqual(set('xo-reads'), ['/users', '/users/{id}', 'getUser', 'listUsers']);
  assert.equal(data.globalAttributes.find((a) => a.name === 'xo-click').valueSet, 'xo-mutations');
  const view = data.tags.find((t) => t.name === 'xo-view');
  assert.equal(view.attributes.find((a) => a.name === 'get').valueSet, 'xo-reads');
  assert.ok(view.attributes.some((a) => a.name === 'p-id'));
});

test('sync writes xoong.html-data.json next to operations.json', async () => {
  const out = await mkdtemp(join(tmpdir(), 'xoong-hd-'));
  await sync(new URL('./fixture.json', import.meta.url).pathname, { out });
  const data = JSON.parse(await readFile(join(out, 'xoong.html-data.json'), 'utf8'));
  assert.equal(data.version, 1.1);
  assert.ok(data.valueSets[0].values.length > 0);
});
