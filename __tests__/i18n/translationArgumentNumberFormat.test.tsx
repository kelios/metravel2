/**
 * #1468: единица уже приходила из ключа перевода — так требует #1459, — а само
 * число уходило в интерполяцию сырым `number`. `i18n/instance.ts` не имеет
 * `interpolation.format`, поэтому i18next печатал `String(number)`: русская
 * страница путешествия показывала «12.6 км», тогда как PDF того же маршрута
 * после #1465 печатал «12,6 км».
 *
 * Тест держит обе стороны этого расхождения на одном и том же маршруте:
 * `preview` здесь совпадает с фикстурой
 * `__tests__/services/pdf-export/generators/v2/runtime/renderers/MapPageRenderer.test.ts`,
 * а ожидания — с её ожиданиями. Запрет на возврат сырого числа держит
 * `npm run guard:locale-number-format` (форма `numeric-translation-argument`).
 */
import React from 'react'
import { render } from '@testing-library/react-native'

import { i18n } from '@/i18n'
import RouteElevationProfile from '@/components/travel/details/sections/RouteElevationProfile'
import {
  formatProfileKm,
  formatProfileMeters,
} from '@/components/travel/details/sections/RouteElevationProfile.utils'
import { formatTravelTime } from '@/utils/distanceCalculator'

// Тот же маршрут, что и в PDF-тесте: 12,6 км, пик 2800 м.
const preview = {
  linePoints: [
    { coord: '53.9,27.56', elevation: 3 },
    { coord: '53.95,27.6', elevation: 1600 },
    { coord: '54.0,27.65', elevation: 2800 },
  ],
  elevationProfile: [
    { distanceKm: 0, elevationM: 3 },
    { distanceKm: 4.2, elevationM: 1600 },
    { distanceKm: 8.8, elevationM: 2800 },
  ],
} as any

// локаль, 12.6 км, 2800 м, 2800 минут в пути
const LOCALE_CASES = [
  ['ru', '12,6 км', '2 800 м', '46 ч 40 мин'],
  ['be', '12,6 км', '2800 м', '46 ч 40 мін'],
  ['uk', '12,6 км', '2 800 м', '46 год 40 хв'],
  ['pl', '12,6 km', '2800 m', '46 godz. 40 min'],
  ['en', '12.6 km', '2,800 m', '46 h 40 min'],
] as const

describe('#1468 число в аргументе перевода печатается по нормам локали', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ru')
  })

  it.each(LOCALE_CASES)(
    'печатает километры и метры профиля высот по нормам локали %s',
    async (locale, distance, elevation) => {
      await i18n.changeLanguage(locale)

      expect(formatProfileKm(12.64)).toBe(distance)
      expect(formatProfileMeters(2800)).toBe(elevation)
    },
  )

  it.each(LOCALE_CASES)(
    'печатает время в пути по нормам локали %s',
    async (locale, _distance, _elevation, travelTime) => {
      await i18n.changeLanguage(locale)

      expect(formatTravelTime(2800)).toBe(travelTime)
    },
  )

  it.each([LOCALE_CASES[0], LOCALE_CASES[4]])(
    'блок «Профиль высот» на странице путешествия печатает то же, что PDF того же маршрута (%s)',
    async (locale, distance, elevation) => {
      await i18n.changeLanguage(locale)

      const { getAllByText, getByText } = render(
        <RouteElevationProfile title="Профиль высот" preview={preview} />,
      )

      expect(getByText(distance)).toBeTruthy()
      expect(getAllByText(elevation).length).toBeGreaterThan(0)
    },
  )

  it('на RU не оставляет английской точки в километрах маршрута', async () => {
    await i18n.changeLanguage('ru')

    expect(formatProfileKm(12.64)).not.toContain('.')
    expect(formatProfileMeters(2800)).not.toBe('2800 м')
  })
})
