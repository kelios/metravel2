import {
  buildQuestSeoMetadata,
  encodedAttributeLength,
} from '@/utils/questSeo'

describe('quest SEO metadata', () => {
  it('targets city sightseeing demand without repeating a city-prefixed quest title', () => {
    const seo = buildQuestSeoMetadata({
      title: 'Витебск: столица авангарда',
      cityName: 'Витебск',
      points: 8,
      durationMin: 120,
    })

    expect(seo.title).toBe('Витебск: что посмотреть — столица авангарда | Metravel')
    expect(seo.description).toContain('Город Витебск: бесплатный пеший маршрут «столица авангарда»')
    expect(seo.description).toContain('8 точек. Примерно 2 ч.')
    expect(encodedAttributeLength(seo.description)).toBeLessThanOrEqual(160)
  })

  it('keeps same-city quests unique and clips long SERP titles on a word boundary', () => {
    const seo = buildQuestSeoMetadata({
      title: 'Тайна Свислочского Цмока: Легенда оживает',
      cityName: 'Минск',
      points: 12,
    })

    expect(seo.title).toBe('Минск: что посмотреть — Тайна Свислочского… | Metravel')
    expect(seo.title.length).toBeLessThanOrEqual(60)
    expect(seo.title).not.toContain('Минск: Минск')
  })

  it('keeps encoded descriptions within the static SEO attribute limit', () => {
    const seo = buildQuestSeoMetadata({
      title: 'Очень длинный городской маршрут & легенды старого центра с неожиданным финалом',
      cityName: 'Санкт-Петербург',
      points: 25,
      durationMin: 195,
    })

    expect(encodedAttributeLength(seo.description)).toBeLessThanOrEqual(160)
    expect(seo.description).not.toMatch(/[\s.,;:!?·–—-]$/u)
  })

  it('builds native quest metadata when Intl.PluralRules is unavailable', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, 'PluralRules')
    Object.defineProperty(Intl, 'PluralRules', { configurable: true, value: undefined })

    try {
      const seo = buildQuestSeoMetadata({ cityName: 'Минск', points: 2 })
      expect(seo.description).toContain('2 точки.')
    } finally {
      if (descriptor) Object.defineProperty(Intl, 'PluralRules', descriptor)
    }
  })
})
