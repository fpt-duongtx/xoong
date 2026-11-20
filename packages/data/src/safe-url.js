// @ts-check
/** What a URL taken from data may be: nothing that runs script. */

/**
 * Allow relative URLs and http(s)/mailto/tel; reject javascript:, data:, vbscript: (even if obfuscated with whitespace).
 * A picture (`image`: `<img src>`, `<xo-image src>`) may also be a blob: URL (an upload preview) or a data:image/ raster (never svg).
 */
export function isSafeUrl(value, image = false) {
  const compact = value.replace(/[\u0000-\u0020\u007f-\u009f]/g, '').toLowerCase();
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(compact)?.[1];
  return !scheme || ['http', 'https', 'mailto', 'tel'].includes(scheme) || (image && /^(blob:|data:image\/(png|jpeg|gif|webp|avif)[;,])/.test(compact));
}
/** `xo-then` goes to a page of this site: a relative path or a same-origin URL, and nothing `isSafeUrl` refuses. */
export function ownPage(path) {
  if (!isSafeUrl(path)) return false;
  try { return new URL(path, location.href).origin === location.origin; } catch { return !/^\s*[/\\]{2}|^[a-z][a-z0-9+.-]*:/i.test(path); }
}
