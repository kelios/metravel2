// #1464: скан смешения алфавитов в видимом игроку тексте шага квеста.
//
// Скан существует ради ответа «смешанных слов нет», поэтому его два главных
// риска — разойтись с родственным сканом достижимости в том, ЧТО считается
// смешением (блок «общее определение смешения»), и потерять популяцию шагов,
// которую словарный скан законно не смотрит: интро и шаги с несловарным типом
// ответа (блок «популяция шагов шире словарного скана»).
const {
  scanStepText,
  scanQuests,
  parseArgs,
  contextAround,
  DEFAULT_FIELDS,
} = require('@/scripts/scan-quest-mixed-script-text')
const { mixedScriptWords: sharedMixedScriptWords } = require('@/scripts/lib/questScriptMixing')
const { mixedScriptWords: reachabilityMixedScriptWords } = require('@/scripts/scan-quest-answer-reachability')

type Finding = { field: string; word: string; confusables: string; context: string }

const words = (findings: Finding[]) => findings.map((f) => f.word)
const fields = (findings: Finding[]) => findings.map((f) => f.field)

describe('общее определение смешения', () => {
  // Определение вынесено в `scripts/lib/questScriptMixing.js` именно потому, что
  // две копии разошлись бы: один скан начал бы отчитываться «чисто» о том, что
  // другой считает дефектом. Тест падает, если словарный скан снова заведёт свою.
  it('словарный скан и текстовый скан считают смешение одной и той же функцией', () => {
    expect(reachabilityMixedScriptWords).toBe(sharedMixedScriptWords)
  })
})

describe('scanStepText — что считается смешением', () => {
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

  it('по умолчанию смотрит ровно пять видимых полей', () => {
    expect(DEFAULT_FIELDS).toEqual(['story', 'task', 'hint', 'title', 'location'])
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

describe('популяция шагов шире словарного скана', () => {
  // Словарный скан (#1450) пропускает `is_intro` и всё, что не `exact_any`, —
  // ему вне словаря смотреть не на что. Видимый текст есть у каждого шага.
  const quest = {
    id: 62,
    quest_id: 'belgrade-white-city',
    steps: [
      { id: 1, step_id: 'intro', is_intro: true, story: 'кальдрма, brusчатка старого Белграда' },
      { id: 2, step_id: 'free', answer_pattern: { type: 'any_text' }, title: 'память о морe' },
      { id: 3, step_id: 'dict', answer_pattern: { type: 'exact_any', value: '["ответ"]' }, hint: 'ищи Momчилова' },
      { id: 4, step_id: 'clean', story: 'обычный текст без подмен' },
    ],
  }

  it('сканирует интро и шаги с несловарным типом ответа', () => {
    const { findings, scannedSteps } = scanQuests([quest])
    expect(scannedSteps).toBe(4)
    expect(findings.map((f: { step_id: string }) => f.step_id)).toEqual(['intro', 'free', 'dict'])
  })

  it('к каждой находке прикладывает опознавательные признаки шага', () => {
    const { findings } = scanQuests([quest])
    expect(findings[0]).toMatchObject({
      quest_db_id: 62,
      quest_id: 'belgrade-white-city',
      step_db_id: 1,
      step_id: 'intro',
      field: 'story',
      word: 'brusчатка',
    })
  })

  it('квест без находок даёт пустой список, но шаги считает', () => {
    const clean = { id: 1, quest_id: 'q', steps: [{ id: 1, step_id: 's', story: 'чистый текст' }] }
    expect(scanQuests([clean])).toEqual({ findings: [], scannedSteps: 1 })
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
  // Тринадцать слов, снятых с прода 2026-08-18: слева форма, которая там лежала,
  // справа — та, на которую её заменили. Скан обязан ловить первую и молчать на
  // второй, иначе правка «закрыта» только на бумаге.
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
  ]

  it.each(CASES)('%s — старая форма ловится, новая проходит', (_label, before, after) => {
    expect(scanStepText({ story: before })).toHaveLength(1)
    expect(scanStepText({ story: after })).toEqual([])
  })
})
