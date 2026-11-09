import { test } from 'vitest';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const formatUrl = new URL('../src/format.js', import.meta.url).href;
/** Run `format(name, value, 'en-US')` in a fresh process whose time zone is `tz` (the zone cannot be changed reliably inside a test worker). */
function inZone(tz, calls) {
  const script = `import { format } from ${JSON.stringify(formatUrl)}; console.log(JSON.stringify(${JSON.stringify(calls)}.map(([n, v]) => format(n, v, 'en-US'))));`;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ: tz }, encoding: 'utf8', cwd: fileURLToPath(new URL('..', import.meta.url)) }));
}

test('a date-only string is a calendar date: it never shows the day before in a time zone west of UTC', () => {
  for (const tz of ['America/Los_Angeles', 'Pacific/Honolulu', 'UTC', 'Asia/Ho_Chi_Minh', 'Pacific/Kiritimati']) {
    const [date, datetime, time] = inZone(tz, [['date', '2026-11-07'], ['datetime', '2026-11-07'], ['time', '2026-11-07']]);
    assert.equal(date, 'Nov 7, 2026', tz);
    assert.equal(datetime, 'Nov 7, 2026, 12:00 AM', tz); // a day without a time of day: the start of that calendar day, not a zone-shifted instant
    assert.equal(time, '12:00 AM', tz);
  }
});

test('a full timestamp still shows in the viewer\'s zone, and other values are unchanged', () => {
  const [la, vn, bad, num] = [
    ...inZone('America/Los_Angeles', [['datetime', '2026-11-07T10:00:00Z']]),
    ...inZone('Asia/Ho_Chi_Minh', [['datetime', '2026-11-07T10:00:00Z']]),
    ...inZone('UTC', [['date', 'not a date']]),
    ...inZone('UTC', [['date', Date.UTC(2026, 10, 7, 12)]]),
  ];
  assert.equal(la, 'Nov 7, 2026, 2:00 AM');
  assert.equal(vn, 'Nov 7, 2026, 5:00 PM');
  assert.equal(bad, 'not a date');
  assert.equal(num, 'Nov 7, 2026');
});
