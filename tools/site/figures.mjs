// The animated figures of the How it works page (drawn with diagrams.mjs, like the diagrams of the Architecture pages). They are the short version of
// what the Data flow and Forms architecture pages explain in full; every arrow here is one of the steps described there.
import { diagram } from './diagrams.mjs';

/** The life of a read and of a write, from the markup to the API and back to the DOM. */
export const life = diagram({
  id: 'hiw-life', label: 'Diagram: the life of a read and of a write', w: 704, h: 338, size: 'md', anim: true,
  title: 'The life of a read and of a write',
  desc: 'Three groups, left to right. Your page, on the left, holds an xo-view with get="listPeople" at the top and a button with xo-click at the bottom. The xoong client, in the middle, holds the entity store at the top, the query cache in the middle and mutate at the bottom. The backend API is on the right. '
    + 'A read, in five steps. 1. The xo-view asks the query cache for listPeople. 2. The cache sends GET /people to the API. 3. The API answers 200 with JSON. 4. The cache normalises the answer into the entity store, one record per id. 5. Effects write only the DOM nodes of the view that read a changed record. '
    + 'A write, in four steps and a repeat. 6. A click on the button calls mutate. 7. Mutate sends POST to the API. 8. The API answers 200. 9. Mutate invalidates every cached query whose path overlaps the mutation\'s path; the list is refetched because the view is watching it, so steps 2 to 5 run again.',
  caption: 'The life of a read (arrows 1 to 5) and of a write (6 to 9). Dashed: an answer, or the store telling the page. After a write the list is read again: 2 to 5 once more.',
  motion: 'a dot travels the arrows in numbered order, first the read, then, after a pause, the write, and then steps 2 to 5 again as the list refreshes. A hollow dot rides a dashed arrow.',
  draw(d) {
    d.zone(6, 6, 206, 326, 'Your page');
    d.zone(252, 6, 214, 326, 'The client (@xoong/data)');
    const view = d.box(22, 40, 174, '<xo-view get>', 'get="listPeople"');
    const button = d.box(22, 260, 174, '<button xo-click>', 'POST /people/{id}/disable');
    const store = d.box(272, 40, 174, 'Entity store', 'one signal per record', { kind: 'core' });
    const cache = d.box(272, 150, 174, 'Query cache', 'one query per operation', { kind: 'core' });
    const mutate = d.box(272, 260, 174, 'client.mutate()', 'POST, then invalidate', { kind: 'core' });
    const api = d.box(556, 150, 140, 'Backend API', ['your server,', 'described by OpenAPI'], { kind: 'soft', bh: 168 });

    const t = d.clock({ travel: 0.6 });
    const read = [t(0.9), t(0.6), t(0.6), t(0.5), t(0.5)]; // 1 to 5
    t.skip(0.5);
    const write = [t(0.5), t(0.6), t(0.6), t(0.5)];        // 6 to 9
    const again = [t(0.6), t(0.6), t(0.5), t(0.5)];        // 2 to 5 once more: the list refreshes
    const ask = cache.cy - 12, answer = cache.cy + 12, post = mutate.cy - 12, ok = mutate.cy + 12;

    d.line([[view.cx, view.b], [view.cx, cache.cy], [cache.x, cache.cy]], { label: '1 get', at: [160, cache.cy - 13], go: read[0], from: view, to: cache });
    d.line([[cache.r, ask], [api.x, ask]], { label: '2 GET', at: [501, ask - 13], go: [read[1], again[0]], from: cache, to: api });
    d.line([[api.x, answer], [cache.r, answer]], { dash: true, label: '3 200 JSON', at: [501, answer + 14], go: [read[2], again[1]], from: api, to: cache });
    d.line([[cache.cx, cache.y], [cache.cx, store.b]], { label: '4 normalize', at: [cache.cx + 10, (store.b + cache.y) / 2], anchor: 'start', go: [read[3], again[2]], from: cache, to: store });
    d.line([[store.x, store.cy], [view.r, view.cy]], { dash: true, label: '5 effects', at: [234, store.cy - 13], go: [read[4], again[3]], from: store, to: view });
    d.line([[button.r, button.cy], [mutate.x, mutate.cy]], { label: '6 xo-click', at: [234, button.cy - 13], go: write[0], from: button, to: mutate });
    d.line([[mutate.r, post], [api.x, post]], { label: '7 POST', at: [501, post - 13], go: write[1], from: mutate, to: api });
    d.line([[api.x, ok], [mutate.r, ok]], { dash: true, label: '8 200 OK', at: [501, ok + 14], go: write[2], from: api, to: mutate });
    d.line([[mutate.cx, mutate.y], [mutate.cx, cache.b]], { go: write[3], from: mutate, to: cache });
    d.text(mutate.cx + 10, (cache.b + mutate.y) / 2 - 8, '9 invalidate:', 'dg-lab dg-start');
    d.text(mutate.cx + 10, (cache.b + mutate.y) / 2 + 8, 'the list refetches', 'dg-lab dg-start');
  },
});

/** A generated form: from the request schema to the call, and the way out when the form is not valid. */
export const form = diagram({
  id: 'hiw-form', label: 'Diagram: a form drawn from the request schema', w: 560, h: 356, size: 'sm', anim: true,
  title: 'A form drawn from the request schema',
  desc: 'Four steps, top to bottom. 1. operations.json holds createPerson and its request schema. 2. The xo-form with op="createPerson" draws a control for every field of the schema. 3. A person fills it in and submits; it is checked against the same schema and against your own rules by path. If it is invalid, nothing is sent and the errors show beside the fields. 4. If it is valid, client.mutate sends createPerson, and the lists that the call touches are fetched again.',
  caption: 'The form is not written, it is read from the schema. Nothing is sent until it is valid.',
  motion: 'a dot goes down the steps for a form that is valid; after a pause a second dot goes to "Nothing is sent", where a form with an error stops.',
  draw(d) {
    const schema = d.box(10, 14, 300, 'operations.json', 'createPerson and its request schema');
    const xoForm = d.box(10, 100, 300, '<xo-form op="createPerson">', 'draws a control for every field', { kind: 'core' });
    const check = d.box(10, 186, 300, 'You fill it in and submit', ['checked against the same schema,', 'plus your own rules by path']);
    const send = d.box(10, 284, 300, 'client.mutate()', 'sends createPerson; the lists refetch');
    const bad = d.box(370, 186, 180, 'Nothing is sent', ['the errors show', 'beside the fields'], { kind: 'err' });
    const t = d.clock({ travel: 0.8 });
    const drawn = t(), filled = t();
    t.skip(0.5);
    const valid = t(), invalid = t(0.8);
    d.line([[schema.cx, schema.b], [schema.cx, xoForm.y]], { go: drawn, from: schema, to: xoForm });
    d.line([[xoForm.cx, xoForm.b], [xoForm.cx, check.y]], { go: filled, from: xoForm, to: check });
    d.line([[check.cx, check.b], [check.cx, send.y]], { label: 'valid', at: [168, 270], anchor: 'start', go: valid, from: check, to: send });
    d.line([[check.r, check.cy], [bad.x, check.cy]], { label: 'invalid', at: [340, check.cy - 13], go: invalid, from: check, to: bad });
  },
});
