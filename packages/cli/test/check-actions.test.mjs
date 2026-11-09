// `xoong check` for the action attributes (xo-then, xo-confirm-*, xo-with ...), the dialog attributes, xo-param, and <xo-pager>.
// Every rule here catches something the runtime silently ignores, so each has a case that must be reported and the correct form that must not.
import { describe, it, expect } from 'vitest';
import { checkHtml, checkScript } from '../src/check.js';

const table = { operations: {
  listUsers: { id: 'listUsers', method: 'GET', path: '/users', query: ['limit', 'offset', 'sort', 'status'] },
  listPlain: { id: 'listPlain', method: 'GET', path: '/plain' },
  createUser: { id: 'createUser', method: 'POST', path: '/users', body: true, bodyFields: [{ name: 'name', type: 'string', required: true }, { name: 'status', type: 'string' }], bodySkipped: [{ name: 'address', type: 'object' }] },
  updateUser: { id: 'updateUser', method: 'PATCH', path: '/users/{id}', body: true, bodySchema: { t: 'object', props: { name: { t: 'string' }, tags: { t: 'array', items: { t: 'string' } } } } },
  deleteUser: { id: 'deleteUser', method: 'DELETE', path: '/users/{id}' },
  bulkDelete: { id: 'bulkDelete', method: 'POST', path: '/users/bulk-delete', body: true, bodyFields: [{ name: 'ids', type: 'array' }] },
} };
const found = (html, options) => checkHtml(html, table, 'x.html', options).map((f) => f.code);
const first = (html, options) => checkHtml(html, table, 'x.html', options)[0];

describe('<xo-pager> is checked like <xo-table>', () => {
  it('XO251: outside an <xo-view get>', () => {
    expect(found('<xo-pager page-size="10"></xo-pager>')).toEqual(['XO251']);
    expect(first('<xo-view><xo-pager></xo-pager></xo-view>').message).toContain('<xo-pager>');
  });

  it('XO250: the operation needs limit and offset, even without page-size (the pager pages by 25 then)', () => {
    expect(found('<xo-view get="/plain"><xo-pager page-size="10"></xo-pager></xo-view>')).toEqual(['XO250']);
    const f = first('<xo-view get="/plain"><xo-pager></xo-pager></xo-view>');
    expect(f.code).toBe('XO250');
    expect(f.message).toContain('"limit", "offset"');
    expect(f.message).toContain('<xo-pager>');
    expect(f.fix).toContain('remove the pager');
    expect(found('<xo-view get="/users"><xo-pager page-size="10" page-sizes="10,20"></xo-pager></xo-view>')).toEqual([]);
  });

  it('a table still reports what it did: sort needs `sort`, page-size needs limit and offset', () => {
    expect(found('<xo-view get="/plain"><xo-table sortable page-size="5"></xo-table></xo-view>')).toEqual(['XO250']);
    expect(first('<xo-view get="/plain"><xo-table sortable></xo-table></xo-view>').message).toContain('sorting');
    expect(first('<xo-view get="/plain"><xo-table page-size="5"></xo-table></xo-view>').message).toContain('paging');
  });
});

describe('XO270: attributes that do nothing where they are', () => {
  it('action modifiers need xo-click or xo-submit on the same element', () => {
    for (const name of ['xo-then="/a"', 'xo-notice="Saved"', 'xo-confirm="Sure?"', 'xo-body="."', 'xo-optimistic="a=b"', 'xo-with="a=b"']) {
      const f = first(`<xo-view><button ${name}>x</button></xo-view>`);
      expect(f.code, name).toBe('XO270');
      expect(f.level).toBe('error');
      expect(f.message).toContain(name.split('=')[0]);
    }
    // a wrapper is not the button: the attribute belongs on the element that has the action
    expect(found('<xo-view><div xo-confirm="Sure?"><button xo-click="DELETE /users/{id}">x</button></div></xo-view>')).toEqual(['XO270']);
  });

  it('are fine on the button or the form that has the action, and xo-with also beside xo-add', () => {
    expect(found('<xo-view get="/users"><li xo-each="items"><button xo-click="DELETE /users/{id}" xo-confirm="Delete {name}?" xo-confirm-kind="danger" xo-confirm-ok="Delete" xo-confirm-title="Delete" xo-confirm-cancel="Keep" xo-notice="Gone" xo-then="/users">x</button></li></xo-view>')).toEqual([]);
    expect(found('<xo-view><form xo-submit="POST /users" xo-keep xo-then="/users/{id}" xo-notice="Saved" xo-with="status=new"><button>x</button></form></xo-view>')).toEqual([]);
    expect(found('<xo-view><form xo-submit="PATCH /users/{id}" xo-body="."><button type="button" xo-add="tags" xo-with="type=a">x</button><button>y</button></form></xo-view>')).toEqual([]);
  });

  it('xo-keep is for xo-submit; xo-confirm-* need xo-confirm; <xo-dialog size> needs heading', () => {
    expect(first('<xo-view><button xo-click="DELETE /users/{id}" xo-keep>x</button></xo-view>').message).toContain('xo-submit');
    const f = first('<xo-view><button xo-click="DELETE /users/{id}" xo-confirm-kind="danger">x</button></xo-view>');
    expect(f.code).toBe('XO270');
    expect(f.message).toContain('without xo-confirm');
    const dialog = first('<xo-dialog id="d" size="wide"></xo-dialog>');
    expect(dialog).toMatchObject({ code: 'XO270', level: 'warn' });
    expect(found('<xo-dialog id="d" heading="T" size="wide"></xo-dialog>')).toEqual([]);
  });

  it('XO221: an action attribute with no value is reported with how to write it', () => {
    expect(first('<xo-view><button xo-click="DELETE /users/{id}" xo-confirm="">x</button></xo-view>').fix).toContain('Write the question');
    expect(first('<xo-view><button xo-click="DELETE /users/{id}" xo-then="">x</button></xo-view>').fix).toContain('xo-then="/articles/{id}"');
    expect(first('<button xo-open="">x</button>').fix).toContain('xo-open="#add"');
    expect(found('<xo-view><button xo-click="DELETE /users/{id}" xo-with=" ">x</button></xo-view>')).toEqual(['XO221']);
    // these are fine without a value
    expect(found('<xo-dialog id="d" heading="T"><button xo-close>x</button></xo-dialog><xo-view><form xo-submit="POST /users" xo-keep><button>x</button></form></xo-view>')).toEqual([]);
  });
});

describe('XO271: values from a fixed set', () => {
  it('xo-confirm-kind and <xo-dialog size> take only the documented values (the runtime falls back silently)', () => {
    const f = first('<xo-view><button xo-click="DELETE /users/{id}" xo-confirm="Sure?" xo-confirm-kind="dangerous">x</button></xo-view>');
    expect(f).toMatchObject({ code: 'XO271', level: 'warn' });
    expect(f.message).toContain('"danger", "warning", "info", "success"');
    expect(f.message).toContain('closest: "danger"');
    expect(f.fix).toBe('Use xo-confirm-kind="danger"');
    expect(first('<xo-dialog heading="T" size="huge"></xo-dialog>').message).toMatch(/^xo-dialog size="huge" is not one of "sm", "wide", "full"/);
    for (const kind of ['danger', 'warning', 'info', 'success', 'error']) expect(found(`<xo-view><button xo-click="DELETE /users/{id}" xo-confirm="x" xo-confirm-kind="${kind}">x</button></xo-view>`), kind).toEqual([]);
  });

  it('covers the controls with a fixed set, skips a value that is bound to data, and leaves other elements alone', () => {
    expect(found('<xo-avatar size="xl" status="ok"></xo-avatar>')).toEqual(['XO271']);
    expect(found('<xo-chart type="pie"></xo-chart><xo-richtext toolbar="big"></xo-richtext>')).toEqual(['XO271', 'XO271']);
    expect(found('<xo-view get="/users"><xo-dialog heading="T" size="{size}"></xo-dialog></xo-view>')).toEqual([]);
    expect(found('<button size="huge"></button><xo-avatar size="lg" status="muted"></xo-avatar>')).toEqual([]);
  });
});

describe('XO272: values with a syntax of their own', () => {
  it('xo-with and xo-optimistic are "field=value" lists', () => {
    const f = first('<xo-view><button xo-click="POST /users" xo-with="published">x</button></xo-view>');
    expect(f).toMatchObject({ code: 'XO272', level: 'error' });
    expect(f.message).toContain('"published" is not "field=value"');
    expect(found('<xo-view get="/users"><li xo-each="items"><button xo-click="DELETE /users/{id}" xo-optimistic="status=gone,x">x</button></li></xo-view>')).toEqual(['XO272']);
    expect(found('<xo-view><button xo-click="POST /users" xo-with="status=new,name={n}">x</button></xo-view>')).toEqual([]);
  });

  it('xo-param: name=value, name+=n, name-=n, name~=value, or just the name on a field', () => {
    for (const ok of ['status=draft', 'offset+=10', 'offset-=10', 'sort~=name', 'status=']) expect(found(`<xo-view get="/users"><button xo-param="${ok}">x</button></xo-view>`), ok).toEqual([]);
    expect(found('<xo-view get="/users"><select xo-param="status"><option>a</option></select><input xo-param="status"></xo-view>')).toEqual([]);
    const f = first('<xo-view get="/users"><button xo-param="status">x</button></xo-view>');
    expect(f.code).toBe('XO272');
    expect(f.message).toContain('"name~=value"');
    expect(first('<xo-view get="/users"><input xo-param="a b"></xo-view>').message).toContain('or just the name, on a field');
  });

  it('xo-move is path:up, path:down or a number; xo-select is empty or all:<list>', () => {
    expect(found('<xo-view><form xo-submit="PATCH /users/{id}"><button type="button" xo-move="tags[{$index}]:up">x</button><button type="button" xo-move="tags[{$index}]:down">y</button><button type="button" xo-move="tags[{$index}]:-2">z</button></form></xo-view>')).toEqual([]);
    expect(found('<xo-view><form xo-submit="PATCH /users/{id}"><button type="button" xo-move="tags[{$index}]">x</button></form></xo-view>')).toEqual(['XO272']);
    expect(found('<xo-view><input type="checkbox" xo-select><input type="checkbox" xo-select="all:items"></xo-view>')).toEqual([]);
    expect(found('<xo-view><input type="checkbox" xo-select="items"></xo-view>')).toEqual(['XO272']);
    expect(found('<xo-view><div xo-select="items"></div></xo-view>')).toEqual(['XO254']); // not a checkbox: reported once, by XO254
  });
});

describe('XO273: dialogs', () => {
  it('xo-open="#id" needs an <xo-dialog> with that id in the file', () => {
    expect(found('<button xo-open="#add">x</button><xo-dialog id="add"></xo-dialog>')).toEqual([]);
    expect(found('<xo-router><template xo-layout="s"><main xo-outlet></main></template><template xo-route="/a" layout="s"><button xo-open="#add">x</button></template></xo-router><xo-dialog id="add"></xo-dialog>')).toEqual([]); // a dialog elsewhere in the page counts
    const missing = first('<button xo-open="#add">x</button>');
    expect(missing).toMatchObject({ code: 'XO273', level: 'warn' });
    expect(missing.fix).toContain('<xo-dialog id="add">');
    const wrong = first('<div id="add"></div><button xo-open="#add">x</button>');
    expect(wrong).toMatchObject({ code: 'XO273', level: 'error' });
    expect(wrong.message).toContain('<div>');
    expect(found('<button xo-open=".dialogs > xo-dialog">x</button>')).toEqual([]); // a selector that is not a plain id is the runtime's business
  });

  it('xo-close needs an <xo-dialog> around it, and a fragment (an html`` template) is not judged for what lives elsewhere', () => {
    expect(found('<xo-dialog id="d"><div><button xo-close>x</button></div></xo-dialog>')).toEqual([]);
    expect(found('<button xo-close>x</button>')).toEqual(['XO273']);
    expect(found('<button xo-close>x</button><button xo-open="#d">y</button>', { fragment: true })).toEqual([]);
    const code = 'const view = html`<button xo-open="#d">Open</button> <button xo-close>Close</button>`;\nconst bad = html`<div id="d"></div><button xo-open="#d">Open</button>`;';
    expect(checkScript(code, table, 'a.js').map((f) => f.code)).toEqual(['XO273']); // not the missing dialog of the first template, only the id that is on a <div>
  });
});

describe('XO274 and XO275: what xo-with, xo-selected and xo-param name', () => {
  it('XO274: xo-with sets a field the request body has, with the closest name when it does not', () => {
    const f = first('<xo-view><button xo-click="POST /users" xo-with="staus=published">x</button></xo-view>');
    expect(f).toMatchObject({ code: 'XO274', level: 'warn' });
    expect(f.message).toContain('"staus"');
    expect(f.message).toContain('closest: "status"');
    expect(f.fix).toBe('Use "status"');
    expect(found('<xo-view><button xo-click="POST /users" xo-with="status=new">x</button></xo-view>')).toEqual([]);
    expect(found('<xo-view><button xo-click="POST /users" xo-with="address.city=Hue">x</button></xo-view>')).toEqual([]); // a nested path: the part before the dot is a field (not drawn flat)
    expect(found('<xo-view><button xo-click="PATCH /users/{id}" xo-with="tags=a">x</button></xo-view>')).toEqual([]); // known from the request schema
    expect(found('<xo-view><button xo-click="PATCH /users/{id}" xo-with="nme=a">x</button></xo-view>')).toEqual(['XO274']);
  });

  it('XO274: an operation without a request body cannot take one; xo-selected="ids" names a body field', () => {
    expect(first('<xo-view><button xo-click="DELETE /users/{id}" xo-with="a=b">x</button></xo-view>').message).toContain('has no request body');
    expect(found('<xo-view get="/users"><button xo-click="POST /users/bulk-delete" xo-selected="ids">x</button></xo-view>')).toEqual([]);
    const f = first('<xo-view get="/users"><button xo-click="POST /users/bulk-delete" xo-selected="idz">x</button></xo-view>');
    expect(f).toMatchObject({ code: 'XO274' });
    expect(f.message).toContain('"idz"');
    expect(found('<xo-view get="/users"><button xo-click="DELETE /users/{id}" xo-selected>x</button></xo-view>')).toEqual([]); // one request per row: no field
    expect(found('<xo-view><button xo-click="nope" xo-with="a=b">x</button></xo-view>')).toEqual(['XO201']); // an unknown operation is XO201's, not a second finding
  });

  it('XO275: xo-param sets a parameter the view\'s operation takes (query or path), or nothing filters', () => {
    expect(found('<xo-view get="/users"><button xo-param="status=active">x</button><button xo-param="offset+=10">y</button><input xo-param="sort"></xo-view>')).toEqual([]);
    const f = first('<xo-view get="/users"><button xo-param="state=active">x</button></xo-view>');
    expect(f).toMatchObject({ code: 'XO275', level: 'warn' });
    expect(f.message).toContain('takes no parameter "state"');
    expect(f.fix).toContain('{state}');
    expect(found('<xo-view get="/plain"><input xo-param="q"></xo-view>')).toEqual(['XO275']);
    expect(found('<xo-view><button xo-param="state=a">x</button></xo-view>')).toEqual([]); // a view without get: nothing to compare with
    expect(found('<xo-view get="/users"><input xo-param="offset"></xo-view>')).toEqual([]);
    expect(found('<xo-view get="/users/{id}" p-id="1"><button xo-param="id=2">x</button></xo-view>', { })).toEqual(['XO201']); // GET /users/{id} is not in this table; the path parameter rule is below
  });

  it('XO275: a path parameter is a parameter (camelCase of the attribute name)', () => {
    const t = { operations: { getUser: { id: 'getUser', method: 'GET', path: '/users/{userId}' } } };
    expect(checkHtml('<xo-view get="getUser" p-user-id="1"><button xo-param="user-id=2">x</button></xo-view>', t).map((f) => f.code)).toEqual([]);
  });
});

describe('XO276: attributes outside the element that gives them meaning', () => {
  it('xo-route and xo-layout belong on a <template> directly inside <xo-router>', () => {
    expect(found('<xo-router><template xo-route="/a"><p>a</p></template></xo-router>')).toEqual([]);
    const f = first('<xo-router><div xo-route="/a">a</div></xo-router>');
    expect(f).toMatchObject({ code: 'XO276', level: 'error' });
    expect(f.message).toContain('on <div>');
    expect(found('<xo-router><div><template xo-route="/a">a</template></div></xo-router>')).toEqual(['XO276']);
    expect(found('<template xo-route="/a">a</template>')).toEqual(['XO276']);
    expect(found('<xo-router><template xo-layout="s"><main xo-outlet></main></template></xo-router>')).toEqual([]);
    // in an html`` template the router may be outside: a template is not judged by its parent there, a <div xo-route> is wrong anywhere
    expect(found('<template xo-route="/a">a</template>', { fragment: true })).toEqual([]);
    expect(found('<div xo-route="/a">a</div>', { fragment: true })).toEqual(['XO276']);
  });

  it('xo-tab, xo-menu-trigger, xo-guard and the array buttons', () => {
    expect(found('<xo-tabs><section xo-tab="A">a</section></xo-tabs><xo-menu><button xo-menu-trigger>Go</button><a href="/x">x</a></xo-menu>')).toEqual([]);
    expect(found('<section xo-tab="A">a</section>')).toEqual(['XO276']);
    expect(found('<button xo-menu-trigger>Go</button>')).toEqual(['XO276']);
    expect(found('<xo-view><form xo-submit="POST /users" xo-guard="off"><button>x</button></form></xo-view>')).toEqual([]);
    expect(found('<xo-view><form xo-guard="Leave?"><button>x</button></form></xo-view>')).toEqual(['XO276']);
    expect(found('<xo-view><form xo-submit="PATCH /users/{id}"><div><button type="button" xo-add="tags">x</button><button type="button" xo-remove="tags[{$index}]">y</button><span xo-drag="tags[{$index}]">h</span></div></form></xo-view>')).toEqual([]);
    expect(found('<xo-view><button type="button" xo-add="tags">x</button></xo-view>')).toEqual(['XO276']);
    expect(found('<section xo-tab="A">a</section><button xo-menu-trigger>Go</button><button xo-add="x">y</button>', { fragment: true })).toEqual([]); // the container may be outside the fragment
  });
});

describe('what already worked keeps working', () => {
  it('the documented forms of every attribute raise nothing', () => {
    const page = `
      <xo-router base="/admin" base-links>
        <template xo-layout="shell"><nav><a href="/users">Users</a></nav><main xo-outlet></main></template>
        <template xo-route="/users" layout="shell" title="Users">
          <xo-view get="/users" url-params="status,offset">
            <button xo-param="status=active" xo-t="x">Active</button>
            <xo-table columns="name" sortable filters="status:Status" page-size="10" empty="None"></xo-table>
            <xo-pager page-size="10"></xo-pager>
            <template xo-each="items"><button xo-click="DELETE /users/{id}" xo-confirm="Delete {name}?" xo-confirm-kind="danger" xo-optimistic="status=gone" xo-notice="Deleted" xo-then="/users">Delete</button></template>
            <button xo-open="#add">Add</button>
          </xo-view>
        </template>
      </xo-router>
      <xo-dialog id="add" heading="Add" size="wide" dismiss><xo-form op="createUser"></xo-form><button slot="footer" type="button" xo-close>Cancel</button></xo-dialog>`;
    expect(found(page)).toEqual([]);
  });
});
