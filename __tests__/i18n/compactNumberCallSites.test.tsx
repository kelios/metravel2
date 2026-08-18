/**
 * #1457: компактные счётчики («1.2K»/«1.2M») собирались `toFixed`'ом на месте и
 * печатали английский суффикс во всех локалях. Тесты держат две вещи:
 * пользовательский результат (компактная единица по локали на конкретных
 * экранах) и запрет на возврат собственного форматирования в эти файлы.
 */
import fs from 'node:fs'
import path from 'node:path'

import React from 'react'
import { render } from '@testing-library/react-native'

import { i18n } from '@/i18n'
import { formatCompactNumber } from '@/i18n/format'
import { formatViewCount } from '@/components/travel/utils/travelHelpers'
import StarRating from '@/components/ui/StarRating'
import PlaceRatingBadge from '@/components/places/PlaceRatingBadge'

const NBSP = ' '

// локаль, 1 000, 12 500, 1 250 000
const COMPACT_CASES = [
  ['ru', `1${NBSP}тыс.`, `12,5${NBSP}тыс.`, `1,3${NBSP}млн`],
  ['be', `1${NBSP}тыс.`, `12,5${NBSP}тыс.`, `1,3${NBSP}млн`],
  ['uk', `1${NBSP}тис.`, `12,5${NBSP}тис.`, `1,3${NBSP}млн`],
  ['pl', `1${NBSP}tys.`, `12,5${NBSP}tys.`, `1,3${NBSP}mln`],
  ['en', '1K', '12.5K', '1.3M'],
] as const

describe('#1457 компактные счётчики идут через канонический форматтер', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ru')
  })

  describe('i18n/format.formatCompactNumber', () => {
    it.each(COMPACT_CASES)(
      'печатает компактную единицу по нормам локали %s',
      async (locale, thousand, thousands, million) => {
        await i18n.changeLanguage(locale)

        expect(formatCompactNumber(1000)).toBe(thousand)
        expect(formatCompactNumber(12_500)).toBe(thousands)
        expect(formatCompactNumber(1_250_000)).toBe(million)
      },
    )

    it('ниже порога печатает обычное целое, а не компактную форму', async () => {
      for (const locale of ['ru', 'en'] as const) {
        await i18n.changeLanguage(locale)

        expect(formatCompactNumber(0)).toBe('0')
        expect(formatCompactNumber(999)).toBe('999')
      }
    })
  })

  describe('счётчик просмотров на карточке путешествия', () => {
    it.each(COMPACT_CASES)('печатает просмотры по нормам локали %s', async (locale, thousand, thousands, million) => {
      await i18n.changeLanguage(locale)

      expect(formatViewCount(999)).toBe('999')
      expect(formatViewCount(1000)).toBe(thousand)
      expect(formatViewCount(12_500)).toBe(thousands)
      expect(formatViewCount(1_250_000)).toBe(million)
    })
  })

  describe('счётчик оценок у звёзд', () => {
    it.each(COMPACT_CASES)('печатает число оценок по нормам локали %s', async (locale, _thousand, thousands) => {
      await i18n.changeLanguage(locale)

      const { getByText } = render(<StarRating rating={4.5} ratingCount={12_500} />)
      expect(getByText(`(${thousands})`)).toBeTruthy()
    })

    it('прячет счётчик целиком, когда оценок нет', () => {
      const { queryByText } = render(<StarRating rating={4.5} ratingCount={0} />)
      expect(queryByText('(0)')).toBeNull()
    })
  })

  describe('бейдж рейтинга места', () => {
    it.each(COMPACT_CASES)('печатает число отзывов по нормам локали %s', async (locale, _thousand, thousands) => {
      await i18n.changeLanguage(locale)

      const { getByTestId } = render(
        <PlaceRatingBadge
          rating={{
            value: 4.6,
            count: 12_500,
            sources: [{ provider: 'google', value: 4.6, count: 12_500 }],
          } as any}
        />,
      )
      expect(getByTestId('place-rating-badge')).toHaveTextContent(thousands)
    })
  })

  describe('регрессия: собственное форматирование не возвращается', () => {
    const CALL_SITES = [
      'components/travel/utils/travelHelpers.ts',
      'components/ui/StarRating.tsx',
      'components/places/PlaceRatingBadge.tsx',
    ]

    // Ловим ручную компактную нотацию: деление на 1000/1000000 c `toFixed` и
    // склейку хардкодного суффикса K/k/M к числу.
    const HAND_ROLLED_COMPACT = /\/\s*1_?000_?(000)?\s*\)?\s*\.toFixed|\.toFixed\([^)]*\)\s*\}?\s*['"`]?[kKM]\b/

    it.each(CALL_SITES)('%s зовёт i18n/format и не собирает компактное число сам', (relative) => {
      const source = fs.readFileSync(path.resolve(process.cwd(), relative), 'utf8')

      expect(source).toMatch(/from '@\/i18n\/format'/)
      const selfMade = source.split('\n').filter((line) => HAND_ROLLED_COMPACT.test(line))
      expect({ file: relative, selfMade }).toEqual({ file: relative, selfMade: [] })
    })
  })
})
