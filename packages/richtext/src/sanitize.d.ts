// Types for @xoong/richtext/sanitize: the allow-list sanitiser behind <xo-richtext>. It needs a DOM (browser, happy-dom).

/** A link target the editor allows: http, https, mailto or tel. */
export function isSafeLink(url: string): boolean;

/** An image source the editor allows: http, https, or a URL without a scheme (relative or root-relative). */
export function isSafeImage(url: string): boolean;

/**
 * Sanitise HTML to the editor's subset: p, h2, h3, strong, em, u, ul, ol, li, blockquote, br, a (safe links only), img (safe sources only).
 * `images: false` removes `<img>`.
 */
export function sanitizeHtml(html: string, options?: { images?: boolean }): string;

/** The text of sanitised or raw HTML, for "is it empty" checks and length limits. */
export function textOf(html: string): string;
