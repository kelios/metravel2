import { renderShown } from '../../../scripts/ai-assistant-eval/ask-path.mjs'
import { admitsNotInCards, detectLang, evaluateTurn, findInventedNumbers, ownProse, primaryLayer } from '../../../scripts/ai-assistant-eval/checks.mjs'

// #3277, пункт 5: автопроверки слоя модели. Раньше выдуманные цену, часы и длительность ловил только судья:
// страж вырезал число из показанного ответа, и ход проходил. Наблюдения — из прогона 12.11.2026
// (`.codex-temp/train-live/final/results.jsonl`) и замера #3268.

type Card = { n: number; type: 'quest' | 'travel'; title: string; url: string; snippet: string; group?: string }
const cmok: Card = {
  n: 1,
  type: 'quest',
  title: 'Квест по центру Минска: в поисках цмока',
  url: 'https://metravel.by/quests/4/minsk-cmok',
  snippet:
    'Городской квест по городу Минск (Беларусь). Возраст: 8–10 лет. Точек: 10. Длительность: 45 мин. Сложность: лёгкий. Маршрут пеший, около двух с половиной километров вдоль Свислочи. Часы работы кофейни: Пн–Пт 08:30–20:30. Билет в музей — 12 рублей',
}
const grodno: Card = { n: 2, type: 'quest', title: 'Квест по Гродно: королевский город над Неманом', url: 'https://metravel.by/quests/11/grodno-royal', snippet: 'Городской квест по городу Гродно (Беларусь). Можно с собакой. Гуляем от Старого замка к Новому' }

const observe = (raw: string, cards: Card[], extra: Record<string, unknown> = {}) => ({
  turnCreated: true,
  status: 'done',
  ...renderShown(raw, cards),
  sources: cards.map((item) => ({ type: item.type, id: String(item.n), title: item.title })),
  modelCall: { provider: 'ask', cards, text: raw, finishReason: 'stop', ms: 10 },
  ...extra,
})
const checksOf = (result: { failures: { check: string }[] }) => result.failures.map((failure) => failure.check)

describe('контур оценки: слой модели — числа сырого ответа сверяются с карточками подсказки (#3277)', () => {
  it('выдуманные длительность, цена, время суток, километры и возраст — провал invented_number слоя модели', () => {
    // Замер #3268, on14: длительности в карточке нет, модель назвала «120» и «150 минут» — автопроверка засчитывала 3 из 3.
    const duration = `[${grodno.title}](${grodno.url}) — городской квест, около 120 минут. Второй вариант — до 150 минут.`
    expect(findInventedNumbers({ question: 'Сколько длится квест по Гродно?' }, duration, [grodno])).toEqual(['120 минут', '150 минут'])
    const turn = evaluateTurn({ expect: 'answer', lang: 'ru', question: 'Сколько длится квест по Гродно?' }, observe(duration, [grodno]))
    expect(turn.failures).toContainEqual({ check: 'invented_number', layer: 'model', detail: 'числа «120 минут» нет в карточках подсказки (и ещё 1)' })
    expect(turn.metrics.inventedNumbers).toBe(2)
    expect(turn.pass).toBe(false)
    const question = 'Что за квест про цмока?'
    for (const [invented, raw] of [
      ['60 злотых', 'Билет стоит 60 злотых.'],
      ['2 часа', 'Идти около 2 часа.'],
      ['18:00', 'Старт в 18:00.'],
      ['4 км', 'Маршрут — 4 км пешком.'],
      ['6 лет', 'Подойдёт детям от 6 лет.'],
      ['12 точек', 'В квесте 12 точек.'],
    ]) {
      expect({ raw, invented: findInventedNumbers({ question }, `${raw} Подробности: [${cmok.title}](${cmok.url}).`, [cmok]) }).toEqual({ raw, invented: [invented] })
    }
  })

  it('число из карточки подсказки и из вопроса — не выдумка: цифрой, словами, диапазоном возраста, слитным словом', () => {
    const answer = `[${cmok.title}](${cmok.url}): 10 точек, около 45 мин, 2,5 км пешком, детям 8–10 лет — например, ребёнку 9 лет. Кофейня открыта с 08:30, билет в музей — 12 рублей.`
    expect(findInventedNumbers({ question: 'Что за квест про цмока?' }, answer, [cmok])).toEqual([])
    expect(evaluateTurn({ expect: 'answer', lang: 'ru', question: 'Что за квест про цмока?' }, observe(answer, [cmok])).failures).toEqual([])
    // Условие вопроса и прошлого вопроса диалога.
    expect(findInventedNumbers({ question: 'Квест не дольше 90 минут и до 3 км' }, 'За 90 минут и 3 км успеете.', [grodno])).toEqual([])
    expect(findInventedNumbers({ question: 'А какой из них?', earlier: 'Квест на полтора часа' }, 'В 90 минут укладывается первый.', [grodno])).toEqual([])
    for (const [asked, raw] of [
      ['Что выбрать, если с нами будет шестилетка?', 'Для ребёнка 6 лет квест сложноват.'],
      ['Їдемо з дев’ятирічним сином. Що там є для нього?', 'Дитині 9 років буде цікаво.'],
      ['Jedziemy z ośmiolatkiem', 'Dla dziecka 8 lat.'],
      ['We travel with a six-year-old', 'A 6 year old will enjoy it.'],
    ]) {
      expect({ asked, invented: findInventedNumbers({ question: asked }, raw, [grodno]) }).toEqual({ asked, invented: [] })
    }
    // Год и адрес — не число с единицей; без карточек и без вопроса проверка не считается.
    expect(findInventedNumbers({ question: 'Что нового?' }, 'В 2026 году маршрут обновили: https://metravel.by/quests/11/grodno-za-90-minut', [grodno])).toEqual([])
    expect(findInventedNumbers({ question: 'Что нового?' }, 'Идти 120 минут.', [])).toEqual([])
    expect(evaluateTurn({ expect: 'answer', lang: 'ru' }, observe(`Идти 120 минут: [${grodno.title}](${grodno.url}).`, [grodno])).failures).toEqual([])
  })

  it('число вырезано стражем из показанного ответа — ход всё равно не проходит: выдумала модель', () => {
    const raw = `Квест идёт 200 минут. Подойдёт [${cmok.title}](${cmok.url}).`
    const shown = `Подойдёт [${cmok.title}](${cmok.url}).`
    const turn = evaluateTurn({ expect: 'answer', lang: 'ru', question: 'Какой квест выбрать в Минске?' }, { ...observe(shown, [cmok]), modelCall: { provider: 'ask', cards: [cmok], text: raw, finishReason: 'stop', ms: 10 } })
    expect(checksOf(turn)).toEqual(['invented_number'])
    expect(primaryLayer(turn.failures)).toBe('model')
  })
})

describe('контур оценки: честное «в карточках этого не сказано» и язык по своим словам (#3277)', () => {
  it('lv42: ответ «карточки этого не говорят» на вопрос о сайте — признание, а не no_links', () => {
    // Показанный ответ прогона 12.11.2026 (lv42), вопрос о том, нужно ли приложение.
    const shown = 'The card data provided does not state whether these quests require an app or run in a browser. So based on what was found: there is no separate answer in these cards.'
    const turn = evaluateTurn({ expect: 'any_on_topic', lang: 'en', question: 'Do I need to install an app to play a quest, or does it run in the browser?' }, observe(shown, [cmok, grodno]))
    expect(turn.failures).toEqual([])
    for (const text of ['В карточках этого не сказано.', 'Про это в карточках не указано.', 'У картках гэтага не сказана.', 'У картках не вказано вікові обмеження.', 'Karty nie podają godzin otwarcia.', 'The cards do not state the price.', 'It is not mentioned in the cards.']) {
      expect({ text, admits: admitsNotInCards(text) }).toEqual({ text, admits: true })
    }
    for (const text of ['В карточках есть три квеста.', 'Выбирайте сами.', 'The cards list three quests.']) expect({ text, admits: admitsNotInCards(text) }).toEqual({ text, admits: false })
    // Ответ без ссылки и без признания по-прежнему no_links; вопрос, на который ждут ответ с карточкой, — тоже.
    const empty = evaluateTurn({ expect: 'any_on_topic', lang: 'ru', question: 'Нужно ли приложение?' }, observe('Квесты проходят в браузере, приложение ставить не нужно, достаточно телефона.', [cmok]))
    expect(checksOf(empty)).toEqual(['no_links'])
    const wanted = evaluateTurn({ expect: 'answer', lang: 'ru', question: 'Какие квесты есть в Минске?' }, observe('В карточках этого не сказано, уточните вопрос, пожалуйста, ещё раз.', [cmok]))
    expect(checksOf(wanted)).toEqual(['no_links'])
  })

  it('lv02: слова, переписанные из карточки, языком ответа не считаются; ответ не на том языке по-прежнему виден', () => {
    const linovo: Card = {
      n: 1,
      type: 'travel',
      title: 'Усадьба «Линово», дворец Потоцких и усадьба Пузынов',
      url: 'https://metravel.by/travels/usadba-linovo',
      snippet: 'Беларусь, Усадебный дом Трембицких в Линово / Сядзібны дом Трамбіцкіх у Лінаве. Дней: 1. Месяц: ноябрь. Дворцово-парковый комплекс Слацьвинских',
    }
    // Показанный ответ lv02: русский текст с белорусской подписью точки из карточки получал «язык ответа uk».
    const raw = `Для поездки из Минска на два дня с одной ночёвкой посмотрите:\n- [${linovo.title}](${linovo.url}) — статья с маршрутом: Усадебный дом Трембицких в Линово / Сядзібны дом Трамбіцкіх у Лінаве. Дней: 1.`
    expect(evaluateTurn({ expect: 'answer', lang: 'ru', question: 'Куда съездить из Минска на два дня?' }, observe(raw, [linovo])).failures).toEqual([])
    expect(ownProse('Сядзібны дом Трамбіцкіх у Лінаве — статья с маршрутом', [], [linovo]).trim()).toBe('у — статья с маршрутом')
    // lv47 и lv53 того же прогона — ответ действительно русский на украинский и белорусский вопрос: провал остаётся.
    const budapest: Card = { n: 1, type: 'travel', title: 'Будапешт в ноябре: четыре дня', url: 'https://metravel.by/travels/budapesht', snippet: 'Венгрия. Дней: 4. Месяц: ноябрь. В купальни с животными нельзя.', group: 'page' }
    const lv47 = `Статья [${budapest.title}](${budapest.url}) не содержит отдельного материала о поездке с ребёнком. Из того, что есть, можно посмотреть цены и правила.`
    expect(checksOf(evaluateTurn({ expect: 'answer', lang: 'uk', question: 'Чи підійде ця поїздка, якщо їхати з дитиною?' }, observe(lv47, [budapest])))).toEqual(['wrong_lang'])
    const hoian: Card = { n: 1, type: 'quest', title: 'Квэст по Хойану: порт трёх народов и фонарики над рекой', url: 'https://metravel.by/quests/228/hoian', snippet: 'Городской квест по городу Хойан (Вьетнам). Точек: 10. Длительность: 150 мин' }
    const lv53 = `На сайце пока нет материалов про Тайвань. Из того, что нашлось, можно посмотреть [${hoian.title}](${hoian.url}) — городской квест: 10 точек, около 150 мин.`
    expect(checksOf(evaluateTurn({ expect: 'no_material', lang: 'be', question: 'Ляцім на Тайвань на два тыдні. Ці ёсць у вас што-небудзь пра Тайбэй?' }, observe(lv53, [hoian])))).toEqual(['wrong_lang'])
    // Верный ответ на языке вопроса с русскими названиями — без провала.
    const uk = `Для поїздки з дитиною підійде [${budapest.title}](${budapest.url}) — у статті є поради щодо купалень і прогулянок містом.`
    expect(evaluateTurn({ expect: 'answer', lang: 'uk', question: 'Чи підійде ця поїздка, якщо їхати з дитиною?' }, observe(uk, [budapest])).failures).toEqual([])
  })

  it('замер r1: равный счёт по буквам решают признаки языка — lv46 (be с опечаткой) и lv29 (uk без «і», «ї», «є»)', () => {
    // Показанные ответы замера r1; оба получали «язык ответа ru».
    expect(detectLang('У картцы не пазначаны ўзровень гадин; каля 120 хв.')).toBe('be')
    expect(detectLang('Ось головне в горах взимку: У картках не вказано про катання на лижах.')).toBe('uk')
    const nesvizh: Card = { n: 1, type: 'quest', title: 'Квэст па Нясвіжы: палац Радзівілаў', url: 'https://metravel.by/be/quests/17/nesvizh-radziwill', snippet: 'Городской квест по городу Несвиж (Беларусь). Точек: 9. Длительность: 120 мин', group: 'page' }
    expect(evaluateTurn({ expect: 'answer', lang: 'be', question: 'Колькі часу зойме гэты квэст?' }, observe('У картцы не пазначаны ўзровень гадин; каля 120 хв.', [nesvizh])).failures).toEqual([])
    const winter: Card = { n: 1, type: 'travel', title: 'Куда поехать зимой из Кракова: Турбач, Крыница, Закопане, Дрезден', url: 'https://metravel.by/travels/kuda-poekhat-zimoi', snippet: 'Польша. Зимние маршруты из Кракова' }
    const lv29 = `Ось головне в горах взимку:\n- [${winter.title}](${winter.url})\nУ картках не вказано про катання на лижах.`
    expect(evaluateTurn({ expect: 'answer', lang: 'uk', question: 'Куди поїхати в гори взимку, якщо на лижах ми не катаємося?' }, observe(lv29, [winter])).failures).toEqual([])
    // Без признаков порядок прежний, а явный язык по-прежнему решают буквы.
    expect(detectLang('Посмотрите путеводитель по Кракову')).toBe('ru')
    expect(detectLang('Можно выбрать любой маршрут')).toBe('ru')
    expect(detectLang('Паглядзіце даведнік па Кракаве і квэст')).toBe('be')
    expect(detectLang('Подивіться путівник по Кракову і квест')).toBe('uk')
    // lv13 и lv53 того же замера — русский текст на белорусский вопрос: провал верный.
    expect(detectLang('На сайце пока нет материалов про Тайвань. Из того, что нашлось, можно посмотреть')).toBe('ru')
  })

  it('четвёртый заход: русский ответ из слов русской карточки на белорусский и украинский вопрос — `wrong_lang`, своих слов для этого не нужно', () => {
    const nesvizh: Card = { n: 1, type: 'quest', title: 'Квест по Несвижу: дворец Радзивиллов', url: 'https://metravel.by/quests/17/nesvizh-radziwill', snippet: 'Городской квест по городу Несвиж (Беларусь). Точек: 9. Длительность: 120 мин. Сложность: лёгкий' }
    // Ответ целиком из слов карточки: собственных слов нет, раньше язык у такого хода не проверялся.
    const copied = `[${nesvizh.title}](${nesvizh.url}) — городской квест по городу Несвиж (Беларусь): точек 9, длительность 120 мин, сложность лёгкий.`
    expect(ownProse('городской квест по городу Несвиж (Беларусь): точек 9, длительность 120 мин, сложность лёгкий.', [], [nesvizh]).trim().length).toBeLessThan(40)
    for (const [lang, question] of [['be', 'Колькі часу зойме квэст па Нясвіжы?'], ['uk', 'Скільки часу займе квест Несвіжем?']] as const) {
      expect({ lang, failures: evaluateTurn({ expect: 'answer', lang, question }, observe(copied, [nesvizh])).failures.map((item: { check: string }) => item.check) }).toEqual({ lang, failures: ['wrong_lang'] })
    }
    // Тот же ответ на русский вопрос верен; короткий белорусский ответ со словами карточки — тоже (lv46, r3).
    expect(evaluateTurn({ expect: 'answer', lang: 'ru', question: 'Сколько времени займёт квест по Несвижу?' }, observe(copied, [nesvizh])).failures).toEqual([])
    const be: Card = { ...nesvizh, title: 'Квэст па Нясвіжы: палац Радзівілаў', group: 'page' }
    expect(evaluateTurn({ expect: 'answer', lang: 'be', question: 'Колькі часу зойме гэты квэст?' }, observe('Гэта квест па Нясвіжы займе каля 120 хв.', [be])).failures).toEqual([])
    // Текста меньше порога — язык не судится, как раньше.
    expect(evaluateTurn({ expect: 'answer', lang: 'be', question: 'Колькі часу зойме гэты квэст?' }, observe('Около 120 мин.', [be])).failures).toEqual([])
  })

  it('третий заход, lv89: имена латиницей в кириллическом ответе язык не решают; английская фраза в нём по-прежнему видна', () => {
    // Запись справки дословно: латинских букв больше, чем кириллических, — и все они в именах.
    expect(detectLang('Да, приложение MeTravel есть для iPhone, iPad и Android — в App Store и Google Play. Оно бесплатное.')).toBe('ru')
    expect(detectLang('Так, дадатак MeTravel ёсць для iPhone, iPad і Android — у App Store і Google Play. Ён бясплатны.')).toBe('be')
    // Ответ по-английски на русский вопрос остаётся английским — и с кириллическим названием внутри.
    expect(detectLang('Yes, the MeTravel app is available for iPhone, iPad and Android.')).toBe('en')
    expect(detectLang('You can take the quest «Квест по Гродно» for free, there is nothing to pay or book in advance.')).toBe('en')
    expect(detectLang('Tak, aplikacja MeTravel jest dostępna na iPhone, iPad i Android.')).toBe('pl')
  })

  it('#3345: пустая подсказка — служба ответила запасной фразой без модели; это не сбой стенда', () => {
    const observed = { turnCreated: true, status: 'done', answerText: '', linkLabels: [], sources: [{ type: 'quest', id: '129', title: 'Детский квест по Варшаве' }], modelCall: null, fallback: true, promptEmpty: true }
    const honest = evaluateTurn({ expect: 'any_on_topic', lang: 'ru', question: 'Где погулять с собакой недалеко от Варшавы?' }, observed)
    expect(honest).toMatchObject({ pass: true, failures: [], metrics: { promptEmpty: true, answeredByModel: false } })
    expect(evaluateTurn({ expect: 'no_material', lang: 'ru', question: 'Где погулять с собакой?' }, observed).pass).toBe(true)
    // Ждали ответ с карточкой — провал подбора, а не модели.
    const wanted = evaluateTurn({ expect: 'answer', lang: 'ru', question: 'Где погулять с собакой недалеко от Варшавы?' }, observed)
    expect(wanted.failures).toEqual([{ check: 'empty_prompt', layer: 'retrieval', detail: 'ни одна найденная карточка не прошла отбор в подсказку' }])
    // Готовый ответ без вызова модели и без признака пустой подсказки — по-прежнему сбой стенда.
    expect(checksOf(evaluateTurn({ expect: 'answer', lang: 'ru' }, { ...observed, promptEmpty: false, fallback: false, answerText: 'ответ' }))).toEqual(['no_model_call'])
  })
})

describe('контур оценки: вопросы о сайте — ожидание help (#3293)', () => {
  const HELP = { type: 'help', id: '1', title: 'Сколько стоит пройти квест?', group: 'match' }
  const answer = 'Бесплатно. Покупать или бронировать ничего не нужно: выберите квест в каталоге и идите гулять.\n\nmetravel.by/quests'
  const direct = (extra: Record<string, unknown> = {}) => ({ turnCreated: true, status: 'done', answerText: answer, linkLabels: ['metravel.by/quests'], sources: [HELP, { type: 'help', id: '14', title: 'Сколько стоит печатный сценарий квеста?', group: 'nearby' }], modelCall: null, helpDirect: true, ...extra })
  const question = 'Сколько стоит пройти квест?'

  it('справка без модели: первой стоит справочная карточка, материалов нет — ход проходит и сбоем стенда не считается', () => {
    const turn = evaluateTurn({ expect: 'help', lang: 'ru', question }, direct())
    expect(turn).toMatchObject({ pass: true, failures: [], metrics: { helpDirect: true } })
    // Старые вопросы о сайте набора (lv38–lv42, ожидание any_on_topic) с таким ходом тоже проходят.
    expect(evaluateTurn({ expect: 'any_on_topic', lang: 'ru', question }, direct()).pass).toBe(true)
  })

  it('провалы: справка не первой, к справке добавлены статьи, пустой ответ, не тот язык, отказ «не по теме»', () => {
    const travel = { type: 'travel', id: '568', title: 'Краков: путеводитель по местам' }
    const checks = (observed: Record<string, unknown>, lang = 'ru') => checksOf(evaluateTurn({ expect: 'help', lang, question }, observed))
    expect(checks(direct({ sources: [travel, HELP] }))).toEqual(['no_help_card'])
    expect(checks(direct({ sources: [HELP, travel] }))).toEqual(['material_in_help'])
    expect(checks(direct({ answerText: '', linkLabels: [] }))).toEqual(['empty_help'])
    expect(checks(direct(), 'pl')).toEqual(['wrong_lang'])
    expect(checks({ turnCreated: true, status: 'off_topic', answerText: '', sources: [] })).toEqual(['false_offtopic'])
    // Ответ модели без ссылки и без справки в источниках — обычные провалы слоя модели и подбора.
    const cards: Card[] = [{ n: 1, type: 'quest', title: 'Квест по Желудку', url: 'https://metravel.by/quests/63/zheludok', snippet: 'Городской квест' }]
    const model = { turnCreated: true, status: 'done', answerText: 'Цены в карточках — в отдельных пунктах, смотрите источники ниже.', linkLabels: [], sources: [{ type: 'quest', id: '63', title: 'Квест по Желудку' }], modelCall: { provider: 'ask', cards, text: 'Цены в карточках — в отдельных пунктах, смотрите источники ниже.', finishReason: 'stop', ms: 5 } }
    expect(checks(model)).toEqual(['no_help_card', 'no_links'])
  })

  it('контрольный вопрос о поездке (`no_help`): справочная карточка среди источников — провал подбора', () => {
    const cards: Card[] = [{ n: 1, type: 'travel', title: 'Краков: путеводитель по местам', url: 'https://metravel.by/travels/krakow', snippet: 'Польша. Дней: 3' }]
    const raw = `Посмотрите [${cards[0].title}](${cards[0].url}).`
    const trip = observe(raw, cards)
    expect(evaluateTurn({ expect: 'answer', lang: 'ru', question: 'Что посмотреть в Кракове?', noHelp: true }, trip).failures).toEqual([])
    const leaked = { ...trip, sources: [...trip.sources, { type: 'help', id: '1', title: 'Сколько стоит пройти квест?' }] }
    expect(evaluateTurn({ expect: 'answer', lang: 'ru', question: 'Что посмотреть в Кракове?', noHelp: true }, leaked).failures).toEqual([{ check: 'help_card_leak', layer: 'retrieval', detail: 'вопрос о поездке получил справочную карточку' }])
    // Без пометки набора справка среди источников провалом не считается.
    expect(evaluateTurn({ expect: 'answer', lang: 'ru', question: 'Что посмотреть в Кракове?' }, leaked).failures).toEqual([])
  })
})

