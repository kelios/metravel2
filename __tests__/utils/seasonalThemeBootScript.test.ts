import { getSeasonalThemeBootScript } from '@/utils/seasonalThemeBootScript'
import { resolveSeasonalTheme, type SeasonalThemePreference } from '@/constants/seasonalThemes'

/**
 * Стартовый ES5-сниппет должен давать тот же `data-season`, что и
 * `resolveSeasonalTheme` в рантайме, иначе страница мигнёт при гидратации.
 */
const runBoot = (stored: string | null, now: Date): string | null => {
  const html = document.createElement('html')
  const storage = { getItem: jest.fn(() => stored) }
  const script = getSeasonalThemeBootScript()
  const fn = new Function('window', 'document', 'Date', script)
  const FakeDate = function () {
    return now
  } as unknown as DateConstructor
  fn({ localStorage: storage }, { documentElement: html }, FakeDate)
  return html.getAttribute('data-season')
}

describe('seasonal theme boot script (#2376)', () => {
  const dates = [new Date(2026, 9, 10), new Date(2026, 9, 20), new Date(2026, 11, 25), new Date(2027, 0, 10), new Date(2027, 0, 20)]
  const prefs: Array<SeasonalThemePreference | null> = [null, 'auto', 'off', 'halloween', 'christmas']

  it.each(dates.flatMap((d) => prefs.map((p) => [p, d] as const)))(
    'matches resolveSeasonalTheme for pref=%s at %s',
    (pref, date) => {
      expect(runBoot(pref, date)).toBe(resolveSeasonalTheme(pref ?? 'auto', date))
    },
  )

  it('ignores unknown stored values and falls back to the calendar', () => {
    expect(runBoot('easter', new Date(2026, 11, 25))).toBe('christmas')
    expect(runBoot('easter', new Date(2026, 6, 1))).toBeNull()
  })

  it('survives a throwing localStorage', () => {
    const html = document.createElement('html')
    const fn = new Function('window', 'document', getSeasonalThemeBootScript())
    expect(() =>
      fn(
        {
          get localStorage() {
            throw new Error('blocked')
          },
        },
        { documentElement: html },
      ),
    ).not.toThrow()
  })
})
