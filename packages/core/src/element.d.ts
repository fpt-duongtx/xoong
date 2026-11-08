// Types for XoElement and define.
import type { Signal } from './signals.js';
import type { TemplateResult } from './html.js';

/** The attribute types a prop can have; the attribute is converted to it (Boolean: present and not "false"). */
export type XoPropType = StringConstructor | NumberConstructor | BooleanConstructor;

/**
 * Light DOM base element.
 *
 * `static props` declares attributes that are also properties and signals; `define` installs the accessors, so TypeScript needs to be told about them.
 * Declare each one in the subclass with `declare` (it emits nothing):
 *
 *     class UserCard extends XoElement {
 *       static props = { name: String, age: Number };
 *       declare name: string;
 *       declare age: number;
 *       render() { return html`<h3>${() => this.name}</h3>`; }
 *     }
 *     define('user-card', UserCard);
 */
export class XoElement extends HTMLElement {
  /** Attributes <-> signals. The attribute is the kebab-case of the name (`maxSize` is `max-size`). */
  static props: Record<string, XoPropType>;
  static get observedAttributes(): string[];

  constructor();

  /** The signal behind a prop (reading `this.name` already tracks it). */
  _sig(name: string): Signal<any>;

  attributeChangedCallback(attr: string, oldValue: string | null, value: string | null): void;
  connectedCallback(): void;
  disconnectedCallback(): void;

  /**
   * Implement it only if the element OWNS its content: the result is rendered into the element when it connects.
   * To enhance server-rendered HTML in place, implement `connected()` instead.
   */
  render?(): TemplateResult | null | undefined | void;
  /** Runs after `render()` when the element is connected. */
  connected?(): void;
  /** Runs after the element's effects and rendering were disposed, when it is disconnected. */
  disconnected?(): void;

  /** Resolves with the element when its children are there: at once once the document is parsed, else after the parser reached the end. Await it in `connected()`. */
  ready(): Promise<this>;

  /** A side effect bound to this element's lifetime: disposed on disconnect. */
  effect(fn: () => void | (() => void)): void;

  /** Dispatch a bubbling, composed CustomEvent. */
  emit<T = unknown>(name: string, detail?: T): void;
}

/** Register a custom element (idempotent: a tag that is already defined is left alone). The tag must contain a hyphen. */
export function define(tag: string, cls: typeof XoElement): void;
