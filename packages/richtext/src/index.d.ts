// Types for @xoong/richtext. Importing the package registers <xo-richtext>; these types describe the element, its tag, its events and the sanitiser.
// To add an element or event: an interface, a line in `XoRichtextTagMap` / `XoRichtextEventMap`.
import type { XoControl } from '@xoong/core';

export { sanitizeHtml, isSafeLink, isSafeImage, textOf } from './sanitize.js';

/** What `detail.insert` of `xo-pick-media` takes: a URL, or `{ src, alt }` (a string second argument is the alt text for a URL). */
export type XoRichtextInsert = (media: { src: string; alt?: string } | string, alt?: string) => void;

/** `<xo-richtext>`: a small rich text editor and a form control. Its value is sanitised HTML (p, h2, h3, strong, em, u, ul, ol, li, blockquote, br, a, img). */
export interface XoRichtextElement extends XoControl {
  value: string;
  label: string;
  placeholder: string;
  /** Space separated tools, in order: `undo redo style bold italic underline h2 ul ol quote link image`. `image` shows only with `media`. */
  tools: string;
  /** `full` or `compact` forces a toolbar size; by default the editor's own width decides. */
  toolbar: string;
  /** Shows the image tool, which fires `xo-pick-media`. */
  media: boolean;
  /** Most text characters allowed (0 is no limit). */
  maxlength: number;
  /** Whether the editor is open in its dialog. */
  readonly expanded: boolean;
  /** Open the same editor in a large dialog. Fires `xo-richtext-expand`. */
  expand(): void;
  /** Close the dialog (what Done and Escape do). Fires `xo-richtext-done`. */
  collapse(): void;
  /** Insert an image (http, https or a relative URL) at the caret, or at the range `at`. Returns false when it was refused (read-only, disabled, unsafe URL). */
  insertImage(src: string, alt?: string, at?: Range | null): boolean;
}

/** The class behind `<xo-richtext>` (`customElements.get('xo-richtext')`). */
export interface XoRichtextConstructor {
  new (): XoRichtextElement;
  /** A typed address made into a link target: `a@b.test` becomes `mailto:`, `example.com` becomes `https://`. */
  linkTarget(raw: string): string;
}

/** Every element of this package by tag name. */
export interface XoRichtextTagMap {
  'xo-richtext': XoRichtextElement;
}

/** The events that carry data, by name. */
export interface XoRichtextEventMap {
  /**
   * The image tool was used. Open your media library in a listener, call `preventDefault()`, and call `detail.insert` when the person has chosen
   * (now or later). Without `preventDefault()` nothing is inserted.
   */
  'xo-pick-media': CustomEvent<{ insert: XoRichtextInsert }>;
  'xo-richtext-expand': CustomEvent<null>;
  'xo-richtext-done': CustomEvent<null>;
}

declare global {
  interface HTMLElementTagNameMap extends XoRichtextTagMap {}
  interface HTMLElementEventMap extends XoRichtextEventMap {}
  // The events bubble, so a listener on the document is typed too.
  interface DocumentEventMap extends XoRichtextEventMap {}
}
