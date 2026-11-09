// The reference as data: site/reference.json. Generated, never written by hand, from the single sources of truth:
//   packages/core/src/syntax.js      the names of the elements and the attributes
//   packages/cli/src/html-data.js    their descriptions, the attributes of each element, the fixed value sets (also what the editors and the MCP server show)
//   packages/*/src/*.js              `static props` (the type of an attribute), `define('xo-...')`
//   packages/*/src/index.d.ts        the signatures of the JavaScript API
//   tools/site/reference-supplement.mjs   what the code cannot say: examples, guide pages, events, the text of the API entries
// test/reference.test.mjs keeps the supplement in step with the code (every name, every event, every example runs through `xoong check`).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SYNTAX, ELEMENT_DOCS, ATTRIBUTE_DOCS, VALUE_SETS, elementAttributes, explainSyntax } from '../../packages/cli/src/html-data.js';
import { XO_UI_ELEMENTS } from '../../packages/core/src/syntax.js';
import { GROUPS, ELEMENTS, DIRECTIVES, EVENTS, API, TEMPLATE } from './reference-supplement.mjs';

const root = new URL('../..', import.meta.url).pathname;
const read = (file) => readFileSync(join(root, file), 'utf8');
const VERSION = JSON.parse(read('packages/xoong/package.json')).version;

// ---- text helpers ---------------------------------------------------------------------------------------------------------------
/** The first sentence of a description (the one-line summary). */
export const firstSentence = (text) => text.match(/^.*?[.!?](?=\s|$)/s)?.[0] ?? text;
/** The descriptions name the package in passing ("(@xoong/controls)", "(@xoong/controls, WAI-ARIA switch)"); the entry shows it on its own. */
const unpackage = (text) => text.replace(/ \(@xoong\/[a-z]+\)/g, '').replace(/\(@xoong\/[a-z]+, /g, '(');
const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const capital = (s) => s[0].toUpperCase() + s.slice(1);

// ---- the types of the attributes: `static props` of the class behind each element --------------------------------------------------
const PROP_TYPES = { String: 'text', Number: 'number', Boolean: 'flag' };
/** tag -> { attribute: 'text' | 'number' | 'flag' } from the `static props` of the class that `define()` registers for it. */
function propTypes() {
  const out = {};
  const baseProps = (read('packages/core/src/control.js').match(/^\s*static props = \{([^}]*)\}/m)?.[1] ?? '');
  const parse = (body) => Object.fromEntries([
    ...(body.includes('...XoControl.props') ? [...baseProps.matchAll(/(\w+): (String|Number|Boolean)/g)] : []),
    ...body.matchAll(/(\w+): (String|Number|Boolean)/g),
  ].map(([, name, type]) => [kebab(name), PROP_TYPES[type]]));
  for (const dir of readdirSync(join(root, 'packages'))) {
    const src = join(root, 'packages', dir, 'src');
    if (!existsSync(src)) continue;
    for (const file of readdirSync(src).filter((f) => f.endsWith('.js'))) {
      const text = readFileSync(join(src, file), 'utf8');
      for (const [, tag, cls] of text.matchAll(/define\('(xo-[\w-]+)', (\w+)\)/g)) {
        const start = text.search(new RegExp(`class ${cls} extends`));
        const next = text.indexOf('\nclass ', start + 1);
        const body = text.slice(start, next < 0 ? undefined : next).match(/static props = \{([^}]*)\}/)?.[1];
        if (body !== undefined) out[tag] = parse(body);
      }
    }
  }
  return out;
}

/** A default the description states: "(default 6, ...)", "(default `items`)", "`cover` (default)", "the default is 40rem". */
function defaultOf(description) {
  const paren = description.match(/\(default:? ([^)]*)\)/i)?.[1];
  if (paren) return paren.split(/[;,]| = /)[0].replace(/[`"]/g, '').trim();
  return description.match(/`([^`]+)` \(default\)/)?.[1] ?? description.match(/the default is ([^).]+)/)?.[1]?.trim() ?? null;
}

// ---- the declarations of the JavaScript API: a small scanner of index.d.ts files --------------------------------------------------
/** The text of the declaration that starts at line `i` (up to the line where its braces and parentheses are balanced and a `;` or `}` ends it). */
function declarationAt(lines, i) {
  let depth = 0;
  for (let j = i; j < lines.length; j++) {
    const code = lines[j].replace(/\/\/.*$/, '').replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '');
    for (const c of code) { if ('{(['.includes(c)) depth++; else if ('})]'.includes(c)) depth--; }
    if (depth <= 0 && /[;}]\s*$/.test(code)) return lines.slice(i, j + 1);
  }
  return lines.slice(i);
}

/** @returns {Map<string, { kind: string, decl: string, members: Map<string, string> }>} the exported names of a .d.ts text and the members of their object types */
export function scanDeclarations(text) {
  const lines = text.split('\n');
  const out = new Map();
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^export (?:declare )?(function|const|class|interface|type) (\w+)/);
    if (!m) continue;
    const block = declarationAt(lines, i);
    const members = new Map();
    if (block.length === 1 && m[1] === 'const' && /: \{.*\}/.test(block[0])) { // `export const toast: { show(...): void };`
      const inner = block[0].slice(block[0].indexOf('{') + 1, block[0].lastIndexOf('}'));
      let depth = 0, from = 0;
      const parts = [];
      for (let k = 0; k < inner.length; k++) { if ('{(['.includes(inner[k])) depth++; else if ('})]'.includes(inner[k])) depth--; else if (inner[k] === ';' && !depth) { parts.push(inner.slice(from, k)); from = k + 1; } }
      parts.push(inner.slice(from));
      for (const part of parts) { const mm = part.trim().match(/^(?:readonly )?(\w+)\s*[(<:?]/); if (mm && !members.has(mm[1])) members.set(mm[1], `${part.trim()};`); }
    } else if (block.length > 1) {
      for (let k = 1; k < block.length - 1; k++) {
        const mm = block[k].match(/^ {2}(?:readonly )?(?:get |set )?(\w+)\s*[(<:?]/);
        if (mm && !members.has(mm[1])) members.set(mm[1], declarationAt(block, k).map((l) => l.trim()).join(' ').replace(/\s+/g, ' '));
      }
    }
    out.set(m[2], { kind: m[1], decl: block.map((l) => l.replace(/^export /, '')).join('\n').trim(), members });
    i += block.length - 1;
  }
  return out;
}

/** Every exported declaration of the .d.ts files in packages/<dir>/src. */
export function packageDeclarations(dir) {
  const folder = join(root, 'packages', dir, 'src');
  const all = new Map();
  for (const file of readdirSync(folder).filter((f) => f.endsWith('.d.ts')).sort()) for (const [name, d] of scanDeclarations(readFileSync(join(folder, file), 'utf8'))) if (!all.has(name)) all.set(name, d);
  return all;
}

// ---- the groups ---------------------------------------------------------------------------------------------------------------------
const importFor = (pkg, tag) => (tag === 'xo-view' ? "import '@xoong/data/view';" : `import '${pkg}';`);

function elements() {
  const props = propTypes();
  return SYNTAX.elements.map((tag) => {
    const info = ELEMENTS[tag] ?? {};
    const [description] = ELEMENT_DOCS[tag];
    const pkg = description.match(/\(@xoong\/([a-z]+)\)/)?.[1] ? `@xoong/${description.match(/\(@xoong\/([a-z]+)\)/)[1]}` : tag === 'xo-view' ? '@xoong/data' : XO_UI_ELEMENTS.includes(tag) ? '@xoong/ui' : '@xoong/controls';
    const attributes = elementAttributes(tag).map(([name, text]) => {
      const values = VALUE_SETS[`${tag} ${name}`] ?? VALUE_SETS[name] ?? null;
      const declared = info.types?.[name] ?? props[tag]?.[name] ?? 'text';
      const type = values ? 'choice' : declared === 'choice' ? 'text' : declared; // a choice is a value set of html-data.js: without one it is plain text
      const fallback = type === 'flag' ? 'off' : null;
      return { name, type, default: info.defaults?.[name] ?? defaultOf(text) ?? fallback, values, description: text };
    });
    if (tag === 'xo-view') attributes.push({ name: 'p-<name>', type: 'text', default: null, values: null, description: capital(explainSyntax('p-name').text.replace(/^p-name: /, '')) });
    const fires = (info.events ?? []).map((name) => ({ name, id: `event-${name}`, summary: EVENTS[name].summary }));
    return {
      id: tag, name: tag, kind: 'element', package: pkg, import: importFor(pkg, tag), summary: firstSentence(unpackage(description)), description: unpackage(description),
      attributes, events: fires, example: { lang: 'html', code: info.example.trim() }, guide: info.guide ?? null, keywords: info.keywords ?? '',
    };
  });
}

/** The order of the categories of the directives, as the page and the menu list them. */
export const CATEGORY_ORDER = ['Read data', 'Actions', 'Form rows', 'Routing', 'Dialogs', 'Controls', 'Language'];

function directives() {
  const list = SYNTAX.attributes.map((name) => {
    const info = DIRECTIVES[name] ?? {};
    const description = ATTRIBUTE_DOCS[name];
    return {
      id: name, name, kind: 'directive', category: info.category, package: info.package, summary: firstSentence(description), description,
      applies: info.applies, value: info.value, values: VALUE_SETS[name] ?? null, notes: info.notes ?? [],
      example: { lang: 'html', code: info.example.trim() }, guide: info.guide ?? null, keywords: info.keywords ?? '',
    };
  });
  return list.sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)); // stable: syntax.js order inside a category
}

function events() {
  return Object.entries(EVENTS).map(([name, e]) => ({
    id: `event-${name}`, name, kind: 'event', summary: e.summary, description: [e.summary, e.description].filter(Boolean).join(' '), from: e.from, detail: e.detail, bubbles: true, cancelable: !!e.cancelable,
    firedBy: Object.entries(ELEMENTS).filter(([, v]) => v.events?.includes(name)).map(([tag]) => tag),
    keywords: e.keywords ?? '', example: { lang: 'js', code: `document.addEventListener('${name}', (event) => console.log(event.detail));` },
  }));
}

/** The codes of the validation messages, from the catalogue in packages/forms/src/schema.js. */
const messageCodes = () => {
  const keys = [...(read('packages/forms/src/schema.js').match(/const catalogue = \{([\s\S]*?)\n\};/)?.[1] ?? '').matchAll(/^ {2}(\w+):/gm)].map((m) => `\`${m[1]}\``);
  return `${keys.slice(0, -1).join(', ')} and ${keys.at(-1)}`;
};

function api() {
  const decls = {};
  return API.map((a) => {
    let declaration = a.hand ?? null;
    if (!declaration) {
      const dir = (a.from ?? [])[0] ?? (a.member ? { Client: 'data', toast: 'ui', router: 'ui' }[a.member[0]] : undefined);
      const found = (decls[dir] ??= packageDeclarations(dir));
      if (a.from) declaration = found.get(a.from[1])?.decl ?? null;
      else if (a.member) declaration = found.get(a.member[0])?.members.get(a.member[1]) ?? null;
    }
    return {
      id: `api-${a.id}`, name: a.name, kind: 'api', package: a.package, import: a.import ?? a.package, type: a.kind ?? (a.member ? 'method' : 'function'),
      signature: a.sig, returns: a.returns ?? null, declaration, summary: a.summary, description: a.description.replace('{codes}', () => messageCodes()), params: (a.params ?? []).map(([name, type, text]) => ({ name, type, description: text })),
      example: { lang: 'js', code: a.example.trim() }, guide: a.guide ?? null, keywords: a.keywords ?? '',
    };
  });
}

function template() {
  return TEMPLATE.map((t) => ({
    id: `tpl-${t.id}`, name: t.name, kind: 'syntax', summary: t.summary, description: t.description, table: t.table ?? null,
    example: { lang: 'html', code: t.example.trim() }, guide: t.guide ?? null, keywords: t.keywords ?? '',
  }));
}

/** The whole reference: the content of site/reference.json. */
export function buildReference() {
  const entries = { elements: elements(), directives: directives(), events: events(), api: api(), template: template() };
  return {
    name: 'xoong', version: VERSION, note: 'Generated by tools/site/reference-data.mjs from packages/core/src/syntax.js, packages/cli/src/html-data.js, the index.d.ts files and tools/site/reference-supplement.mjs. Do not edit.',
    groups: GROUPS.map((g) => ({ id: g.id, label: g.label, summary: g.summary, count: entries[g.id].length, entries: entries[g.id] })),
  };
}

export const referenceJson = () => `${JSON.stringify(buildReference(), null, 1)}\n`;
