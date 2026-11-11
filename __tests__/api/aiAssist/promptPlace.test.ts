import { selectPlaceSources, withoutPlace } from '@/api/aiAssist/promptPlace'
import type { AiSource } from '@/api/aiAssist/types'

const quest = (id: string, title: string, cities: string[], country = 'Беларусь'): AiSource => ({
  type: 'quest',
  source_id: id,
  title,
  url: `https://metravel.by/quests/x/${id}`,
  path: `/quests/x/${id}`,
  snippet: `Городской квест по городу ${cities[0]} (${country}). Точек: 9. Длительность: 120 мин`,
  score: 3,
  place: { cities, countries: [country] },
})

const travel = (id: string, title: string, snippet: string, countries: string[] = ['Беларусь']): AiSource => ({
  type: 'travel',
  source_id: id,
  title,
  url: `https://metravel.by/travels/${id}`,
  path: `/travels/${id}`,
  snippet,
  score: 2,
  place: { countries },
})

const ids = (sources: readonly AiSource[]) => sources.map((source) => source.source_id)

describe('aiAssist promptPlace: карточки подсказки — только места из вопроса (#3315)', () => {
  it('PL: «trzy questy w Grodnie» — квесты Карловых Вар, Кобрина и Кракова в подсказку не идут, порядок подбора сохраняется', () => {
    const sources = [
      quest('g1', 'Quest po Grodnie: królewskie miasto nad Niemnem', ['Grodno', 'Гродно']),
      quest('g2', 'Quest po Grodnie: Horodnica Tyzenhauza', ['Grodno', 'Гродно']),
      quest('kv', 'Quest po Karlowych Warach: jeleń Karola IV i trzynaste źródło', ['Karlowe Wary', 'Карловы Вары'], 'Чехия'),
      quest('g3', 'Quest po Grodnie: cienie królewskiego miasta', ['Grodno', 'Гродно']),
      quest('ko', 'Quest po Kobryniu: park, który przeżył trzy stulecia', ['Kobryń', 'Кобрин']),
      quest('kr', 'Quest po Krakowie: Smok Wawelski', ['Kraków', 'Краков'], 'Польша'),
    ]
    expect(ids(selectPlaceSources('Podaj najwyżej trzy questy w Grodnie, każdy z odnośnikiem.', sources))).toEqual(['g1', 'g2', 'g3'])
  })

  it('UK: уточнение без своего места берёт город из опоры диалога; чередование «Краків — у Кракові» ловит русское написание', () => {
    const sources = [
      quest('pk', 'Детский квест по Пинску: лодочка Чайка', ['Пінськ', 'Пинск']),
      quest('po', 'Квест Пінськом: альбом Наполеона Орди', ['Пінськ', 'Пинск']),
      quest('ke', 'Квест Кельном: гноми, які пішли', ['Кельн'], 'Германия'),
      quest('ba', 'Квест по Барківщині: озера й легенди', ['с. Вашково (Ушацький район)']),
    ]
    const anchored = 'Збираємося до Пінська на вихідні. Які квести там є? А що з цього підійде дітям?'
    expect(ids(selectPlaceSources(anchored, sources))).toEqual(['pk', 'po'])

    const krakow = [quest('kr', 'Квест по Кракову: Вавельський дракон', ['Краків', 'Краков'], 'Польша'), quest('br', 'Наказ № 1: три дні Брестської фортеці', ['Брест'])]
    expect(ids(selectPlaceSources('Що подивитися у Кракові за два дні?', krakow))).toEqual(['kr'])
  })

  it('BE: беглая гласная «Навагрудак — па Навагрудку»; квест района города остаётся, слово «раён» местом не считается', () => {
    const sources = [
      quest('nv', 'Квэст па Навагрудку: першая сталіца ВКЛ', ['Навагрудак', 'Новогрудок']),
      quest('sv', 'Квэст па возеры Свіцязь: затанулы горад', ['воз. Свіцязь (Навагрудскі раён)']),
      quest('he', 'Квэст па Хевізе: цёплае возера', ['Хевіз'], 'Венгрия'),
      quest('el', 'Квэст па балоце Ельня', ['балота Ельня (Мёрскі раён)']),
    ]
    expect(ids(selectPlaceSources('Ці ёсць у вас квэст па Навагрудку? Хочам прайсці яго за паўдня.', sources))).toEqual(['nv', 'sv'])
    // «Раён» в вопросе — не название: подсказка остаётся прежней.
    expect(selectPlaceSources('Што паглядзець у гэтым раёне?', sources)).toBe(sources)
  })

  it('EN и статьи: статья относится к месту по названию и фрагменту, в том числе по прилагательному', () => {
    const tallinn = [
      quest('vi', 'The Drawing That Ran Off for a Walk Around Vitebsk', ['Vitebsk', 'Витебск']),
      quest('ta', 'Tallinn quest: the Old Town', ['Tallinn', 'Таллин'], 'Эстония'),
    ]
    expect(ids(selectPlaceSources('We have one afternoon in Tallinn. Which walk would you suggest?', tallinn))).toEqual(['ta'])

    const nesvizh = [
      quest('nq', 'Квест по Несвижу: тайны Радзивиллов', ['Несвиж']),
      travel('nz', 'Несвижский замок Радзивиллов.', 'Беларусь, Несвижский замок'),
      travel('nm', 'Несвиж и Мир: расстояние и маршрут на два дня', 'Беларусь, Церковь Успения в Новом Свержене'),
      travel('lz', 'Лодзь - город муралов и фабрик', 'Польша, Мануфактура', ['Польша']),
      quest('mq', 'Квест по Миру', ['Мир']),
    ]
    expect(ids(selectPlaceSources('Что посмотреть в Несвиже?', nesvizh))).toEqual(['nq', 'nz', 'nm'])
  })

  it('слово-омоним названием не считается: строчная буква без предлога места, короткое название — только с заглавной', () => {
    const sources = [quest('gl', 'Глубокое: вишни, барон и пять озёр', ['Глубокое']), quest('mi', 'Квест по Миру', ['Мир']), quest('gr', 'Квест по Гродно', ['Гродно'])]
    expect(selectPlaceSources('Приезжаем глубокой ночью, а заселение только с двух часов дня. Как переждать?', sources)).toBe(sources)
    expect(selectPlaceSources('Какие квесты самые известные в мире?', sources)).toBe(sources)
    expect(ids(selectPlaceSources('Что посмотреть в Мире?', sources))).toEqual(['mi'])
    // Город, набранный строчными, узнаётся после предлога места.
    expect(ids(selectPlaceSources('квесты в гродно', sources))).toEqual(['gr'])
    expect(ids(selectPlaceSources('Едем в Глубокое на выходные', sources))).toEqual(['gl'])
  })

  it('общие слова названий каталога («Старый Орхей», «Нова-Слупя», «Кутна-Гора», «Lake Svityaz») местом не считаются, хотя вопрос начинается с заглавной', () => {
    const sources = [
      quest('mn', 'Квест по Минску', ['Минск', 'Minsk']),
      quest('or', 'Квест по Старому Орхею', ['Старый Орхей'], 'Молдова'),
      quest('ns', 'Квест по Нова-Слупе', ['Нова-Слупя', 'Nowa Słupia'], 'Польша'),
      quest('kh', 'Квест по Кутна-Горе', ['Кутна-Гора', 'Kutná Hora'], 'Чехия'),
      quest('sv', 'Lake Svityaz quest', ['Lake Svityaz (Novogrudok District)']),
      quest('bs', 'Blue Spring quest', ['Blue Spring (Slavgorod District)']),
    ]
    expect(ids(selectPlaceSources('Старые замки Беларуси — какие квесты?', sources))).toEqual(['mn', 'sv', 'bs'])
    expect(selectPlaceSources('Новые квесты есть?', sources)).toBe(sources)
    expect(selectPlaceSources('Горы рядом — какие маршруты?', sources)).toBe(sources)
    expect(selectPlaceSources('Spring trips: which quests?', sources)).toBe(sources)
    expect(ids(selectPlaceSources('Lakes near Minsk?', sources))).toEqual(['mn'])
    expect(ids(selectPlaceSources('Nowe questy w Mińsku?', sources))).toEqual(['mn'])
    // Само место узнаётся по своему слову названия.
    expect(ids(selectPlaceSources('Что посмотреть в Нова-Слупе?', sources))).toEqual(['ns'])
  })

  it('исключение («кроме Минска») и вопрос без места подсказку не трогают; нет карточек места — тоже', () => {
    const sources = [quest('mn', 'Квест по Минску', ['Минск']), quest('gr', 'Квест по Гродно', ['Гродно']), travel('pl', 'Катовице за день', 'Польша, Катовице', ['Польша'])]
    expect(selectPlaceSources('Что посмотреть в Беларуси, кроме Минска?', sources)).toBe(sources)
    expect(selectPlaceSources('Какие квесты есть на сайте?', sources)).toBe(sources)
    // Лиды среди найденного нет: модель получает ближайшее, как раньше.
    expect(selectPlaceSources('Что посмотреть в Лиде?', sources)).toBe(sources)
    expect(selectPlaceSources(null, sources)).toBe(sources)
    expect(selectPlaceSources('Что посмотреть в Минске?', [sources[1]])).toEqual([sources[1]])
  })

  it('страна: без названного города — карточки страны; назван город — выигрывает он', () => {
    const sources = [
      quest('mn', 'Квест по Минску', ['Минск']),
      travel('by', 'Замки и усадьбы: 19 маршрутов', 'Беларусь, Мирский замок'),
      travel('eu', 'Зимний маршрут: Польша, Германия, Чехия, Австрия', 'Польша, Германия, Чехия, Австрия, Дрезден', ['Польша', 'Германия', 'Чехия', 'Австрия']),
      quest('kr', 'Квест по Кракову', ['Краков'], 'Польша'),
    ]
    expect(ids(selectPlaceSources('Какие замки Беларуси можно объехать за выходные?', sources))).toEqual(['mn', 'by'])
    expect(ids(selectPlaceSources('Что посмотреть в Польше?', sources))).toEqual(['eu', 'kr'])
    expect(ids(selectPlaceSources('Квесты в Минске, Беларусь', sources))).toEqual(['mn'])
  })

  it('withoutPlace убирает служебное поле: в список источников посетителя оно не уходит', () => {
    const source = quest('gr', 'Квест по Гродно', ['Гродно'])
    expect(withoutPlace(source)).not.toHaveProperty('place')
    expect(withoutPlace(source)).toMatchObject({ source_id: 'gr', title: 'Квест по Гродно' })
  })
})
