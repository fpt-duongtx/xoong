import { describe, it, expect, afterEach } from 'vitest';
import { mount, mockApi } from '@xoong/test';
import '@xoong/ui';

const table = {
  version: 1,
  entities: { Person: { id: 'id' } },
  operations: {
    createPerson: { id: 'createPerson', method: 'POST', path: '/people', bodyFields: [{ name: 'name', type: 'string', required: true }], response: { t: 'entity', name: 'Person' } },
  },
};
let screen;
afterEach(() => screen?.unmount());

describe('<xo-form> hands the modifiers of the action to the form it draws', () => {
  it('xo-then, xo-notice, xo-confirm, xo-guard, xo-keep and xo-with reach the <form xo-submit>', async () => {
    screen = await mount('<xo-view><xo-form op="createPerson" xo-notice="Saved" xo-then="/people/{id}" xo-confirm="Add?" xo-confirm-kind="info" xo-keep xo-guard="off" xo-with="role=admin"></xo-form></xo-view>', { api: mockApi(table, { createPerson: () => ({ id: 1, name: 'Ada' }) }) });
    await screen.settle();
    const form = screen.$('form[xo-submit]');
    expect(form.getAttribute('xo-notice')).toBe('Saved');
    expect(form.getAttribute('xo-then')).toBe('/people/{id}');
    expect(form.getAttribute('xo-confirm')).toBe('Add?');
    expect(form.getAttribute('xo-confirm-kind')).toBe('info');
    expect(form.hasAttribute('xo-keep')).toBe(true);
    expect(form.getAttribute('xo-guard')).toBe('off');
    expect(form.getAttribute('xo-with')).toBe('role=admin');
  });
  it('attributes that are not modifiers are not copied', async () => {
    screen = await mount('<xo-view><xo-form op="createPerson" class="wide" data-x="1"></xo-form></xo-view>', { api: mockApi(table, { createPerson: () => ({ id: 1 }) }) });
    await screen.settle();
    const form = screen.$('form[xo-submit]');
    expect(form.hasAttribute('data-x')).toBe(false);
  });
});
