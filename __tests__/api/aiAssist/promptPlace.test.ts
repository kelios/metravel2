import { matchPlaceSources, withoutPlace } from '@/api/aiAssist/promptPlace'
import { arrangeSources, withoutNearby } from '@/api/aiAssist/sourceSelection'
import type { AiSource } from '@/api/aiAssist/types'

// Отбор по месту — первый шаг цепочки `arrangeSources` (#3289): место не названо, у него нет карточек или
// названо исключение — подбор идёт дальше как есть. Отдельной обёртки в продукте нет (#3345).
const placeCards = (query: string | null, sources: readonly AiSource[]): readonly AiSource[] => matchPlaceSources(query, sources) ?? sources

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
    expect(ids(placeCards('Podaj najwyżej trzy questy w Grodnie, każdy z odnośnikiem.', sources))).toEqual(['g1', 'g2', 'g3'])
  })

  it('UK: уточнение без своего места берёт город из опоры диалога; чередование «Краків — у Кракові» ловит русское написание', () => {
    const sources = [
      quest('pk', 'Детский квест по Пинску: лодочка Чайка', ['Пінськ', 'Пинск']),
      quest('po', 'Квест Пінськом: альбом Наполеона Орди', ['Пінськ', 'Пинск']),
      quest('ke', 'Квест Кельном: гноми, які пішли', ['Кельн'], 'Германия'),
      quest('ba', 'Квест по Барківщині: озера й легенди', ['с. Вашково (Ушацький район)']),
    ]
    const anchored = 'Збираємося до Пінська на вихідні. Які квести там є? А що з цього підійде дітям?'
    expect(ids(placeCards(anchored, sources))).toEqual(['pk', 'po'])

    const krakow = [quest('kr', 'Квест по Кракову: Вавельський дракон', ['Краків', 'Краков'], 'Польша'), quest('br', 'Наказ № 1: три дні Брестської фортеці', ['Брест'])]
    expect(ids(placeCards('Що подивитися у Кракові за два дні?', krakow))).toEqual(['kr'])
  })

  it('BE: беглая гласная «Навагрудак — па Навагрудку»; квест района города остаётся, слово «раён» местом не считается', () => {
    const sources = [
      quest('nv', 'Квэст па Навагрудку: першая сталіца ВКЛ', ['Навагрудак', 'Новогрудок']),
      quest('sv', 'Квэст па возеры Свіцязь: затанулы горад', ['воз. Свіцязь (Навагрудскі раён)']),
      quest('he', 'Квэст па Хевізе: цёплае возера', ['Хевіз'], 'Венгрия'),
      quest('el', 'Квэст па балоце Ельня', ['балота Ельня (Мёрскі раён)']),
    ]
    expect(ids(placeCards('Ці ёсць у вас квэст па Навагрудку? Хочам прайсці яго за паўдня.', sources))).toEqual(['nv', 'sv'])
    // «Раён» в вопросе — не название: подсказка остаётся прежней.
    expect(placeCards('Што паглядзець у гэтым раёне?', sources)).toBe(sources)
  })

  it('EN и статьи: статья относится к месту по названию и фрагменту, в том числе по прилагательному', () => {
    const tallinn = [
      quest('vi', 'The Drawing That Ran Off for a Walk Around Vitebsk', ['Vitebsk', 'Витебск']),
      quest('ta', 'Tallinn quest: the Old Town', ['Tallinn', 'Таллин'], 'Эстония'),
    ]
    expect(ids(placeCards('We have one afternoon in Tallinn. Which walk would you suggest?', tallinn))).toEqual(['ta'])

    const nesvizh = [
      quest('nq', 'Квест по Несвижу: тайны Радзивиллов', ['Несвиж']),
      travel('nz', 'Несвижский замок Радзивиллов.', 'Беларусь, Несвижский замок'),
      travel('nm', 'Несвиж и Мир: расстояние и маршрут на два дня', 'Беларусь, Церковь Успения в Новом Свержене'),
      travel('lz', 'Лодзь - город муралов и фабрик', 'Польша, Мануфактура', ['Польша']),
      quest('mq', 'Квест по Миру', ['Мир']),
    ]
    expect(ids(placeCards('Что посмотреть в Несвиже?', nesvizh))).toEqual(['nq', 'nz', 'nm'])
  })

  it('слово-омоним названием не считается: строчная буква без предлога места, короткое название — только с заглавной', () => {
    const sources = [quest('gl', 'Глубокое: вишни, барон и пять озёр', ['Глубокое']), quest('mi', 'Квест по Миру', ['Мир']), quest('gr', 'Квест по Гродно', ['Гродно'])]
    expect(placeCards('Приезжаем глубокой ночью, а заселение только с двух часов дня. Как переждать?', sources)).toBe(sources)
    expect(placeCards('Какие квесты самые известные в мире?', sources)).toBe(sources)
    expect(ids(placeCards('Что посмотреть в Мире?', sources))).toEqual(['mi'])
    // Город, набранный строчными, узнаётся после предлога места.
    expect(ids(placeCards('квесты в гродно', sources))).toEqual(['gr'])
    expect(ids(placeCards('Едем в Глубокое на выходные', sources))).toEqual(['gl'])
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
    expect(ids(placeCards('Старые замки Беларуси — какие квесты?', sources))).toEqual(['mn', 'sv', 'bs'])
    expect(placeCards('Новые квесты есть?', sources)).toBe(sources)
    expect(placeCards('Горы рядом — какие маршруты?', sources)).toBe(sources)
    expect(placeCards('Spring trips: which quests?', sources)).toBe(sources)
    expect(ids(placeCards('Lakes near Minsk?', sources))).toEqual(['mn'])
    expect(ids(placeCards('Nowe questy w Mińsku?', sources))).toEqual(['mn'])
    // Само место узнаётся по своему слову названия.
    expect(ids(placeCards('Что посмотреть в Нова-Слупе?', sources))).toEqual(['ns'])
  })

  it('исключение («кроме Минска») и вопрос без места подсказку не трогают; нет карточек места — тоже', () => {
    const sources = [quest('mn', 'Квест по Минску', ['Минск']), quest('gr', 'Квест по Гродно', ['Гродно']), travel('pl', 'Катовице за день', 'Польша, Катовице', ['Польша'])]
    expect(placeCards('Что посмотреть в Беларуси, кроме Минска?', sources)).toBe(sources)
    expect(placeCards('Какие квесты есть на сайте?', sources)).toBe(sources)
    // Лиды среди найденного нет: модель получает ближайшее, как раньше.
    expect(placeCards('Что посмотреть в Лиде?', sources)).toBe(sources)
    expect(placeCards(null, sources)).toBe(sources)
    expect(placeCards('Что посмотреть в Минске?', [sources[1]])).toEqual([sources[1]])
  })

  it('страна: без названного города — карточки страны; назван город — выигрывает он', () => {
    const sources = [
      quest('mn', 'Квест по Минску', ['Минск']),
      travel('by', 'Замки и усадьбы: 19 маршрутов', 'Беларусь, Мирский замок'),
      travel('eu', 'Зимний маршрут: Польша, Германия, Чехия, Австрия', 'Польша, Германия, Чехия, Австрия, Дрезден', ['Польша', 'Германия', 'Чехия', 'Австрия']),
      quest('kr', 'Квест по Кракову', ['Краков'], 'Польша'),
    ]
    expect(ids(placeCards('Какие замки Беларуси можно объехать за выходные?', sources))).toEqual(['mn', 'by'])
    expect(ids(placeCards('Что посмотреть в Польше?', sources))).toEqual(['eu', 'kr'])
    expect(ids(placeCards('Квесты в Минске, Беларусь', sources))).toEqual(['mn'])
  })

  it('#3277: маршрут «из X в Y» — место вопроса Y; названо одно место отправления — оно и есть место', () => {
    const sources = [
      quest('m1', 'Квест по центру Минска', ['Минск', 'Мінск', 'Mińsk', 'Minsk']),
      quest('z1', 'Квест по Заславлю: Рогнеда', ['Заславль', 'Заслаўе', 'Zasław', 'Zaslawye']),
      quest('m2', 'Квест по дворикам Минска', ['Минск', 'Мінск', 'Mińsk', 'Minsk']),
      quest('n1', 'Квэст па Нясвіжы', ['Несвиж', 'Нясвіж', 'Nieśwież', 'Nesvizh']),
      quest('kr', 'Квест по Кракову', ['Краков', 'Kraków'], 'Польша'),
    ]
    expect(ids(placeCards('Квест из Минска в Заславль', sources))).toEqual(['z1'])
    expect(ids(placeCards('Як даехаць з Мінска да Нясвіжа без машыны і што там паглядзець за дзень?', sources))).toEqual(['n1'])
    expect(ids(placeCards('Jak dojechać z Mińska do Nieświeża?', sources))).toEqual(['n1'])
    expect(ids(placeCards('How do I get from Minsk to Nesvizh?', sources))).toEqual(['n1'])
    expect(ids(placeCards('Їдемо з Мінська до Заславля', [...sources, quest('m3', 'Квест Мінськом', ['Мінськ'])]))).toEqual(['z1'])
    // Назначение — страна: город отправления место не задаёт.
    expect(ids(placeCards('Едем из Минска в Польшу, что посмотреть?', sources))).toEqual(['kr'])
    // Откуда — единственное названное место.
    expect(ids(placeCards('Куда поехать из Минска на выходные?', sources))).toEqual(['m1', 'm2'])
    // «З», «z» — ещё и «с кем»: слово после них место отправления, только если называет место каталога.
    expect(ids(placeCards('Квэсты ў Мінску з дзецьмі', sources))).toEqual(['m1', 'm2'])
    expect(ids(placeCards('Questy w Mińsku z psem', sources))).toEqual(['m1', 'm2'])
    // Два места без «откуда» — оба места вопроса, как раньше.
    expect(ids(placeCards('Что выбрать: Минск или Заславль?', sources))).toEqual(['m1', 'z1', 'm2'])
  })

  it('#3345 lv23: числительное местом не становится — «на сорок-пятьдесят», «на сорок минут» при квесте в Сороках', () => {
    const sources = [quest('so', 'Квест по Сорокам: круглая крепость и цыганская гора', ['Сороки', 'Soroki', 'Soroca'], 'Молдова'), quest('mn', 'Квест по Минску', ['Минск'])]
    expect(placeCards('Посоветуй веломаршрут на день, километров на сорок-пятьдесят', sources)).toBe(sources)
    expect(placeCards('Квест на сорок минут', sources)).toBe(sources)
    expect(placeCards('Нужен маршрут на сорока километрах пути', sources)).toBe(sources)
    expect(placeCards('A route for forty minutes, in two days', sources)).toBe(sources)
    // Само место по-прежнему узнаётся — с заглавной и после предлога.
    expect(ids(placeCards('Что посмотреть в Сороках?', sources))).toEqual(['so'])
    expect(ids(placeCards('квесты в сороках', sources))).toEqual(['so'])
    // Каталог целиком (`strict`): слово со строчной после предлога городом не считается.
    expect(matchPlaceSources('квесты в сороках', sources, ['cities'], { strict: true })).toBeNull()
    expect(ids(matchPlaceSources('Квесты в Сороках', sources, ['cities'], { strict: true }) ?? [])).toEqual(['so'])
  })

  it('цепочка подсказки (`arrangeSources`) оставляет те же карточки места, остальные уходят в группу «рядом»', () => {
    const sources = [quest('g1', 'Квест по Гродно: королевский город', ['Гродно']), quest('b1', 'Квест по Бресту: тени Берестья', ['Брест']), quest('g2', 'Квест по Гродно: Городница', ['Гродно'])]
    const query = 'Что посмотреть в Гродно?'
    const arranged = arrangeSources(query, sources).sources
    expect(ids(withoutNearby(arranged))).toEqual(ids(placeCards(query, sources)))
    expect(arranged.filter((source) => source.group === 'nearby').map((source) => source.source_id)).toEqual(['b1'])
    // Место не названо — групп нет, порядок подбора прежний.
    expect(ids(arrangeSources('Какие квесты есть на сайте?', sources).sources)).toEqual(['g1', 'b1', 'g2'])
  })

  it('withoutPlace убирает служебное поле: в список источников посетителя оно не уходит', () => {
    const source = quest('gr', 'Квест по Гродно', ['Гродно'])
    expect(withoutPlace(source)).not.toHaveProperty('place')
    expect(withoutPlace(source)).toMatchObject({ source_id: 'gr', title: 'Квест по Гродно' })
  })
})
