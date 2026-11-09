import { test, describe, it, expect } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { htmlData, SYNTAX, VALUE_SETS, FORM_CONTROLS, elementAttributes, explainSyntax } from '../src/html-data.js';
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

// ---- values, shared control attributes, and what the runtime really reads -----------------------------------------------------------

const sourceOf = (pkg) => readdirSync(new URL(`../../${pkg}/src/`, import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => readFileSync(new URL(`../../${pkg}/src/${f}`, import.meta.url), 'utf8'));
const runtimeSources = ['data', 'ui', 'controls', 'richtext'].flatMap(sourceOf);
const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

describe('attributes with a fixed set of values', () => {
  it('are offered as value sets to the editor, on the element or globally', () => {
    const data = htmlData(table);
    const set = (name) => data.valueSets.find((v) => v.name === name)?.values.map((v) => v.name);
    expect(set('xo-confirm-kind')).toEqual(['danger', 'warning', 'info', 'success']);
    expect(set('xo-dialog-size')).toEqual(['sm', 'wide', 'full']);
    expect(data.globalAttributes.find((a) => a.name === 'xo-confirm-kind').valueSet).toBe('xo-confirm-kind');
    expect(data.tags.find((t) => t.name === 'xo-dialog').attributes.find((a) => a.name === 'size').valueSet).toBe('xo-dialog-size');
    expect(data.tags.find((t) => t.name === 'xo-avatar').attributes.find((a) => a.name === 'status').valueSet).toBe('xo-avatar-status');
    expect(data.tags.find((t) => t.name === 'xo-dialog').attributes.find((a) => a.name === 'heading').valueSet).toBeUndefined();
  });

  it('every entry names an element and an attribute that exist and are documented', () => {
    for (const key of Object.keys(VALUE_SETS)) {
      const [tag, name] = key.includes(' ') ? key.split(' ') : [undefined, key];
      if (tag) expect(SYNTAX.elements, `${key}: no element ${tag}`).toContain(tag);
      const documented = tag ? elementAttributes(tag).map(([n]) => n) : SYNTAX.attributes;
      expect(documented, `${key} is not documented`).toContain(name);
      expect(VALUE_SETS[key].length).toBeGreaterThan(0);
    }
  });

  it('are the values the runtime knows (each is in the source of the element that reads it)', () => {
    const text = runtimeSources.join('\n');
    for (const [key, values] of Object.entries(VALUE_SETS)) for (const v of values) expect(text, `${key}: the runtime never mentions "${v}"`).toMatch(new RegExp(`['"\`]${v}['"\`]|\\b${v}:`));
  });
});

describe('form controls', () => {
  it('FORM_CONTROLS is exactly the controls that extend XoControl, and each lists required, disabled and readonly', () => {
    const extending = [];
    for (const text of runtimeSources) {
      for (const m of text.matchAll(/define\('(xo-[\w-]+)',\s*(\w+)\)/g)) {
        let cls = m[2];
        for (let i = 0; i < 4 && cls; i++) { // XoTags extends XoCombobox extends XoControl
          const parent = new RegExp(`class ${cls} extends (\\w+)`).exec(text)?.[1];
          if (parent === 'XoControl') { extending.push(m[1]); break; }
          cls = parent;
        }
      }
    }
    expect([...FORM_CONTROLS].sort()).toEqual(extending.sort());
    for (const tag of FORM_CONTROLS) expect(elementAttributes(tag).map(([n]) => n)).toEqual(expect.arrayContaining(['required', 'disabled', 'readonly']));
    expect(elementAttributes('xo-otp').filter(([n]) => n === 'required')).toHaveLength(1); // not twice when the element documents it itself
    expect(elementAttributes('xo-pager').map(([n]) => n)).not.toContain('required');
    const data = htmlData(table);
    expect(data.tags.find((t) => t.name === 'xo-slider').attributes.map((a) => a.name)).toEqual(expect.arrayContaining(['min', 'max', 'required']));
  });
});

describe('the documented attributes cover what each element reads', () => {
  // props that an element inherits or sets itself are not for the author to write
  const NOT_FOR_AUTHORS = { 'xo-tags': ['multiple', 'creatable', 'remote'] }; // <xo-tags> is a combobox that is always multiple and creatable
  const IGNORED = ['slot', 'name', 'required', 'disabled', 'readonly']; // slot is global HTML; the other four come with FORM_CONTROLS (checked above)

  /** The attributes an element reads: `static props` of its class (or its parent's), or, for a template element, the attributes its file reads. */
  function readBy(tag) {
    const text = runtimeSources.find((t) => new RegExp(`define(Template)?\\('${tag}'`).test(t));
    const cls = new RegExp(`define\\('${tag}',\\s*(\\w+)\\)`).exec(text)?.[1];
    const props = (name) => {
      const m = new RegExp(`class ${name} extends (\\w+) \\{([\\s\\S]*?)\\n\\}\\n`).exec(text);
      if (!m) return null;
      const own = /static props = \{([^}]*)\}/.exec(m[2]);
      if (own) return [...own[1].matchAll(/(\w+)\s*:/g)].map((k) => kebab(k[1]));
      return ['XoControl', 'XoElement'].includes(m[1]) ? [] : props(m[1]);
    };
    return [...new Set((cls && props(cls)) || [...text.matchAll(/(?:get|has)Attribute\('([\w-]+)'\)/g)].map((m) => m[1]))];
  }

  for (const tag of SYNTAX.elements) {
    it(`<${tag}>`, () => {
      const documented = elementAttributes(tag).map(([n]) => n);
      const missing = readBy(tag).filter((p) => !documented.includes(p) && !IGNORED.includes(p) && !(NOT_FOR_AUTHORS[tag] ?? []).includes(p));
      expect(missing, `<${tag}> reads ${missing.join(', ')}, which html-data.js does not document`).toEqual([]);
    });
  }
});

describe('explainSyntax: what the MCP server answers', () => {
  it('describes an element with its attributes and values, in the forms an assistant writes it', () => {
    for (const name of ['xo-dialog', '<xo-dialog>', ' xo-dialog ']) {
      const r = explainSyntax(name);
      expect(r.found, name).toBe(true);
      expect(r.text).toMatch(/^<xo-dialog>: A modal/);
      expect(r.text).toContain('size (sm | wide | full)');
      expect(r.text).toContain('heading: The title');
    }
    expect(explainSyntax('xo-switch').text).toContain('required:'); // the shared control attributes
  });

  it('describes an attribute of an element, a global attribute, and p-<name>', () => {
    for (const name of ['xo-dialog size', 'xo-dialog/size', 'xo-dialog.size', '<xo-dialog> size']) expect(explainSyntax(name).text, name).toBe('<xo-dialog size>: `sm`, `wide` or `full` (the default is 40rem).\nValues: sm, wide, full.');
    expect(explainSyntax('xo-confirm-kind').text).toMatch(/^xo-confirm-kind: With xo-confirm[\s\S]*\nValues: danger, warning, info, success\.$/);
    expect(explainSyntax('xo-then').text).toContain('/articles/{id}');
    expect(explainSyntax('xo-table xo-click').text).toMatch(/^xo-click: /); // a global attribute named after an element
    expect(explainSyntax('p-id').text).toContain('path parameter "id"');
  });

  it('suggests the closest name for a typo, and nothing for a word that is not xo-something', () => {
    expect(explainSyntax('xo-dilog')).toEqual({ found: false, suggestions: ['xo-dialog'] });
    expect(explainSyntax('xo-confirm-knd')).toEqual({ found: false, suggestions: ['xo-confirm-kind'] });
    expect(explainSyntax('xo-dialog sise')).toEqual({ found: false, suggestions: ['xo-dialog size'] });
    expect(explainSyntax('xo-dialog zzzzzzzzzzzz').suggestions.length).toBeGreaterThan(0); // not close to any: the attributes it has
    expect(explainSyntax('nope')).toEqual({ found: false, suggestions: [] });
    expect(explainSyntax('')).toEqual({ found: false, suggestions: [] });
    expect(explainSyntax(undefined).found).toBe(false);
  });

  it('knows every element and attribute of the syntax lists', () => {
    for (const name of [...SYNTAX.elements, ...SYNTAX.attributes]) expect(explainSyntax(name).found, name).toBe(true);
  });
});
