// The command line: every command refuses an option it does not have (it used to ignore it), `xoong --help` lists what the code accepts.
import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, readdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { COMMANDS, parseArgs } from '../src/args.js';
import { USAGE, EXIT_CODES, helpText } from '../src/usage.js';

const run = promisify(execFile);
const cli = new URL('../src/cli.js', import.meta.url).pathname;
const xoong = (args, options = {}) => run(process.execPath, [cli, ...args], options);

describe('parseArgs', () => {
  it('splits arguments, values and flags; repeatable options collect every value, a single one takes the first', () => {
    const a = parseArgs('build', ['--exclude', 'a', '--no-preload', '--out', 'dist', '--exclude', 'b', '--out', 'other']);
    expect(a.all('--exclude')).toEqual(['a', 'b']);
    expect(a.value('--out')).toBe('dist');
    expect(a.value('--base', '')).toBe('');
    expect(a.has('--no-preload')).toBe(true);
    expect(a.has('--spa')).toBe(false);
    expect(parseArgs('check', ['a.html', '--format', 'json', 'dir', '--exclude', '*.draft.html']).args).toEqual(['a.html', 'dir']);
  });

  it('a value may start with a dash, and a lone dash is an argument', () => {
    expect(parseArgs('dev', ['--root', '-weird']).value('--root')).toBe('-weird');
    expect(parseArgs('check', ['-']).args).toEqual(['-']);
  });

  it('refuses an unknown option (naming the known ones), an option without its value, a bad choice and too many arguments', () => {
    expect(() => parseArgs('check', ['x.html', '--exclud', 'a'])).toThrow('xoong check: unknown option --exclud (known: --operations, --format, --exclude)');
    expect(() => parseArgs('sync', ['api.json', '--out'])).toThrow('--out needs a value');
    expect(() => parseArgs('check', ['x.html', '--format', 'sarif'])).toThrow('--format must be text or json, not "sarif"');
    expect(() => parseArgs('build', ['dist'])).toThrow('unexpected argument dist');
    expect(() => parseArgs('sync', ['a.json', 'b.json'])).toThrow('unexpected argument b.json');
    expect(() => parseArgs('dev', ['-p', '3000'])).toThrow('unknown option -p');
  });

  it('returns null when an argument or a required option is missing (the help is shown)', () => {
    expect(parseArgs('sync', [])).toBeNull();
    expect(parseArgs('check', ['--format', 'json'])).toBeNull();
    expect(parseArgs('new', ['app'])).toBeNull(); // needs --spec
    expect(parseArgs('render', ['page.html'])).toBeNull(); // needs --api
    expect(parseArgs('i18n check', ['vi.json'])).toBeNull(); // needs --source
    expect(parseArgs('i18n extract', [])).toBeNull();
    expect(parseArgs('build', [])).not.toBeNull();
  });
});

describe('xoong --help matches what the code accepts', () => {
  const help = helpText(); // usage.js is the one table: the help, COMMANDS and the documentation page are made from it
  const lines = help.split('\n').filter((l) => /^ {2}\S/.test(l));
  const lineOf = (name) => lines.find((l) => l.trim().startsWith(`${name} `));

  it('lists every command, and every option of each (a ... after an option means it may repeat)', () => {
    for (const [name, spec] of Object.entries(COMMANDS)) {
      const line = lineOf(name);
      expect(line, `no line for "${name}" in the help`).toBeTruthy();
      const options = [...new Set([...line.matchAll(/--[\w-]+/g)].map((m) => m[0]))];
      expect(options.sort(), `options of "${name}"`).toEqual([...spec.values, ...spec.flags].sort());
      for (const option of spec.repeatable) expect(line, `${name} ${option} may repeat`).toMatch(new RegExp(`${option} [^\\]]*\\]\\.\\.\\.`));
      for (const option of spec.required) expect(line, `${name} ${option} is required`).not.toMatch(new RegExp(`\\[${option}`));
    }
    expect(lines.filter((l) => !l.startsWith('  --')).length).toBe(Object.keys(COMMANDS).length); // no command in the help that the code does not have
  });

  it('the table has every command once, the exit codes the help names, and no option twice in a command', () => {
    expect(new Set(USAGE.map((c) => c.name)).size).toBe(USAGE.length);
    expect(help).toContain(`Exit code: ${EXIT_CODES.map((e) => `${e.code} ${e.text}`).join(', ')}.`);
    for (const c of USAGE) {
      expect(new Set(c.options.map((o) => o.flag)).size, c.name).toBe(c.options.length);
      for (const o of c.options) expect(o.doc, `${c.name} ${o.flag} needs a description for the documentation`).toMatch(/\S/);
    }
  });

  it('cli.js reads every option the table lists (an option that is listed and never read would be accepted and ignored)', () => {
    const source = readFileSync(cli, 'utf8');
    for (const c of USAGE) for (const o of c.options) expect(source, `${c.name} ${o.flag}`).toContain(`'${o.flag}'`);
  });

  it('prints it for --help anywhere, -h and help, and does nothing else', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'xoong-help-'));
    for (const args of [['--help'], ['-h'], ['help'], ['check', '--help'], ['i18n', 'extract', '-h'], ['dev', '--port', '1', '--help']]) {
      const { stdout } = await xoong(args, { cwd: dir });
      expect(stdout, args.join(' ')).toBe(`${helpText()}\n`); // console.log adds the last newline
    }
    expect(await readdir(dir)).toEqual([]);
  });
});

describe('xoong: refused input, exit codes', () => {
  it('every command refuses an unknown option with exit code 1 and writes nothing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'xoong-opts-'));
    await writeFile(join(dir, 'a.html'), '<p>x</p>');
    const cases = {
      sync: ['sync', 'api.json', '--outt', 'x'], doctor: ['doctor', 'api.json', '--al'], new: ['new', 'app', '--spec', 'a.json', '--titel', 'x'],
      check: ['check', 'a.html', '--exclud', 'x'], render: ['render', 'a.html', '--api', 'http://x', '--ur', '/'], 'i18n extract': ['i18n', 'extract', 'a.html', '--ot', 'x'],
      'i18n check': ['i18n', 'check', 'a.json', '--sourc', 'x'], build: ['build', '--hlep'], dev: ['dev', '--prot', '3000'],
    };
    expect(Object.keys(cases).sort()).toEqual(Object.keys(COMMANDS).sort()); // a new command needs a case here
    for (const [name, args] of Object.entries(cases)) {
      await expect(xoong(args, { cwd: dir }), name).rejects.toMatchObject({ code: 1, stderr: expect.stringMatching(new RegExp(`xoong ${name}: unknown option`)) });
    }
    expect(await readdir(dir)).toEqual(['a.html']);
  });

  it('a missing argument shows the help with exit code 2, like an unknown command; --version prints the package version', async () => {
    for (const args of [['sync'], ['check'], ['nonsense'], ['i18n', 'oops']]) {
      await expect(xoong(args)).rejects.toMatchObject({ code: 2 });
    }
    const { stdout } = await xoong(['--version']);
    expect(stdout.trim()).toBe(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
  });

  it('dev refuses a port that is not a number, check refuses a format it does not have', async () => {
    await expect(xoong(['dev', '--port', 'abc'])).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('--port must be a number') });
    await expect(xoong(['dev', '--port', '70000'])).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('--port must be a number') });
    await expect(xoong(['check', 'a.html', '--format', 'sarif'])).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('--format must be text or json') });
  });

  it('check collects every --exclude, and a repeated option still reaches the command', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'xoong-excl-'));
    await writeFile(join(dir, 'ops.json'), JSON.stringify({ operations: {} }));
    await writeFile(join(dir, 'a.html'), '<xo-view get="/nope"></xo-view>');
    await writeFile(join(dir, 'b.html'), '<xo-view get="/nope"></xo-view>');
    await writeFile(join(dir, 'c.html'), '<p>fine</p>');
    const { stdout } = await xoong(['check', dir, '--operations', join(dir, 'ops.json'), '--exclude', 'a.html', '--exclude', 'b.html', '--format', 'json']);
    expect(JSON.parse(stdout)).toEqual([]);
    await expect(xoong(['check', dir, '--operations', join(dir, 'ops.json'), '--exclude', 'a.html'])).rejects.toMatchObject({ code: 1 }); // b.html still fails
  });
});
