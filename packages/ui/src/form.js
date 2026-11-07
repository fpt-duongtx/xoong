// @ts-check
/**
 * <xo-form op="POST /users" submit="Add"></xo-form>
 *
 * Generates a <form xo-submit="op"> from the operation's request schema (`bodyFields` in operations.json):
 * one labelled control per field, required and maxlength set, enums as <select>, booleans as checkboxes.
 * Server field errors (error.fields) appear next to the control. Fields the schema marks readOnly are skipped;
 * nested objects and arrays are not generated: write that form by hand.
 */
import { defineTemplate } from '@xoong/data/view';

const TYPES = { email: 'email', password: 'password', date: 'date', 'date-time': 'datetime-local', uri: 'url', url: 'url' };
const label = (name) => name.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

defineTemplate('xo-form', (el, { client }) => {
  const ref = el.getAttribute('op') ?? '';
  const op = client.op(ref); // unknown operations throw with the closest valid name
  const form = document.createElement('form');
  form.setAttribute('xo-submit', ref);
  form.className = 'xo-form';
  const fields = op.bodyFields ?? [];
  const missing = (op.bodySkipped ?? []).filter((s) => s.required);
  if (missing.length) console.warn(`xoong: <xo-form op="${ref}"> cannot generate the required field(s) ${missing.map((m) => `${m.name} (${m.type})`).join(', ')}: the server will refuse this form. Write those fields by hand or wait for nested form support.`);
  if (!fields.length) console.error(`xoong: <xo-form op="${ref}">: the request body has no simple fields to generate (see docs/admin.md)`);
  for (const f of fields) {
    const wrap = document.createElement('label');
    wrap.className = 'xo-field';
    const text = document.createElement('span');
    text.textContent = f.title ?? label(f.name);
    let input;
    if (f.enum) {
      input = document.createElement('select');
      for (const v of f.required ? f.enum : ['', ...f.enum]) {
        const option = document.createElement('option');
        option.value = option.textContent = String(v);
        input.append(option);
      }
    } else {
      input = document.createElement('input');
      input.type = f.type === 'file' ? 'file' : f.type === 'boolean' ? 'checkbox' : f.type === 'integer' || f.type === 'number' ? 'number' : TYPES[f.format] ?? 'text';
      if (f.type === 'number') input.step = 'any';
      if (f.maxLength) input.maxLength = f.maxLength;
      if (input.type === 'text' || input.type === 'email') input.autocomplete = 'off';
    }
    input.name = f.name;
    if (f.required && f.type !== 'boolean') input.required = true;
    if (f.type === 'boolean') wrap.append(input, text); else wrap.append(text, input);
    form.append(wrap);
  }
  const button = document.createElement('button');
  button.textContent = el.getAttribute('submit') || 'Save';
  form.append(button);
  return form;
});
