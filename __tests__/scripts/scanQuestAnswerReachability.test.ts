// #1450: скан достижимости вариантов ответа в закрытых словарях `exact_any`.
//
// Скан существует ради ответа «недостижимых вариантов нет», поэтому его главный
// риск — тихо разойтись с рантаймом: `utils/questAdapters.normalize` получает
// новое правило, копия в `scripts/lib/questAnswerNormalize.js` — нет, и скан
// продолжает рапортовать зелёным о словаре, который игроку недоступен. Блок
// «паритет с рантаймом» падает ровно в этом случае.
const fs = require('fs')
const path = require('path')

const { normalizeRuntime, normalizeAnswer } = require('@/scripts/lib/questAnswerNormalize')
const {
  parseDictionary,
  mixedScriptWords,
  hasCaseFormGap,
  scanStep,
  scanQuests,
  findingKey,
  splitByBaseline,
} = require('@/scripts/scan-quest-answer-reachability')

import { buildAnswerChecker, normalize as runtimeNormalize } from '@/utils/questAdapters'

const dict = (variants: string[]) => ({ type: 'exact_any', value: JSON.stringify(variants) })
const step = (variants: string[], over: Record<string, unknown> = {}) => ({
  id: 1,
  step_id: 'x',
  answer_pattern: dict(variants),
  ...over,
})
const kinds = (variants: string[]) => scanStep(step(variants)).map((f: { kind: string }) => f.kind)

describe('паритет нормализации со средой выполнения', () => {
  // Корпус закрывает каждое правило рантайма плюс сами символы класса
  // пунктуации: если из класса выпадет символ, поведение разойдётся здесь.
  const corpus = [
    'Орёл',
    'ОРЕЛ',
    '  меч,   щит  ',
    'меч щит',
    'flеur de lis',
    'дом-музей',
    '«Пагоня»',
    '50\'',
    'что?!',
    'а.б,в;г:д!е?ж\'з„и"к"л–м—н-о',
    'ёжик',
    '',
    '   ',
    '-',
  ]

  it.each(corpus)('даёт тот же результат, что utils/questAdapters.normalize: %j', (value) => {
    expect(normalizeRuntime(value)).toBe(runtimeNormalize(value))
  })

  // Корпус проверяет то, о чём мы догадались. Новое правило в рантайме
  // («ў»→«у», скажем) корпус может не заметить, а эта сверка — заметит.
  const extractChain = (source: string, signature: string) => {
    const start = source.indexOf(signature)
    expect(start).toBeGreaterThan(-1)
    const body = source.slice(start + signature.length)
    const end = body.indexOf('\n}')
    // Любой вызов в цепочке, а не перечень известных имён: правило вида
    // `.normalize('NFKC')` или `.replaceAll(...)` тоже обязано разводить
    // рантайм и скан, иначе сверка зелёная при разошедшейся нормализации.
    // Точка с запятой — разница TS и CJS, а не правила нормализации.
    return (body.slice(0, end).match(/\.\w+\([^\n]*?\);?$/gm) || [])
      .map((call: string) => call.trim().replace(/;$/, ''))
  }

  const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8')

  it('сверяет сам список преобразований, а не только выборку значений', () => {
    const runtimeChain = extractChain(read('utils/questAdapters.ts'), 'export function normalize(s: string): string {')
    const scanChain = extractChain(read('scripts/lib/questAnswerNormalize.js'), 'function normalizeRuntime(s) {')

    expect(runtimeChain.length).toBeGreaterThanOrEqual(4)
    expect(scanChain).toEqual(runtimeChain)
  })

  it('видит правило любой формы, а не только известные имена методов', () => {
    // Белый список из `replace|toLowerCase|trim` пропустил бы `.normalize()` и
    // `.replaceAll()`, и сверка осталась бы зелёной при разошедшемся правиле.
    const synthetic = [
      'function normalizeRuntime(s) {',
      '  return s',
      "    .toLowerCase()",
      "    .normalize('NFKC')",
      "    .replaceAll('ў', 'у')",
      '    .trim()',
      '}',
    ].join('\n')

    expect(extractChain(synthetic, 'function normalizeRuntime(s) {')).toEqual([
      '.toLowerCase()',
      ".normalize('NFKC')",
      ".replaceAll('ў', 'у')",
      '.trim()',
    ])
  })

  it('терпит пустые поля бандла, которых у рантайма не бывает', () => {
    expect(normalizeAnswer(null)).toBe('')
    expect(normalizeAnswer(undefined)).toBe('')
    expect(normalizeAnswer(50)).toBe('50')
  })
})

describe('parseDictionary', () => {
  it('разбирает словарь из API (строка) и из локального *-quest-data.js (массив)', () => {
    expect(parseDictionary(dict(['мост', 'арка']))).toEqual(['мост', 'арка'])
    expect(parseDictionary({ type: 'exact_any', value: ['мост'] })).toEqual(['мост'])
  })

  it('битый или не-массивный словарь отдаёт null, а не падает', () => {
    expect(parseDictionary({ type: 'exact_any', value: '[не json' })).toBeNull()
    expect(parseDictionary({ type: 'exact_any', value: '"мост"' })).toBeNull()
  })

  it('нeсловарные типы не сканируются', () => {
    expect(parseDictionary({ type: 'any_text', value: '{"min_length":5}' })).toBeNull()
    expect(parseDictionary(null)).toBeNull()
  })
})

describe('scanStep — классы находок', () => {
  it('чистый словарь не даёт находок', () => {
    expect(scanStep(step(['мост', 'арка', 'переход']))).toEqual([])
  })

  it('вариант, пустой после нормализации, — рантайм его молча выбрасывает', () => {
    const findings = scanStep(step(['мост', '-']))
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ kind: 'empty_after_normalize', value: '-' })
  })

  it('дословный повтор и повтор после нормализации — разные классы', () => {
    expect(kinds(['орел', 'орел'])).toEqual(['duplicate_raw'])
    expect(kinds(['орел', 'орёл'])).toEqual(['duplicate_normalized'])
    expect(kinds(['меч, щит', 'меч щит'])).toEqual(['duplicate_normalized'])
    expect(kinds(['Замок', 'замок'])).toEqual(['duplicate_normalized'])
  })

  it('смешанные алфавиты внутри слова — реальный кейс шага 130 grodno-royal', () => {
    // Прод отдаёт «гадзiннiк» с латинской i (U+0069) вместо белорусской і (U+0456).
    const findings = scanStep(step(['часы', 'гадзiннiк', 'гадзинник']))
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ kind: 'mixed_script', value: 'гадзiннiк' })
    expect(findings[0].detail).toContain('i')
  })

  it('двуязычный вариант из разных слов подменой не считается', () => {
    expect(scanStep(step(['кафе Bar', 'zwykły', 'звыклы']))).toEqual([])
    expect(mixedScriptWords('кафе bar')).toEqual([])
    expect(mixedScriptWords('zwykłы')).toEqual(['zwykłы'])
  })

  it('дефисное соединение алфавитов подменой не считается — normalize срезает дефис, игрок нет', () => {
    // `normalizeAnswer('SPA-центр') === 'spaцентр'`, и если считать пробеги по
    // нормализованной строке, вводимая форма получает вердикт «набрать нельзя».
    expect(mixedScriptWords('SPA-центр')).toEqual([])
    expect(mixedScriptWords('XIX-го')).toEqual([])
    expect(scanStep(step(['SPA-центр']))).toEqual([])
  })

  it('шаг без единой вводимой формы отмечается отдельно и как blocker', () => {
    expect(kinds(['-', '.'])).toEqual(['empty_after_normalize', 'empty_after_normalize', 'step_unreachable'])
    expect(kinds(['гадзiннiк'])).toEqual(['mixed_script', 'step_unreachable'])
  })

  it('неразбираемый или пустой словарь делает шаг непроходимым', () => {
    expect(scanStep(step([], { answer_pattern: { type: 'exact_any', value: '[не json' } }))[0]).toMatchObject({
      kind: 'dictionary_unusable',
    })
    expect(scanStep(step([]))[0]).toMatchObject({ kind: 'dictionary_unusable', value: '[]' })
  })

  it('синтетический словарь со всеми классами сразу ловится целиком', () => {
    const findings = scanStep(step(['цэгла', '-', 'цэгла', 'цeгла']))
    expect(findings.map((f: { kind: string }) => f.kind).sort()).toEqual([
      'duplicate_raw',
      'empty_after_normalize',
      'mixed_script',
    ])
  })
})

describe('case_form_gap — вопрос в родительном падеже против словаря в именительном', () => {
  // Разбор прохождения 305 `yelnya-bog-bells`, шаг 791: «Какого она цвета?»,
  // словарь только в именительном — `коричневого` и `рыжего` отклонены, принят
  // `коричневый` с четвёртой попытки.
  const colourStep = (variants: string[], task = 'Подойди к воде и посмотри на неё. Какого она цвета?') =>
    step(variants, { task })

  it('ловит словарь, где родительного падежа нет ни в одном варианте', () => {
    const findings = scanStep(colourStep(['коричневый', 'коричневая', 'рыжая']))
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ kind: 'case_form_gap' })
  })

  it('не срабатывает, когда родительный падеж в словаре есть — в любом слове варианта', () => {
    expect(scanStep(colourStep(['коричневый', 'коричневого', 'рыжая']))).toEqual([])
    expect(scanStep(colourStep(['жёлтый', 'жёлтая', 'жёлтого цвета']))).toEqual([])
  })

  it('не трогает вопрос, где естественный ответ — существительное', () => {
    // «Из какого материала» тоже начинается с «какого», но требовать
    // «кирпичного» вместо «кирпич» бессмысленно.
    expect(scanStep(colourStep(['кирпич', 'кирпичный'], 'Из какого материала сложены стены форта?'))).toEqual([])
  })

  it('словарь без прилагательных пропуском падежа не считается', () => {
    expect(scanStep(colourStep(['золото', 'бирюза']))).toEqual([])
  })

  it('без текста задания класс не срабатывает', () => {
    expect(hasCaseFormGap({ task: undefined }, ['коричневый'])).toBe(false)
  })
})

describe('baseline — гейт падает на том, что принесла правка', () => {
  const finding = (over: Record<string, unknown> = {}) => ({
    kind: 'mixed_script',
    quest_id: 'q',
    step_id: 's',
    value: 'гадзiннiк',
    ...over,
  })

  it('ключ находки складывается из опознавательных признаков, а не из текста отчёта', () => {
    expect(findingKey(finding())).toBe('mixed_script|q|s|гадзiннiк')
  })

  it('известное отделяется от нового, а не глушится целиком', () => {
    const known = finding()
    const fresh = finding({ value: 'могiслаў' })
    const split = splitByBaseline([known, fresh], [findingKey(known)])

    expect(split.known).toEqual([known])
    expect(split.fresh).toEqual([fresh])
  })

  it('без записей baseline новыми считаются все находки', () => {
    const rows = [finding()]
    expect(splitByBaseline(rows, undefined).fresh).toEqual(rows)
  })
})

describe('scanQuests', () => {
  it('считает шаги и варианты, пропускает intro и несловарные типы, метит severity', () => {
    const quests = [
      {
        id: 7,
        quest_id: 'q',
        steps: [
          step(['-'], { id: 1, step_id: 'intro', is_intro: true }),
          step(['мост'], { id: 2, step_id: 'free', answer_pattern: { type: 'any_text', value: '{}' } }),
          step(['орел', 'орёл', '-'], { id: 3, step_id: 's3' }),
        ],
      },
    ]
    const { findings, scannedSteps, scannedVariants } = scanQuests(quests)

    expect(scannedSteps).toBe(1)
    expect(scannedVariants).toBe(3)
    expect(findings.map((f: { kind: string; severity: string }) => [f.kind, f.severity])).toEqual([
      ['duplicate_normalized', 'warning'],
      ['empty_after_normalize', 'blocker'],
    ])
    expect(findings[0]).toMatchObject({ quest_db_id: 7, quest_id: 'q', step_db_id: 3, step_id: 's3' })
  })
})

describe('доказательство рантаймом: находка mixed_script — это отказ игроку', () => {
  // Словарь скопирован из ответа прода `GET /api/quest-steps/130/` как есть.
  const PROD_STEP_130 = '["часы","часов","куранты","часы куранты","башенные часы","гадзiннiк","гадзинник","clock"]'

  it('белорусская форма с кириллической і отвергается, хотя ради неё вариант и заведён', () => {
    const check = buildAnswerChecker('exact_any', PROD_STEP_130)

    expect(check('гадзіннік')).toBe(false)      // U+0456 — то, что наберёт игрок
    expect(check('гадзiннiк')).toBe(true)       // U+0069 — то, что лежит в словаре
    expect(check('часы')).toBe(true)            // контроль на здоровой позиции
  })
})
