import vm from 'node:vm'
import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'acorn'
import { transformSync } from '@babel/core'
import { getSeasonalThemeBootScript } from '@/utils/seasonalThemeBootScript'
import { SEASONAL_THEME_IDS, resolveSeasonalTheme, type SeasonalThemePreference } from '@/constants/seasonalThemes'
import { seasonalCalendarCore } from '@/utils/seasonalCalendarCore'

// Execute the emitted ES5 payload without import/module/React/DOM helpers.
// Reuse its isolated VM function for the complete 36,525-day traversal.
const script = getSeasonalThemeBootScript()
const execute = vm.runInNewContext(`(function(window,document,Date){${script}})`) as (
  window: unknown, document: unknown, Date: unknown,
) => void
const runBoot = (stored: string | null, now: Date): string | null => {
  let season: string | null = 'stale'
  const html = {
    setAttribute: (_key: string, value: string) => { season = value },
    removeAttribute: () => { season = null },
  }
  execute({ localStorage: { getItem: () => stored } }, { documentElement: html }, function () { return now })
  return season
}

describe('shared seasonal boot calendar', () => {
  it('emits an actual self-contained ES5 payload', () => {
    expect(() => parse(script, { ecmaVersion: 5 })).not.toThrow()
    expect(script).not.toMatch(/require\(|import\s|\beval\(/)
    expect(runBoot(null, new Date(2026, 2, 1))).toBe('spring')
  })

  it('keeps its serialized function self-contained after production Metro minification', async () => {
    const compiled = transformSync(fs.readFileSync(path.join(process.cwd(), 'utils/seasonalCalendarCore.ts'), 'utf8'), {
      filename: 'seasonalCalendarCore.ts', babelrc: false, configFile: false,
      presets: ['@babel/preset-typescript'], plugins: ['@babel/plugin-transform-modules-commonjs'],
    })!.code!
    const minifier = require('metro-minify-terser')
    const config = require('metro-config/private/defaults/index').default.getDefaultValues(process.cwd()).transformer.minifierConfig
    const minified = await minifier({ code: compiled, filename: 'seasonalCalendarCore.js', reserved: [], config })
    const module = { exports: {} as { seasonalCalendarCore?: typeof seasonalCalendarCore } }
    vm.runInNewContext(minified.code, module)
    const payload = script.replace(seasonalCalendarCore.toString(), module.exports.seasonalCalendarCore!.toString())
    expect(() => parse(payload, { ecmaVersion: 5 })).not.toThrow()
    const executeMinified = vm.runInNewContext(`(function(window,document,Date){${payload}})`)
    for (const date of [new Date(2008, 2, 23), new Date(2024, 3, 10), new Date(2026, 2, 1), new Date(2100, 4, 2), new Date(2027, 0, 7)]) {
      let actual: string | null = 'stale'
      executeMinified(
        { localStorage: { getItem: () => 'auto' } },
        { documentElement: { setAttribute: (_key: string, value: string) => { actual = value }, removeAttribute: () => { actual = null } } },
        function () { return date },
      )
      expect(actual).toBe(resolveSeasonalTheme('auto', date))
    }
  })

  it('matches runtime on every local civil day from 2000 through 2099', () => {
    let count = 0
    for (let date = new Date(2000, 0, 1, 12); date.getFullYear() < 2100; date.setDate(date.getDate() + 1)) {
      const expected = resolveSeasonalTheme('auto', date)
      const actual = runBoot('auto', date)
      if (actual !== expected) throw new Error(`Boot/runtime mismatch at ${date.toDateString()}: ${actual}/${expected}`)
      count++
    }
    expect(count).toBe(36525)
  }, 120000)

  it.each([
    [2100, 2, 28, null], [2100, 3, 20, null], [2100, 3, 21, 'easter'],
    [2100, 3, 28, 'easter'], [2100, 3, 30, 'easter'], [2100, 3, 31, null],
    [2100, 4, 24, null], [2100, 4, 25, 'easter'], [2100, 5, 2, 'easter'],
    [2100, 5, 4, 'easter'], [2100, 5, 5, null], [2100, 12, 31, 'christmas'],
  ] as Array<[number, number, number, string | null]>)('handles verified 2100 century boundary %s/%s/%s', (year, month, day, expected) => {
    const date = new Date(year, month - 1, day, 12)
    expect(runBoot(null, date)).toBe(expected)
    expect(runBoot(null, date)).toBe(resolveSeasonalTheme('auto', date))
  })

  const dates = [new Date(2024, 3, 10), new Date(2024, 4, 5), new Date(2025, 3, 20), new Date(2026, 2, 1), new Date(2026, 8, 15), new Date(2026, 9, 15), new Date(2026, 11, 25), new Date(2027, 0, 14), new Date(2027, 0, 15)]
  const prefs: Array<SeasonalThemePreference | null> = [null, 'auto', 'off', ...SEASONAL_THEME_IDS]
  it.each(dates.flatMap((date) => prefs.map((pref) => [pref, date] as const)))(
    'preserves pref=%s and matches runtime at %s', (pref, date) => {
      expect(runBoot(pref, date)).toBe(resolveSeasonalTheme(pref ?? 'auto', date))
    },
  )

  it('ignores invalid stored values and clears stale attributes outside a period', () => {
    expect(runBoot('unknown', new Date(2026, 11, 25))).toBe('christmas')
    expect(runBoot('unknown', new Date(2026, 6, 1))).toBeNull()
    expect(runBoot('off', new Date(2026, 11, 25))).toBeNull()
  })

  it('uses auto when storage is unavailable/throws without writing preferences', () => {
    for (const brokenWindow of [{}, { get localStorage() { throw new Error('blocked') } }, { localStorage: { getItem() { throw new Error('blocked') } } }]) {
      let season: string | null = null
      const html = { setAttribute(_key: string, value: string) { season = value }, removeAttribute() { season = null } }
      execute(brokenWindow, { documentElement: html }, function () { return new Date(2026, 2, 1) })
      expect(season).toBe('spring')
    }
  })
})
