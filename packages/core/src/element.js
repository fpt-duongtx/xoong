// @ts-check
import { signal, effect } from './signals.js';
import { render } from './html.js';

const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

function coerce(type, raw) {
  if (type === Boolean) return raw !== null && raw !== 'false';
  if (raw === null) return type === Number ? 0 : '';
  return type === Number ? Number(raw) : String(raw);
}

function fromProp(type, v) {
  if (type === Boolean) return v !== null && v !== undefined && v !== false && v !== 'false';
  if (type === Number) return Number(v ?? 0);
  return v == null ? '' : String(v);
}

/**
 * Light DOM base element.
 *
 *   class UserCard extends XoElement {
 *     static props = { name: String, age: Number }   // attributes <-> signals
 *     render() { return html`<h3>${() => this.name}</h3>` }
 *   }
 *   define('user-card', UserCard)
 *
 * - `props` are reflected from attributes and readable/writable as properties;
 *   reading `this.name` inside a template function is tracked automatically.
 * - Implement `render()` only if the element OWNS its content. To enhance
 *   server-rendered HTML in place, implement `connected()` instead.
 * - Use `this.effect(fn)` for side effects: it is disposed on disconnect.
 */
// Importable outside a browser (SSR, tooling, tests); elements only run in a DOM.
const Base = /** @type {typeof HTMLElement} */ (globalThis.HTMLElement ?? class {});

export class XoElement extends Base {
  /** @type {Record<string, typeof String | typeof Number | typeof Boolean>} */
  static props = {};

  static get observedAttributes() {
    return Object.keys(this.props).map(kebab);
  }

  /** @type {Record<string, import('./signals.js').Signal<any>>} */
  #sigs = {};
  /** @type {(() => void)[]} */
  #disposers = [];

  constructor() {
    super();
    const props = /** @type {typeof XoElement} */ (this.constructor).props;
    for (const [name, type] of Object.entries(props)) {
      // Properties set before the element was upgraded win over defaults.
      const own = Object.getOwnPropertyDescriptor(this, name);
      if (own) delete (/** @type {any} */ (this))[name];
      this.#sigs[name] = signal(own ? own.value : coerce(type, null));
    }
  }

  /** @param {string} name */
  _sig(name) {
    return this.#sigs[name];
  }

  attributeChangedCallback(attr, _old, value) {
    const props = /** @type {typeof XoElement} */ (this.constructor).props;
    const name = Object.keys(props).find((n) => kebab(n) === attr);
    if (name) this.#sigs[name].value = coerce(props[name], value);
  }

  connectedCallback() {
    const result = this.render?.();
    if (result) this.#disposers.push(render(result, this));
    this.connected?.();
  }

  disconnectedCallback() {
    this.#disposers.splice(0).forEach((d) => d());
    this.disconnected?.();
  }

  /** Resolves when the element's children are there: at once when the page is parsed, else after the parser reached the end of the document. Await it in connected(). */
  ready() {
    return new Promise((r) => (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => r(this), { once: true }) : r(this)));
  }

  /** Side effect bound to this element's lifetime. @param {() => void | (() => void)} fn */
  effect(fn) {
    this.#disposers.push(effect(fn));
  }

  /** Dispatch a bubbling CustomEvent. */
  emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true, cancelable: true }));
  }
}

/**
 * Register a custom element (idempotent). Tag must contain a hyphen.
 * @param {string} tag
 * @param {typeof XoElement} cls
 */
export function define(tag, cls) {
  if (customElements.get(tag)) return;
  for (const name of Object.keys(cls.props)) {
    let at = cls.prototype, found;
    while (at && at !== XoElement.prototype && !(found = Object.getOwnPropertyDescriptor(at, name))) at = Object.getPrototypeOf(at);
    if (found && !found.get?.xo) continue; // the class has its own accessor for this prop (xo-switch keeps `checked` in step with `value`): it stays
    Object.defineProperty(cls.prototype, name, {
      get: Object.assign(function () { return this._sig(name).value; }, { xo: 1 }), // marked: an accessor the class wrote itself has no mark
      set(v) {
        this._sig(name).value = fromProp(cls.props[name], v);
      },
      configurable: true,
    });
  }
  customElements.define(tag, cls);
}
