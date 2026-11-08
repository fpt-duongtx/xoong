import { signal, computed, effect, batch, untracked, disposeComputed, Signal, html, render, TemplateResult, XoElement, XoControl, define, text, setTextProvider } from '@xoong/core';
import type { ReadonlySignal, XoValidity } from '@xoong/core';
import { signal as sig2, effect as effect2 } from '@xoong/core/signals';
import { nearest, distance } from '@xoong/core/closest';
import { XO_ATTRIBUTES, XO_CONTROL_ELEMENTS } from '@xoong/core/syntax';

// Signals
const count: Signal<number> = signal(1);
const double: ReadonlySignal<number> = computed(() => count.value * 2);
const n: number = double.peek() + count.peek();
count.value = 2;
count.update((c) => c + 1);
const stop: () => void = effect(() => { void count.value; return () => {}; });
effect(() => { void count.value; });
stop();
const r: string = batch(() => 'x');
const u: number = untracked(() => count.value);
disposeComputed(double as any);
const s2: Signal<string> = sig2('a');
effect2(() => { void s2.value; });
void [n, r, u, new Signal(0)];

// Templates
const tpl: TemplateResult = html`<p class=${() => 'a'}>${() => count.value}</p>`;
const dispose: () => void = render(tpl, document.body);
dispose();

// Elements
class UserCard extends XoElement {
  static props = { name: String, age: Number, active: Boolean };
  declare name: string;
  declare age: number;
  declare active: boolean;
  render() { return html`<h3>${() => this.name}</h3>`; }
  connected() { this.effect(() => { void this.age; }); this.emit('hello', { n: 1 }); void this.ready().then((el) => el.name); }
  disconnected() {}
}
define('user-card', UserCard);
const card = new UserCard();
card.name = 'Ada';

class Plain extends XoElement { connected() { this.emit('ready'); } }
define('x-plain', Plain);

class Stars extends XoControl {
  static props = { ...XoControl.props, max: Number };
  declare max: number;
  render() { return html`<button @click=${() => this.userInput(Number(this.value) + 1)}>+</button>`; }
  validate(value: unknown) { return Number(value) > this.max ? 'Too many stars' : ''; }
  serialize(v: number) { return String(v); }
  isEmpty(v: unknown) { return !v; }
}
define('x-stars', Stars);
const stars = new Stars();
stars.setValue(3);
stars.userInput(4);
stars.userChange();
const dirty: boolean = stars.dirty && !stars.pristine && stars.touched && stars.valid && !stars.invalid;
const msg: string = stars.validationMessage;
stars.setCustomValidity('nope');
const checks: boolean = stars.checkValidity() && stars.reportValidity() && stars.willValidate && stars.isDisabled;
const focus: HTMLElement | null = stars.focusTarget;
const form: HTMLFormElement | null = stars.form;
const validity: XoValidity = stars.validity;
const name: string = stars.name;
stars.required = true;
stars.reset();
stars.markPristine();
stars.markTouched();
const ser: string | File | FormData | null = new XoControl().serialize('x');
void [dirty, msg, checks, focus, form, validity, name, ser, stars.initialValue];

// Text hook
const label: string = text('xoong.table.next', 'Next');
const plural: string = text('k', '{n, plural, one {# row} other {# rows}}', { n: 2 });
setTextProvider((key, args) => (key === 'a' ? String(args?.x) : undefined));
setTextProvider(null);
void [label, plural];

// Helpers
const near: string | undefined = nearest('lsit', ['list', 'get']);
const d: number = distance('a', 'b');
const attrs: string[] = XO_ATTRIBUTES;
void [near, d, attrs, XO_CONTROL_ELEMENTS];

// Mistakes are compile errors.
// @ts-expect-error a signal holds one type
count.value = 'a';
// @ts-expect-error computed signals are read-only
double.value = 3;
// @ts-expect-error render takes a template result
render('text', document.body);
// @ts-expect-error props accept String, Number or Boolean only
class Bad extends XoElement { static props = { x: Date }; }
// @ts-expect-error a prop declared as a number
card.age = 'old';
// @ts-expect-error validity is read-only
stars.validity = validity;
// @ts-expect-error dirty is read-only
stars.dirty = true;
// @ts-expect-error text needs a fallback
text('key');
void Bad;
