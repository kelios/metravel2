// #1464: скан смешения алфавитов в видимом игроку тексте квеста.
//
// Скан существует ради ответа «смешанных слов нет», поэтому его два главных
// риска — разойтись с родственным сканом достижимости в том, ЧТО считается
// смешением (блок «общее определение смешения»), и недобрать текста, который
// игрок на самом деле читает (блок «textNodes — что вообще читает игрок»).
//
// Второй риск не теоретический: первая редакция скана обходила только
// `parseSteps(quest)`, а интро лежит в бандле ОТДЕЛЬНЫМ объектом `quest.intro`
// — 147 интро прода в отчёт не попадали, и живая находка «пройdём» в интро
// `bielsko-biala-cartoon-vienna` пряталась за «Смешанных слов нет». Поэтому
// фикстуры здесь повторяют реальную форму бандла, а не удобную.
const {
  scanQuests,
  textNodes,
  parseArgs,
  contextAround,
  DEFAULT_FIELDS,
  STEP_FIELDS,
  POI_FIELDS,
} = require('@/scripts/scan-quest-mixed-script-text')
const { mixedScriptWords: sharedMixedScriptWords } = require('@/scripts/lib/questScriptMixing')
const { mixedScriptWords: reachabilityMixedScriptWords } = require('@/scripts/scan-quest-answer-reachability')

type Finding = { field: string; word: string; confusables: string; context: string }

const words = (findings: Finding[]) => findings.map((f) => f.word)
const fields = (findings: Finding[]) => findings.map((f) => f.field)

// Все проверки идут через `scanQuests` — единственный путь, который исполняет
// сам прогон. Отдельного «просканируй один шаг» у скрипта намеренно нет: пока
// он был, корпусный регресс держал зелёным код, мимо которого прогон шёл.
const scanStepText = (step: Record<string, unknown>, fieldList?: string[]) =>
  scanQuests([{ quest_id: 'q', steps: [{ step_id: 's', ...step }] }], fieldList).findings

describe('общее определение смешения', () => {
  // Определение вынесено в `scripts/lib/questScriptMixing.js` именно потому, что
  // две копии разошлись бы: один скан начал бы отчитываться «чисто» о том, что
  // другой считает дефектом. Тест падает, если словарный скан снова заведёт свою.
  it('словарный скан и текстовый скан считают смешение одной и той же функцией', () => {
    expect(reachabilityMixedScriptWords).toBe(sharedMixedScriptWords)
  })
})

describe('что считается смешением', () => {
  it('ловит подменённую букву в каждом видимом поле', () => {
    const step = {
      story: 'кальдрма, brusчатка старого Белграда',
      task: 'дойди до площади Луža',
      hint: 'ищи табличку Momчилова',
      title: 'память о морe',
      location: 'площадь Луža',
    }
    expect(fields(scanStepText(step))).toEqual(['story', 'task', 'hint', 'title', 'location'])
    expect(words(scanStepText(step))).toEqual(['brusчатка', 'Луža', 'Momчилова', 'морe', 'Луža'])
  })

  it('двуязычная запись из РАЗНЫХ слов смешением не считается', () => {
    expect(scanStepText({ story: 'кафе Bar на улице Skadarska, дворец Palača Sponza' })).toEqual([])
    expect(scanStepText({ location: 'Церковь святого Влаха (Crkva sv. Vlaha)' })).toEqual([])
  })

  it('дефисное соединение алфавитов смешением не считается — читателю оно не мешает', () => {
    expect(scanStepText({ story: 'SPA-центр рядом, XIX-го века' })).toEqual([])
  })

  it('находит все вхождения, а не только первое', () => {
    expect(words(scanStepText({ story: 'площадь Луža и снова Луža' }))).toEqual(['Луža', 'Луža'])
  })

  it('пустые и отсутствующие поля не ломают скан', () => {
    expect(scanStepText({})).toEqual([])
    expect(scanStepText({ story: null, task: undefined, hint: '', title: 0 })).toEqual([])
  })

  it('поля сканируются только перечисленные', () => {
    const step = { story: 'brusчатка', title: 'морe' }
    expect(words(scanStepText(step, ['title']))).toEqual(['морe'])
  })

  it('находки шага несут scope «step», а не квестовый', () => {
    expect(scanStepText({ story: 'brusчатка' })[0]).toMatchObject({ scope: 'step', step_id: 's', field: 'story' })
  })

  it('поля шага — ровно пять видимых', () => {
    expect(STEP_FIELDS).toEqual(['story', 'task', 'hint', 'title', 'location'])
  })

  it('к полям шага добавлены проза poi_info и текст финала — их игрок тоже читает', () => {
    expect(DEFAULT_FIELDS).toEqual([
      'story', 'task', 'hint', 'title', 'location',
      'poi_info.opening_hours', 'poi_info.ticket_price',
      'finale',
    ])
    expect(POI_FIELDS).toEqual(['opening_hours', 'ticket_price'])
  })
})

describe('буквы чужого алфавита в отчёте', () => {
  // Подменённую букву глазами не видно, поэтому отчёт обязан назвать её отдельно.
  it('называет алфавит-меньшинство, а не всё слово', () => {
    expect(scanStepText({ title: 'память о морe' })[0].confusables).toBe('e')
    expect(scanStepText({ story: 'площадь Луža' })[0].confusables).toBe('ža')
    expect(scanStepText({ story: 'один representативнее другого' })[0].confusables).toBe('ативне')
  })
})

describe('контекст находки', () => {
  it('показывает фразу вокруг слова и схлопывает переносы', () => {
    const context = contextAround('Пройдись по мощёной улочке — кальдрма,\nbrusчатка старого Белграда', 'brusчатка')
    expect(context).toContain('brusчатка')
    expect(context).toContain('кальдрма')
    expect(context).not.toContain('\n')
  })

  it('короткое поле показывает целиком, без многоточий', () => {
    expect(contextAround('площадь Луža', 'Луža')).toBe('площадь Луža')
  })

  it('слова нет в тексте — контекста нет', () => {
    expect(contextAround('площадь Лужа', 'Луža')).toBe('')
  })
})

describe('textNodes — что вообще читает игрок', () => {
  // Форма бандла снята с `GET /api/quests/by-quest-id/{id}/` и с локального
  // `scripts/<city>-quest-data.js`: интро и финал — СОСЕДИ `steps`, а не его
  // элементы. Тест на удобной форме `steps:[{is_intro:true}]` был бы зелёным
  // ровно на том пути, который в проде не выполняется.
  const quest = {
    id: 121,
    quest_id: 'bielsko-biala-cartoon-vienna',
    title: 'Бельско-Бяла: маленькая Вена',
    intro: { id: 1174, step_id: 'intro', story: 'Мы пройdём оба берега' },
    steps: [
      { id: 2, step_id: 'free', answer_pattern: { type: 'any_text' }, title: 'память о морe' },
      { id: 3, step_id: 'dict', answer_pattern: { type: 'exact_any', value: '["ответ"]' }, hint: 'ищи Momчилова' },
      { id: 4, step_id: 'clean', story: 'обычный текст без подмен' },
    ],
    finale: { text: 'Готово — ты прошёл оба берега' },
  }

  it('собирает узлы в порядке чтения: квест → интро → шаги → финал', () => {
    expect(textNodes(quest).map((n: { scope: string; field: string }) => `${n.scope}.${n.field}`)).toEqual([
      'quest.title',
      'intro.story',
      'step.title',
      'step.hint',
      'step.story',
      'quest.finale',
    ])
    // Порядок именно такой, потому что игрок читает квест сверху вниз: имя →
    // интро → шаги по порядку → финал. Отчёт скана идёт тем же порядком.
  })

  it('пустые и отсутствующие узлы в обход не попадают', () => {
    const bare = { quest_id: 'q', title: '', intro: null, steps: [{ step_id: 's', story: 'текст' }], finale: null }
    expect(textNodes(bare)).toHaveLength(1)
  })

  it('интро сканируется — на этом ловилась первая редакция скана', () => {
    const { findings } = scanQuests([quest])
    expect(findings.map((f: { scope: string; word: string }) => [f.scope, f.word])).toEqual([
      ['intro', 'пройdём'],
      ['step', 'морe'],
      ['step', 'Momчилова'],
    ])
  })

  it('находка интро несёт признаки интро, а не первого шага', () => {
    const { findings } = scanQuests([quest])
    expect(findings[0]).toMatchObject({
      quest_db_id: 121,
      quest_id: 'bielsko-biala-cartoon-vienna',
      scope: 'intro',
      step_db_id: 1174,
      step_id: 'intro',
      field: 'story',
      word: 'пройdём',
    })
  })

  it('заголовок квеста и текст финала сканируются как квестовые, без step_id', () => {
    const dirty = { id: 7, quest_id: 'q', title: 'память о морe', steps: [], finale: { text: 'кальдрма, brusчатка' } }
    const { findings } = scanQuests([dirty])
    expect(findings.map((f: { scope: string; field: string; step_id: null }) => [f.scope, f.field, f.step_id])).toEqual([
      ['quest', 'title', null],
      ['quest', 'finale', null],
    ])
  })

  it('финал читается в ОБЕИХ формах — `text` и `story`', () => {
    // `scripts/sync-quest-to-prod.js` заливает на прод `finale.text || finale.story`,
    // поэтому обе формы одинаково доходят до игрока. Пять локальных квестов
    // (`hel-fishermen`, `chisinau-white-stone`, …) держат именно `story`.
    const asText = { quest_id: 'q', steps: [], finale: { title: 'Финал', text: 'кальдрма, brusчатка' } }
    const asStory = { quest_id: 'q', steps: [], finale: { title: 'Финал', story: 'кальдрма, brusчатка' } }
    expect(words(scanQuests([asText]).findings)).toEqual(['brusчатка'])
    expect(words(scanQuests([asStory]).findings)).toEqual(['brusчатка'])
  })

  it('`finale.title` не сканируется — в прод-сериализатор финала он не попадает', () => {
    const titled = { quest_id: 'q', steps: [], finale: { title: 'память о морe', text: 'чистый текст' } }
    expect(scanQuests([titled]).findings).toEqual([])
  })

  it('проза poi_info читается — и под ключом `poi_info`, и под `poiInfo`', () => {
    // `scripts/sync-quest-to-prod.js:69` шлёт на прод `s.poi_info || s.poiInfo`,
    // поэтому обе формы ключа одинаково доходят до игрока.
    const poi = { is_museum: true, opening_hours: 'вт-вс 10:00–18:00, brusчатка', ticket_price: 'память о морe' }
    const snake = { quest_id: 'q', steps: [{ step_id: 's', poi_info: poi }] }
    const camel = { quest_id: 'q', steps: [{ step_id: 's', poiInfo: poi }] }
    const seen = (quest: unknown) => scanQuests([quest]).findings.map((f: Finding) => [f.field, f.word])
    expect(seen(snake)).toEqual([['poi_info.opening_hours', 'brusчатка'], ['poi_info.ticket_price', 'морe']])
    expect(seen(camel)).toEqual(seen(snake))
  })

  it('`website` и `is_museum` внутри poi_info не сканируются — это не проза', () => {
    // Смешанный алфавит в URL ломает саму ссылку: другой класс дефекта, другой контроль.
    const quest = { quest_id: 'q', steps: [{ step_id: 's', poi_info: { is_museum: true, website: 'https://muzeум.pl' } }] }
    expect(scanQuests([quest]).findings).toEqual([])
  })

  it('poi_info интро читается наравне с шаговым', () => {
    const quest = { quest_id: 'q', intro: { step_id: 'intro', poi_info: { ticket_price: 'память о морe' } }, steps: [] }
    expect(scanQuests([quest]).findings.map((f: Finding & { scope: string }) => [f.scope, f.field])).toEqual([
      ['intro', 'poi_info.ticket_price'],
    ])
  })

  it('считает текстовые узлы, а не шаги — счётчик не должен прятать необойдённое', () => {
    const clean = { id: 1, quest_id: 'q', title: 'заголовок', steps: [{ id: 1, step_id: 's', story: 'чистый текст' }] }
    expect(scanQuests([clean])).toEqual({ findings: [], scannedNodes: 2 })
  })

  it('фильтр --fields режет и квестовые узлы тоже', () => {
    const dirty = { id: 7, quest_id: 'q', title: 'память о морe', steps: [], finale: { text: 'brusчатка' } }
    expect(words(scanQuests([dirty], ['finale']).findings)).toEqual(['brusчатка'])
  })

  it('шаги в бандле лежат строкой JSON — так их отдаёт часть источников', () => {
    const packed = { id: 1, quest_id: 'q', steps: JSON.stringify([{ id: 9, step_id: 's', title: 'память о морe' }]) }
    expect(words(scanQuests([packed]).findings)).toEqual(['морe'])
  })
})

describe('parseArgs', () => {
  it('по умолчанию берёт прод и все видимые поля', () => {
    const args = parseArgs([])
    expect(args.fields).toEqual(DEFAULT_FIELDS)
    expect(args.source).toBeNull()
    expect(args.questId).toBeNull()
    expect(args.json).toBe(false)
  })

  it('читает источник, квест, поля и json', () => {
    const args = parseArgs(['--source=scripts/belgrade-quest-data.js', '--quest-id=belgrade-white-city', '--fields=story,title', '--json'])
    expect(args).toMatchObject({
      source: 'scripts/belgrade-quest-data.js',
      questId: 'belgrade-white-city',
      fields: ['story', 'title'],
      json: true,
    })
  })

  it('неизвестное поле — ошибка, а не тихий пропуск проверки', () => {
    expect(() => parseArgs(['--fields=answer_pattern'])).toThrow(/answer_pattern/)
  })
})

describe('корпус прода до правки #1464', () => {
  // Одиннадцать различных форм, покрывающих все 14 слов, снятых с прода
  // 2026-08-18 (пять вхождений «Луža» дают одну форму): слева то, что там
  // лежало, справа — то, на что заменили. Скан обязан ловить первую и молчать
  // на второй, иначе правка «закрыта» только на бумаге. Последняя строка —
  // интро, найденное только после расширения обхода на `quest.intro`.
  const CASES: Array<[string, string, string]> = [
    ['pakocim-voices/1-herb', 'рыцарь по прозвищу Dołęга из засады', 'рыцарь по прозвищу Dołęga из засады'],
    ['porto-port-wine/5-se-catedral story', 'площадь Террейру-да-Сé', 'площадь Террейру-да-Се'],
    ['porto-port-wine/5-se-catedral title', 'Собор Сé — крепость', 'Собор Се — крепость'],
    ['dubrovnik-libertas/5-orlando-column', 'на площадь Луža — политическое сердце', 'на площадь Лужа — политическое сердце'],
    ['dubrovnik-libertas location', 'Дворец Спонца (Palača Sponza), площадь Луža', 'Дворец Спонца (Palača Sponza), площадь Лужа'],
    ['belgrade-white-city/1-skadarlija', 'кальдрма, brusчатка старого Белграда', 'кальдрма, брусчатка старого Белграда'],
    ['belgrade-white-city/3-knez-mihailova', 'один representативнее другого', 'один репрезентативнее другого'],
    ['sofia-serdica-underfoot/4-mineral-baths', 'болгарина Петко Momчилова', 'болгарина Петко Момчилова'],
    ['kazimierz-dolny-kogut/6-gora-trzech-krzyzy', 'Гора Трёх Крестов — память о морe', 'Гора Трёх Крестов — память о море'],
    ['venice-lion-of-saint-mark/11-gobbo-di-rialto', 'работа Пьетро да Салó, 1541 год', 'работа Пьетро да Сало, 1541 год'],
    ['bielsko-biala-cartoon-vienna/intro', 'Мы пройdём оба берега', 'Мы пройдём оба берега'],
  ]

  it.each(CASES)('%s — старая форма ловится, новая проходит', (_label, before, after) => {
    expect(scanStepText({ story: before })).toHaveLength(1)
    expect(scanStepText({ story: after })).toEqual([])
  })

  it('тот же корпус в интро и в финале — поверхности, добавленные после ревью', () => {
    for (const [, before, after] of CASES) {
      expect(words(scanQuests([{ quest_id: 'q', intro: { step_id: 'intro', story: before }, steps: [] }]).findings)).toHaveLength(1)
      expect(scanQuests([{ quest_id: 'q', intro: { step_id: 'intro', story: after }, steps: [] }]).findings).toEqual([])
      expect(words(scanQuests([{ quest_id: 'q', steps: [], finale: { story: before } }]).findings)).toHaveLength(1)
      expect(scanQuests([{ quest_id: 'q', steps: [], finale: { story: after } }]).findings).toEqual([])
    }
  })
})
