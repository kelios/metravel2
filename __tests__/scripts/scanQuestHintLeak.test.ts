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

// #1488: вторая поверхность — текст УРОВНЯ КВЕСТА (интро, финал) против ответов
// ВСЕХ шагов. До #1488 скан обходил только `quest.steps`, а интро приходит
// отдельным ключом бандла, поэтому нулевой свип #1467 этот контур не покрывал:
// класс не был измерен ни разу. Тесты ниже падают, если контур снова выпадет из
// обхода или если совпадение сузят обратно до именительного падежа.
const {
  answerStem,
  questAnswerDictionary,
  findQuestLeaks,
  findingKeys,
  splitFindings,
  INTRO_FIELDS,
} = require('@/scripts/scan-quest-hint-leak')

describe('answerStem — словарь в именительном, проза в косвенном', () => {
  it('срезает одно окончание: «ротонда» → «ротонд», «пуговица» → «пуговиц»', () => {
    expect(answerStem('ротонда')).toBe('ротонд')
    expect(answerStem('пуговица')).toBe('пуговиц')
    expect(answerStem('фонари')).toBe('фонар')
  })

  it('не срезает два символа: иначе «мария» станет «мар» и поймает «маршрут»', () => {
    expect(answerStem('мария')).toBe('мари')
  })

  it('оставляет минимум четыре буквы: «роза» → «роза», иначе «роз» ловит «розовый»', () => {
    expect(answerStem('роза')).toBe('роза')
    expect(answerStem('одна')).toBe('одна')
    expect(answerStem('три')).toBe('три')
  })

  it('слово без гласного окончания не трогает', () => {
    expect(answerStem('дуб')).toBe('дуб')
    expect(answerStem('флаг')).toBe('флаг')
  })
})

describe('questAnswerDictionary — ответы всех шагов квеста', () => {
  it('собирает словари всех шагов и помнит, чей это ответ', () => {
    const answers = questAnswerDictionary([
      step({ id: 10, step_id: 's1', answer_pattern: { type: 'exact_any', value: JSON.stringify(['ротонда']) } }),
      step({ id: 11, step_id: 's2', answer_pattern: { type: 'exact_any', value: JSON.stringify(['пуговица']) } }),
    ])
    expect(answers).toEqual([
      { value: 'ротонда', step_db_id: 10, step_id: 's1' },
      { value: 'пуговица', step_db_id: 11, step_id: 's2' },
    ])
  })

  it('интро своего ответа не имеет и в словарь не попадает', () => {
    const answers = questAnswerDictionary([
      step({ id: 9, step_id: 'intro', is_intro: true, answer_pattern: { type: 'exact_any', value: JSON.stringify(['мост']) } }),
      step({ id: 10, step_id: 's1', answer_pattern: { type: 'exact_any', value: JSON.stringify(['ров']) } }),
    ])
    expect(answers.map((a) => a.value)).toEqual(['ров'])
  })
})

describe('findQuestLeaks — интро против ответов чужих шагов', () => {
  // Ровно два примера, ради которых заведён #1488. Наивное подстрочное
  // совпадение их НЕ находит: «ротонда» не является подстрокой «ротонду».
  it('ловит косвенный падеж — реальное интро sofia-serdica-underfoot и ответ шага 677', () => {
    const leaks = findQuestLeaks(
      'церковь, вросшую в землю, ротонду старше самого слова «София» в её нынешнем звучании',
      [{ value: 'ротонда', step_db_id: 677, step_id: '8-rotunda' }],
    )
    expect(leaks).toEqual([{ kind: 'dictionary', value: 'ротонда', via: 'stem', step_db_id: 677, step_id: '8-rotunda' }])
  })

  it('ловит косвенный падеж — реальное интро brest-lantern и ответ шага 538', () => {
    const leaks = findQuestLeaks(
      'дальше мимо памятника Тысячелетия — к гигантской пуговице фонарщика',
      [{ value: 'пуговица', step_db_id: 538, step_id: '2-fonarshchik' }],
    )
    expect(leaks.map((l) => l.value)).toEqual(['пуговица'])
  })

  it('точное вхождение остаётся подстрочным, как на уровне шага', () => {
    const leaks = findQuestLeaks('золотые петухи на шпилях', [{ value: 'петух', step_db_id: 946, step_id: 's' }])
    expect(leaks).toEqual([{ kind: 'dictionary', value: 'петух', via: 'substring', step_db_id: 946, step_id: 's' }])
  })

  it('основа не съедает лишнего: «роза» не ловит «розовый туф», «мария» не ловит «маршрут»', () => {
    expect(findQuestLeaks('маршрут пеший, около двух километров', [{ value: 'мария', step_db_id: 1, step_id: 's' }])).toEqual([])
  })

  it('чистое интро находок не даёт', () => {
    expect(findQuestLeaks('Начинаем на площади у синагоги. Вперёд!', [{ value: 'ротонда', step_db_id: 1, step_id: 's' }])).toEqual([])
  })
})

describe('scanQuests — поверхности интро и финала', () => {
  const questWithIntro = (over: Record<string, unknown> = {}) => ({
    id: 1,
    quest_id: 'q',
    intro: { id: 9, step_id: 'intro', title: '', location: '', task: '', story: 'ты увидишь ротонду старше города' },
    finale: { text: 'а начиналось всё с ротонды' },
    steps: [step({ id: 2, step_id: 's2', answer_pattern: { type: 'exact_any', value: JSON.stringify(['ротонда']) } })],
    ...over,
  })

  it('интро сверяется с ответом ЧУЖОГО шага и попадает в умолчание', () => {
    const { findings, scannedQuestNodes } = scanQuests([questWithIntro()], ['hint'])
    expect(scannedQuestNodes).toBe(1)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ scope: 'intro', field: 'story', step_db_id: null })
    expect(findings[0].leaks[0]).toMatchObject({ value: 'ротонда', step_db_id: 2 })
  })

  // Экран финала игрок читает ПОСЛЕ последнего шага, а сам текст по замыслу
  // пересказывает маршрут: замер 23.08.2026 дал 99 находок на 149 квестов.
  // Контур красный by design, поэтому в умолчание не входит — но измерим флагом.
  it('финал вне умолчания, но доступен флагом', () => {
    expect(scanQuests([questWithIntro()], ['hint']).findings.some((f: { scope: string }) => f.scope === 'finale')).toBe(false)
    const withFinale = scanQuests([questWithIntro()], ['hint'], ['finale'])
    expect(withFinale.findings).toHaveLength(1)
    expect(withFinale.findings[0]).toMatchObject({ scope: 'finale', field: 'finale' })
  })

  // 51 числовой хит из 51 в свипе 23.08.2026 — адреса, часы работы и маркеры
  // списка «Что делать: 1) 2) 3)». У текста уровня квеста нет своего вопроса.
  it('числа на уровне квеста не ищет: одиночная цифра в интро — адрес, а не ответ', () => {
    const quest = questWithIntro({
      intro: { id: 9, step_id: 'intro', title: '', location: '', task: '', story: 'Что делать: 1) читай, 2) иди, 3) отвечай' },
      finale: null,
      steps: [step({ id: 2, step_id: 's2', answer_pattern: { type: 'range', value: JSON.stringify({ min: 2, max: 3 }) } })],
    })
    expect(scanQuests([quest], ['hint']).findings).toHaveLength(0)
  })

  it('поля интро шире полей шага: у интро нет своего ответа, значит нет и самореференции', () => {
    expect(INTRO_FIELDS).toEqual(['title', 'location', 'story', 'task'])
  })
})

describe('parseArgs — поверхности', () => {
  it('по умолчанию шаг и интро; финал только явным флагом', () => {
    expect(parseArgs([]).scopes).toEqual(['step', 'intro'])
    expect(parseArgs(['--scopes=step,intro,finale']).scopes).toEqual(['step', 'intro', 'finale'])
  })

  it('незнакомую поверхность отвергает, а не сканирует молча пустоту', () => {
    expect(() => parseArgs(['--scopes=outro'])).toThrow(/outro/)
  })

  // `--update-baseline` намеренно НЕ слушается `--scopes`: набор без `intro`
  // перезаписал бы baseline пустым объектом, и следующий check:fast покраснел
  // бы на всех уже разобранных находках.
  it('умолчание поверхностей не зависит от того, что просили сканировать', () => {
    expect(parseArgs(['--scopes=step', '--update-baseline']).updateBaseline).toBe(true)
    expect(parseArgs(['--scopes=step', '--update-baseline']).scopes).toEqual(['step'])
  })
})

describe('baseline — разобранный остаток молчит, новая находка валит гейт', () => {
  const finding = (over: Record<string, unknown> = {}) => ({
    quest_id: 'q',
    scope: 'intro',
    step_id: null,
    field: 'story',
    leaks: [{ kind: 'dictionary', value: 'дерево' }],
    ...over,
  })

  it('ключей столько, сколько слов в находке — по одному на значение', () => {
    expect(findingKeys(finding({ leaks: [{ value: 'дуб' }, { value: 'дерево' }] }))).toEqual([
      'intro|q||story|дуб',
      'intro|q||story|дерево',
    ])
  })

  it('известное уходит в known, новое остаётся fresh', () => {
    const other = finding({ quest_id: 'q2' })
    const { fresh, known } = splitFindings([finding(), other], findingKeys(finding()))
    expect(known).toEqual([finding()])
    expect(fresh).toEqual([other])
  })

  // Ключ на всю находку целиком ломал гейт на ЧАСТИЧНОЙ правке: автор убирал из
  // интро одно слово из трёх, ключ менялся целиком, и уже разобранный остаток
  // приходил как «новая находка».
  it('убранное слово не делает остаток находки новым', () => {
    const before = finding({ leaks: [{ value: 'дуб' }, { value: 'дерево' }, { value: 'сосна' }] })
    const after = finding({ leaks: [{ value: 'дерево' }, { value: 'сосна' }] })
    const { fresh } = splitFindings([after], findingKeys(before))
    expect(fresh).toEqual([])
  })

  // Поля шага вычищены до нуля в #1467 и обязаны падать сразу: попади шаговая
  // находка в baseline — красный прогон стал бы зелёным молча. На первой
  // редакции #1488 так и вышло с подписью места `ul. Lipowa 4`.
  it('находка ШАГА в baseline не уходит никогда, даже если её ключ там лежит', () => {
    const stepFinding = finding({ scope: 'step', step_id: 's1' })
    const { fresh, known } = splitFindings([stepFinding], findingKeys(stepFinding))
    expect(known).toEqual([])
    expect(fresh).toEqual([stepFinding])
  })
})
