// <xo-richtext> in a generated form: the hint names it, the record fills it, a change reaches the model, the payload carries sanitised HTML.
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mount, mockApi } from '@xoong/test';
import '@xoong/ui';
import '@xoong/richtext';

const bodySchema = { t: 'object', required: ['body'], props: { body: { t: 'string', widget: 'xo-richtext', title: 'Body', maxLength: 50 } } };
const table = {
  version: 1, entities: { Page: { id: 'id' } },
  operations: {
    getPage: { id: 'getPage', method: 'GET', path: '/pages/{id}', response: { t: 'entity', name: 'Page' } },
    updatePage: { id: 'updatePage', method: 'PUT', path: '/pages/{id}', body: true, response: { t: 'entity', name: 'Page' }, bodySchema },
  },
};
let screen;
beforeEach(() => { document.execCommand = () => true; });
afterEach(() => { screen?.unmount(); delete document.execCommand; });
const wait = () => new Promise((r) => setTimeout(r, 20)).then(() => screen.settle());

describe('xo-richtext in a generated form', () => {
  it('prefills from the record (sanitised), a change reaches the model and the saved payload, and the schema rules apply', async () => {
    const api = mockApi(table, { getPage: () => ({ id: 1, body: '<p>Hello <b onclick="x()">there</b></p><script>1</script>' }), updatePage: ({ body }) => ({ id: 1, ...body }) });
    screen = await mount('<xo-view get="getPage" p-id="1"><xo-form op="updatePage" submit="Save"></xo-form></xo-view>', { api });
    await wait();
    const el = screen.$('xo-richtext[name=body]');
    expect(el.value).toBe('<p>Hello <strong>there</strong></p>');
    expect(screen.$('.xo-richtext-editable').innerHTML).toBe('<p>Hello <strong>there</strong></p>');
    const editor = screen.$('.xo-richtext-editable');
    editor.innerHTML = '<p>New <i>text</i></p><img src="javascript:1" onerror="x()">';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    await wait();
    expect(screen.$('form').model.get('body')).toBe('<p>New <em>text</em></p>');
    await screen.submit('form');
    expect(api.callsOf('updatePage')[0].body.body).toBe('<p>New <em>text</em></p>');
  });

  it('an empty required editor blocks the save', async () => {
    const api = mockApi(table, { getPage: () => ({ id: 1, body: '' }), updatePage: ({ body }) => body });
    screen = await mount('<xo-view get="getPage" p-id="1"><xo-form op="updatePage" submit="Save"></xo-form></xo-view>', { api });
    await wait();
    await screen.submit('form');
    expect(api.callsOf('updatePage')).toEqual([]);
    expect(screen.$('form').model.errors.body).toBeTruthy();
  });

  it('the schema maxLength applies to the stored HTML string (what the API receives), the `maxlength` attribute to the text', async () => {
    const api = mockApi(table, { getPage: () => ({ id: 1, body: '<p>ok</p>' }), updatePage: ({ body }) => body });
    screen = await mount('<xo-view get="getPage" p-id="1"><xo-form op="updatePage" submit="Save"></xo-form></xo-view>', { api });
    await wait();
    const editor = screen.$('.xo-richtext-editable');
    editor.innerHTML = `<p><strong>${'x'.repeat(45)}</strong></p>`; // 45 characters of text, 74 of HTML
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    await wait();
    await screen.submit('form');
    expect(api.callsOf('updatePage')).toEqual([]);
    expect(screen.$('form').model.errors.body).toBeTruthy();
  });
});
