import { COUNTRY_NAMES } from '@/api/aiAssist/placeCountries'
import { countryCodeOfWord, countryCodesOf, matchPlaceSources, mentionsAnyPlace, namedCountryCodes, namesPlaceAfterFrom, sameCountryWord, withoutPlace } from '@/api/aiAssist/promptPlace'
import { arrangeSources, withoutNearby } from '@/api/aiAssist/sourceSelection'
import type { AiSource } from '@/api/aiAssist/types'
import { questsGenerated2 as questsBe } from '@/i18n/locales/be/generated/quests_02'
import { questsGenerated2 as questsEn } from '@/i18n/locales/en/generated/quests_02'
import { questsGenerated2 as questsPl } from '@/i18n/locales/pl/generated/quests_02'
import { questsGenerated2 as questsRu } from '@/i18n/locales/ru/generated/quests_02'
import { questsGenerated2 as questsUk } from '@/i18n/locales/uk/generated/quests_02'

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

  it('PL (#3357): чередование «k → c» в местном падеже — «Wieliczka — w Wieliczce», «Polska — w Polsce»', () => {
    const sources = [
      quest('w1', 'Quest po Wieliczce: sól i święta Kinga', ['Wieliczka', 'Величка'], 'Польша'),
      quest('k1', 'Quest po Krakowie: smok i Wawel', ['Kraków', 'Краков'], 'Польша'),
      quest('g1', 'Quest po Grodnie', ['Grodno', 'Гродно']),
    ]
    expect(ids(placeCards('Jakie questy są w Wieliczce?', sources))).toEqual(['w1'])
    const bialka = [quest('b1', 'Quest w Białce', ['Białka Tatrzańska']), ...sources]
    expect(ids(placeCards('Co robić w Białce zimą?', bialka))).toEqual(['b1'])
    // Название с «c» в основе само по себе чередованием не становится: «Wieliczce» — не «Wielice».
    expect(ids(placeCards('Questy w Wielicach', sources))).toEqual(['w1', 'k1', 'g1'])
    const byCountry = [travel('p1', 'Szlak Orlich Gniazd', 'Jura Krakowsko-Częstochowska', ['Polska']), travel('b1', 'Нарочанский край', 'озёра', ['Беларусь'])]
    expect(ids(placeCards('Co zobaczyć w Polsce?', byCountry))).toEqual(['p1'])
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

// #3369: корпус падежей и названий места — формы на RU/BE/UK/PL/EN, которые место называют, и слова, которые
// с названием только совпадают. Каждая строка — вопрос, названия города в каталоге и ожидание.
describe('aiAssist promptPlace: корпус падежей и названий места (#3369)', () => {
  const other = quest('other', 'Квест по Пинску', ['Пинск', 'Пінск', 'Pińsk', 'Pinsk'])
  const asksAboutCity = (query: string, cities: string[]): boolean => {
    const own = quest('own', 'Квест города', cities)
    const kept = matchPlaceSources(query, [other, own])
    return kept !== null && kept.includes(own) && !kept.includes(other)
  }

  it.each<[string, string[]]>([
    // RU
    ['Что посмотреть, если поеду в Лиду?', ['Лида']],
    ['Едем из Гродно в Лиду на день', ['Лида']],
    ['Квесты в Новогрудке', ['Новогрудок']],
    ['квесты в гродно', ['Гродно']],
    ['Гродно за день: что успеть?', ['Гродно']],
    ['Что посмотреть в г. Минске?', ['Минск']],
    ['Есть квест в Мостах?', ['Мосты']],
    ['Что посмотреть в Глубоком за день?', ['Глубокое']],
    ['Куда съездить в Червень на день?', ['Червень']],
    // BE
    ['Квэст па Навагрудку', ['Навагрудак']],
    ['Што паглядзець у Мінску?', ['Мінск']],
    ['Як даехаць да Нясвіжа?', ['Нясвіж']],
    // UK
    ['Що подивитися дорогою до Відня?', ['Відень']],
    ['Їдемо зі Львова, що подивитися у Кракові?', ['Краків']],
    ['Квести у Львові', ['Львів']],
    ['Що цікавого біля Львова?', ['Львів']],
    ['Маршрут до Тернополя', ['Тернопіль']],
    ['Прогулянка по Києву', ['Київ']],
    ['Що подивитися біля Києва?', ['Київ']],
    // PL
    ['Jakie questy są w Krakowie?', ['Kraków']],
    ['Jedziemy do Gdańska na weekend', ['Gdańsk']],
    ['Co zobaczyć we Wrocławiu?', ['Wrocław']],
    ['Ile trwa quest po Sandomierzu?', ['Sandomierz']],
    // EN
    ['Is there a quest in Vienna?', ['Vienna']],
    ['Krakow in one day?', ['Krakow']],
  ])('место названо: «%s»', (query, cities) => {
    expect(asksAboutCity(query, cities)).toBe(true)
  })

  it.each<[string, string[]]>([
    // Заглавная буква в начале фразы — не признак названия.
    ['Глубокой ночью приезжаем, где позавтракать?', ['Глубокое']],
    ['Сорок минут есть. Глубокой осенью что посмотреть?', ['Глубокое']],
    ['Most interesting quests for a weekend?', ['Мосты', 'Mosty']],
    ['Мосты через Неман красивые?', ['Мосты']],
    ['Берёзой пахнет в лесу. Куда сходить в поход?', ['Берёза']],
    // Название — обычное слово: строчная буква после предлога местом не становится.
    ['Как пройти на мост влюблённых?', ['Мосты']],
    ['Гуляли под берёзой у реки', ['Берёза']],
    ['Купались в глубоком озере', ['Глубокое']],
    ['Сидели на ветке дерева', ['Ветка']],
    // Месяц: украинское «у червні» и белорусское «у чэрвені» — «в июне», а не город Червень.
    ['Куди поїхати у червні?', ['Червень']],
    ['Куды паехаць у чэрвені?', ['Чэрвень']],
    // Числительное и слово, похожее на название только началом.
    ['Квест на сорок минут', ['Сороки']],
    ['Ужинали в Лидо, что посмотреть рядом?', ['Лида']],
  ])('место не названо: «%s»', (query, cities) => {
    expect(matchPlaceSources(query, [other, quest('own', 'Квест города', cities)])).toBeNull()
  })

  it('«Лидо» в тексте статьи о Риге — не Лида: статья в подсказку на «в Лиду» не идёт', () => {
    const lida = quest('lida', 'Квест по Лиде: гости замка Гедимина', ['Лида', 'Ліда', 'Lida'])
    const castle = travel('castle', 'Лидский замок: история и как добраться', 'Беларусь. Дней: 1. Замок Гедимина в центре Лиды')
    const riga = travel('riga', 'Латвия. Рига и Юрмала в октябре.', 'Латвия. Дней: 3. Обедали в ресторане Лидо — большой выбор латышской кухни', ['Латвия'])
    expect(ids(placeCards('Что посмотреть, если поеду в Лиду?', [castle, riga, lida]))).toEqual(['castle', 'lida'])
  })

  it('место, на которое только смотрят, упоминанием не считается: «виды на Татры» у статьи о Горце', () => {
    const tatras = ['Татрах']
    for (const view of [
      '6 км в одну сторону, потрясающие виды на Татры и Пьенины, приют PTTK почти у вершины',
      'в ясную погоду отсюда открывается панорама Татр, Пьенин и Бескидов',
      'В ясную погоду с Турбача видны Высокие Татры, Пенины и хребты западных Бескидов',
      'особенно с Халы Турбач и вершины, с которых открываются Татры',
      'Отсюда видно польские Татры',
    ]) {
      expect(mentionsAnyPlace(tatras, view)).toBe(false)
    }
    expect(mentionsAnyPlace(['Tatry'], 'Ze szczytu jest piękny widok na Tatry')).toBe(false)
    expect(mentionsAnyPlace(['Tatras'], 'The summit has wide views of the Tatras')).toBe(false)
    for (const own of [
      'Ścieżka nad Reglami — несложная тропа вдоль северной кромки Татр',
      'Téryho chata — одна из самых известных горных хат Высоких Татр',
      'Технически Гевонт не самый сложный пик Татр',
      'Вид на Татры открывается с тропы. Сам маршрут идёт по Татрам от Закопане',
    ]) {
      expect(mentionsAnyPlace(tatras, own)).toBe(true)
    }
  })

  it('цепочка подсказки: статья с видом на место уходит в «рядом», статьи о самом месте остаются (lv79)', () => {
    const path = travel('path', 'Закопане: лёгкая тропа Ścieżka nad Reglami', 'Польша. Дней: 1. Несложная тропа вдоль северной кромки Татр', ['Польша'])
    const turbacz = travel('turbacz', 'Гора Турбач (1310 м): поход в Горце, Польша', 'Польша. Дней: 1. Потрясающие виды на Татры и Пьенины, приют PTTK у вершины', ['Польша'])
    const hut = travel('hut', 'Териева хата в Высоких Татрах: маршрут из Старого Смоковца', 'Словакия. Дней: 1. Маршрут через водопады', ['Словакия'])
    const mentions = (source: AiSource, places: readonly string[]) => mentionsAnyPlace(places, `${source.title} ${source.snippet}`)
    const arranged = arrangeSources('Посоветуй маршрут в Татрах для новичков без машины', [path, turbacz, hut], { mentions })
    expect(ids(withoutNearby(arranged.sources))).toEqual(['path', 'hut'])
    expect(arranged.sources.find((source) => source.source_id === 'turbacz')?.group).toBe('nearby')
  })
})

// #3416 п.2, 4, 6 и #3431: общий разбор места — страна на другом языке и в другом падеже, спутник вместо
// места, вопрос без заглавных букв, «N км от места». Каждая форма — на RU/BE/UK/PL/EN.
describe('aiAssist promptPlace: общий разбор места на пяти языках (#3416, #3431)', () => {
  const poland = travel('pl', 'Татры за три дня', 'Польша. Дней: 3. Закопане и Морское Око', ['Польша'])
  const germany = travel('de', 'Саксонская Швейцария', 'Германия. Дней: 2. Бастай и Кёнигштайн', ['Германия'])
  const italy = travel('it', 'Доломиты', 'Италия. Дней: 5. Тре-Чиме', ['Италия'])
  const hungary = quest('hu', 'Квест по Будапешту', ['Будапешт', 'Budapest'], 'Венгрия')
  const both = travel('plsk', 'Пьенины', 'Польша, Словакия. Дней: 2. Сплав по Дунайцу', ['Польша, Словакия'])
  const cards = [poland, germany, italy, hungary, both]

  it.each<[string, string, string[]]>([
    ['RU', 'Маршруты в Польше', ['pl', 'plsk']],
    ['BE', 'Маршруты ў Польшчы', ['pl', 'plsk']],
    ['UK', 'Маршрути в Польщі', ['pl', 'plsk']],
    ['PL', 'Szlak pieszy do 30 km w Polsce', ['pl', 'plsk']],
    ['EN', 'Hiking trail in Poland', ['pl', 'plsk']],
    ['RU', 'Куда съездить в Германии?', ['de']],
    ['BE', 'Што паглядзець у Германіі?', ['de']],
    ['UK', 'Що подивитися в Німеччині?', ['de']],
    ['PL', 'Trasy w Niemczech', ['de']],
    ['EN', 'Trips in Germany', ['de']],
    ['PL', 'Co zobaczyć we Włoszech?', ['it']],
    ['UK', 'Маршрути в Італії', ['it']],
    ['PL', 'Questy na Węgrzech', ['hu']],
    ['UK', 'Квести в Угорщині', ['hu']],
    ['EN', 'Quests in Hungary', ['hu']],
    ['UK', 'Маршрути у Словаччині', ['plsk']],
  ])('%s: страна карточки узнаётся на языке вопроса — «%s»', (_lang, query, expected) => {
    expect(ids(matchPlaceSources(query, cards) ?? [])).toEqual(expected)
  })

  it('страна со строчной буквы после предлога узнаётся и в строгом поиске: список стран закрытый', () => {
    expect(ids(matchPlaceSources('что посмотреть в польше', cards, ['countries'], { strict: true }) ?? [])).toEqual(['pl', 'plsk'])
    expect(ids(matchPlaceSources('Едем с Анной: что посмотреть в польше?', cards, ['countries'], { strict: true }) ?? [])).toEqual(['pl', 'plsk'])
    expect(namedCountryCodes('что посмотреть в польше')).toEqual(['PL'])
    // Короткое название — только с заглавной: «на кубе» и «в чаде» страной не становятся.
    expect(namedCountryCodes('сидели на кубе из бетона')).toEqual([])
    expect(namedCountryCodes('Отдых на Кубе')).toEqual(['CU'])
    // Числительное и обычное слово страной не становятся.
    expect(namedCountryCodes('Квест на сорок минут в центре')).toEqual([])
    // Короткое название — только своими падежными формами: Кубань и иранцы — не Куба и не Иран.
    expect(namedCountryCodes('Поход на Кубани в мае')).toEqual([])
    expect(namedCountryCodes('Чем интересна Кубань?')).toEqual([])
    expect(countryCodeOfWord('иранцы')).toBeNull()
    expect(['кубе', 'кубу', 'кубои', 'кипре', 'кипром', 'иране', 'cyprze', 'kubie', 'usa'].map(countryCodeOfWord)).toEqual(['CU', 'CU', 'CU', 'CY', 'CY', 'IR', 'CY', 'CU', 'US'])
    // Исключение страну не называет.
    expect(namedCountryCodes('Пеший маршрут в Европе, кроме Польши')).toEqual([])
  })

  it('таблица стран: одно слово — одна страна, падеж и язык её не меняют', () => {
    expect(countryCodeOfWord('polsce')).toBe('PL')
    expect(countryCodeOfWord('niemczech')).toBe('DE')
    expect(countryCodeOfWord('włoszech'.normalize('NFD').replace(/\p{M}+/gu, ''))).toBe('IT')
    expect(countryCodeOfWord('угорщині')).toBe('HU')
    expect(countryCodeOfWord('минске')).toBeNull()
    expect(sameCountryWord('niemcy', 'niemczech')).toBe(true)
    expect(sameCountryWord('польша', 'polsce')).toBe(true)
    // Похожие начала разных стран не склеиваются.
    expect(sameCountryWord('австрии', 'австралии')).toBe(false)
    expect(sameCountryWord('словакии', 'словении')).toBe(false)
    expect(sameCountryWord('индии', 'индонезии')).toBe(false)
    expect(countryCodesOf(['Польша, Словакия'])).toEqual(['PL', 'SK'])
    expect(countryCodesOf(['Южная Корея', 'United Kingdom', "В'етнам"])).toEqual(['KR', 'GB', 'VN'])
    expect(countryCodesOf(['Маврикий', null, undefined])).toEqual([])
  })

  it('таблица стран не расходится со списком стран сайта: каждое название на пяти локалях ведёт к своему коду', () => {
    const locales = { ru: questsRu, be: questsBe, uk: questsUk, pl: questsPl, en: questsEn } as Record<string, Record<string, string>>
    const prefix = 'screens.tabs.QuestsScreen.country.'
    const codes = Object.keys(questsRu).filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length))
    expect(codes.sort()).toEqual(Object.keys(COUNTRY_NAMES).sort())
    const missed: string[] = []
    for (const code of codes) {
      for (const [locale, resource] of Object.entries(locales)) {
        const name = resource[`${prefix}${code}`]
        // Название узнаётся целиком либо по слову в любом падеже: в польском списке сайта «Austrii», «Albanii».
        const known = countryCodesOf([name]).includes(code) || name.split(/[^\p{L}\p{N}]+/u).some((word) => countryCodeOfWord(word.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase()) === code)
        if (!known) missed.push(`${code}/${locale}: ${name}`)
      }
    }
    expect(missed).toEqual([])
  })

  it('упоминание страны в тексте сверяется на всех языках сайта (`mentionsAnyPlace`)', () => {
    expect(mentionsAnyPlace(['Polsce'], 'Польша. Дней: 3. Закопане и Морское Око')).toBe(true)
    expect(mentionsAnyPlace(['Poland'], 'Маршрут по Польше на машине')).toBe(true)
    expect(mentionsAnyPlace(['Niemczech'], 'Германия. Дней: 2. Бастай')).toBe(true)
    expect(mentionsAnyPlace(['Польщі'], 'Trasa przez Polskę i Słowację')).toBe(true)
    expect(mentionsAnyPlace(['Polsce'], 'Германия. Дней: 2. Бастай')).toBe(false)
  })

  // Имя человека совпадает с местом каталога (Лида) и газеттира (Виктория, Иордания): после предлога «с кем»
  // в творительном падеже это спутник; родительный после тех же предлогов — место отправления.
  const lida = quest('lida', 'Квест по Лиде', ['Лида', 'Ліда', 'Lida'])
  const victoria = quest('vic', 'Victoria trail', ['Виктория', 'Вікторыя', 'Вікторія', 'Wiktoria', 'Victoria'], 'Австралия')
  const jordan = travel('jo', 'Петра', 'Иордания. Дней: 4. Петра и Вади-Рам', ['Иордания'])
  const people = [lida, victoria, jordan, quest('other', 'Квест по Пинску', ['Пинск', 'Пінск', 'Pinsk'])]

  it.each<[string, string]>([
    ['RU', 'Идём в поход с Лидой на выходные'],
    ['RU', 'Гуляем с Викторией, что посмотреть?'],
    ['BE', 'Ідзём у паход з Лідай на выхадныя'],
    ['BE', 'Гуляем з Вікторыяй, што паглядзець?'],
    ['UK', 'Йдемо в похід з Вікторією на вихідні'],
    ['PL', 'Idziemy na wędrówkę z Wiktorią na weekend'],
    ['PL', 'Jedziemy z Jordanem na weekend'],
    ['EN', 'Hiking with Victoria this weekend'],
    ['EN', 'A weekend trip with Jordan'],
  ])('%s: спутник — не место: «%s»', (_lang, query) => {
    expect(matchPlaceSources(query, people)).toBeNull()
    expect(matchPlaceSources(query, people, ['cities'], { strict: true })).toBeNull()
  })

  it.each<[string, string, string[]]>([
    ['RU', 'Что посмотреть в Лиде с детьми?', ['lida']],
    ['RU', 'Паром с Виктории на материк', ['vic']],
    ['BE', 'Што паглядзець у Лідзе?', ['lida']],
    ['UK', 'Маршрут по Вікторії', ['vic']],
    ['PL', 'Szlak w Wiktorii na trzy dni', ['vic']],
    ['EN', 'Hiking in Victoria with kids', ['vic']],
    ['EN', 'A week in Jordan with friends', ['jo']],
  ])('%s: то же название местом остаётся — «%s»', (_lang, query, expected) => {
    expect(ids(matchPlaceSources(query, people) ?? [])).toEqual(expected)
  })

  // Строгий поиск читает место по заглавной букве. Вопрос без заглавных (режим `lowercase`, маршруты мира)
  // читается по предлогу места; автор, который заглавными пользуется, остаётся под строгим правилом.
  const scotland = quest('sc', '', ['Шотландия', 'Шатландыя', 'Шотландія', 'Szkocja', 'Scotland'], 'Великобритания')
  const gazetteer = [scotland, quest('co', '', ['Корсика', 'Корсіка', 'Korsyka', 'Corsica'], 'Франция'), quest('rd', '', ['Дорога', 'Береза', 'Мир'], 'Беларусь')]
  const lowercase = (query: string) => ids(matchPlaceSources(query, gazetteer, ['cities'], { strict: true, lowercase: true }) ?? [])

  it.each<[string, string]>([
    ['RU', 'пеший маршрут в шотландии'],
    ['RU', 'Пеший маршрут в шотландии на пять дней'],
    ['BE', 'пешы маршрут у шатландыі'],
    ['UK', 'піший маршрут у шотландії'],
    ['PL', 'szlak pieszy w szkocji'],
    ['EN', 'hiking trail in scotland'],
  ])('%s: вопрос без заглавных букв читается по предлогу места — «%s»', (_lang, query) => {
    expect(lowercase(query)).toEqual(['sc'])
  })

  it('вопрос без заглавных: слово без предлога, омоним обычного слова и короткое название местом не становятся', () => {
    expect(lowercase('шотландия пеший маршрут')).toEqual([])
    expect(lowercase('маршрут на березе у реки')).toEqual([])
    expect(lowercase('лучшие маршруты в мире')).toEqual([])
    expect(lowercase('поход на сорок километров')).toEqual([])
  })

  it('автор пользуется заглавными — слово со строчной после предлога местом не считается и в режиме `lowercase`', () => {
    expect(lowercase('По дороге в Бобруйск заедем в лес')).toEqual([])
    expect(lowercase('Пеший маршрут на Корсике по дороге к морю')).toEqual(['co'])
  })

  it('каталог сайта остаётся строгим: без режима `lowercase` город со строчной буквы не добирается (lv23)', () => {
    expect(matchPlaceSources('пеший маршрут в шотландии', gazetteer, ['cities'], { strict: true })).toBeNull()
  })

  // #3416 п.6, первая часть: падежная форма первым словом фразы («Минске что посмотреть?») местом не
  // считается — цена правила #3369 о заглавной букве в начале фразы; в наборах вопросов форма не встречается.
  it('падежная форма первым словом фразы место не называет; само название и форма после предлога — называют', () => {
    const minsk = quest('minsk', 'Квест по Минску', ['Минск', 'Мінск', 'Minsk'])
    const pool = [minsk, quest('other', 'Квест по Пинску', ['Пинск', 'Пінск', 'Pinsk'])]
    expect(matchPlaceSources('Минске что посмотреть?', pool)).toBeNull()
    expect(ids(matchPlaceSources('Минск что посмотреть?', pool) ?? [])).toEqual(['minsk'])
    expect(ids(matchPlaceSources('В Минске что посмотреть?', pool) ?? [])).toEqual(['minsk'])
  })

  // #3416 п.2: «N км от …» — расстояние от места или длина маршрута от ориентира.
  it.each<[string, string, boolean]>([
    ['RU', 'Минска', true],
    ['RU', 'минска на выходные', true],
    ['RU', 'вокзала', false],
    ['RU', 'озера до деревни', false],
    ['BE', 'мінска', true],
    ['BE', 'вакзала', false],
    ['UK', 'львова', true],
    ['UK', 'зупинки', false],
    ['PL', 'krakowa', true],
    ['PL', 'dworca', false],
    ['EN', 'krakow', true],
    ['EN', 'the station', false],
    ['EN', 'my hotel', false],
  ])('%s: «N км от %s» — место: %s', (_lang, after, expected) => {
    expect(namesPlaceAfterFrom(after)).toBe(expected)
  })
})

// #3357, приёмка на полном индексе: слово вопроса — падежная форма названия, а не слово с тем же началом.
describe('aiAssist promptPlace: падежная форма, а не общее начало (#3357)', () => {
  const other = quest('other', 'Квест по Пинску', ['Пинск', 'Пінск', 'Pińsk', 'Pinsk'])
  const names = (query: string, cities: string[], options: Parameters<typeof matchPlaceSources>[3] = {}): boolean => {
    const own = quest('own', 'Квест города', cities)
    return (matchPlaceSources(query, [other, own], ['cities'], options) ?? []).includes(own)
  }

  it.each<[string, string, string[]]>([
    // Те же три-четыре буквы в начале — другое слово.
    ['RU', 'Пеший маршрут в Нарнии на три дня', ['Нара']],
    ['RU', 'Пеший маршрут в Нарнии на три дня', ['Нарботэн', 'Norrbotten']],
    ['RU', 'Поход в Альпах на неделю', ['Альб']],
    ['RU', 'Поход в Альпах на неделю', ['Альберта', 'Alberta']],
    ['RU', 'Поход в Альпах на неделю', ['Альбасете']],
    ['RU', 'Поход в Альпах на неделю', ['Альфёльд']],
    ['RU', 'Поход в Альпах на неделю', ['Альта', 'Альто']],
    ['RU', 'Кто победит на Выборах?', ['Выборг']],
    ['RU', 'Летим на Тайвань на две недели', ['Тайн', 'Тайнсайд']],
    ['RU', 'Мечтаем про Коста-Рику', ['Косово']],
    ['BE', 'Пешы маршрут у Нарніі', ['Нара']],
    ['BE', 'Ляцім на Тайвань на два тыдні', ['Тайбей']],
    ['UK', 'Летимо до Відня з донькою', ['Венеция', 'Венеція']],
    ['UK', 'Плануємо тиждень в Андоррі', ['Андора']],
    ['PL', 'Szlak pieszy w Narnii', ['Nara']],
    ['PL', 'Odpowiedz po Polsku: dokąd na weekend?', ['Polska']],
    ['EN', 'How many points are in the Warsaw quest?', ['Karlowe Wary', 'Karlovy Vary']],
    ['EN', 'A quest for Angkor Wat', ['Anglia', 'Anglesey']],
    ['EN', 'Which is shorter, the Lisbon quest or the Porto one?', ['Portugal', 'Portugalia']],
    ['EN', 'Tell me about Tour du Mont Blanc', ['Monaco', 'Montana', 'Tours']],
  ])('%s: «%s» не называет «%s»', (_lang, query, cities) => {
    expect(names(query, cities)).toBe(false)
    expect(names(query, cities, { strict: true })).toBe(false)
  })

  it.each<[string, string, string[]]>([
    ['RU', 'Поход в Альпах на неделю', ['Альпы']],
    ['RU', 'Тропы Альп для новичков', ['Альпы']],
    ['RU', 'Что посмотреть в Глубоком за день?', ['Глубокое']],
    ['RU', 'Едем в Пиренеи, потом из Пиренеев домой', ['Пиренеи']],
    ['RU', 'Поход по Татрам', ['Татры']],
    ['BE', 'Што паглядзець у Брэсце?', ['Брэст']],
    ['BE', 'Што паглядзець у Лідзе?', ['Ліда']],
    ['BE', 'Квэсты ў Кракаве', ['Кракаў']],
    ['BE', 'Паход у Альпах', ['Альпы']],
    ['UK', 'Маршрут у Шотландії', ['Шотландія']],
    ['UK', 'Похід в Альпах', ['Альпи']],
    ['UK', 'Квести в Одесі', ['Одеса']],
    ['PL', 'Jedziemy do Poznania bez samochodu', ['Poznań']],
    ['PL', 'Trasa w okolicach Wrocławia', ['Wrocław']],
    ['PL', 'Co zobaczyć w Budapeszcie?', ['Budapeszt']],
    ['PL', 'Wycieczka z Zakopanego', ['Zakopane']],
    ['PL', 'Szlak w Tatrach', ['Tatry']],
    ['PL', 'Wakacje na Cyprze', ['Cypr']],
    ['EN', 'A hike in the Tatras', ['Tatra']],
    ['EN', 'Hiking in the Alps', ['Alps']],
  ])('%s: «%s» называет «%s»', (_lang, query, cities) => {
    expect(names(query, cities)).toBe(true)
  })

  it('статья относится к месту по прилагательному и названию края, но не по слову с тем же началом', () => {
    const grodno = quest('grodno', 'Квест по Гродно', ['Гродно', 'Гродна', 'Grodno'])
    const region = travel('region', 'Желудок и усадьбы Гродненщины: как добраться', 'Беларусь. Дней: 1. Усадьба в Желудке')
    const castle = travel('castle', 'Старый замок', 'Беларусь. Дней: 1. Гродненский Старый замок над Неманом')
    expect(ids(matchPlaceSources('Что посмотреть в Гродно за один день?', [grodno, region, castle]) ?? [])).toEqual(['grodno', 'region', 'castle'])
    const mir = quest('mir', 'Квест в Мире', ['Мир', 'Mir'])
    const mirow = travel('mirow', 'Замки Мирув и Боболице: маршрут на один день', 'Польша. Дней: 1. Орлиные гнёзда', ['Польша'])
    expect(ids(matchPlaceSources('Несвиж и Мир за один день', [mir, mirow]) ?? [])).toEqual(['mir'])
  })
})
