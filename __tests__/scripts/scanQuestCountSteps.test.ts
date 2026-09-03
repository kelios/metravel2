// #1718: скан счётного шага без границы счёта — правило авторинга 4b.
//
// Кейс: `minsk-teens-oktyabrskaya / 9-amigos` спрашивал «сколько жёлтых
// персонажей на стене» при `range {min:2,max:4}`. Границы счёта задание не
// задавало вовсе, игрок честно насчитал у стены 6, перебрал 5, 7, 8 и прошёл
// шаг числом 3 — задание засчитало ответ, которого игрок не видел.
//
// Три способа для инструмента тихо стать бесполезным, и все три закрыты здесь:
//
//   1. Искать границу счёта в подсказке. Подсказка открывается только после
//      ДВУХ неверных попыток — к этому моменту игрок уже дважды не угадал, что
//      именно считать. Граница обязана быть в `task`.
//   2. Считать границей любое уточнение. «Обойди кругом» и «отойди подальше»
//      говорят, ОТКУДА смотреть, и на вопрос «что идёт в счёт» не отвечают.
//   3. Уронить порог до span 1. `5..6` и `2..3` — два варианта, правило 4b их
//      не трогает, и находки там были бы шумом на всю базу.
const {
  BOUNDARY_MARKERS,
  answerSpan,
  hasCountBoundary,
  inspectStep,
  scanQuests,
  findingKeys,
} = require('@/scripts/scan-quest-count-steps')

const range = (min: number, max: number) => ({ type: 'range', value: JSON.stringify({ min, max }) })

const step = (over: Record<string, unknown> = {}) => ({
  id: 1,
  step_id: 'x',
  task: 'Сосчитай колонны. Сколько их?',
  answer_pattern: range(3, 5),
  ...over,
})

const quest = (steps: unknown[]) => [{ id: 116, quest_id: 'q', steps }]

describe('answerSpan — ширина принимаемого диапазона', () => {
  it('range считается как max - min', () => {
    expect(answerSpan(range(3, 5))).toBe(2)
    expect(answerSpan(range(5, 6))).toBe(1)
    expect(answerSpan(range(4, 4))).toBe(0)
  })

  it('any_number принимает любое число — ширина бесконечна', () => {
    expect(answerSpan({ type: 'any_number', value: '' })).toBe(Infinity)
  })

  it('нечисловые типы ответа шириной не обладают', () => {
    expect(answerSpan({ type: 'exact_any', value: JSON.stringify(['мост']) })).toBeNull()
    expect(answerSpan({ type: 'any_text', value: JSON.stringify({ min_length: 10 }) })).toBeNull()
    expect(answerSpan(null)).toBeNull()
    expect(answerSpan({ type: 'range', value: 'не json' })).toBeNull()
  })
})

describe('hasCountBoundary — что считается названной границей', () => {
  it.each([
    ['исключение через «только»', 'Сосчитай только целые колонны под перекладиной.'],
    ['исключение через «в счёт не идут»', 'Сосчитай фигуры. Колонны в счёт не идут.'],
    ['исключение через «не считай»', 'Посчитай фигуры в нишах, медальоны не считай.'],
    ['исключение через «без»', 'Посчитай купола главного объёма, БЕЗ колокольни.'],
    ['включение через «считая»', 'Посчитай этажи, считая первый.'],
    ['включение через «вместе с»', 'Посчитай купола вместе с главкой колокольни.'],
  ])('%s', (_name, task) => {
    expect(hasCountBoundary(task)).toBe(true)
  })

  // Указание, ОТКУДА смотреть, границей счёта не является: именно так были
  // сформулированы шаги 483, 443 и 638, и именно они остались нерешёнными.
  it.each([
    'Обойди башню и сосчитай её циферблаты. Сколько их всего?',
    'Отойди подальше, чтобы видеть всю крышу разом, и сосчитай купола.',
    'Посмотри на верхнюю часть башни: по её углам стоят маленькие башенки. Сколько их?',
  ])('«%s» границей счёта не считается', (task) => {
    expect(hasCountBoundary(task)).toBe(false)
  })

  it('маркеры ищутся без учёта регистра и в неразрывном пробеле', () => {
    expect(hasCountBoundary('Считай ТОЛЬКО фигуры.')).toBe(true)
    expect(hasCountBoundary('Считай только фигуры.')).toBe(true)
  })

  it('список маркеров непустой и без дублей — иначе скан молча ослабнет', () => {
    expect(BOUNDARY_MARKERS.length).toBeGreaterThan(0)
    expect(new Set(BOUNDARY_MARKERS).size).toBe(BOUNDARY_MARKERS.length)
  })
})

describe('inspectStep — критерий находки', () => {
  it('счётный шаг с широким диапазоном и без границы — находка', () => {
    expect(inspectStep(step({ answer_pattern: range(2, 4) }))).toMatchObject({ answer_type: 'range', span: 2 })
  })

  it('эталон из одного числа находкой не является — перебирать нечего', () => {
    expect(inspectStep(step({ answer_pattern: range(3, 3) }))).toBeNull()
  })

  // Порог: два принимаемых значения правило 4b не трогает (шаги 449 и 251).
  it('span 1 ниже порога', () => {
    expect(inspectStep(step({ answer_pattern: range(5, 6) }))).toBeNull()
  })

  it('any_number без границы — находка: эталона у шага нет вовсе', () => {
    expect(inspectStep(step({ answer_pattern: { type: 'any_number', value: '' } }))).toMatchObject({
      span: 'any_number',
    })
  })

  it('граница в задании закрывает находку', () => {
    expect(inspectStep(step({ task: 'Сосчитай только целые колонны. Сколько их?' }))).toBeNull()
  })

  // Главный контур: подсказка открывается после двух неверных попыток, то есть
  // слишком поздно. Так была устроена почти вся выборка свипа #1718.
  it('граница в подсказке находку НЕ закрывает', () => {
    expect(inspectStep(step({ hint: 'Считай только целые колонны — обломки не в счёт.' }))).not.toBeNull()
  })

  it('несчётное задание не разбирается, даже с широким диапазоном', () => {
    expect(inspectStep(step({ task: 'Введи год на табличке.', answer_pattern: range(1900, 1910) }))).toBeNull()
  })

  it.each(['Сколько их?', 'Сосчитай колонны.', 'Посчитай купола.', 'Пересчитай стулья.'])(
    'счётная формулировка «%s» распознаётся',
    (task) => {
      expect(inspectStep(step({ task, answer_pattern: range(2, 4) }))).not.toBeNull()
    },
  )

  it('интро не разбирается', () => {
    expect(inspectStep(step({ is_intro: true, answer_pattern: range(2, 4) }))).toBeNull()
  })
})

describe('scanQuests и ключи allow-файла', () => {
  it('находка несёт адрес шага и текст задания', () => {
    const { findings, scannedSteps } = scanQuests(
      quest([step({ id: 1135, step_id: '9-amigos', answer_pattern: range(2, 4) })]),
    )
    expect(scannedSteps).toBe(1)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ quest_id: 'q', step_db_id: 1135, step_id: '9-amigos', span: 2 })
    expect(findings[0].task).toContain('Сосчитай')
  })

  // Ключ по паре «квест + шаг», а НЕ по имени файла-источника: вердикт
  // «оставлено с обоснованием» — свойство шага, и он обязан читаться одинаково
  // при прогоне по проду и по локальным данным.
  it('ключ allow-файла не зависит от источника данных', () => {
    expect(findingKeys({ quest_id: 'q', step_id: '9-amigos', step_db_id: 1135 })).toEqual(['q|9-amigos'])
  })
})
