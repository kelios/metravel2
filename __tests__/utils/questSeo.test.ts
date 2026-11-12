import path from 'node:path'

import {
  buildQuestCityLandingMeta,
  buildQuestSeoMetadata,
  encodedAttributeLength,
  questCityLandingPlaceLabels,
} from '@/utils/questSeo'

const { loadSsgCatalogs } = require('@/i18n/babel-inline-plugin')
const { createSsgTranslator } = require('@/scripts/lib/questLocalePackage')

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
    expect(seo.description).toContain('Город Витебск: бесплатный пеший маршрут «Столица авангарда»')
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
      'Город Витебск: бесплатный пеший маршрут «Столица авангарда» по достопримечательностям. Проходите сами в любой день, без записи. 8 точек. Примерно 2 ч.',
    )

    // Длинное название: формат помещается, а число точек и время опускаются целиком.
    const tight = buildQuestSeoMetadata({ title: 'Квест по Несвижу: дворец Радзивиллов', cityName: 'Несвиж', points: 7, durationMin: 120 })
    expect(tight.description).toContain('Проходите сами в любой день, без записи.')
    expect(tight.description).toMatch(/\.$/u)
    expect(encodedAttributeLength(tight.description)).toBeLessThanOrEqual(160)
  })

  // #3238: the EN lead reads as a sentence («City Grodno: …» did not), the PL
  // lead carries the searched phrase «gra miejska»; both stay whole sentences.
  it.each([
    ['en', 'Grodno: a free walking route “The Royal City on the Neman” past the sights. Self-guided, any day, no booking.'],
    ['pl', 'Grodno: bezpłatna gra miejska „The Royal City on the Neman” — trasa piesza po zabytkach. Przejdź samodzielnie'],
  ])('builds the %s detail lead from its own catalog', (locale, lead) => {
    const ssg = createSsgTranslator(loadSsgCatalogs(path.resolve(__dirname, '../..')).catalogs, locale)
    const seo = buildQuestSeoMetadata({
      title: 'Grodno: The Royal City on the Neman', cityName: 'Grodno', points: 9, durationMin: 120,
      translate: ssg.t, translatePlural: ssg.tp, locale: ssg.languageTag,
    })
    expect(seo.description.startsWith(lead)).toBe(true)
    expect(seo.description).toMatch(/\.$/u)
    expect(encodedAttributeLength(seo.description)).toBeLessThanOrEqual(160)
  })

  // #3332: the city goes only as a standalone head before «: » or « — »; the
  // rest starts with a capital. A city inside the phrase keeps the title whole.
  it.each([
    ['Витебск как галерея: опись девяти стен', 'Витебск', '«Витебск как галерея: опись девяти стен»'],
    ['Минск: столица авангарда', 'Минск', '«Столица авангарда»'],
    ['Минск — звезда над батлейкой', 'Минск', '«Звезда над батлейкой»'],
    ['Квест по Минску: предания пана Бохана', 'Минск', '«Квест по Минску: предания пана Бохана»'],
    ['Вашково: усадьба у озера', 'д.Вашково (Ушачского района)', '«Усадьба у озера»'],
  ])('names «%s» in the description whole unless the city is its own head', (title, cityName, quoted) => {
    const seo = buildQuestSeoMetadata({ title, cityName, points: 8 })
    expect(seo.description).toContain(`маршрут ${quoted} по достопримечательностям.`)
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

// #3236: head посадочной города — один билдер для SSR-проекции и экрана.
describe('quest city landing meta', () => {
  const MINSK = {
    cityName: 'Минск',
    questTitles: ['Квест по Минску: звезда над батлейкой', 'Детский квест по Минску: бронзовые друзья города', 'Квест по Минску: предания пана Бохана'],
    places: [
      { title: 'Верхний ярус: ниша у Красного костёла', location: 'Костёл Святых Симеона и Елены, пл. Независимости, 15' },
      { title: 'Свято-Духов собор: православное Рождество', location: 'Свято-Духов кафедральный собор, ул. Кирилла и Мефодия, 3' },
      { title: 'Площадь Свободы', location: 'Площадь Свободы, Верхний город' },
    ],
    nearbyCityNames: ['Заславль', 'урочище Вялое (Налибокская пуща)'],
  }
  const GRODNO = {
    cityName: 'Гродно',
    questTitles: ['Квест по Гродно: две звезды над Неманом', 'Оркестр, который потерял дирижёра'],
    places: [{ title: 'Форт №4: единственный, кто уцелел', location: 'Форт №4 Гродненской крепости, у деревни Фолюш' }],
    nearbyCityNames: ['Друскининкай'],
  }

  it('opens the title with the city and the word «квесты» and names real route places', () => {
    const seo = buildQuestCityLandingMeta(MINSK)

    expect(seo.title).toBe('Минск: квесты-прогулки — Свято-Духов собор | Metravel')
    expect(seo.title.length).toBeLessThanOrEqual(60)
    expect(seo.description).toBe(
      'Минск: 3 квеста с заданиями — «Детский квест по Минску: бронзовые друзья города», «Звезда над батлейкой» и другие. Проходите сами в любой день, без записи.',
    )
    expect(`${seo.title} ${seo.description}`).not.toContain('что посмотреть')
  })

  it('gives two cities different titles and descriptions', () => {
    const minsk = buildQuestCityLandingMeta(MINSK)
    const grodno = buildQuestCityLandingMeta(GRODNO)

    expect(grodno.title).toBe('Гродно: квесты-прогулки — Форт №4 | Metravel')
    expect(grodno.description).toBe(
      'Гродно: 2 квеста с заданиями — «Две звезды над Неманом», «Оркестр, который потерял дирижёра». Проходите сами в любой день, без записи. Рядом: Друскининкай.',
    )
    expect(grodno.title).not.toBe(minsk.title)
    expect(grodno.description).not.toBe(minsk.description)
  })

  // Заголовок точки — чаще загадка или родовое слово; в заголовок выдачи идёт
  // только имя места, подтверждённое адресом точки.
  it('takes only address-confirmed proper place names, in walk order', () => {
    expect(questCityLandingPlaceLabels([
      { title: 'Знак терпения', location: 'Каменный зверь у костёла иезуитов' },
      { title: 'Колокол, который будил город', location: 'Площадь между башнями, у Колокольной башни' },
      { title: 'Привал в «Бульбяной» (по желанию)', location: 'Кафе «Бульбяная»' },
      { title: 'Площадь Дам — та самая дамба', location: 'Площадь Дам, центр Амстердама' },
      { title: 'Нотр-Дам — каменная книга', location: 'Центральный портал западного фасада Нотр-Дама' },
      { title: 'Площадь Дам', location: '' },
    ], 'Амстердам')).toEqual(['Площадь Дам', 'Нотр-Дам'])
  })

  it('drops places whole to keep the brand inside the title budget, never clipping a name', () => {
    const square = { title: 'Площадь Свободы', location: 'Площадь Свободы, Верхний город' }
    const cathedral = { title: 'Свято-Духов собор', location: 'Свято-Духов кафедральный собор' }

    // Оба места — 59 знаков без бренда: второе уходит целиком.
    expect(buildQuestCityLandingMeta({ cityName: 'Минск', places: [square, cathedral] }).title)
      .toBe('Минск: квесты-прогулки — Площадь Свободы | Metravel')
    // Длинному имени города не хватает места даже на одно: заголовок без мест, но с брендом.
    const long = buildQuestCityLandingMeta({ cityName: 'Гожув-Велькопольский', places: [cathedral] })
    expect(long.title).toBe('Гожув-Велькопольский: квесты-прогулки с заданиями | Metravel')
    expect(long.title.length).toBeLessThanOrEqual(60)
  })

  it('falls back to a title without places and a description without neighbours', () => {
    const seo = buildQuestCityLandingMeta({ cityName: 'д.Вашково (Ушачского района)', questTitles: ['Огонёк и семь знаков Аллеи фонарей'] })

    expect(seo.title).toBe('Вашково: квесты-прогулки с заданиями | Metravel')
    expect(seo.description).toBe('Вашково: 1 квест с заданиями — «Огонёк и семь знаков Аллеи фонарей». Проходите сами в любой день, без записи.')
  })

  it('keeps the format sentence and whole sentences within 160 encoded characters', () => {
    const seo = buildQuestCityLandingMeta({
      cityName: 'Санкт-Петербург',
      questTitles: Array.from({ length: 12 }, (_, index) => `Очень длинное название квеста & легенды старого центра номер ${index + 1}`),
      nearbyCityNames: ['Пушкин', 'Петергоф', 'Гатчина', 'Выборг'],
    })

    expect(encodedAttributeLength(seo.description)).toBeLessThanOrEqual(160)
    expect(seo.description).toContain('Проходите сами в любой день, без записи.')
    expect(seo.description).toMatch(/\.$/u)
  })

  it('names the country only when asked to tell two same-named cities apart', () => {
    const by = buildQuestCityLandingMeta({ ...GRODNO, countryName: 'Беларусь' })

    expect(by.title).toBe('Гродно, Беларусь: квесты-прогулки — Форт №4 | Metravel')
    expect(by.description.startsWith('Гродно, Беларусь: 2 квеста')).toBe(true)
  })

  const catalogs = loadSsgCatalogs(path.resolve(__dirname, '../..')).catalogs
  it.each(['ru', 'be', 'uk', 'pl', 'en'])('builds the %s landing meta from its own catalog', (locale) => {
    const ssg = createSsgTranslator(catalogs, locale)
    const seo = buildQuestCityLandingMeta({ ...MINSK, translate: ssg.t, translatePlural: ssg.tp, locale: ssg.languageTag })

    expect(seo.title.startsWith('Минск: ')).toBe(true)
    expect(seo.title).toContain('Свято-Духов собор')
    expect(seo.title.length).toBeLessThanOrEqual(60)
    expect(seo.description).not.toMatch(/\{\{|utils\.questSeo/u)
    expect(encodedAttributeLength(seo.description)).toBeLessThanOrEqual(160)
    if (locale !== 'ru') expect(seo.description).not.toContain('квеста с заданиями')
  })
})
