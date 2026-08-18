/**
 * #1459: пятый домен того же корня — оценка, длительность квеста и размер файла
 * маршрута собирались `toFixed`'ом на месте и печатали английскую точку во всех
 * локалях. Тест держит пользовательский результат через сами продовые функции и
 * компоненты; запрет на возврат самодельного форматирования держит
 * `npm run guard:locale-number-format`.
 */
import React from 'react'
import { render } from '@testing-library/react-native'

import { i18n } from '@/i18n'
import { formatRatingValue } from '@/utils/ratingHelpers'
import { formatFileSize } from '@/utils/fileSize'
import { QuestForCityCard } from '@/components/quests/QuestForCityCard'
import StarRating from '@/components/ui/StarRating'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/utils/analytics', () => ({
  queueAnalyticsEvent: jest.fn(),
}))

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: () => null,
}))

// локаль, оценка 4.6, целая оценка 5, 1536 байт, 90 минут
const LOCALE_CASES = [
  ['ru', '4,6', '5,0', '1,5 КБ', '~1,5 ч'],
  ['be', '4,6', '5,0', '1,5 КБ', '~1,5 ч'],
  ['uk', '4,6', '5,0', '1,5 КБ', '~1,5 год'],
  ['pl', '4,6', '5,0', '1,5 KB', '~1,5 godz'],
  ['en', '4.6', '5.0', '1.5 KB', '~1.5 h'],
] as const

const quest = {
  id: 'gomel-palace',
  title: 'Тайны дворца',
  points: 8,
  cityId: '3',
  cityName: 'Гомель',
  durationMin: 90,
  lat: 52.43,
  lng: 30.99,
}

describe('#1459 отображаемые числа идут через канонический форматтер', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ru')
  })

  it.each(LOCALE_CASES)(
    'печатает оценку по нормам локали %s',
    async (locale, rating, wholeRating) => {
      await i18n.changeLanguage(locale)

      expect(formatRatingValue(4.6)).toBe(rating)
      // Целая оценка сохраняет один знак после запятой: «5,0», а не «5».
      expect(formatRatingValue(5)).toBe(wholeRating)
    },
  )

  it.each(LOCALE_CASES)('печатает оценку на звёздах по нормам локали %s', async (locale, rating) => {
    await i18n.changeLanguage(locale)

    const { getByText } = render(<StarRating rating={4.6} testID="star-rating" />)

    expect(getByText(rating)).toBeTruthy()
  })

  it.each(LOCALE_CASES)(
    'печатает размер файла по нормам локали %s',
    async (locale, _rating, _wholeRating, size) => {
      await i18n.changeLanguage(locale)

      expect(formatFileSize(1536)).toBe(size)
      // Байты и мегабайты берут единицу оттуда же, из одного слоя.
      expect(formatFileSize(512)).toBe(locale === 'pl' || locale === 'en' ? '512 B' : '512 Б')
      expect(formatFileSize(3 * 1024 * 1024)).toBe(
        locale === 'pl' || locale === 'en' ? '3 MB' : '3 МБ',
      )
    },
  )

  it.each(LOCALE_CASES)(
    'печатает длительность квеста на карточке города по нормам локали %s',
    async (locale, _rating, _wholeRating, _size, duration) => {
      await i18n.changeLanguage(locale)

      const { getByText } = render(<QuestForCityCard quest={quest} />)

      expect(getByText(duration)).toBeTruthy()
    },
  )
})
