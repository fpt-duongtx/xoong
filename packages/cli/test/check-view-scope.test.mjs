// What the AI benchmark found models get wrong, and nothing said so: an element that acts through an <xo-view> outside one, an xo-each that does not match the
// response of the view's operation, and an expression where a path is read. XO277, XO278 and XO279, and the response shape in the operations list.
import { describe, it, expect } from 'vitest';
import { checkHtml, describeResponse } from '../src/check.js';

const table = { operations: {
  listPosts: { id: 'listPosts', method: 'GET', path: '/posts', response: { t: 'array', items: { t: 'entity', name: 'Post' } } },
  listUsers: { id: 'listUsers', method: 'GET', path: '/users', query: ['limit'], response: { t: 'object', props: { items: { t: 'array', items: { t: 'entity', name: 'User' } }, total: { t: 'integer' } } } },
  createUser: { id: 'createUser', method: 'POST', path: '/users', bodyFields: [{ name: 'name', required: true }], response: { t: 'entity', name: 'User' } },
  deleteUser: { id: 'deleteUser', method: 'DELETE', path: '/users/{id}' },
  bare: { id: 'bare', method: 'GET', path: '/bare' },
  ping: { id: 'ping', method: 'GET', path: '/ping', response: { t: 'object', props: { ok: { t: 'boolean' } } } },
} };
const codes = (html, options) => checkHtml(html, table, 'a.html', options).map((f) => f.code);
const first = (html, options) => checkHtml(html, table, 'a.html', options)[0];

describe('describeResponse: the shape of a response in a few words', () => {
  it('an array of records, an object with an array field, one record, scalars, nothing', () => {
    expect(describeResponse(table.operations.listPosts.response)).toBe('Post[]');
    expect(describeResponse(table.operations.listUsers.response)).toBe('{ items: User[], total: integer }');
    expect(describeResponse(table.operations.createUser.response)).toBe('User');
    expect(describeResponse(table.operations.ping.response)).toBe('{ ok: boolean }');
    expect(describeResponse(undefined)).toBe('');
    expect(describeResponse({ t: 'array', items: { t: 'string' } })).toBe('string[]');
  });
});

describe('XO277: what acts through a view is inside one', () => {
  it('<xo-form> outside an <xo-view> is an error with the fix, inside one (even without get) it is fine', () => {
    const f = first('<section><xo-form op="POST /users" submit="Add"></xo-form></section>');
    expect(f).toMatchObject({ code: 'XO277', level: 'error' });
    expect(f.fix).toContain('<xo-view><xo-form');
    expect(codes('<xo-view><xo-form op="POST /users" submit="Add"></xo-form></xo-view>')).toEqual([]);
    expect(codes('<xo-view get="listUsers"><xo-dialog id="d"><xo-view><xo-form op="POST /users"></xo-form></xo-view></xo-dialog></xo-view>')).toEqual([]);
  });

  it('xo-click, xo-param and xo-refresh outside a view do nothing, and that is said', () => {
    expect(codes('<button xo-click="DELETE /users/{id}">x</button>')).toEqual(['XO277']);
    expect(codes('<button xo-param="limit=5">5</button><xo-view get="listUsers"><li xo-each="items">{name}</li></xo-view>')).toEqual(['XO277']);
    expect(codes('<button xo-refresh>again</button>')).toEqual(['XO277']);
    expect(codes('<xo-view get="listUsers"><button xo-param="limit=5">5</button><button xo-refresh>again</button><li xo-each="items"><button xo-click="DELETE /users/{id}">x</button></li></xo-view>')).toEqual([]);
  });

  it('a fragment (an html`...` template, a piece of a page) is not judged: its view may be around it', () => {
    expect(codes('<xo-form op="POST /users"></xo-form><button xo-param="limit=5">5</button>', { fragment: true })).toEqual([]);
  });
});

describe('XO278: xo-each follows the response of the view\'s operation', () => {
  it('an array response is repeated with ".", not by a field name', () => {
    const f = first('<xo-view get="listPosts"><li xo-each="items">{title}</li></xo-view>');
    expect(f).toMatchObject({ code: 'XO278', level: 'error' });
    expect(f.message).toContain('returns an array (Post[])');
    expect(f.fix).toBe('Repeat the response itself: xo-each="."');
    expect(codes('<xo-view get="listPosts"><li xo-each=".">{title}</li></xo-view>')).toEqual([]);
    expect(codes('<xo-view get="/posts"><li xo-each=".">{title}</li></xo-view>')).toEqual([]);
  });

  it('an object response is repeated by the name of an array field, with the closest name for a typo', () => {
    expect(codes('<xo-view get="listUsers"><li xo-each="items">{name}</li></xo-view>')).toEqual([]);
    const typo = first('<xo-view get="listUsers"><li xo-each="itms">{name}</li></xo-view>');
    expect(typo).toMatchObject({ code: 'XO278', level: 'error' });
    expect(typo.message).toContain('closest: "items"');
    expect(typo.fix).toBe('Repeat an array field: xo-each="items"');
    const dot = first('<xo-view get="listUsers"><li xo-each=".">{name}</li></xo-view>');
    expect(dot.message).toContain('returns an object');
    expect(dot.fix).toBe('Repeat its array field: xo-each="items"');
  });

  it('only the first xo-each of a view is judged (the inner ones read the item), "$..." variables and unknown responses are not', () => {
    expect(codes('<xo-view get="listUsers"><li xo-each="items"><b xo-each="tags">{.}</b></li></xo-view>')).toEqual([]);
    expect(codes('<xo-view get="listUsers"><li xo-each="$selected">{.}</li></xo-view>')).toEqual([]);
    expect(codes('<xo-view get="bare"><li xo-each="anything">x</li></xo-view>')).toEqual([]); // a response nobody described: nothing to compare with
    expect(codes('<xo-view><li xo-each="items">{name}</li></xo-view>')).toEqual([]); // no get: nothing to compare with
  });
});

describe('XO279: {...} is a path, not an expression', () => {
  it('a negation, a comparison or a condition in an attribute is said to stay as written', () => {
    const f = first('<xo-view get="listUsers"><button xo-param="limit-=5" hidden="{!$hasPrev}">Previous</button></xo-view>');
    expect(f).toMatchObject({ code: 'XO279', level: 'warn' });
    expect(f.fix).toContain('xo-if="!path"');
    expect(codes('<xo-view get="listUsers"><button disabled="{a && b}">x</button></xo-view>')).toEqual(['XO279']);
    expect(codes('<xo-view get="listUsers"><button disabled="{n > 1}">x</button></xo-view>')).toEqual(['XO279']);
  });

  it('a path (with a format), a literal JSON value, and anything outside a view are fine', () => {
    expect(codes('<xo-view get="listUsers"><button hidden="{flag}" title="{name | upper}" data-x=\'{"a":1}\' class="{status}">x</button></xo-view>')).toEqual([]);
    expect(codes('<p hidden="{!flag}">x</p>')).toEqual([]);
  });
});

describe('XO280: a form that edits a record is not nested in a view that does not load it', () => {
  const t2 = { operations: { ...table.operations,
    getUser: { id: 'getUser', method: 'GET', path: '/users/{id}', response: { t: 'entity', name: 'User' } },
    updateUser: { id: 'updateUser', method: 'PUT', path: '/users/{id}', bodyFields: [{ name: 'name', required: true }], response: { t: 'entity', name: 'User' } },
  } };
  const c2 = (html) => checkHtml(html, t2, 'a.html').map((f) => f.code);

  it('a view without get nested around an edit form is said to give it neither the record nor the id', () => {
    const f = checkHtml('<xo-view get="getUser" p-id="?id"><xo-view><form xo-submit="updateUser"><input name="name"><button>Save</button></form></xo-view></xo-view>', t2, 'a.html').find((x) => x.code === 'XO280');
    expect(f).toMatchObject({ code: 'XO280', level: 'warn' });
    expect(f.fix).toContain('directly inside');
  });

  it('the form directly in the view that loads the record, a view that is given the id, an add form and a form in a row are fine', () => {
    expect(c2('<xo-view get="getUser" p-id="?id"><form xo-submit="updateUser"><input name="name"><button>Save</button></form></xo-view>')).toEqual([]);
    expect(c2('<xo-view p-id="?id"><form xo-submit="updateUser"><input name="name"><button>Save</button></form></xo-view>')).toEqual([]);
    expect(c2('<xo-view><form xo-submit="createUser"><input name="name"><button>Add</button></form></xo-view>')).toEqual([]);
    expect(c2('<xo-view get="listUsers"><li xo-each="items"><form xo-submit="updateUser"><input name="name"><button>Save</button></form></li></xo-view>')).toEqual([]);
  });
});

describe('XO281 / XO282: named templates', () => {
  const tpl = '<template xo-define="node"><span>{label}</span><ul><li xo-each="children" xo-use="node"></li></ul></template>';
  it('a fixed name with no template of that name is a warning with the closest name; a name that exists, a name with data and a fallback are fine', () => {
    const f = checkHtml(`<xo-view get="ping">${tpl}<div xo-use="nodes"></div></xo-view>`, table, 'a.html').find((x) => x.code === 'XO281');
    expect(f).toMatchObject({ code: 'XO281', level: 'warn' });
    expect(f.fix).toContain('xo-use="node"');
    expect(codes(`<xo-view get="ping">${tpl}<div xo-use="node"></div></xo-view>`)).toEqual([]);
    expect(codes(`<xo-view get="ping">${tpl}<div xo-use="block-{type}"></div></xo-view>`)).toEqual([]); // known only when the page runs
    expect(codes('<xo-view get="ping"><div xo-use="missing"><i>fallback</i></div></xo-view>')).toEqual([]);
    expect(codes('<xo-view get="ping"><div xo-use="missing"></div></xo-view>', { fragment: true })).toEqual([]); // the name may be defined in another file
  });

  it('a template of the page can be used by a view, and its own xo-use is not a stray one', () => {
    expect(codes(`${tpl}<xo-view get="ping"><div xo-use="node"></div></xo-view>`)).toEqual([]);
  });

  it('xo-use outside a view does nothing and says so (XO277); an empty xo-use or xo-define is XO221', () => {
    expect(codes(`${tpl}<div xo-use="node"></div>`)).toEqual(['XO277']);
    expect(codes('<xo-view get="ping"><div xo-use=""></div></xo-view>')).toContain('XO221');
  });

  it('xo-define on something that is not a <template> is an error; a name defined twice is a warning', () => {
    expect(codes('<xo-view get="ping"><div xo-define="a"></div></xo-view>')).toContain('XO282');
    const twice = checkHtml('<xo-view get="ping"><template xo-define="a"><i></i></template><template xo-define="a"><b></b></template></xo-view>', table, 'a.html').filter((x) => x.code === 'XO282');
    expect(twice.length).toBe(2);
    expect(twice[0].level).toBe('warn');
  });
});

describe('layout elements (xo-stack, xo-row, xo-grid, xo-center)', () => {
  it('are known elements, and a value the CSS does not know is a warning with the values it knows (XO271)', () => {
    expect(codes('<xo-center size="narrow"><xo-stack gap="2" align="center"><xo-row justify="between" align="baseline" wrap><b>a</b><i grow>b</i></xo-row><xo-grid cols="3" gap="4"><p>x</p></xo-grid></xo-stack></xo-center>')).toEqual([]);
    const f = checkHtml('<xo-row gap="9" justify="spread"><b>a</b></xo-row>', table, 'a.html');
    expect(f.map((x) => x.code)).toEqual(['XO271', 'XO271']);
    expect(f[0].message).toContain('"9"');
    expect(f[0].message).toContain('is not one of "0", "1"');
    expect(codes('<xo-grid cols="5"><p>x</p></xo-grid>')).toEqual(['XO271']);
    expect(codes('<xo-stack align="between"><p>x</p></xo-stack>')).toEqual(['XO271']); // between is a row's justify, not a stack's align
  });
});
