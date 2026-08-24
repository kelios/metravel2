// #1431: скан «поверхностного» ответа — правило авторинга 4f.
//
// Скрипт — постоянный контроль класса, который до него держался на разовом
// аудите в `.quest-audit/` (папка в `.gitignore`, то есть на одной машине).
// Главные риски инструмента ровно два, и оба здесь закрыты тестом:
//
//   1. Тихо перестать отличать ПОВЕРХНОСТНЫЙ материал от КОНСТРУКТИВНОГО.
//      Граница не косметическая: именно по ней два шага (1007 плетёный лев,
//      1312 Пассаж Розы) переехали из «исключено с причиной» в «конструктивный
//      материал» и сдвинули норматив аудита с 60+49+38 на 60+47+40. Разъедься
//      граница обратно — и цифры в отчёте задачи снова разойдутся с машиной.
//   2. Тихо начать поглощать baseline'ом перекрашенный эталон. Ключ находки
//      сделан ПОВАЛЮЙНО именно для этого: смена «синий» → «белый» обязана
//      приходить как новая находка, иначе скан молчит ровно в том событии,
//      ради которого написан.
const {
  classifyStep,
  findingKeys,
  isColorWord,
  scanQuests,
} = require('@/scripts/scan-quest-surface-answer')

const step = (over: Record<string, unknown> = {}) => ({
  id: 1,
  step_id: 'x',
  title: '',
  task: '',
  hint: '',
  answer_pattern: { type: 'exact_any', value: JSON.stringify(['мост']) },
  ...over,
})

const dict = (values: string[]) => ({ type: 'exact_any', value: JSON.stringify(values) })

describe('isColorWord — стоп-лист ложных срабатываний', () => {
  it('цветовые корни ловятся в разных языках', () => {
    expect(isColorWord('голубой')).toBe(true)
    expect(isColorWord('czerwony')).toBe(true)
    expect(isColorWord('white')).toBe(true)
    expect(isColorWord('залатая')).toBe(false)
    expect(isColorWord('золотая')).toBe(true)
  })

  // Без стоп-листа эти восемь слов раздували выборку вдвое (#1431: шаги
  // 174, 386, 400, 514, 718, 815, 1276, 1370).
  it.each(['бельведер', 'белка', 'белорусский', 'сердце', 'серьга', 'лебедь', 'пирамида'])(
    '«%s» не цветовое слово, хотя содержит цветовой корень',
    (word) => {
      expect(isColorWord(word)).toBe(false)
    },
  )

  // Птица против цвета. Стоп-лист обязан резать «голубя», не задев «голубой»:
  // короткий корень «голуб» убил бы половину настоящих цветовых шагов (262,
  // 524, 865, 930, 1212, 1311). Кейс пойман свипом 23.08.2026 на шаге 1410.
  it('«голубь» не цвет, «голубой» — цвет', () => {
    expect(isColorWord('голубь')).toBe(false)
    expect(isColorWord('голубка')).toBe(false)
    expect(isColorWord('голубой')).toBe(true)
    expect(isColorWord('голубые')).toBe(true)
  })

  it('шаг 1410 (Риальто): ответ «голубь святого духа» — не цветовая находка', () => {
    expect(classifyStep(step({
      id: 1410,
      step_id: '10-ponte-di-rialto',
      task: 'Посмотри на замковый камень в центре арки моста. Какое существо там вырезано?',
      answer_pattern: dict(['голубь', 'голубя', 'голубка', 'птица', 'голубь святого духа']),
    }))).toBeNull()
  })
})

describe('classifyStep — ветка ЦВЕТ', () => {
  it('словарь из цветов попадает в scope', () => {
    const verdict = classifyStep(step({ task: 'Какого они цвета?', answer_pattern: dict(['синий', 'голубой']) }))
    expect(verdict).toMatchObject({ structural: false })
    expect(verdict.reason).toContain('dict-color')
  })

  it('формулировка про цвет ловится и без цветового словаря', () => {
    // Ответ числовой, но протухает так же: перекрасят — и счёт «зелёных» сойдётся иначе.
    const verdict = classifyStep(step({
      task: 'Сколько зелёных башенок у ратуши?',
      answer_pattern: { type: 'range', value: JSON.stringify({ min: 3, max: 3 }) },
    }))
    expect(verdict).toMatchObject({ structural: false })
    expect(verdict.reason).toContain('task-color-word')
  })

  it('одна случайная цветная строка в большом словаре не делает ответ цветовым', () => {
    const verdict = classifyStep(step({
      task: 'Как называется башня?',
      answer_pattern: dict(['часовая', 'ратушная', 'городская', 'белая']),
    }))
    expect(verdict).toBeNull()
  })
})

describe('classifyStep — ветка МАТЕРИАЛ ПОВЕРХНОСТИ', () => {
  // Ветка обязательна отдельно от цвета: «кирпич» не цветовое слово, и первый
  // прогон #1431 потерял на этом девять шагов ядра.
  it.each([
    ['кирпич', ['кирпич', 'из кирпича']],
    ['черепица', ['черепица', 'черепицы']],
    ['майолика', ['майолика', 'изразцы']],
  ])('%s — поверхностный материал, идёт в scope', (_label, values) => {
    const verdict = classifyStep(step({ task: 'Из какого материала сложены стены?', answer_pattern: dict(values) }))
    expect(verdict).toMatchObject({ structural: false })
    expect(verdict.reason).toContain('dict-material-surface')
  })
})

describe('classifyStep — граница «конструктивный материал» (вне scope)', () => {
  it.each([
    ['камень', ['камень', 'валуны']],
    ['дерево', ['дерево', 'бревна']],
    ['бетон', ['бетон']],
    ['стекло', ['стекло']],
  ])('%s виден потому, что из него объект построен — ремонтом не меняется', (_label, values) => {
    const verdict = classifyStep(step({ task: 'Из чего построен дом?', answer_pattern: dict(values) }))
    expect(verdict).toMatchObject({ structural: true })
  })

  // Регрессия на причину сдвига норматива 60+49+38 → 60+47+40. Оба шага
  // реальные, тексты и словари взяты с прода как есть.
  it('шаг 1007 (плетёный лев): прутья и лоза образуют саму фигуру — structural', () => {
    const verdict = classifyStep(step({
      id: 1007,
      step_id: '6-lev-iz-prutyev',
      task: 'Из какого материала сделана фигура?',
      answer_pattern: dict(['прутья', 'из прутьев', 'ветки', 'лоза', 'из лозы']),
    }))
    expect(verdict).toMatchObject({ structural: true })
  })

  it('шаг 1312 (Пассаж Розы): зеркальные осколки образуют само произведение — structural', () => {
    const verdict = classifyStep(step({
      id: 1312,
      step_id: '3-pasaz-rozy',
      task: 'Подойди к стене вплотную и рассмотри, из чего сложена эта сияющая мозаика. Назови материал одним словом.',
      answer_pattern: dict(['зеркала', 'зеркало', 'из зеркал', 'осколки зеркал', 'битые зеркала']),
    }))
    expect(verdict).toMatchObject({ structural: true })
  })

  // Обратная сторона той же границы: неоднозначный корень засчитывается
  // материалом, только когда САМО задание спрашивает про материал. Иначе шаг
  // 116 (зеркало портного против базилиска) попадал в скан как материал.
  it('шаг 116: «зеркало» как предмет сюжета — не находка вовсе', () => {
    const verdict = classifyStep(step({
      id: 116,
      step_id: '3-bazyliszek',
      task: 'Какой обычный предмет помог портному обратить смертельный взгляд против самого чудовища? Напиши одно слово.',
      answer_pattern: dict(['зеркало', 'зеркалом', 'с помощью зеркала', 'зеркала']),
    }))
    expect(verdict).toBeNull()
  })
})

describe('scanQuests — сходимость выборки', () => {
  // Машинная форма «сходимости» из отчёта #1431: ни одна отобранная строка не
  // теряется между scope и конструктивным материалом. Разойдись это — и отчёт
  // снова начнёт спорить со сканом, как в приёмке 20.08.2026.
  it('scope + конструктивный материал = все отобранные шаги, пересечения нет', () => {
    const bundles = [{
      id: 1,
      quest_id: 'q',
      steps: [
        step({ id: 1, step_id: 'a', task: 'Какого цвета купола?', answer_pattern: dict(['синий']) }),
        step({ id: 2, step_id: 'b', task: 'Из какого материала стены?', answer_pattern: dict(['кирпич']) }),
        step({ id: 3, step_id: 'c', task: 'Из чего построен дом?', answer_pattern: dict(['камень', 'валуны']) }),
        step({ id: 4, step_id: 'd', task: 'Как зовут скульптора?', answer_pattern: dict(['Иван']) }),
      ],
    }]
    const { findings, structural, scannedSteps } = scanQuests(bundles)
    expect(scannedSteps).toBe(4)
    expect(findings.map((f: { step_id: string }) => f.step_id)).toEqual(['a', 'b'])
    expect(structural.map((f: { step_id: string }) => f.step_id)).toEqual(['c'])
    const ids = [...findings, ...structural].map((f: { step_id: string }) => f.step_id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('findingKeys — ключ на каждое значение, а не на шаг', () => {
  it('перекрашенный эталон даёт НОВЫЙ ключ: baseline его не поглотит', () => {
    const before = classifyStep(step({ task: 'Какого цвета купола?', answer_pattern: dict(['синий', 'голубой']) }))
    const after = classifyStep(step({ task: 'Какого цвета купола?', answer_pattern: dict(['белый', 'голубой']) }))
    const keysOf = (verdict: unknown) => findingKeys({ quest_id: 'q', step_id: 'church', ...(verdict as object) })

    expect(keysOf(before)).toContain('q|church|dict-color|синий')
    expect(keysOf(after)).toContain('q|church|dict-color|белый')
    expect(keysOf(after)).not.toContain('q|church|dict-color|синий')
  })

  // P2 ревью 24.08.2026: облицовочный материал эмитится в ключ БЕЗУСЛОВНО, так же
  // как цвет. Раньше маркер `dict-material-surface` стоял под порогом
  // `dictIsSurfaceMaterial`, и когда облицовка была меньшинством словаря (шаг в
  // scope через task-asks-material), её значение не попадало в ключ — переоблицовка
  // «кирпич»→«плитка» проходила мимо baseline. Это ровно молчаливый дрейф
  // поверхности, ради которого скан написан; кейс смешанной кладки Крево из 4f.
  it('переоблицовка меньшинством словаря даёт НОВЫЙ ключ: baseline её не поглотит', () => {
    const task = 'Из чего сложены стены?'
    const before = classifyStep(step({ task, answer_pattern: dict(['три яруса', 'из кирпича', 'высокая', 'старая']) }))
    const after = classifyStep(step({ task, answer_pattern: dict(['три яруса', 'из плитки', 'высокая', 'старая']) }))
    const keysOf = (verdict: unknown) => findingKeys({ quest_id: 'q', step_id: 'wall', ...(verdict as object) })

    // Оба шага в scope через формулировку, облицовка — 1 из 4 (ниже порога).
    expect(before?.reason).toContain('task-asks-material')
    expect(keysOf(before)).toContain('q|wall|dict-material-surface|из кирпича')
    expect(keysOf(after)).toContain('q|wall|dict-material-surface|из плитки')
    expect(keysOf(after)).not.toContain('q|wall|dict-material-surface|из кирпича')
  })
})
