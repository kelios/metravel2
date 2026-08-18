// #1447: скан утечки ответа в подсказку (правило авторинга 4a).
//
// Скрипт — постоянный контроль правила, которое три прохода подряд (#1190,
// #1445, #1447) проверяли глазами. Главный риск инструмента — тихо перестать
// ловить словоформы: ответ «вал» утёк через «перед валом», и если совпадение
// однажды сузят до границы слова, скан начнёт рапортовать «утечек нет» на тех
// же самых шагах. Эти тесты падают, если это случится.
const { dictionaryValues, findLeaks, numericValues, parseArgs, scanQuests } = require('@/scripts/scan-quest-hint-leak')

const step = (over: Record<string, unknown> = {}) => ({
  id: 1,
  step_id: 'x',
  hint: '',
  answer_pattern: { type: 'exact_any', value: JSON.stringify(['мост']) },
  ...over,
})

describe('dictionaryValues — закрытый словарь ответов', () => {
  it('разбирает exact_any как массив строк', () => {
    expect(dictionaryValues({ type: 'exact_any', value: JSON.stringify(['ров', 'вал']) })).toEqual(['ров', 'вал'])
  })

  it('exact отдаёт одно значение', () => {
    expect(dictionaryValues({ type: 'exact', value: '5' })).toEqual(['5'])
  })

  it('свободные типы словаря не имеют', () => {
    expect(dictionaryValues({ type: 'any', value: '' })).toEqual([])
    expect(dictionaryValues({ type: 'any_text', value: JSON.stringify({ min_length: 5 }) })).toEqual([])
  })

  it('битый JSON не роняет скан', () => {
    expect(dictionaryValues({ type: 'exact_any', value: '[не json' })).toEqual([])
  })
})

describe('numericValues — числовой ответ', () => {
  it('range раскрывается в весь диапазон: 4a запрещает и точное число, и вилку', () => {
    expect(numericValues({ type: 'range', value: JSON.stringify({ min: 7, max: 9 }) })).toEqual([7, 8, 9])
  })

  it('exact числом даёт число, exact словом — нет', () => {
    expect(numericValues({ type: 'exact', value: '5' })).toEqual([5])
    expect(numericValues({ type: 'exact', value: 'орёл' })).toEqual([])
  })
})

describe('findLeaks — совпадение ответа с текстом подсказки', () => {
  it('ловит словоформу, а не только точное слово (реальный кейс шага 1224)', () => {
    const leaks = findLeaks(
      step({
        hint: 'Смотри под ноги вдоль обходной тропы: перед валом идёт глубокая сухая «канава».',
        answer_pattern: { type: 'exact_any', value: JSON.stringify(['ров', 'вал', 'земляной вал']) },
      }),
      'hint',
    )
    expect(leaks).toEqual([{ kind: 'dictionary', value: 'вал' }])
  })

  it('ловит ответ внутри слова (реальный кейс шага 677: «круг» в «по кругу»)', () => {
    const leaks = findLeaks(
      step({
        hint: 'Обойди корпус здания глазами по кругу и попробуй найти на нём углы.',
        answer_pattern: { type: 'exact_any', value: JSON.stringify(['круг', 'цилиндр']) },
      }),
      'hint',
    )
    expect(leaks).toEqual([{ kind: 'dictionary', value: 'круг' }])
  })

  it('сравнивает нормализованно, как сервер засчитывает ответ: ё/регистр/дефис не прячут утечку', () => {
    const leaks = findLeaks(
      step({ hint: 'Ищи ОРЁЛ-а на фасаде', answer_pattern: { type: 'exact_any', value: JSON.stringify(['орел']) } }),
      'hint',
    )
    expect(leaks).toEqual([{ kind: 'dictionary', value: 'орел' }])
  })

  it('слишком короткое значение не срабатывает подстрокой', () => {
    const leaks = findLeaks(
      step({ hint: 'думай о форме', answer_pattern: { type: 'exact_any', value: JSON.stringify(['ум']) } }),
      'hint',
    )
    expect(leaks).toEqual([])
  })

  it('число из диапазона в подсказке — утечка; соседнее число из даты — нет', () => {
    const pattern = { type: 'range', value: JSON.stringify({ min: 7, max: 9 }) }
    expect(findLeaks(step({ hint: 'их примерно 8', answer_pattern: pattern }), 'hint')).toEqual([
      { kind: 'numeric', value: '8' },
    ])
    expect(findLeaks(step({ hint: 'построен в 1884 году', answer_pattern: pattern }), 'hint')).toEqual([])
  })

  it('ловит ответ в подписи места — реальный шаг 677 «Ротонда Святого Георгия»', () => {
    const leaks = findLeaks(
      step({
        location: 'Ротонда Святого Георгия, двор между Президентством и отелем «Балкан»',
        answer_pattern: { type: 'exact_any', value: JSON.stringify(['круглая', 'цилиндр', 'ротонда']) },
      }),
      'location',
    )
    expect(leaks).toEqual([{ kind: 'dictionary', value: 'ротонда' }])
  })

  it('чистая подсказка не даёт находок', () => {
    const leaks = findLeaks(
      step({
        hint: 'Подними взгляд выше вторых этажей и посмотри, на что опираются края.',
        answer_pattern: { type: 'exact_any', value: JSON.stringify(['мост', 'арка', 'переход']) },
      }),
      'hint',
    )
    expect(leaks).toEqual([])
  })
})

describe('parseArgs — набор сканируемых полей', () => {
  // #1461: `location` печатается игроку ДО попытки — в мастере под заголовком
  // шага, в печатной версии в шапке шага и в таблице маршрута, в офлайн-экспорте
  // именем точки. Поле было носителем утечки по реестру QUEST-HINT-LEAK-001, но
  // CLI его не принимал и падал с `Fatal: неизвестное поле`: инвариант записан,
  // проверки у него нет. Тест падает, если поле снова выпадет из набора.
  it('принимает location', () => {
    expect(parseArgs(['--fields=location']).fields).toEqual(['location'])
  })

  // #1467: все 17 находок по `location` переписаны, прогон по проду нулевой —
  // поле переведено в умолчание, чтобы новая утечка в подписи роняла gate сразу.
  // `title`/`story`/`task` остаются вне умолчания: у них есть неразобранные
  // находки, и любое включение уронило бы каждый прогон.
  it('по умолчанию сканирует hint и location: остальные поля шумят и в gate не входят', () => {
    expect(parseArgs([]).fields).toEqual(['hint', 'location'])
  })

  it('незнакомое поле отвергает, а не сканирует молча пустоту', () => {
    expect(() => parseArgs(['--fields=subtitle'])).toThrow(/subtitle/)
  })
})

describe('scanQuests', () => {
  it('пропускает intro-шаги и считает только реальные', () => {
    const quests = [
      {
        id: 1,
        quest_id: 'q',
        steps: [
          { ...step({ is_intro: true, hint: 'по кругу', answer_pattern: { type: 'exact_any', value: '["круг"]' } }) },
          step({ id: 2, step_id: 's2', hint: 'по кругу', answer_pattern: { type: 'exact_any', value: '["круг"]' } }),
        ],
      },
    ]
    const { findings, scannedSteps } = scanQuests(quests, ['hint'])
    expect(scannedSteps).toBe(1)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ quest_id: 'q', step_db_id: 2, field: 'hint' })
  })
})
