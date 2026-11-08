// @ts-check
/**
 * A tiny glob for `--exclude` and `exclude` in xoong.config.json: paths relative to the project root, `/` separators.
 *   `*` any characters except `/`   `**` any characters including `/`   `?` one character   a trailing `/` means the folder and everything in it.
 * A pattern without a `/` matches that name at any depth (`*.draft.html`, `partials`). A folder that matches is skipped with all it holds.
 * @param {string[] | undefined} patterns
 * @returns {(relativePath: string) => boolean}
 */
export function excluder(patterns) {
  const list = (patterns ?? []).map((p) => String(p).trim().replaceAll('\\', '/').replace(/^\.\//, '')).filter(Boolean);
  const regexes = list.map((p) => {
    if (p.endsWith('/')) p += '**';
    if (!p.includes('/')) p = `**/${p}`;
    const source = p.replace(/[.+^${}()|[\]]/g, '\\$&').replace(/\*\*\//g, '\u0000').replace(/\*\*/g, '\u0001').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]').replace(/\u0000/g, '(?:.*/)?').replace(/\u0001/g, '.*');
    return new RegExp(`^${source}$`);
  });
  return (relativePath) => {
    const path = relativePath.replaceAll('\\', '/').replace(/^\.\//, '');
    return regexes.some((r) => r.test(path));
  };
}
