// Types for @xoong/richtext/sanitize: the allow-list sanitiser behind <xo-richtext>. It needs no DOM: the same code runs in a browser and in Node, with the same output.

/** One allowed tag: its attributes (a type, or a list of allowed values) and the class names it may keep. */
export interface RichtextTagSpec {
  /** `text`, `url` (checked against `schemes.url`), `imgurl` (`schemes.imgurl`), `int` (up to 5 digits), or a list of allowed values. `style`, `on*`, `srcdoc` are refused; `id` needs a list. */
  attrs?: Record<string, 'text' | 'url' | 'imgurl' | 'int' | string[]>;
  /** The class names this tag keeps; any other class token is removed. */
  classes?: string[];
}

/** A white-list as plain data. Known tags: p h1-h6 pre figcaption ul ol li blockquote aside div section figure strong em u s code sub sup mark small span abbr kbd a br img. */
export interface RichtextProfile {
  tags: Record<string, RichtextTagSpec>;
  /** Tag renames applied before the check: `{ b: 'strong', div: 'p' }`. */
  rename?: Record<string, string>;
  /** More tags removed with their content (script, style, iframe, object, embed, svg, math, template, noscript are always removed). */
  drop?: string[];
  /** Allowed URL schemes. `relative` allows a URL without a scheme; `data:image` allows raster data: images (png, jpeg, gif, webp, avif). */
  schemes?: { url?: string[]; imgurl?: string[] };
}

/** A link target allowed by default: http, https, mailto or tel. */
export function isSafeLink(url: string): boolean;

/** An image source allowed by default: http, https, or a URL without a scheme (relative or root-relative). */
export function isSafeImage(url: string): boolean;

/**
 * Sanitise HTML with a profile: a profile object, the name of a registered one (`default`, `rich`, or from `defineRichtextProfile`), or nothing for `default`.
 * `{ images: false }` is the default profile without `<img>`. The same input gives the same output in a browser and in Node, and sanitising the result again changes nothing.
 */
export function sanitizeHtml(html: string, profile?: RichtextProfile | string | { images?: boolean } | null): string;

/** Register a named profile for `<xo-richtext profile="name">` and `sanitizeHtml(html, 'name')`. Throws for a profile that cannot be kept safe. `default` and `rich` are built in. */
export function defineRichtextProfile(name: string, profile: RichtextProfile): void;

/** A registered profile by name, or undefined. */
export function getRichtextProfile(name: string): RichtextProfile | undefined;

/** Whether a profile (object or name; none is `default`) keeps a tag. */
export function profileAllows(profile: RichtextProfile | string | null | undefined, tag: string): boolean;

/** The text of HTML (sanitised or not), for "is it empty" checks and length limits. */
export function textOf(html: string): string;
