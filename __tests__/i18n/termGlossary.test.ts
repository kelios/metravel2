import { resources } from '@/i18n/resources'

// Глоссарий терминов интерфейса. Значения `generated/*` переведены машинно, и
// короткая подпись без окружения уходит в самый частый словарный смысл: «тема»
// стала «Temat» (#2180), «Светлая» — «Światło» (свет), «лёгкий» — «light»,
// «точка» на карте — «dot» и «kropka» (#2188). Строка TERMS — это термин: какие
// RU-значения им считаются и что перевод обязан или не вправе содержать. Новое
// слово добавляется строкой сюда; отдельный тест на слово не пишется.

type Locale = 'en' | 'pl' | 'be' | 'uk'
type Expectation = { required?: RegExp; forbidden?: RegExp }
type Term = {
  name: string
  /** Какие RU-значения считаются этим термином. */
  ru: RegExp
  /** Сужение по ключу — для слова, чья форма зависит от строки интерфейса. */
  keys?: RegExp
  /** Сколько RU-ключей термин обязан находить: правило без находок мертво. */
  minEntries: number
  locales: Partial<Record<Locale, Expectation>>
}

// Шаблоны ищут слово целиком: «точк» без границы слева находит «карточку»,
// «светл» без окончания — «Светлогорск». Окончание у «темы» обязательно: голое
// «тем» — местоимение («тем, кто…», «тем ближе»).
const RU_THEME_WORD = /(^|[^а-яё])тем(а|у|ы|е|ой|ам|ами|ах)([^а-яё]|$)/i
const RU_LIGHT_WORD = /(^|[^а-яё])светл(ая|ый|ое|ые|ую|ой)([^а-яё]|$)/i
const RU_POINT_WORD = /(^|[^а-яё])точ(к|ек)/i
const RU_DIFFICULTY_NOUN = /(^|[^а-яё])сложност/i

// Одна шкала сложности на всех поверхностях: бейдж и карточка квеста, попап
// карты, каталог города, фильтр путешествий. В PL слово согласуется с «poziom»
// и «quest» (мужской род), а не с тем, что вернул перевод одиночного слова.
const DIFFICULTY_SCALE_KEYS = new RegExp(
  [
    'createMapPopupComponent\\.(legkiy|sredniy|slozhnyy)_',
    'QuestCard\\.(legko|sredne|slozhno)_',
    'QuestForCityCard\\.difficulty\\.(easy|medium|hard)$',
    'routeDifficulty(Easy|Medium|Hard)$',
    'useTravelFilters\\.complexity\\.(easy|medium|hard)$',
  ].join('|'),
)

const TERMS: Term[] = [
  {
    name: '«тема» — тема оформления',
    ru: RU_THEME_WORD,
    minEntries: 8,
    locales: {
      en: { required: /\btheme/i, forbidden: /\b(topic|subject)/i },
      pl: { required: /motyw/i, forbidden: /temat/i },
    },
  },
  {
    name: '«светлая» — светлая тема, не свет',
    ru: RU_LIGHT_WORD,
    minEntries: 5,
    locales: {
      en: { required: /\blight\b/i },
      pl: { required: /jasn/i, forbidden: /światł/i },
    },
  },
  {
    name: '«системная» — тема как в системе',
    ru: /^системн(ая|ый)$/i,
    minEntries: 1,
    locales: { pl: { required: /^systemow/i } },
  },
  {
    name: '«авто» — автоматический выбор или автомобиль, не автомат',
    ru: /^авто$/i,
    minEntries: 3,
    locales: { pl: { forbidden: /^automat$/i } },
  },
  {
    name: '«лёгкий» — уровень сложности, не свет',
    ru: /^л[её]гк(ий|ая|ое|о)$/i,
    minEntries: 5,
    locales: {
      en: { required: /^easy$/i },
      pl: { required: /^łatw/i },
    },
  },
  {
    name: '«средний» — уровень, не среднее арифметическое',
    ru: /^средн(ий|яя|ее|е)$/i,
    minEntries: 6,
    locales: {
      en: { required: /^(moderate|medium)$/i },
      pl: { required: /^średni/i },
    },
  },
  {
    name: '«сложный» — трудный, не составной',
    ru: /^сложн(ый|ая|ое|о)$/i,
    minEntries: 5,
    locales: {
      en: { required: /^hard$/i },
      pl: { required: /^trudn/i },
    },
  },
  {
    // По слову внутри фразы, а не по значению целиком: «Транспорт, сложность,
    // сезонность…» — та же сложность маршрута, что и одиночная подпись фильтра.
    name: '«сложность» — трудность, не устройство',
    ru: RU_DIFFICULTY_NOUN,
    minEntries: 5,
    locales: {
      en: { forbidden: /\bcomplexity\b/i },
      pl: { forbidden: /złożonoś/i },
    },
  },
  {
    name: 'шкала сложности — одни слова на всех поверхностях',
    ru: /./,
    keys: DIFFICULTY_SCALE_KEYS,
    minEntries: 15,
    locales: {
      en: { required: /^(easy|moderate|hard)$/i },
      pl: { required: /^(łatwy|średni|trudny)$/i },
    },
  },
  {
    name: '«точка» — место на карте, не знак препинания',
    ru: RU_POINT_WORD,
    minEntries: 300,
    locales: {
      en: { forbidden: /\bdots?\b/i },
      pl: { forbidden: /krop(k|ek)/i },
      uk: { forbidden: /крап(к|ок)/i },
    },
  },
]

type Bundle = Record<string, Record<string, unknown>>

const entriesOf = (term: Term) =>
  Object.entries(resources.ru as unknown as Bundle).flatMap(([namespace, entries]) =>
    Object.entries(entries)
      .filter(
        ([key, value]) =>
          typeof value === 'string' && term.ru.test(value) && (!term.keys || term.keys.test(key)),
      )
      .map(([key]) => ({ namespace, key })),
  )

const localeCases = TERMS.flatMap((term) =>
  (Object.keys(term.locales) as Locale[]).map((locale) => ({ locale, term, name: term.name })),
)

describe('глоссарий терминов интерфейса (#2180, #2188)', () => {
  it.each(TERMS)('$name: правило находит свои RU-ключи', (term) => {
    expect(entriesOf(term).length).toBeGreaterThanOrEqual(term.minEntries)
  })

  it('RU-шаблоны не цепляют соседние слова', () => {
    expect(RU_THEME_WORD.test('Тематические группы')).toBe(false)
    expect(RU_THEME_WORD.test('Чем дальше, тем ближе')).toBe(false)
    expect(RU_THEME_WORD.test('Выбрать тему: {{value1}}')).toBe(true)
    expect(RU_LIGHT_WORD.test('Светлогорск')).toBe(false)
    expect(RU_LIGHT_WORD.test('По умолчанию светлая')).toBe(true)
    expect(RU_POINT_WORD.test('Точность геолокации')).toBe(false)
    expect(RU_POINT_WORD.test('Источник маршрута')).toBe(false)
    expect(RU_POINT_WORD.test('Карточки точек')).toBe(true)
    expect(RU_POINT_WORD.test('Карточки маршрутов')).toBe(false)
    expect(RU_POINT_WORD.test('Найдено точек: ')).toBe(true)
    expect(RU_DIFFICULTY_NOUN.test('Транспорт, сложность, сезонность')).toBe(true)
    expect(RU_DIFFICULTY_NOUN.test('Используйте более сложный пароль')).toBe(false)
  })

  it.each(localeCases)('$locale: $name', ({ locale, term }) => {
    const { required, forbidden } = term.locales[locale] as Expectation
    const bundle = resources[locale] as unknown as Bundle
    const violations = entriesOf(term).flatMap(({ namespace, key }) => {
      const value = bundle[namespace]?.[key]
      if (typeof value !== 'string') return []
      const fits = (!required || required.test(value)) && !(forbidden && forbidden.test(value))
      return fits ? [] : [`${namespace}:${key} = ${JSON.stringify(value)}`]
    })
    expect(violations).toEqual([])
  })
})
