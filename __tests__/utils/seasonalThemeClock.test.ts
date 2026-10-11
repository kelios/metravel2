import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { transformSync } from '@babel/core';
import { millisecondsUntilLocalMidnight } from '@/utils/seasonalThemeClock';

describe('seasonal midnight clock', () => {
  it('waits only until the next local calendar day', () => {
    expect(millisecondsUntilLocalMidnight(new Date(2026, 9, 14, 23, 59, 59))).toBe(1000);
  });

  // Separate processes make timezone deterministic even when Jest virtualizes process.env.
  it.each([
    ['Europe/Warsaw', '2026-03-29T00:00:00+01:00', 23],
    ['Europe/Warsaw', '2026-10-25T00:00:00+02:00', 25],
    ['America/New_York', '2026-03-08T00:00:00-05:00', 23],
    ['America/New_York', '2026-11-01T00:00:00-04:00', 25],
    ['UTC', '2026-03-29T00:00:00Z', 24],
  ])('uses local midnight in %s on %s (%s hours)', (timezone, instant, hours) => {
    const source = readFileSync(resolve(process.cwd(), 'utils/seasonalThemeClock.ts'), 'utf8');
    const compiled = transformSync(source, {
      filename: 'seasonalThemeClock.ts', babelrc: false, configFile: false,
      presets: ['@babel/preset-typescript'], plugins: ['@babel/plugin-transform-modules-commonjs'],
    })!.code!;
    const script = compiled + '\nprocess.stdout.write(String(exports.millisecondsUntilLocalMidnight(new Date(process.argv[1]))));';
    const delay = Number(execFileSync(process.execPath, ['-e', script, instant], {
      env: { ...process.env, TZ: timezone }, encoding: 'utf8',
    }));
    expect(delay).toBe(hours * 60 * 60 * 1000);
  });
});
