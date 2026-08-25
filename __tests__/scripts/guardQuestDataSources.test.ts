// #1554: у каждого квеста ровно один локальный файл-источник.
//
// Guard существует ради ответа «дублей нет», и его провал тихий: пропустит
// дубль — заливка одного файла молча откатит правки другого на проде. Поэтому
// здесь заперты обе границы распознавания: что считается файлом-данными и что
// считается упоминанием `quest_id`, а не копией контента.
const fs = require('fs')
const os = require('os')
const path = require('path')

const { describedQuests, scanScripts, MENTIONS_QUEST_ID } = require('@/scripts/guard-quest-data-sources')

const { diffStep, diffQuestLevel, finaleText, normalizeField } = require('@/scripts/lib/questProdDiff')
const { replaceField, replaceByAst, renderObject } = require('@/scripts/sync-quest-data-from-prod')

/** Временное дерево `<root>/scripts/*` — guard читает каталог, а не список файлов. */
const withScripts = (files: Record<string, string>, run: (root: string) => void) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quest-sources-'))
  fs.mkdirSync(path.join(root, 'scripts'))
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(root, 'scripts', name), body, 'utf8')
  try { run(root) } finally { fs.rmSync(root, { recursive: true, force: true }) }
}

const dataFile = (questId: string) => `module.exports = [{ quest_id: '${questId}', steps: [{ step_id: 'a' }] }]\n`

describe('describedQuests: что считается описанием квеста', () => {
  // Разбор, а не исполнение. Первая редакция звала require() на каждый скрипт и
  // запустила `add-quest-spots.js`, у которого нет гарда `require.main` и
  // который сразу идёт писать на прод.
  it('видит квест, объявленный литералом', () => {
    expect(describedQuests("module.exports = [{ quest_id: 'minsk-cmok', steps: [] }]", 'f'))
      .toEqual([{ quest_id: 'minsk-cmok', file: 'f' }])
  })

  it('видит его же, когда шаги вынесены в переменную', () => {
    // На этой форме текстовый поиск `steps: [` молчал.
    expect(describedQuests("const S = []\nmodule.exports = [{ quest_id: 'a-b', steps: S }]", 'f'))
      .toEqual([{ quest_id: 'a-b', file: 'f' }])
  })

  it('не метит трансформацию чужих данных', () => {
    // Так строят объекты сами квест-сканы: `quest_id` вычисляется, а не объявлен.
    expect(describedQuests('module.exports = (b) => ({ quest_id: b.quest_id, steps: b.steps })', 'f')).toEqual([])
  })

  it('молчит на объекте без шагов', () => {
    expect(describedQuests("const T = { quest_id: 'minsk-cmok' }", 'f')).toEqual([])
  })

  it('не падает на неразбираемом файле', () => {
    expect(describedQuests('module.exports = [{ quest_id:', 'f')).toEqual([])
  })

  it('дешёвый отсев пропускает только упоминающие quest_id', () => {
    expect(MENTIONS_QUEST_ID.test('const x = 1')).toBe(false)
    expect(MENTIONS_QUEST_ID.test('quest_id')).toBe(true)
  })
})

describe('scanScripts', () => {
  it('молчит, когда у каждого квеста один файл', () => {
    withScripts({ 'minsk-quest-data.js': dataFile('minsk-cmok'), 'pinsk-quest-data.js': dataFile('pinsk-polesie') }, (root) => {
      const result = scanScripts(root)
      expect(result.findings).toEqual([])
      expect(result.quests).toBe(2)
    })
  })

  // Кейс `hel-fishermen`: старый батч-файл не убрали при переходе на по-квестовую
  // конвенцию, и оба файла остались рабочими источниками.
  it('ловит один quest_id в двух data-файлах и называет оба', () => {
    withScripts({ 'hel-city-quest-data.js': dataFile('hel-fishermen'), 'hel-fishermen-quest-data.js': dataFile('hel-fishermen') }, (root) => {
      const [finding] = scanScripts(root).findings
      expect(finding.kind).toBe('duplicate_quest_id')
      expect(finding.quest_ids).toEqual(['hel-fishermen'])
      expect(finding.detail).toContain('scripts/hel-city-quest-data.js')
      expect(finding.detail).toContain('scripts/hel-fishermen-quest-data.js')
    })
  })

  it('видит батч-файл на несколько квестов', () => {
    withScripts({
      'krakow-district-quests-data.js': `module.exports = [{ quest_id: 'a-one', steps: [] }, { quest_id: 'a-two', steps: [] }]\n`,
      'a-one-quest-data.js': dataFile('a-one'),
    }, (root) => {
      const kinds = scanScripts(root).findings.map((f: { kind: string }) => f.kind)
      expect(kinds).toEqual(['duplicate_quest_id'])
    })
  })

  // Кейс `migrate-quests-to-backend-data.js`: данные квеста под именем, которое
  // не подходит под шаблон, — такой файл невидим для всех инструментов проекта.
  it('ловит данные квеста в файле с непринятым именем', () => {
    withScripts({ 'migrate-quests-to-backend-data.js': dataFile('minsk-cmok') }, (root) => {
      const [finding] = scanScripts(root).findings
      expect(finding.kind).toBe('unregistered_source')
      expect(finding.file).toBe('scripts/migrate-quests-to-backend-data.js')
      expect(finding.quest_ids).toEqual(['minsk-cmok'])
    })
  })

  it('не трогает скрипт, который лишь упоминает quest_id без данных', () => {
    withScripts({
      'upload-quest-media.js': `const TARGETS = { quest_id: 'minsk-cmok' }\n`,
      'minsk-quest-data.js': dataFile('minsk-cmok'),
    }, (root) => {
      expect(scanScripts(root).findings).toEqual([])
    })
  })
})

// Сверка с продом — общая для скана и синхронизатора. Ошибка здесь тихая в обе
// стороны: пропустит расхождение — заливка откатит прод; выдумает лишнее — гейт
// будет вечно красным на том, что никто не собирается переносить.
describe('questProdDiff: что считается расхождением с продом', () => {
  const step = (over: Record<string, unknown> = {}) => ({
    step_id: 's', title: 't', location: 'l', story: 'st', task: 'ta', hint: 'h',
    answer_pattern: { type: 'exact_any', value: JSON.stringify(['а']) }, lat: 53.9034, lng: 27.5744, ...over,
  })

  it('координаты сравнивает по значению, а не по записи', () => {
    // Локально число, с API строка `"53.903400"` — это одно и то же место.
    expect(diffStep(step(), step({ lat: '53.903400', lng: '27.574400' }))).toEqual([])
  })

  it('answer_pattern сравнивает по разобранному значению обоих уровней', () => {
    expect(diffStep(step(), step({ answer_pattern: JSON.stringify({ type: 'exact_any', value: JSON.stringify(['а']) }) }))).toEqual([])
    expect(diffStep(step(), step({ answer_pattern: { type: 'exact_any', value: JSON.stringify(['б']) } }))).toEqual(['answer_pattern'])
  })

  it('maps_url расхождением не считает', () => {
    // Бэкенд генерирует его из координат, локально поля нет вовсе — без этого
    // исключения «разошлись» показывали все 156 файло-квестов.
    expect(diffStep(step({ maps_url: undefined }), step({ maps_url: 'https://maps.google.com/?q=1,2' }))).toEqual([])
  })

  it('ловит расхождение текста задания', () => {
    expect(diffStep(step(), step({ task: 'другое' }))).toEqual(['task'])
  })

  // Развилка форм финала: старые файлы пишут `{title, story}`, новые и прод — `{text}`.
  describe('финал', () => {
    it('читает текст так же, как заливка: text либо story', () => {
      expect(finaleText({ text: 'x' })).toBe('x')
      expect(finaleText({ title: 'Финал', story: 'x' })).toBe('x')
      expect(finaleText(null)).toBeNull()
    })

    it('сравнивает старую локальную форму с прод-формой', () => {
      const bundle = { finale: { text: 'финал' }, intro: null }
      expect(diffQuestLevel({ finale: { title: 'Финал', story: 'финал' } }, bundle)).toEqual([])
      const drift = diffQuestLevel({ finale: { title: 'Финал', story: 'другое' } }, bundle)
      expect(drift).toHaveLength(1)
      expect(drift[0]).toMatchObject({ scope: 'finale', field: 'text' })
    })

    it('локальный title расхождением не считает — заливка его не отправляет', () => {
      expect(diffQuestLevel({ finale: { title: 'Финал', text: 'x' } }, { finale: { text: 'x' }, intro: null })).toEqual([])
    })
  })

  it('служебные поля интро не сравнивает', () => {
    const local = { intro: { story: 'одинаково', lat: 0, lng: 0 } }
    const bundle = { intro: { story: 'одинаково', lat: 53.9, lng: 27.5, id: 7, order: 0, is_intro: true }, finale: null }
    expect(diffQuestLevel(local, bundle)).toEqual([])
  })

  it('пустое и отсутствующее значение — одно и то же', () => {
    expect(normalizeField('hint', '')).toBeNull()
    expect(normalizeField('hint', null)).toBeNull()
  })
})

// Находки код-ревью #1554: каждая закрыта тестом, чтобы не вернулась.
describe('#1554 review: интро', () => {
  it('ловит поле, которое есть на проде и отсутствует локально', () => {
    // `sync-quest-to-prod.js:88` шлёт `hint: q.intro.hint || null` — отсутствующая
    // локально подсказка ЗАТИРАЕТ подсказку на проде. Обход только локальных
    // ключей этого не видел.
    const drift = diffQuestLevel({ intro: { story: 'одинаково' } }, { intro: { story: 'одинаково', hint: 'подсказка' }, finale: null })
    expect(drift).toHaveLength(1)
    expect(drift[0]).toMatchObject({ scope: 'intro', field: 'hint' })
  })
})

describe('#1554 review: poi_info', () => {
  const step = (over: Record<string, unknown> = {}) => ({ step_id: 's', title: 't', story: 's', task: 't', ...over })
  const poi = { is_museum: true, website: 'https://x' }

  it('сравнивается, когда он есть локально', () => {
    expect(diffStep(step({ poi_info: poi }), step({ poi_info: { is_museum: false, website: 'https://x' } })))
      .toEqual(['poi_info'])
  })

  it('НЕ сравнивается, когда локально его нет — заливка такое поле не отправляет', () => {
    expect(diffStep(step(), step({ poi_info: poi }))).toEqual([])
  })

  it('порядок ключей расхождением не считает', () => {
    expect(diffStep(step({ poi_info: { website: 'https://x', is_museum: true } }), step({ poi_info: poi }))).toEqual([])
  })
})

describe('#1554 review: замена значения в исходнике', () => {
  it('не трактует $ в прод-значении как шаблон подстановки', () => {
    // `String.replace` со строковым шаблоном раскрывает `$&` в заменяющей строке
    // и портит записываемый файл.
    const text = "task: 'старый текст',"
    const { text: out, ok } = replaceField(text, 'task', 'старый текст', 'цена $& и $$5')
    expect(ok).toBe(true)
    expect(out).toBe("task: 'цена $& и $$5',")
  })

  it('многострочный poi_info меняется по AST, в нужном шаге', () => {
    // Однострочный текстовый шаблон такую запись не находит, а одинаковый
    // poi_info у двух шагов сделал бы слепую замену опасной.
    const text = [
      'module.exports = [{ quest_id: "q", steps: [',
      "  { step_id: 'a', poi_info: {",
      '      is_museum: true,',
      '  } },',
      "  { step_id: 'b', poi_info: {",
      '      is_museum: true,',
      '  } },',
      ']}]',
    ].join('\n')
    const result = replaceByAst(text, 'b', 'poi_info', { is_museum: false })
    expect(result.ok).toBe(true)
    expect(result.text).toContain('is_museum: true')
    expect(result.text).toContain('is_museum: false')
    // Поменялся именно второй шаг, первый цел.
    expect(result.text.indexOf('is_museum: false')).toBeGreaterThan(result.text.indexOf("step_id: 'b'"))
  })

  it('молчит, когда такого шага в файле нет', () => {
    expect(replaceByAst("[{ step_id: 'a' }]", 'нет-такого', 'poi_info', {}).ok).toBe(false)
  })

  // У текстового пути защита была бесплатной (пустой список форм), у AST-пути
  // её пришлось ставить руками: `null` ронял весь прогон `--all`, а строка тихо
  // писала в исходник посимвольный мусор `{ 0: '{', 1: '\"', … }`.
  it('отказывается писать, когда новое значение не объект', () => {
    const text = "[{ step_id: 'a', poi_info: { is_museum: true } }]"
    expect(replaceByAst(text, 'a', 'poi_info', null).ok).toBe(false)
    expect(replaceByAst(text, 'a', 'poi_info', 'не json').ok).toBe(false)
    expect(replaceByAst(text, 'a', 'poi_info', [1, 2]).ok).toBe(false)
  })

  it('принимает объект, записанный строкой JSON', () => {
    const text = "[{ step_id: 'a', poi_info: { is_museum: true } }]"
    const result = replaceByAst(text, 'a', 'poi_info', '{"is_museum":false}')
    expect(result.ok).toBe(true)
    expect(result.text).toContain('is_museum: false')
  })

  it('рендерит объект с отступом вызывающей строки', () => {
    expect(renderObject({ is_museum: true, website: 'https://x' }, '  '))
      .toBe("{\n      is_museum: true,\n      website: 'https://x',\n  }")
  })
})
