// @ts-check
/**
 * What `xoong` accepts, described once: every command, its positional arguments, its options (with defaults) and the exit codes.
 * Three things are made from this one table, so none of them can drift from what the code accepts:
 *   - `xoong --help` (`helpText()` below),
 *   - the parser's table of commands and options (`COMMANDS` in args.js),
 *   - the "Command line" page of the documentation site (tools/site/tooling-pages.mjs).
 * A new command or option is added here, and nowhere else, in order to exist; cli.js then has to handle it.
 */

/**
 * @typedef {object} Option
 * @property {string} flag          the option as typed: `--out`
 * @property {string} [value]       how its value is written in the usage line (`.xoong`, `<url>`); absent for a flag that takes no value
 * @property {string} [default]     what is used when the option is not given (absent: nothing is used)
 * @property {boolean} [required]   the command shows the help instead of running without it
 * @property {boolean} [repeatable] may be given several times; every occurrence counts
 * @property {string[]} [choices]   the only values it accepts
 * @property {string} doc           what it does, in one sentence (the documentation site shows it)
 */

/**
 * @typedef {object} Command
 * @property {string} name          `check`, or `i18n extract` for a sub-command
 * @property {string} [args]        the positional arguments as written in the usage line (`<file|folder>...`)
 * @property {number | '+'} count   how many positional arguments: a number, or '+' for one or more
 * @property {string} summary       what it does, in a few words (the help prints it after the options)
 * @property {Option[]} options     values first, then flags: the order of the usage line
 */

const SPEC = '<openapi.json|yaml|url>';
const OPERATIONS = '.xoong/operations.json';

/** @type {Command[]} */
export const USAGE = [
  {
    name: 'sync', args: SPEC, count: 1, summary: 'generate operations.json and api.d.ts',
    options: [
      { flag: '--out', value: '.xoong', default: '.xoong', doc: 'The folder for the generated files (created when it is missing).' },
      { flag: '--hints', value: 'hints.json', doc: 'A hints file (xoong.hints.json). It is never looked for on its own: pass it on every run.' },
    ],
  },
  {
    name: 'doctor', args: SPEC, count: 1, summary: 'audit the OpenAPI document for xoong',
    options: [
      { flag: '--hints', value: 'hints.json', doc: 'The same hints file you give to sync, so the audit sees what sync sees.' },
      { flag: '--all', doc: 'Print every warning. By default each warning code shows its first five and counts the rest.' },
    ],
  },
  {
    name: 'new', args: '<folder>', count: 1, summary: 'create a project with a first screen',
    options: [
      { flag: '--spec', value: SPEC, required: true, doc: 'The OpenAPI document the project is made from (a file or a URL). It is copied into the project.' },
      { flag: '--title', value: '"My app"', default: 'the title of the OpenAPI document', doc: 'The heading of the first screen.' },
      { flag: '--link', value: '<xoong checkout>', doc: 'A checkout of the xoong repository: the project then uses its packages by path instead of from npm.' },
    ],
  },
  {
    name: 'check', args: '<file|folder>...', count: '+', summary: 'check HTML screens',
    options: [
      { flag: '--operations', value: OPERATIONS, default: OPERATIONS, doc: 'The operations table that sync wrote.' },
      { flag: '--format', value: 'text|json', default: 'text', choices: ['text', 'json'], doc: 'text prints one finding with its fix per line; json prints the list of findings, for tools.' },
      { flag: '--exclude', value: 'glob', repeatable: true, doc: 'Skip the files and folders that match (paths relative to the current folder). It adds to check.exclude of xoong.config.json.' },
    ],
  },
  {
    name: 'render', args: '<page.html>', count: 1, summary: 'prerender a page (a route, with --url) with its data (needs @xoong/ssr)',
    options: [
      { flag: '--api', value: '<url>', required: true, doc: 'The base URL of the API the page reads its data from.' },
      { flag: '--url', value: '/users/7', doc: 'Render the route of this URL, for a page with an <xo-router>.' },
      { flag: '--operations', value: OPERATIONS, default: OPERATIONS, doc: 'The operations table that sync wrote.' },
      { flag: '--out', value: 'file', doc: 'Write the HTML to this file (its folders are created). Without it the HTML goes to standard output.' },
    ],
  },
  {
    name: 'build', count: 0, summary: 'static output for strict-CSP hosting (no import map, no inline code)',
    options: [
      { flag: '--root', value: '.', default: '.', doc: 'The folder with the pages. Every .html file under it is a page.' },
      { flag: '--out', value: 'dist', default: 'dist', doc: 'The output folder. It is never read as input, even when it sits inside the root.' },
      { flag: '--base', value: '/admin', doc: 'The URL path the app is served under. Root-absolute URLs get this prefix. By default the app is served at /.' },
      { flag: '--include', value: 'path', repeatable: true, doc: 'A file or folder (relative to the root) to publish although no page names it: data fetched from JavaScript, images named in code.' },
      { flag: '--exclude', value: 'glob', repeatable: true, doc: 'Keep matching .html files out of the start list (partials, drafts). A file that a page references is still published.' },
      { flag: '--no-preload', doc: 'Do not add <link rel="modulepreload"> to the pages.' },
    ],
  },
  {
    name: 'i18n extract', args: '<html|js files or folders>...', count: '+', summary: 'list xo-t keys with their source text',
    options: [
      { flag: '--out', value: 'catalogs/en.json', doc: 'Write the catalog to this file (its folders are created). Without it the JSON goes to standard output.' },
    ],
  },
  {
    name: 'i18n check', args: '<catalog.json>', count: 1, summary: 'missing keys, wrong placeholders, invalid messages',
    options: [
      { flag: '--source', value: '<en.json>', required: true, doc: 'The source-language catalog, the file that i18n extract wrote. The translation is checked against it.' },
    ],
  },
  {
    name: 'dev', count: 0, summary: 'serve the app (static, proxy, .ts)',
    options: [
      { flag: '--root', value: '.', default: '.', doc: 'The folder to serve. xoong.config.json is read from it.' },
      { flag: '--port', value: '5173', default: '5173', doc: 'The port, a number from 0 to 65535 (0 lets the system pick one). The server listens on 127.0.0.1 only.' },
      { flag: '--proxy', value: '/api=http://localhost:8080', repeatable: true, doc: 'Forward the requests under a prefix to a backend, written /prefix=http://host:port. It adds to proxy of xoong.config.json; for the same prefix the flag wins.' },
      { flag: '--spa', doc: 'Answer every path without a file extension with index.html, for an app with an <xo-router>.' },
    ],
  },
];

/** Options that belong to no command. */
export const GLOBAL_OPTIONS = [
  { flag: '--version', alias: '-v', summary: 'print the version' },
  { flag: '--help', alias: '-h', summary: 'print the help (anywhere on the line; `xoong help` too). Nothing else is done.' },
];

/** What the exit code of `xoong` says. */
export const EXIT_CODES = [
  { code: 0, text: 'done' },
  { code: 1, text: 'findings or a failure (also a refused option)' },
  { code: 2, text: 'unknown command or a missing argument' },
];

/** One option as the usage line writes it: `[--out dist]`, `--spec <url>` (required), `[--exclude glob]...` (repeatable). */
export const optionUsage = (/** @type {Option} */ o) => {
  const text = o.value === undefined ? o.flag : `${o.flag} ${o.value}`;
  return o.required ? text : `[${text}]${o.repeatable ? '...' : ''}`;
};

/** The usage line of a command, as the help prints it before the summary. */
export const commandUsage = (/** @type {Command} */ c) => [c.name, c.args, ...c.options.map(optionUsage)].filter(Boolean).join(' ');

/** The text of `xoong --help`. */
export function helpText() {
  const lines = USAGE.map((c) => `  ${commandUsage(c)}   ${c.summary}`);
  const version = GLOBAL_OPTIONS.find((o) => o.flag === '--version');
  if (version) lines.push(`  ${version.flag}   ${version.summary}`);
  return `xoong <command>\n\n${lines.join('\n')}\n\nOptions that do not exist are refused. Exit code: ${EXIT_CODES.map((e) => `${e.code} ${e.text}`).join(', ')}.\n`;
}
