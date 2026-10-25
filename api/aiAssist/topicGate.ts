/**
 * Фильтр тем ассистента (#2711): вопрос не о путешествиях не уходит ни в
 * подбор, ни в модель — посетитель получает вежливый отказ.
 *
 * Первый рубеж — явные признаки чужой темы на RU/BE/UK/PL/EN: рецепты,
 * программирование, политика, медицина, финансы, учёба, болтовня и попытки
 * переписать инструкции ассистента. Признаки поездки («в поход», «с детьми»,
 * «маршрут», город после предлога) снимают «мягкие» темы: «какую кашу взять в
 * поход» и «аптечка для поездки» остаются вопросами по теме. Попытки сломать
 * промпт и просьбы о коде поездкой не оправдываются.
 *
 * Второй рубеж — модель: промпт велит ей отвечать на чужую тему фразой отказа,
 * `isModelOffTopicReply` узнаёт эту фразу в ответе. Серверный `/ai/ask` (#2713)
 * повторяет эти же правила.
 */

export type OffTopicReason = 'injection' | 'coding' | 'cooking' | 'politics' | 'medicine' | 'finance' | 'study' | 'chitchat'

export type TopicVerdict = { offTopic: false } | { offTopic: true; reason: OffTopicReason }

// `\b` не знает кириллицы: начало слова — lookbehind по букве, основы ловят падежи.
const W = '(?<![\\p{L}\\p{N}])'
const re = (...parts: string[]): RegExp => new RegExp(`${W}(?:${parts.join('|')})`, 'iu')

/** Темы, которые признак поездки не оправдывает. */
const HARD_TOPICS: [OffTopicReason, RegExp][] = [
  [
    'injection',
    re(
      'игнорир\\p{L}*\\s+(?:вс\\p{L}*\\s+)?(?:предыдущ|прошл|свои|эти|инструкц|правил)',
      '(?<!не\\s)забудь\\p{L}*[,\\s]+(?:что|все|всё|свои|инструкц|правил|кто)',
      'системн\\p{L}*\\s+(?:промпт|подсказ|инструкц)',
      'ты\\s+(?:теперь|больше\\s+не)',
      'притворись',
      'режим\\s+разработчик',
      'ігнару\\p{L}*', 'забудзь\\p{L}*[,\\s]+(?:што|усё|свае|інструкц)', 'сістэмн\\p{L}*\\s+промпт',
      'ігнору\\p{L}*', 'забудь\\p{L}*[,\\s]+(?:що|все|свої|інструкц)', 'системн\\p{L}*\\s+промпт',
      'zignoruj', 'zapomnij[,\\s]+(?:że|o\\s+|wszystk|swoje|instrukc)', 'prompt\\p{L}*\\s+systemow', 'systemow\\p{L}*\\s+prompt',
      'ignore\\s+(?:all\\s+|the\\s+|your\\s+|any\\s+)?(?:previous|prior|above|earlier)', 'system\\s+prompt', 'you\\s+are\\s+now', 'jailbreak',
      'developer\\s+mode', 'pretend\\s+(?:to\\s+be|you)', 'dan(?![\\p{L}])',
    ),
  ],
  [
    'coding',
    re(
      'python', 'javascript', 'typescript', 'c\\+\\+', 'php(?![\\p{L}])', 'sql(?![\\p{L}])', 'html', 'css(?![\\p{L}])', 'json', 'regex',
      'программирова', 'програмува', 'праграмава', 'programow', 'programming', 'undefined\\s+is\\s+not', 'null\\s+pointer', 'stack\\s*trace', 'syntax\\s+error',
      'напиш\\p{L}*\\s+(?:мне\\s+)?(?:код|функци|скрипт|программ|запрос\\s+sql)',
      'напіш\\p{L}*\\s+(?:мне\\s+)?(?:код|функцы|скрыпт|праграм)',
      'напиш\\p{L}*\\s+(?:мені\\s+)?(?:код|функці|скрипт|програм)',
      'napisz\\s+(?:mi\\s+)?(?:kod|funkcj|skrypt|program)',
      'write\\s+(?:me\\s+)?(?:a\\s+|the\\s+)?(?:code|function|script|program)', 'взлом\\p{L}*',
      // «hack» сам по себе — ещё и «лайфхак» («travel hacks»): взлом — только с объектом.
      'hack(?:ing|er)?\\s+(?:into\\s+)?(?:a\\s+|the\\s+|my\\s+|someone)?\\p{L}*\\s*(?:account|password|wifi|wi-fi|phone|site|website|server)',
    ),
  ],
]

/** Темы, которые снимает признак поездки. */
const SOFT_TOPICS: [OffTopicReason, RegExp][] = [
  // «Java» — и язык, и остров: «Trip to Java» — вопрос о поездке.
  ['coding', re('java(?![\\p{L}])')],
  [
    'cooking',
    re(
      'рецепт', 'приготов', 'готовить', 'сварить', 'варить', 'испечь', 'запечь', 'пожарить', 'ингредиент',
      'рэцэпт', 'прыгатав', 'зварыць', 'гатаваць', 'спячы',
      'приготув', 'зварити', 'готувати', 'спекти',
      'przepis', 'ugotow', 'gotowa(?:ć|nie|nia|niu)(?![\\p{L}])', 'upiec', 'usmaż',
      'recipe', 'cook(?:ing)?(?![\\p{L}])', 'bake(?![\\p{L}])', 'boil(?![\\p{L}])',
    ),
  ],
  [
    'politics',
    re(
      'выбор\\p{L}*\\s+(?:президент|в\\s+парламент|депутат)', 'президент(?!ск)', 'парти[яиюей]', 'политик', 'политич', 'оппозиц', 'лукашенк', 'путин', 'зеленск', 'санкци',
      // «выбар»/«вибір» — ещё и «выбор»: только формы множественного «выборы».
      'выбар(?:ы|аў|ах|амі)(?![\\p{L}])', 'прэзідэнт', 'палітык', 'палітыч',
      'вибор(?:и|ів|ах|ами)(?![\\p{L}])', 'політик', 'політич',
      'wybor(?:y|ach)', 'prezydent(?!ow?\\p{L})', 'polityk', 'polityczn', 'partia', 'partii',
      'election', 'politic', 'president(?!ial)',
    ),
  ],
  [
    'medicine',
    re(
      'болит', 'болят', 'таблетк', 'лекарств', 'лечить', 'лечени', 'вылечить', 'диагноз', 'симптом', 'антибиотик', 'простуд', 'грипп', 'давлени\\p{L}*\\s+(?:высок|низк|поднял|упал)',
      'баліць', 'лекі', 'лячыць', 'лячэнн', 'прастуд',
      'болить', 'ліки', 'лікува', 'застуд',
      'boli(?![\\p{L}])', 'leki(?![\\p{L}])', 'lekarstw', 'leczy', 'leczeni', 'przeziębien', 'grypa', 'grypy',
      'headache', 'medicine', 'medication', 'treatment', 'symptom', 'flu(?![\\p{L}])', 'pills',
    ),
  ],
  [
    'finance',
    re(
      'курс\\p{L}*\\s+(?:доллар|евро|валют|рубл|злот)', 'биткоин', 'биткойн', 'криптовалют', 'инвестир', 'акци[ийя]\\s+(?:компани|apple|tesla)', 'ипотек', 'кредит',
      'біткоін', 'крыптавалют', 'біткоїн', 'криптовалют', 'інвест',
      'kurs\\s+(?:dolara|euro|walut)', 'kryptowalut', 'bitcoin', 'inwest',
      'exchange\\s+rate', 'crypto', 'invest', 'stock(?:s)?\\s+(?:market|price)',
    ),
  ],
  [
    'study',
    re(
      'реши\\p{L}*\\s+(?:уравнени|задач|пример)', 'уравнени', 'интеграл', 'производн\\p{L}*\\s+функци', 'сочинени', 'эссе', 'домашн\\p{L}*\\s+задани', 'реферат',
      'рашы\\p{L}*\\s+(?:раўнанн|задач)', 'раўнанн', 'сачыненн',
      'розв.?яж\\p{L}*', 'рівнянн', 'твір(?![\\p{L}])',
      'rozwiąż', 'równani', 'wypracowani',
      'solve', 'equation', 'essay', 'homework',
    ),
  ],
  [
    'chitchat',
    re(
      'анекдот', 'шутк', 'стих(?:и|ов|ам|ами|ах|отворени\\p{L}*)?(?![\\p{L}])', 'гороскоп', 'песн[юя]',
      'жарт', 'верш(?![\\p{L}])', 'вірш',
      'dowcip', 'kawał(?:y|ów)?(?![\\p{L}])', 'wiersz', 'horoskop',
      'joke', 'poem', 'horoscope',
    ),
  ],
]

/** Признаки поездки: слова о путешествии и «предлог + название места». */
const TRAVEL_SIGNAL_RE = re(
  'поезд', 'путешеств', 'маршрут', 'квест', 'квэст', 'поход', 'экскурс', 'музе', 'замок', 'замк', 'дворец', 'дворц', 'усадьб', 'парк', 'озер', 'озёр', 'гор[аыу](?![\\p{L}])',
  'отдых', 'отпуск', 'санатор', 'курорт', 'привал', 'пикник', 'кост[её]?р', 'адпачын', 'відпочин', 'выходн', 'туризм', 'турист', 'достопримеч', 'посмотреть', 'погулять', 'прогулк', 'съездить', 'поехать', 'ночев', 'отел', 'гостиниц', 'кемпинг',
  'виз[аыу](?![\\p{L}])', 'границ', 'аэропорт', 'с\\s+детьми', 'с\\s+ребенк', 'с\\s+ребёнк', 'в\\s+дорог', 'город', 'страна', 'стран[еуы]',
  'падарож', 'паездк', 'вандроўк', 'падарожж', 'подорож', 'поїздк', 'мандр',
  'podróż', 'wycieczk', 'zwiedz', 'szlak', 'wakacj', 'urlop', 'muzeum', 'zamek', 'zamk', 'sanatori',
  'travel', 'trip(?![\\p{L}])', 'hiking', 'hike', 'sightseeing', 'vacation', 'holiday', 'visit', 'museum', 'castle', 'route', 'hotel', 'resort',
)
/** Слово с большой буквы после предлога; вежливое «у Вас» местом не считается. */
const placeAfter = (prepositions: string): RegExp =>
  new RegExp(`(?<![\\p{L}])(?:${prepositions})\\s+(?!(?:Вас|Вам|Вами|Ваш\\p{L}*)(?![\\p{L}]))\\p{Lu}\\p{Ll}{2,}`, 'u')
/** Где: «в Кракове», «под Гродно», «w Gdańsku», «in Vilnius» — признак поездки. */
const PLACE_AFTER_PREPOSITION_RE = placeAfter('в|во|из|по|под|до|около|возле|у|ў|w|we|z|do|pod|in|to|from|near|around')
/**
 * О чём: «А про Брест?», «на Нарочи» — своё место уточнения, но не признак поездки:
 * «анекдот про Лукашенко» поездкой не становится.
 */
const PLACE_AFTER_TOPIC_PREPOSITION_RE = placeAfter('про|пра|о|об|на|nad|na|o|about')

/** Вопрос сам называет место с большой буквы: «А в Бресте?», «А про Брест?», «and in Riga?». */
export const mentionsPlace = (question: string): boolean =>
  PLACE_AFTER_PREPOSITION_RE.test(question) || PLACE_AFTER_TOPIC_PREPOSITION_RE.test(question)

export const hasTravelSignal = (question: string): boolean =>
  TRAVEL_SIGNAL_RE.test(question) || PLACE_AFTER_PREPOSITION_RE.test(question)

export function classifyQuestion(rawQuestion: string): TopicVerdict {
  const question = String(rawQuestion ?? '').replace(/\s+/g, ' ').trim()
  if (!question) return { offTopic: false }
  for (const [reason, pattern] of HARD_TOPICS) if (pattern.test(question)) return { offTopic: true, reason }
  const soft = SOFT_TOPICS.find(([, pattern]) => pattern.test(question))
  if (!soft || hasTravelSignal(question)) return { offTopic: false }
  return { offTopic: true, reason: soft[0] }
}

/**
 * Ответ модели — отказ «не по теме» (второй рубеж): модель представилась
 * ассистентом metravel.by и не дала ни одной ссылки на карточку.
 */
const MODEL_REFUSAL_RE =
  /(?:ассистент|асістэнт|асистент|asystent\p{L}*|assistant)\s+(?:сайта\s+)?metravel\.by|metravel\.by\s+(?:travel\s+)?assistant/iu
export const isModelOffTopicReply = (text: string, keptLinks: number): boolean =>
  keptLinks === 0 && MODEL_REFUSAL_RE.test(String(text ?? ''))
