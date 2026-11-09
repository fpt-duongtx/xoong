// The animated figures of the How it works page (drawn with diagrams.mjs, like the diagrams of the Architecture pages). They are the short version of what the
// Data flow and Forms architecture pages explain in full. Each one shows, left to right: the few lines you write, the screen they make, the inner parts
// of xoong that do the work, and your services. The steps tell the story; the code line that causes a step is lit while it plays, and the screen changes
// with it. The people, the services and their names are examples.
import { diagram, states, ui } from './diagrams.mjs';

/** The code that every read starts from, as on the home page. */
const READ_CODE = [
  '<xo-view get="listPeople">',
  '  <xo-table columns="name,email,role"',
  '            sortable></xo-table>',
  '</xo-view>',
  '',
  '<!-- loading, errors, cache and types',
  '     come from your OpenAPI document -->',
];

/** What the figures say once, in the free space above the client. */
const note = (d, x, y) => {
  d.text(x, y, 'You write only the code on the left.', 'dg-start dg-lab');
  d.text(x, y + 20, 'The client does the rest,', 'dg-start dg-lab');
  d.text(x, y + 38, 'from your OpenAPI document.', 'dg-start dg-lab');
};

/** Your services, as examples: two that this story does not touch, and People API, which answers. */
const cluster = (d, x, h, [y, th, sub]) => d.services(x, 6, 196, h, [['Orders API', 72, 32], ['Files service', 110, 32], ['People API', y, th, sub]])[2];

const PEOPLE = [['Ada', 'ada@example.org', 'admin'], ['Bob', 'bob@example.org', 'editor'], ['Cy', 'cy@example.org', 'viewer']];

/** A read: the markup, the screen, the client and a service. */
export const read = diagram({
  id: 'hiw-read', label: 'Diagram: how a list on the screen is read', w: 850, h: 384, size: 'xl', anim: true,
  title: 'How a list on the screen is read',
  desc: 'Four groups. On the left, the code you write, in a window named people.html, and below it the screen that code makes: a window with a table of people. In the middle, the xoong client, with the query cache above the entity store. On the right, your services and APIs, drawn as example tiles (Orders API, Files service and People API); xoong needs one OpenAPI document and one base URL and does not care what is behind it, and here only the People API is called.',
  caption: 'A read, from the markup you write to the rows on the screen. Dashed: an answer, or the store telling the screen. The people and the names of the services are examples.',
  motion: 'a dot travels the arrows in numbered order while the line of code that causes the step is lit, and the screen changes with it: loading rows first, then the table. A hollow dot rides a dashed arrow.',
  draw(d) {
    const code = d.code(6, 6, 292, 'people.html', 'html', READ_CODE);
    const scr = d.screen(6, 190, 292, 162, { title: '/people' });
    d.line([[scr.cx, code.b], [scr.cx, scr.y]], { label: 'is drawn as', at: [scr.cx + 8, (code.b + scr.y) / 2], anchor: 'start' });
    note(d, 372, 40);
    d.zone(358, 186, 190, 186, 'The client (@xoong/data)');
    const cache = d.box(374, 214, 158, 'Query cache', 'one query per operation', { kind: 'core' });
    const store = d.box(374, 300, 158, 'Entity store', 'one signal per record', { kind: 'core' });
    const people = cluster(d, 654, 366, [196, 100, ['GET /people']]);

    const x = scr.left, tw = scr.inner;
    d.raw(ui.thead(x, scr.top + 8, tw));
    const rows = ui.trow(x, scr.top + 30, tw, PEOPLE[0]) + ui.trow(x, scr.top + 58, tw, PEOPLE[1]) + ui.trow(x, scr.top + 86, tw, PEOPLE[2]);
    const t = d.clock({ travel: 0.7 });
    const s1 = d.step('The xo-view with get="listPeople" asks the client for that operation. Until the answer comes, the screen shows loading rows.', t(0.7), { code: [code, 0] });
    const s2 = d.step('The client\'s query cache has no fresh answer, so it sends GET /people to your People API. You wrote no request code.', t(0.8), { code: [code, 5, 6] });
    const s3 = d.step('Your People API answers 200 with the people as JSON.', t(0.8), { code: [code, 5, 6] });
    const s4 = d.step('The client stores each person once, as one record per id, in the entity store.', t(0.6), { code: [code, 5, 6] });
    const s5 = d.step('Effects write the rows into the xo-table on the screen. Only the DOM nodes that read the new data change, and the loading rows are gone.', t(0.8), { code: [code, 1, 2] });
    const [, loading, listed] = states([s1[0] + 0.3, s5[1] - 0.25]);
    d.layer(ui.tskel(x, scr.top + 30, tw), loading);
    d.layer(rows, listed);
    d.still(rows);

    d.line([[scr.r, cache.cy], [cache.x, cache.cy]], { label: '1 get', at: [(scr.r + cache.x) / 2, cache.cy - 13], go: s1, from: scr, to: cache });
    d.line([[cache.r, cache.cy - 12], [people.x, cache.cy - 12]], { label: '2 GET /people', at: [(cache.r + people.x) / 2, cache.cy - 25], go: s2, from: cache, to: people });
    d.line([[people.x, cache.cy + 12], [cache.r, cache.cy + 12]], { dash: true, label: '3 200 JSON', at: [(cache.r + people.x) / 2, cache.cy + 26], go: s3, from: people, to: cache });
    d.line([[cache.cx, cache.b], [cache.cx, store.y]], { label: '4 normalize', at: [cache.cx + 10, (cache.b + store.y) / 2], anchor: 'start', go: s4, from: cache, to: store });
    d.line([[store.x, store.cy], [scr.r, store.cy]], { dash: true, label: '5 effects', at: [(scr.r + store.x) / 2, store.cy - 13], go: s5, from: store, to: scr });
  },
});

/** A write: the button, the screen, the client and a service. */
export const write = diagram({
  id: 'hiw-write', label: 'Diagram: how a click on the screen is written', w: 850, h: 508, size: 'xl', anim: true,
  title: 'How a click on the screen is written',
  desc: 'Four groups. On the left, the code you write, in a window named people.html: the list from before, with a Disable button in each row that has xo-click and xo-confirm; below it the screen that code makes, a table of people with a Disable button in each row. In the middle, the xoong client, with client.mutate above the query cache above the entity store. On the right, your services and APIs, drawn as example tiles; only the People API is called.',
  caption: 'A write, from the click to the screen. The client then reads the list again, because the write touched its path. Dashed: an answer, or the client telling the screen. The people and the names of the services are examples.',
  motion: 'a dot travels the arrows in numbered order while the code that causes the step is lit; the screen shows the question, then the changed row. A hollow dot rides a dashed arrow.',
  draw(d) {
    const code = d.code(6, 6, 330, 'people.html', 'html', [
      '<xo-view get="listPeople">',
      '  <xo-table columns="name,status">',
      '    <button xo-click="POST /people/{id}/disable"',
      '            xo-confirm="Disable {name}?"',
      '    >Disable</button>',
      '  </xo-table>',
      '</xo-view>',
    ]);
    const scr = d.screen(6, 206, 292, 262, { title: '/people' });
    d.line([[scr.cx, code.b], [scr.cx, scr.y]], { label: 'is drawn as', at: [scr.cx + 8, (code.b + scr.y) / 2], anchor: 'start' });
    note(d, 372, 40);
    const mutate = d.box(374, 249, 158, 'client.mutate()', 'POST, then invalidate', { kind: 'core' });
    const cache = d.box(374, 335, 158, 'Query cache', 'one query per operation', { kind: 'core' });
    const store = d.box(374, 421, 158, 'Entity store', 'one signal per record', { kind: 'core' });
    d.zone(358, 202, 190, 294, 'The client (@xoong/data)');
    const people = cluster(d, 654, 488, [242, 156, ['GET /people', 'POST /people/{id}/disable']]);

    const x = scr.left, tw = scr.inner, top = scr.top + 8;
    d.raw(ui.thead(x, top, tw, ['Name ▲', 'Status', '']));
    const row = (i, status) => ui.trow(x, top + 22 + i * 28, tw, [PEOPLE[i][0], status], { button: 'Disable' });
    const before = row(0, 'active') + row(1, 'active') + row(2, 'active');
    const after = row(0, 'disabled') + row(1, 'active') + row(2, 'active');
    const t = d.clock({ travel: 0.7 });
    const s1 = d.step('You click Disable on a row. The button\'s xo-click starts client.mutate, and xo-confirm asks first: "Disable Ada?" You press OK.', t(0.8), { code: [code, 2, 4] });
    const s2 = d.step('mutate sends POST /people/1/disable to your People API. The {id} comes from the row.', t(0.8), { code: [code, 2] });
    const s3 = d.step('Your People API answers 200 with the updated person.', t(0.8));
    const s4 = d.step('mutate puts the answer in the entity store. The row reads that record, so its effect writes "disabled" at once.', t(0.8));
    const s5 = d.step('mutate marks every cached query whose path overlaps /people/1/disable as stale. The list is one, and the screen is showing it, so it is fetched again now.', t(0.8), { code: [code, 0] });
    const s6 = d.step('The cache asks your People API for the list again: GET /people. The rows stay on the screen meanwhile.', t(0.8), { code: [code, 0] });
    const s7 = d.step('Your People API answers with the list as it is now.', t(0.7));
    const s8 = d.step('The client stores the new answer: the same records, one each.', t(0.6));
    const s9 = d.step('Effects update the screen. Nothing visible changes here, because the row already said "disabled".', t(0.8), { code: [code, 1] });
    const [active, disabled] = states([s4[1] - 0.25]);
    d.layer(before, active);
    d.layer(after, disabled);
    d.still(after);
    const bx = x + tw - 54, by = top + 22 + 4;
    d.layer(ui.ring(bx, by, 52, 20), [[s1[0], s1[1] + 0.3]]);
    d.layer(ui.dialog(scr.x + 56, scr.top + 150, 180, 'Disable Ada?'), [[s1[0], s1[1] - 0.05]]);

    d.line([[scr.r, mutate.cy - 10], [mutate.x, mutate.cy - 10]], { label: '1 click', at: [(scr.r + mutate.x) / 2, mutate.cy - 23], go: s1, from: scr, to: mutate });
    d.line([[mutate.r, mutate.cy - 12], [people.x, mutate.cy - 12]], { label: '2 POST', at: [(mutate.r + people.x) / 2, mutate.cy - 25], go: s2, from: mutate, to: people });
    d.line([[people.x, mutate.cy + 12], [mutate.r, mutate.cy + 12]], { dash: true, label: '3 200', at: [(mutate.r + people.x) / 2, mutate.cy + 26], go: s3, from: people, to: mutate });
    d.line([[mutate.x, mutate.cy + 10], [scr.r, mutate.cy + 10]], { dash: true, label: '4 stored', at: [(scr.r + mutate.x) / 2, mutate.cy + 23], go: s4, from: mutate, to: scr });
    d.line([[mutate.cx, mutate.b], [mutate.cx, cache.y]], { label: '5 invalidate', at: [mutate.cx + 10, (mutate.b + cache.y) / 2], anchor: 'start', go: s5, from: mutate, to: cache });
    d.line([[cache.r, cache.cy - 12], [people.x, cache.cy - 12]], { label: '6 GET', at: [(cache.r + people.x) / 2, cache.cy - 25], go: s6, from: cache, to: people });
    d.line([[people.x, cache.cy + 12], [cache.r, cache.cy + 12]], { dash: true, label: '7 200 JSON', at: [(cache.r + people.x) / 2, cache.cy + 26], go: s7, from: people, to: cache });
    d.line([[cache.cx, cache.b], [cache.cx, store.y]], { label: '8 normalize', at: [cache.cx + 10, (cache.b + store.y) / 2], anchor: 'start', go: s8, from: cache, to: store });
    d.line([[store.x, store.cy], [scr.r, store.cy]], { dash: true, label: '9 effects', at: [(scr.r + store.x) / 2, store.cy - 13], go: s9, from: store, to: scr });
  },
});

/** A generated form: the markup, the screen, the form model, the call. */
export const form = diagram({
  id: 'hiw-form', label: 'Diagram: a form drawn from the request schema', w: 850, h: 456, size: 'xl', anim: true,
  title: 'A form drawn from the request schema',
  desc: 'Four groups. On the left, the code you write, in a window named people.html: an xo-form with op="createPerson" and a submit label; below it the screen that code makes, a window with a form of two fields and a button. In the middle, the xoong parts: operations.json with the request schema of createPerson, the form model, and client.mutate. On the right, your services and APIs, drawn as example tiles; only the People API is called.',
  caption: 'A form is read from the schema, not written. Nothing is sent until the values are valid. Dashed: an answer, or the model telling the screen. The names of the services are examples.',
  motion: 'a dot travels the arrows in numbered order while the code that causes the step is lit; the screen shows an empty form, the typed values, the error, the corrected value, and the cleared form. A hollow dot rides a dashed arrow.',
  draw(d) {
    const code = d.code(6, 6, 292, 'people.html', 'html', [
      '<xo-form op="createPerson"',
      '         submit="Add person"></xo-form>',
      '',
      '<!-- fields and validation come from the',
      '     request schema of createPerson -->',
    ]);
    const scr = d.screen(6, 158, 292, 262, { title: '/people/new' });
    d.line([[scr.cx, code.b], [scr.cx, scr.y]], { label: 'is drawn as', at: [scr.cx + 8, (code.b + scr.y) / 2], anchor: 'start' });
    note(d, 372, 30);
    d.zone(358, 158, 190, 262, 'xoong');
    const schema = d.box(374, 190, 158, 'operations.json', 'createPerson: its schema', { kind: 'core' });
    const model = d.box(374, 268, 158, 'Form model', 'checks values by the schema', { kind: 'core' });
    const mutate = d.box(374, 346, 158, 'client.mutate()', 'sends createPerson', { kind: 'core' });
    const people = cluster(d, 654, 436, [330, 74, ['POST /people']]);

    const x = scr.left, tw = scr.inner, top = scr.top;
    const name = (v) => ui.field(x, top + 40, tw, 'Name', v);
    const email = (v, err) => ui.field(x, top + 96, tw, 'Email', v, err);
    const button = ui.button(x, top + 180, 100, 'Add person', true);
    const fields = (n, e, err = '') => name(n) + email(e, err) + button;
    d.raw(ui.h(x, top + 20, 'New person'));
    const t = d.clock({ travel: 0.7 });
    const s1 = d.step('The xo-form with op="createPerson" reads the request schema of createPerson from operations.json and draws a control for each field.', t(0.8), { code: [code, 0, 1] });
    const s2 = d.step('You type a name and an invalid e-mail address, and press Add person. The form model takes the values.', t(0.8), { code: [code, 1] });
    const s3 = d.step('The model checks the values against the same request schema. The e-mail is not valid, so nothing is sent: the field shows its error.', t(0.8), { code: [code, 3, 4] });
    const s4 = d.step('You correct the e-mail address and press Add person again.', t(0.7), { code: [code, 1] });
    const s5 = d.step('The values are valid now. The form model hands them to client.mutate.', t(0.7), { code: [code, 3, 4] });
    const s6 = d.step('mutate sends POST /people to your People API, with the values as the JSON body.', t(0.8));
    const s7 = d.step('Your People API answers with the new person.', t(0.7));
    const s8 = d.step('The call worked: the form clears, ready for the next person. A list of people on the page, whose path overlaps POST /people, is fetched again.', t(0.8));
    const [, empty, typed, error, fixed, cleared] = states([s1[1] - 0.25, s2[0] + 0.35, s3[1] - 0.25, s4[0] + 0.35, s8[1] - 0.25]);
    d.layer(fields('', ''), empty);
    d.layer(fields('Ada Lovelace', 'ada@'), typed);
    d.layer(fields('Ada Lovelace', 'ada@', 'Enter a valid email address.'), error);
    d.layer(fields('Ada Lovelace', 'ada@example.org'), fixed);
    d.layer(fields('', ''), cleared);
    d.still(fields('', ''));

    d.line([[schema.x, schema.cy], [scr.r, schema.cy]], { label: '1 draws', at: [(scr.r + schema.x) / 2, schema.cy - 13], go: s1, from: schema, to: scr });
    d.line([[scr.r, model.cy - 10], [model.x, model.cy - 10]], { label: '2, 4 submit', at: [(scr.r + model.x) / 2, model.cy - 23], go: [s2, s4], from: scr, to: model });
    d.line([[model.x, model.cy + 10], [scr.r, model.cy + 10]], { dash: true, label: '3 error', at: [(scr.r + model.x) / 2, model.cy + 23], go: s3, from: model, to: scr });
    d.line([[model.cx, model.b], [model.cx, mutate.y]], { label: '5 valid', at: [model.cx + 10, (model.b + mutate.y) / 2], anchor: 'start', go: s5, from: model, to: mutate });
    d.line([[mutate.r, mutate.cy - 12], [people.x, mutate.cy - 12]], { label: '6 POST', at: [(mutate.r + people.x) / 2, mutate.cy - 25], go: s6, from: mutate, to: people });
    d.line([[people.x, mutate.cy + 12], [mutate.r, mutate.cy + 12]], { dash: true, label: '7 answer', at: [(mutate.r + people.x) / 2, mutate.cy + 26], go: s7, from: people, to: mutate });
    d.line([[mutate.x, mutate.cy], [scr.r, mutate.cy]], { dash: true, label: '8 done', at: [(scr.r + mutate.x) / 2, mutate.cy - 13], go: s8, from: mutate, to: scr });
  },
});
