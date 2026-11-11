import {
  buildQuestSeoMetadata,
  encodedAttributeLength,
} from '@/utils/questSeo'

describe('quest SEO metadata', () => {
  // SEO-QUESTS #1756: формула «<Город>: что посмотреть» отменена. За 28 дней она
  // не принесла ни одного клика (74 пары запрос×URL, 110 показов, ср. позиция
  // 65,4) — кластер «что посмотреть» на сайте держат статьи /travels.
  it('keeps a quest title that already names its city as the whole SERP title', () => {
    const seo = buildQuestSeoMetadata({
      title: 'Витебск: столица авангарда',
      cityName: 'Витебск',
      points: 8,
      durationMin: 120,
    })

    expect(seo.title).toBe('Витебск: столица авангарда | Metravel')
    expect(seo.title).not.toContain('что посмотреть')
    expect(seo.description).toContain('Город Витебск: бесплатный пеший маршрут «столица авангарда»')
    expect(seo.description).toContain('8 точек. Примерно 2 ч.')
    expect(encodedAttributeLength(seo.description)).toBeLessThanOrEqual(160)
  })

  it('prefixes the city only when the quest title is silent about it', () => {
    const seo = buildQuestSeoMetadata({
      title: 'Тайна Свислочского Цмока: Легенда оживает',
      cityName: 'Минск',
      points: 12,
    })

    expect(seo.title).toBe('Минск — Тайна Свислочского Цмока: Легенда оживает | Metravel')
    expect(seo.title.length).toBeLessThanOrEqual(60)
    expect(seo.title).not.toContain('Минск: Минск')
  })

  // «Квест по Лунинцу» и «Квест по Гервятам» называют город в косвенном падеже —
  // точное вхождение его бы не увидело и приклеило второй раз.
  it('recognizes an inflected city name inside the quest title', () => {
    for (const [title, cityName] of [
      ['Квест по Лунинцу: город, который построила железная дорога', 'Лунинец'],
      ['Квест по Гервятам: костёл, каких в Беларуси больше нет', 'Гервяты'],
      ['Квест по Лиде: замок Гедимина', 'Лида'],
    ] as const) {
      expect(buildQuestSeoMetadata({ title, cityName }).title.startsWith('Квест по')).toBe(true)
    }
  })

  // Тип населённого пункта и район в скобках ответа на запрос не дают, а бюджет
  // в 60 символов съедают.
  it('strips the settlement type and the district note from a prefixed city', () => {
    const seo = buildQuestSeoMetadata({
      title: 'Огонёк и семь знаков Аллеи фонарей',
      cityName: 'д.Вашково (Ушачского района)',
      points: 6,
    })

    expect(seo.title).toBe('Вашково — Огонёк и семь знаков Аллеи фонарей | Metravel')
  })

  it('keeps encoded descriptions within the static SEO attribute limit', () => {
    const seo = buildQuestSeoMetadata({
      title: 'Очень длинный городской маршрут & легенды старого центра с неожиданным финалом',
      cityName: 'Санкт-Петербург',
      points: 25,
      durationMin: 195,
    })

    expect(encodedAttributeLength(seo.description)).toBeLessThanOrEqual(160)
    // Целые предложения: либо первое предложение обрезано без висящей пунктуации,
    // либо описание заканчивается точкой последнего поместившегося предложения.
    expect(seo.description).not.toMatch(/[\s,;:!?·–—-]$/u)
  })

  it('shortens an oversized title inside the first sentence and keeps the format sentence (#3284)', () => {
    const seo = buildQuestSeoMetadata({
      title: 'Очень длинный городской маршрут & легенды старого центра с неожиданным финалом и ещё одной долгой прогулкой вдоль набережной до самого заката',
      cityName: 'Санкт-Петербург',
      points: 25,
      durationMin: 195,
    })

    expect(encodedAttributeLength(seo.description)).toBeLessThanOrEqual(160)
    expect(seo.description).toMatch(/^Город Санкт-Петербург: бесплатный пеший маршрут «Очень длинный [^»]*…» по достопримечательностям\. Проходите сами в любой день, без записи\.$/u)
  })

  it('keeps the format sentence for a catalog title that alone overflows with it (#3284)', () => {
    const seo = buildQuestSeoMetadata({ title: 'Квест по Дубровнику: республика одного слова — Libertas', cityName: 'Дубровник', points: 9, durationMin: 150 })

    expect(seo.description).toContain('…» по достопримечательностям. Проходите сами в любой день, без записи.')
    expect(encodedAttributeLength(seo.description)).toBeLessThanOrEqual(160)
  })

  it('says the quest is self-guided right after the title and never cuts a sentence (#3284)', () => {
    const fits = buildQuestSeoMetadata({ title: 'Витебск: столица авангарда', cityName: 'Витебск', points: 8, durationMin: 120 })
    expect(fits.description).toBe(
      'Город Витебск: бесплатный пеший маршрут «столица авангарда» по достопримечательностям. Проходите сами в любой день, без записи. 8 точек. Примерно 2 ч.',
    )

    // Длинное название: формат помещается, а число точек и время опускаются целиком.
    const tight = buildQuestSeoMetadata({ title: 'Квест по Несвижу: дворец Радзивиллов', cityName: 'Несвиж', points: 7, durationMin: 120 })
    expect(tight.description).toContain('Проходите сами в любой день, без записи.')
    expect(tight.description).toMatch(/\.$/u)
    expect(encodedAttributeLength(tight.description)).toBeLessThanOrEqual(160)
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
