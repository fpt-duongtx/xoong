// Types for the `html` template and `render` of @xoong/core.

/** What `html` returns: the strings and values of one template call. Nothing touches the DOM until `render` (or an element's `render()`) uses it. */
export class TemplateResult {
  constructor(strings: TemplateStringsArray, values: unknown[]);
  readonly strings: TemplateStringsArray;
  readonly values: unknown[];
}

/**
 * Tagged template with fine-grained reactive bindings (Light DOM, no virtual DOM). A function in a child or attribute position is reactive.
 *
 *     html`<h3 class=${() => cls.value}>${() => name.value}</h3><button @click=${() => save()}>Save</button>`
 *
 * `name=${v}` sets an attribute (null/false removes it), `?name=${v}` a boolean attribute, `.name=${v}` a DOM property, `@event=${fn}` a listener,
 * `style:--x=${v}` a CSS custom property through the CSS object model.
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult;

/** Render a template result into `container`, replacing its children. Returns the dispose function. */
export function render(result: TemplateResult, container: Element | DocumentFragment): () => void;
