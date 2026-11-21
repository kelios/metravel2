import { resources } from '@/i18n/resources'
import { ssgOnlyResources } from '@/i18n/ssgResources'

// Глоссарий терминов интерфейса. Значения `generated/*` переведены машинно, и
// короткая подпись без окружения уходит в самый частый словарный смысл: «тема»
// стала «Temat» (#2180), «Светлая» — «Światło» (свет), «лёгкий» — «light»,
// «точка» на карте — «dot» и «kropka» (#2188), «карта» — «card», «karta» и
// «картка», «отдалить» — «Remove», «спутники» — «Satellites» (#2242). Строка
// TERMS — это термин: какие RU-значения им считаются и что перевод обязан или
// не вправе содержать. Новое слово добавляется строкой сюда; отдельный тест на
// слово не пишется.

type Locale = 'en' | 'pl' | 'be' | 'uk'
type Expectation = { required?: RegExp; forbidden?: RegExp }
type Term = {
  name: string
  /** Какие RU-значения считаются этим термином. */
  ru: RegExp
  /** Сужение по ключу — для слова, чья форма зависит от строки интерфейса. */
  keys?: RegExp
  /** То же RU-слово, но другой термин: по соседнему слову или по ключу. */
  except?: { ru?: RegExp; keys?: RegExp }
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
// These book controls describe subject matter; their Polish term is «temat», not UI «motyw».
const BOOK_THEME_KEYS = /^(theme|noBooks|fullCatalogLead)$/

// «Карта» многозначна: географическая, банковская, карта памяти. Глоссарий
// держит географическую: «карты памяти» отсекает сам шаблон, банковскую
// («Без карты» в значках доверия главной) — ключ. «Карточка» — отдельный
// термин: её шаблон начинается с «карточ» и с «картой» не пересекается.
const RU_MAP_WORD = /(^|[^а-яё])карт(а|у|ы|е|ой|ою|ам|ами|ах)?(?![а-яё])(?! памяти)/i
const RU_CARD_WORD = /(^|[^а-яё])карточ(к|ек)/i
const BANK_CARD_KEYS = /HomeFinalCTA\.bez_karty_/
// «Приблизительная линия» — не приближение карты: после «приблизит» идёт
// окончание глагола и конец слова.
const RU_ZOOM_IN_WORD = /(^|[^а-яё])приблизит(ь|е)(?![а-яё])/i
const RU_ZOOM_OUT_WORD = /(^|[^а-яё])отдалит(ь|е)(?![а-яё])/i
// Список «Хочу поехать» и глагол поездки (#2254): посредник «go» дал в PL и
// «iść» (идти пешком), и «jechać»; имя списка одно — «Chcę pojechać».
const RU_WISHLIST_NAME = /хочу\s+поехать/i
const RU_GO_BY_TRANSPORT = /(^|[^а-яё])(поехать|поехали|поеду|поедут|едут|ехать)(?![а-яё])/i
// «Очистить / очищен» через «clear» стало прилагательным «jasne» (ясно).
const RU_CLEAR_WORD = /(^|[^а-яё])(очист|очищ)/i

// Слово перевода ищется целиком: в PL «kartka» (лист A4) — не «karta», в UK
// «картка» — не «карта», и граница слова учитывает буквы своего алфавита.
const PL_LETTER = 'a-ząćęłńóśźż'
const UK_LETTER = "а-яіїєґ'’"
const BE_LETTER = "а-яіўё'’"
const PL_WALK_VERB = new RegExp(
  `(^|[^${PL_LETTER}])(iść|pójść|pójdę|idę|chodź|chodźmy)(?![${PL_LETTER}])`,
  'i',
)
const PL_MAP_WORD = new RegExp(`(^|[^${PL_LETTER}])map`, 'i')
const UK_MAP_WORD = new RegExp(
  `(^|[^${UK_LETTER}])(карт(а|у|и|і|ою|ам|ами|ах)?|мап[а-яіїєґ]*)(?![${UK_LETTER}])`,
  'i',
)
const BE_MAP_WORD = new RegExp(
  `(^|[^${BE_LETTER}])(карт(а|у|ы|е|ай|аю|ам|амі|ах)?|карце|мап[а-яіўё]*)(?![${BE_LETTER}])`,
  'i',
)
const EN_CARD_WORD = /\bcards?\b/i
const PL_CARD_WORD = new RegExp(`(^|[^${PL_LETTER}])kar(t|c)`, 'i')
const PL_CARD_NOT_SHEET = new RegExp(
  `(^|[^${PL_LETTER}])kar(t(a|y|ę|ą|o|om|ami|ach)?|cie)(?![${PL_LETTER}])`,
  'i',
)
const UK_CARD_WORD = /картк|картц|карток/i
const BE_CARD_WORD = /картк|картц|картак/i

// Решения владельца 21.11.2026 (#3372). «Квест» в польском — одно слово „quest”:
// раньше его передавали ещё и как zadanie, misja, gra, poszukiwanie, и кнопка
// «Начать квест» называлась „Rozpocznij zadanie”, а текст рядом звал нажать
// „Rozpocznij misję”. «Задание», «игра» и «поиск» остаются своими словами,
// поэтому запрет действует только там, где в RU-строке их нет.
const RU_QUEST_WORD = /(^|[^а-яё])квест/i
const RU_TASK_GAME_SEARCH = /задани|(^|[^а-яё])игр|поиск|мисси/i
const PL_QUEST_WORD = new RegExp(`(^|[^${PL_LETTER}])que(st|ści)`, 'i')
const PL_QUEST_SUBSTITUTE = new RegExp(
  `zada[nń]|misj|poszukiwa|wypraw|(^|[^${PL_LETTER}])gr(a|ę|y|ze|ą|om|ami|ach|ier)?(?![${PL_LETTER}])`,
  'i',
)
// «Мои поездки» — раздел совместных поездок („Wycieczki” в навигации), «Мои
// путешествия» — свои статьи („Moje podróże”); обе подписи были „Moje podróże”.
const RU_MY_TRIPS = /(^|[^а-яё])мо(и|их|им|ими)\s+поездк/i
const RU_MY_TRAVELS = /(^|[^а-яё])мо(и|их|им|ими)\s+путешестви/i
// «Точка» маршрута и карты в белорусском — «кропка»; «пункт» остаётся пунктом
// меню, списка и населённым пунктом. «Точка печати» в книгах — пункт приёма
// заказов, а не место на карте.
const RU_ITEM_WORD = /(^|[^а-яё])пункт/i
const BE_ITEM_WORD = new RegExp(`(^|[^${BE_LETTER}])пунк[тц]`, 'i')
const BE_POINT_WORD = /кроп(к|ак|цы)/i
const PRINT_PROVIDER_KEYS = /^provider(Empty|FontsEmbedded|FontsOutlines|FontsAsk|LoadError)$/
// «Приложение» — программа на устройстве: BE «дадатак», UK «застосунок».
const RU_APP_WORD = /(^|[^а-яё])приложени/i

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
    name: '«диалог» в сообщениях — переписка, не диалоговое окно (#2284)',
    ru: /диалог/i,
    keys: /^components\.messages\./,
    minEntries: 8,
    locales: { pl: { required: /rozmow|dialog(?!ow)/i, forbidden: /okn[oa]? dialogow/i } },
  },
  {
    name: '«квест» — единое белорусское написание «квэст»',
    ru: /(^|[^а-яё])квест/i,
    minEntries: 40,
    locales: { be: { required: /квэс[тц]/i, forbidden: /квест/i } },
  },
  {
    name: '«тема» — тема оформления',
    ru: RU_THEME_WORD,
    // Разговор и тематика книги — другие значения слова, не оформление интерфейса; «Ещё по теме» —
    // группа соседних материалов под ответом ассистента (#3290).
    except: { ru: /не\s+по\s+теме|на\s+другие\s+темы|ещё\s+по\s+теме|тема\s+книги|в\s+этой\s+теме\s+пока\s+нет\s+книг/i, keys: BOOK_THEME_KEYS },
    minEntries: 8,
    locales: {
      en: { required: /\btheme/i, forbidden: /\b(topic|subject)/i },
      pl: { required: /motyw/i, forbidden: /temat/i },
    },
  },
  {
    name: '«тема книги» — предмет подборки, а не оформление (#2809)',
    ru: RU_THEME_WORD,
    keys: BOOK_THEME_KEYS,
    minEntries: 3,
    locales: {
      en: { required: /\b(theme|topic|subject)/i },
      pl: { required: /temat/i, forbidden: /motyw/i },
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
    // #2219 (device QA): BE «галіна» и UK «галузь» — «отрасль», а не область карты.
    name: '«в этой области» — область карты, не отрасль',
    ru: /(^|[^а-яё])в этой области/i,
    minEntries: 6,
    locales: {
      en: { required: /\barea\b/i },
      pl: { required: /(obszar|okolic)/i },
      be: { required: /вобласц/i, forbidden: /галін/i },
      uk: { required: /област/i, forbidden: /галуз/i },
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
  {
    name: '«карта» — географическая карта',
    ru: RU_MAP_WORD,
    except: { keys: BANK_CARD_KEYS },
    minEntries: 250,
    locales: {
      en: { required: /\bmaps?\b/i },
      pl: { required: PL_MAP_WORD },
      uk: { required: UK_MAP_WORD },
      be: { required: BE_MAP_WORD },
    },
  },
  {
    // Отдельной строкой: «Шари картки карти» прошло бы строку выше.
    name: '«карта» без «карточки» — в переводе нет card / karta / картка',
    ru: RU_MAP_WORD,
    except: { ru: RU_CARD_WORD, keys: BANK_CARD_KEYS },
    minEntries: 250,
    locales: {
      en: { forbidden: EN_CARD_WORD },
      pl: { forbidden: PL_CARD_NOT_SHEET },
      uk: { forbidden: UK_CARD_WORD },
      be: { forbidden: BE_CARD_WORD },
    },
  },
  {
    name: '«карточка» — карточка, не карта',
    ru: RU_CARD_WORD,
    minEntries: 25,
    locales: {
      en: { required: EN_CARD_WORD },
      pl: { required: PL_CARD_WORD },
      uk: { required: UK_CARD_WORD },
      be: { required: BE_CARD_WORD },
    },
  },
  {
    name: '«отдалить» — уменьшить масштаб, не удалить',
    ru: RU_ZOOM_OUT_WORD,
    minEntries: 4,
    locales: {
      en: { required: /\bzoom out\b/i },
      pl: { required: /pomniejsz/i },
      uk: { required: /віддал/i },
      be: { required: /аддал/i },
    },
  },
  {
    name: '«приблизить» — увеличить масштаб',
    ru: RU_ZOOM_IN_WORD,
    minEntries: 5,
    locales: {
      en: { required: /\bzoom in\b/i },
      pl: { required: /powiększ/i },
      uk: { required: /наблиз/i },
      be: { required: /набліз/i },
    },
  },
  {
    // Фильтр каталога «Спутники», поле мастера «Компания» и «компания по душе»
    // в поездках — одно и то же: с кем едут. Правило по слову во всех падежах, а
    // не по одиночной подписи. Слой карты «Спутник» стоит в единственном числе
    // и сюда не входит.
    name: '«спутники», «компания» — с кем едут, не аппараты и не фирма',
    ru: /(^|[^а-яё])(спутники|компани(я|и|ю|ей|й|ям|ями|ях))(?![а-яё])/i,
    minEntries: 6,
    locales: {
      en: { forbidden: /satellit|\bcompan(y|ies)\b/i },
      pl: { forbidden: /satelit|firm/i },
    },
  },
  {
    name: '«черновик» — неопубликованная запись, не сквозняк и не проект',
    ru: /(^|[^а-яё])черновик/i,
    minEntries: 40,
    locales: {
      en: { required: /\bdrafts?\b/i },
      // Одно слово на всех экранах (#2254): «wersja robocza», не «szkic».
      pl: { required: /robocz/i, forbidden: /szkic/i },
      uk: { required: /чернет(к|ок)|чорнов/i },
      be: { required: /чарнавік/i },
    },
  },
  {
    name: '«Хочу поехать» — одно имя списка на всех экранах',
    ru: RU_WISHLIST_NAME,
    // #2360: 11 ключей без ссылок в коде удалены из всех локалей (93 → 82).
    minEntries: 82,
    locales: {
      en: { required: /\bI want to go\b/i, forbidden: /want to travel/i },
      pl: { required: /Chcę pojechać/, forbidden: PL_WALK_VERB },
      be: { required: /хачу паехаць/i },
      uk: { required: /хочу поїхати/i },
    },
  },
  {
    name: '«поехать / едут» — поездка, не ходьба пешком',
    ru: RU_GO_BY_TRANSPORT,
    minEntries: 20,
    locales: { pl: { forbidden: PL_WALK_VERB } },
  },
  {
    name: '«очистить / очищен» — убрать содержимое, не «ясно»',
    ru: RU_CLEAR_WORD,
    minEntries: 20,
    locales: { pl: { forbidden: new RegExp(`(^|[^${PL_LETTER}])jasn`, 'i') } },
  },
  {
    name: '«квест» — в польском „quest” (#3372)',
    ru: RU_QUEST_WORD,
    minEntries: 380,
    locales: { pl: { required: PL_QUEST_WORD } },
  },
  {
    name: '«квест» без «задания», «игры» и «поиска» — не zadanie, misja, gra, poszukiwanie',
    ru: RU_QUEST_WORD,
    except: { ru: RU_TASK_GAME_SEARCH },
    minEntries: 300,
    locales: { pl: { forbidden: PL_QUEST_SUBSTITUTE } },
  },
  {
    name: '«Начать квест» — одна подпись у кнопки и у текста, который зовёт её нажать',
    ru: /начать квест/i,
    minEntries: 11,
    locales: { pl: { required: /Rozpocznij quest/ } },
  },
  {
    name: '«Мои поездки» — „Moje wycieczki”, как раздел „Wycieczki”',
    ru: RU_MY_TRIPS,
    minEntries: 9,
    locales: { pl: { required: /wyciecz/i, forbidden: /podróż|przejazd/i } },
  },
  {
    name: '«Мои путешествия» — „Moje podróże”, не wycieczki',
    ru: RU_MY_TRAVELS,
    minEntries: 14,
    locales: { pl: { required: /podróż/i, forbidden: /wyciecz/i } },
  },
  {
    name: '«точка» — в белорусском «кропка», не «пункт» (#3372)',
    ru: RU_POINT_WORD,
    except: { ru: RU_ITEM_WORD, keys: PRINT_PROVIDER_KEYS },
    minEntries: 300,
    locales: { be: { required: BE_POINT_WORD, forbidden: BE_ITEM_WORD } },
  },
  {
    name: '«приложение» — BE «дадатак», UK «застосунок» (#3372)',
    ru: RU_APP_WORD,
    minEntries: 50,
    locales: {
      be: { required: /дадат(ак|к)/i, forbidden: /прыкладанн|праграм/i },
      uk: { required: /застосун(ок|к)/i, forbidden: /додат(ок|к)|програм|застосуванн/i },
    },
  },
]

type Bundle = Record<string, Record<string, unknown>>

const entriesOf = (term: Term) =>
  Object.entries(resources.ru as unknown as Bundle).flatMap(([namespace, entries]) =>
    Object.entries(entries)
      .filter(
        ([key, value]) =>
          typeof value === 'string' &&
          term.ru.test(value) &&
          (!term.keys || term.keys.test(key)) &&
          !term.except?.ru?.test(value) &&
          !term.except?.keys?.test(key),
      )
      .map(([key]) => ({ namespace, key })),
  )

const localeCases = TERMS.flatMap((term) =>
  (Object.keys(term.locales) as Locale[]).map((locale) => ({ locale, term, name: term.name })),
)

describe('глоссарий терминов интерфейса (#2180, #2188, #2242, #2254, #3372)', () => {
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
    expect(RU_MAP_WORD.test('Слои карты')).toBe(true)
    expect(RU_MAP_WORD.test('Импорт в офлайн-карты')).toBe(true)
    expect(RU_MAP_WORD.test('Запасные карты памяти')).toBe(false)
    expect(RU_MAP_WORD.test('Карточки маршрутов')).toBe(false)
    expect(RU_MAP_WORD.test('Картинка не загрузилась')).toBe(false)
    expect(RU_CARD_WORD.test('Нажмите на карточку')).toBe(true)
    expect(RU_CARD_WORD.test('Нажмите на карту')).toBe(false)
    expect(RU_ZOOM_IN_WORD.test('Приблизить карту')).toBe(true)
    expect(RU_ZOOM_IN_WORD.test('Показана приблизительная линия')).toBe(false)
    expect(RU_ZOOM_OUT_WORD.test('Отдалить')).toBe(true)
    expect(RU_GO_BY_TRANSPORT.test('Не знаешь, куда поехать?')).toBe(true)
    expect(RU_GO_BY_TRANSPORT.test('{{count}} едут')).toBe(true)
    expect(RU_GO_BY_TRANSPORT.test('Переехать в другой город')).toBe(false)
    expect(RU_GO_BY_TRANSPORT.test('Едуны')).toBe(false)
    expect(RU_CLEAR_WORD.test('«Хочу поехать» очищен')).toBe(true)
    expect(RU_CLEAR_WORD.test('Очистить')).toBe(true)
    expect(PL_WALK_VERB.test('Nie wiesz gdzie iść?')).toBe(true)
    expect(PL_WALK_VERB.test('Chcę pojechać')).toBe(false)
    expect(PL_WALK_VERB.test('przyjść na spotkanie')).toBe(false)
    expect(RU_QUEST_WORD.test('Что входит в квест-бук')).toBe(true)
    expect(RU_TASK_GAME_SEARCH.test('Квест-комната — это платная игра')).toBe(true)
    expect(RU_TASK_GAME_SEARCH.test('Выиграйте приз')).toBe(false)
    expect(PL_QUEST_WORD.test('Recenzje o queście')).toBe(true)
    expect(PL_QUEST_SUBSTITUTE.test('Rozpocznij zadanie')).toBe(true)
    expect(PL_QUEST_SUBSTITUTE.test('Kontynuuj grę')).toBe(true)
    expect(PL_QUEST_SUBSTITUTE.test('Film z misji')).toBe(true)
    expect(PL_QUEST_SUBSTITUTE.test('Program questu')).toBe(false)
    expect(RU_MY_TRIPS.test('Поиск по моим поездкам')).toBe(true)
    expect(RU_MY_TRIPS.test('Организовать мою поездку')).toBe(false)
    expect(BE_ITEM_WORD.test('Удакладніце ў пункце')).toBe(true)
    expect(BE_ITEM_WORD.test('Кропкі маршруту')).toBe(false)
    expect(BE_POINT_WORD.test('На кожнай кропцы')).toBe(true)
  })

  it('шаблоны перевода различают карту, карточку и лист', () => {
    expect(PL_CARD_NOT_SHEET.test('Usuń kartę')).toBe(true)
    expect(PL_CARD_NOT_SHEET.test('Ładowanie danych karty')).toBe(true)
    expect(PL_CARD_NOT_SHEET.test('Nie udało się otworzyć kart.')).toBe(true)
    expect(PL_CARD_NOT_SHEET.test('zwykłą kartkę A4')).toBe(false)
    expect(PL_CARD_NOT_SHEET.test('na kartkach A4')).toBe(false)
    expect(PL_MAP_WORD.test('Pomniejsz mapę')).toBe(true)
    expect(UK_MAP_WORD.test('Шари карти')).toBe(true)
    expect(UK_MAP_WORD.test('Шари картки')).toBe(false)
    expect(UK_MAP_WORD.test('в офлайн-карти')).toBe(true)
    expect(BE_MAP_WORD.test('{{value1}} на карце')).toBe(true)
    expect(BE_MAP_WORD.test('Не ўдалося адкрыць Яндэкс')).toBe(false)
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

it.each(['ru', 'be', 'uk', 'pl', 'en'] as const)('uses the same wishlist name in common feedback and travel buttons: %s', (locale) => {
  const common = resources[locale].common as Record<string, string>
  const travel = resources[locale].travel as Record<string, string>
  const profile = resources[locale].profile as Record<string, string>
  const name = profile['components.profile.ProfileTabs.hochu_poehat_6d285e47']
  expect(common['feedback.favoriteAdded']).toBe(travel['components.travel.FavoriteButton.dobavleno_v_hochu_poehat_442a2566'])
  expect(common['feedback.favoriteRemoved']).toBe(travel['components.travel.FavoriteButton.udaleno_iz_hochu_poehat_3ea076cb'])
  for (const key of ['feedback.favoriteAdded', 'feedback.favoriteRemoved', 'feedback.favoriteError']) expect(common[key]).toContain(name)
  expect(common['feedback.favoriteAdded']).not.toMatch(/избранн|абран|обран|ulubion|favorites/i)
  expect(common['feedback.favoriteRemoved']).not.toMatch(/избранн|абран|обран|ulubion|favorites/i)
})

// Бренд пишется «MeTravel» во всех пяти локалях, включая SEO-заголовки (решение
// владельца 21.11.2026, #3372): до правки половина строк несла «Metravel».
// Адрес сайта, почта и хэндл названием не считаются: metravel.by, @metravelby.
const BRAND_MENTION = /(?<![@/.\w-])metravel(?![\w-]|\.by)/gi
// В польском имя склоняется: «Podróżuj MeTravelem».
const PL_DECLINED_BRAND = /(?<![@/.\w-])metravel(em|a|u|owi|ie)(?![\w-])/gi
// Заголовок видео набран прописными целиком — это оформление, а не написание бренда.
const BRAND_CAPS_KEYS = /^components\.about\.VideoCard\.metravel_o_metravel_by_/

it.each(['ru', 'be', 'uk', 'pl', 'en'] as const)('бренд пишется «MeTravel»: %s', (locale) => {
  const bundles = [resources[locale], ssgOnlyResources[locale]] as unknown as Bundle[]
  const violations = bundles.flatMap((bundle) =>
    Object.entries(bundle).flatMap(([namespace, entries]) =>
      Object.entries(entries).flatMap(([key, value]) => {
        if (typeof value !== 'string' || BRAND_CAPS_KEYS.test(key)) return []
        const mentions = [...(value.match(BRAND_MENTION) ?? []), ...(value.match(PL_DECLINED_BRAND) ?? [])]
        return mentions.some((mention) => !mention.startsWith('MeTravel')) ? [`${namespace}:${key} = ${JSON.stringify(value)}`] : []
      }),
    ),
  )
  expect(violations).toEqual([])
})
