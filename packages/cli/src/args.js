// @ts-check
import { USAGE } from './usage.js';

/**
 * The commands of `xoong` and the options each one accepts, made from the table in usage.js (the same one `xoong --help` and the documentation
 * site are made from). `cli.js` refuses everything else: a typo such as `--exclud` used to be ignored without a word.
 *
 *   args       how many positional arguments: a number, or '+' for one or more
 *   values     options that take a value (`--out dist`); a repeatable one may appear several times
 *   flags      options without a value
 *   required   options the command cannot run without (the help is shown instead)
 *   repeatable options that collect every occurrence (`--exclude a --exclude b`)
 */
export const COMMANDS = Object.fromEntries(USAGE.map((c) => [c.name, {
  args: c.count,
  values: c.options.filter((o) => o.value !== undefined).map((o) => o.flag),
  flags: c.options.filter((o) => o.value === undefined).map((o) => o.flag),
  required: c.options.filter((o) => o.required).map((o) => o.flag),
  repeatable: c.options.filter((o) => o.repeatable).map((o) => o.flag),
}]));

/** Option values with a fixed set of choices, per command. */
export const CHOICES = Object.fromEntries(USAGE.filter((c) => c.options.some((o) => o.choices)).map((c) => [c.name, Object.fromEntries(c.options.filter((o) => o.choices).map((o) => [o.flag, o.choices]))]));

/**
 * @param {string} name a key of COMMANDS
 * @param {string[]} argv what follows the command
 * @returns {{ args: string[], value: (option: string, fallback?: string) => string | undefined, all: (option: string) => string[], has: (flag: string) => boolean } | null}
 *   null when a positional argument or a required option is missing (show the help). Throws a message for an option that does not exist,
 *   an option without its value, a value that is not allowed, and arguments that are too many.
 */
export function parseArgs(name, argv) {
  const spec = COMMANDS[/** @type {keyof typeof COMMANDS} */ (name)];
  /** @type {string[]} */ const args = [];
  /** @type {Record<string, string[]>} */ const values = {};
  /** @type {Set<string>} */ const flags = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (spec.flags.includes(a)) flags.add(a);
    else if (spec.values.includes(a)) {
      if (i + 1 >= argv.length) throw new Error(`xoong ${name}: ${a} needs a value`);
      (values[a] ??= []).push(argv[++i]);
    } else if (a.length > 1 && a.startsWith('-')) {
      throw new Error(`xoong ${name}: unknown option ${a} (known: ${[...spec.values, ...spec.flags].join(', ') || 'none'})`);
    } else args.push(a);
  }
  for (const [option, allowed] of Object.entries(/** @type {Record<string, string[]>} */ (CHOICES[/** @type {keyof typeof CHOICES} */ (name)] ?? {}))) {
    for (const v of values[option] ?? []) if (!allowed.includes(v)) throw new Error(`xoong ${name}: ${option} must be ${allowed.join(' or ')}, not "${v}"`);
  }
  if (spec.args === 0 && args.length) throw new Error(`xoong ${name}: unexpected argument ${args[0]} (it takes only options)`);
  if (typeof spec.args === 'number' && spec.args > 0 && args.length > spec.args) throw new Error(`xoong ${name}: unexpected argument ${args[spec.args]} (it takes ${spec.args})`);
  if (spec.args === '+' ? !args.length : args.length < /** @type {number} */ (spec.args)) return null;
  if (spec.required.some((r) => !values[r])) return null;
  return { args, value: (option, fallback) => values[option]?.[0] ?? fallback, all: (option) => values[option] ?? [], has: (flag) => flags.has(flag) };
}
