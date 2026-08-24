// #1536: скан пропусков составных форм вокруг второго написания.
//
// Скан существует ради ответа «пропусков нет», и оба его провала тихие:
// расширится свёртка написаний — начнёт склеивать разные слова и требовать
// бессмысленных форм; сузится — перестанет видеть класс и отчитается зелёным о
// словаре, который игрока не пускает. Поэтому здесь заперты обе границы
// `orthoStem`, позиция слова, вокруг которого собрана фраза, и связка находки с
// рантаймом: то, что скан называет пропуском, `buildAnswerChecker` обязан
// отклонять до правки и принимать после.
const {
  orthoStem,
  spellingSiblings,
  scanDictionary,
  scanStep,
  scanQuests,
  parseArgs,
  findingKey,
  splitByBaseline,
} = require('@/scripts/scan-quest-compound-spelling-gap')

import { buildAnswerChecker } from '@/utils/questAdapters'

const dict = (variants: string[]) => ({ type: 'exact_any', value: JSON.stringify(variants) })
const gaps = (variants: string[]): string[] => scanDictionary(variants).gaps.map((g: { missing: string }) => g.missing)

describe('orthoStem: свёртка написаний', () => {
  it.each([
    ['сад', 'садъ'],
    ['меч', 'мечь'],
    ['цеп', 'цепь'],
    ['сидит', 'сидить'],
    ['михаил', 'міхаіл'],
    ['калинина', 'калініна'],
    ['ленин', 'ленін'],
    ['мизинец', 'мізінец'],
    ['вера', 'вѣра'],
    ['федор', 'ѳедор'],
  ])('склеивает написания одного слова: %s ↔ %s', (a, b) => {
    expect(orthoStem(a)).toBe(orthoStem(b))
  })

  // Вторая граница: свёртка не должна ходить по гласным и по согласным внутри
  // слова, иначе в пару попадут разные слова и скан потребует форм, которых
  // никто не пишет.
  it.each([
    ['свислочь', 'свіслач'],
    ['мизинец', 'мезинец'],
    ['ленин', 'ленина'],
    ['меч', 'мяч'],
    ['сад', 'суд'],
  ])('оставляет разные слова разными: %s ≠ %s', (a, b) => {
    expect(orthoStem(a)).not.toBe(orthoStem(b))
  })

  it('снимает конечные ъ/ь, но не трогает их внутри слова', () => {
    expect(orthoStem('цепью')).toBe('цепью')
    expect(orthoStem('садъ')).toBe('сад')
  })
})

describe('spellingSiblings: пары написаний словаря', () => {
  it('находит пару и не выдумывает её на одиночках', () => {
    expect(spellingSiblings(['сад', 'садъ', 'парк'])).toEqual([['сад', 'садъ']])
    expect(spellingSiblings(['сад', 'парк', 'сквер'])).toEqual([])
  })
})

describe('scanDictionary: условие срабатывания', () => {
  // Все три пункта условия обязаны выполняться разом — иначе словарь молчит.
  it('молчит без пары написаний', () => {
    expect(scanDictionary(['сад', 'городской сад']).qualifies).toBe(false)
  })

  it('молчит без составной формы: пара написаний сама по себе не дефект', () => {
    expect(scanDictionary(['сад', 'садъ']).qualifies).toBe(false)
  })

  it('молчит, когда фраза собрана вокруг обоих написаний', () => {
    const scanned = scanDictionary(['сад', 'садъ', 'городской сад', 'городской садъ'])
    expect(scanned.qualifies).toBe(true)
    expect(scanned.gaps).toEqual([])
  })

  it('видит пропуск зеркальной формы — кейс арки брестского горсада', () => {
    expect(gaps(['сад', 'садъ', 'городской сад'])).toEqual(['городской садъ'])
  })

  it('зеркалит в обе стороны: фраза может стоять вокруг любого написания', () => {
    expect(gaps(['сад', 'садъ', 'городской садъ'])).toEqual(['городской сад'])
  })

  it('перечисляет каждую недостающую фразу отдельно', () => {
    expect(gaps(['калинина', 'калініна', 'имени калинина', 'им калинина']))
      .toEqual(['имени калініна', 'им калініна'])
  })

  // Граница класса: фраза, где спорное слово стоит НЕ последним, сканом не
  // ловится. Это осознанное сужение — «прилагательное + существительное» кладёт
  // существительное в конец, а обход любой позиции дал бы шум на порядок выше.
  it('смотрит только на последнее слово фразы', () => {
    expect(gaps(['меч', 'мечь', 'меч в руке'])).toEqual([])
  })

  it('сравнивает по нормализованным формам, а не по сырым записям', () => {
    // «Городской Сад» и «городской сад» — одна форма для рантайма, поэтому
    // регистр не должен рождать пропуск на пустом месте.
    expect(gaps(['Сад', 'Садъ', 'Городской Сад', 'городской садъ'])).toEqual([])
  })

  it('не спотыкается о пустой и неразбираемый словарь', () => {
    expect(scanDictionary([]).qualifies).toBe(false)
    expect(scanStep({ answer_pattern: { type: 'exact_any', value: 'не json' } }).findings).toEqual([])
  })
})

describe('scanQuests: числа отчёта', () => {
  const quest = (steps: unknown[]) => [{ id: 1, quest_id: 'q', steps }]

  it('делит подходящие словари на дефектные и контрольные', () => {
    const scanned = scanQuests(quest([
      { id: 1, step_id: 'gap', answer_pattern: dict(['сад', 'садъ', 'городской сад']) },
      { id: 2, step_id: 'clean', answer_pattern: dict(['сад', 'садъ', 'городской сад', 'городской садъ']) },
      { id: 3, step_id: 'out', answer_pattern: dict(['парк', 'городской парк']) },
    ]))
    expect({ pool: scanned.pool, defective: scanned.defective, clean: scanned.clean })
      .toEqual({ pool: 2, defective: 1, clean: 1 })
    expect(scanned.scannedSteps).toBe(3)
    expect(scanned.findings).toHaveLength(1)
    expect(scanned.findings[0]).toMatchObject({ step_db_id: 1, step_id: 'gap', value: 'городской садъ' })
  })

  // Широкий `pool` воспроизводит числа разового скана, но завышает контроль:
  // словарь без фразы вокруг спорного слова дефектным стать не мог. Отдельный
  // `atRisk` считает только те, что реально были под риском.
  it('отделяет реально рисковавшие словари от просто подходящих', () => {
    const scanned = scanQuests(quest([
      // пара есть, фраза есть, но кончается не на спорное слово — под риском не был
      { id: 1, step_id: 'safe', answer_pattern: dict(['меч', 'мечь', 'меч в руке']) },
      // фраза кончается на спорное слово — был под риском и зеркало на месте
      { id: 2, step_id: 'risked', answer_pattern: dict(['сад', 'садъ', 'городской сад', 'городской садъ']) },
    ]))
    expect({ pool: scanned.pool, atRisk: scanned.atRisk, defective: scanned.defective, clean: scanned.clean })
      .toEqual({ pool: 2, atRisk: 1, defective: 0, clean: 2 })
  })

  it('пропускает интро и словари других типов', () => {
    const scanned = scanQuests(quest([
      { id: 1, step_id: 'intro', is_intro: true, answer_pattern: dict(['сад', 'садъ', 'городской сад']) },
      { id: 2, step_id: 'free', answer_pattern: { type: 'any_text', value: '[]' } },
    ]))
    expect(scanned).toMatchObject({ scannedSteps: 0, pool: 0, defective: 0 })
  })
})

// Смысл находки: до правки рантайм фразу отклоняет, после — принимает. Если
// связка порвётся, скан начнёт требовать форм, которые ничего не чинят.
describe('связка с рантаймом', () => {
  const answer = 'Городской садъ'

  const checker = (variants: string[]) => buildAnswerChecker('exact_any', JSON.stringify(variants))

  it('найденная сканом форма — ровно та, что рантайм отклонял', () => {
    const before = ['сад', 'садъ', 'городской сад']
    const [missing] = gaps(before)
    expect(checker(before)(answer)).toBe(false)
    expect(checker([...before, missing])(answer)).toBe(true)
  })

  // Контроль на саму связку: если бы чекер собирался неверно, он отвечал бы
  // `false` на что угодно — и предыдущий тест был бы зелёным по случайности.
  it('чекер принимает форму, которая в словаре уже была', () => {
    expect(checker(['сад', 'садъ', 'городской сад'])('Городской сад')).toBe(true)
  })
})

// Выход для омографов: свёртка склеивает «цепь» и «цеп», но «цеп» — отдельное
// слово, и «якорная цеп» была бы несуществующей фразой. Без baseline у автора
// остаётся только выдумать её или выкинуть послабление из словаря.
describe('baseline: осознанное исключение', () => {
  const finding = { quest_id: 'hel-fishermen', step_id: 'hel-krzyz-rybakow', value: 'якорная цеп' }

  it('записанная находка не валит гейт, а новая — валит', () => {
    const fresh = { ...finding, value: 'корабельная цеп' }
    const split = splitByBaseline([finding, fresh], [findingKey(finding)])
    expect(split.known).toEqual([finding])
    expect(split.fresh).toEqual([fresh])
  })

  it('ключ различает шаг и форму, а не только квест', () => {
    expect(findingKey(finding)).not.toBe(findingKey({ ...finding, step_id: 'other' }))
    expect(findingKey(finding)).not.toBe(findingKey({ ...finding, value: 'корабельная цеп' }))
  })
})

describe('parseArgs', () => {
  it('читает источник, квест, baseline и формат вывода', () => {
    expect(parseArgs(['--source=scripts/x-quest-data.js', '--quest-id=minsk-cmok', '--baseline=scripts/b.json', '--json']))
      .toMatchObject({ source: 'scripts/x-quest-data.js', questId: 'minsk-cmok', baseline: 'scripts/b.json', json: true })
  })

  it('по умолчанию идёт в прод без baseline', () => {
    expect(parseArgs([])).toMatchObject({
      source: null, questId: null, baseline: null, updateBaseline: false, json: false,
      apiUrl: expect.stringContaining('metravel.by'),
    })
  })
})
