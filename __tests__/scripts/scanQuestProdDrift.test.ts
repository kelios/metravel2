// #1811: гвардия расхождения локальных data-файлов с продом (#1554) не
// переживала штатную ситуацию «локальный файл есть, квеста на проде нет».
// 404 по одному слагу летел наружу наравне с сетевой ошибкой, `main()` ловил
// его общим `catch` и печатал `Fatal: HTTP 404`, поэтому корпусный прогон
// обрывался на ПЕРВОМ таком файле и не измерял ничего.
//
// У инструмента три границы, и все три сторожатся здесь:
//   1. «Квеста нет» — это результат замера. Он идёт отдельной категорией и не
//      мешает сравнить остальные файлы.
//   2. «Измерить не удалось» (5xx, 429, обрыв сокета) остаётся фатальным.
//      Молчаливое «расхождений с продом нет» на недоступном хосте было бы
//      худшим исходом, чем падение: гвардия отчиталась бы о чистоте вслепую.
//   3. Та же ложь, собранная из одних только «штатных» 404: хост, отвечающий
//      404 на КАЖДЫЙ слаг (чужой METRAVEL_API_URL, локальный бэкенд, опечатка в
//      --api-url), даёт корпусный прогон с нулём сравнений. Замер на таком
//      хосте: 175 файлов, 179 квестов, ноль сравнений — и «Расхождений с продом
//      нет» с кодом 0.
import fs from 'fs'
import path from 'path'
import { makeTempDir, removeDir } from './cli-test-utils'

const questBundles = require('@/scripts/lib/questBundles')
const scanBaseline = require('@/scripts/lib/scanBaseline')

jest.mock('@/scripts/lib/questBundles', () => ({
  DEFAULT_USER_AGENT: 'ua-test',
  fetchQuestBundles: jest.fn(),
  fetchQuestCatalog: jest.fn(async () => []),
  loadLocalBundles: jest.fn(),
  parseSteps: jest.fn(() => []),
}))

jest.mock('@/scripts/lib/scanBaseline', () => ({
  ...jest.requireActual('@/scripts/lib/scanBaseline'),
  localQuestDataFiles: jest.fn(() => []),
}))

const { UsageError } = require('@/scripts/lib/cli-contract')
const { BASELINE_PATH, fetchProdMeta, isMissingOnProd, main, parseArgs, reportText, scanFile } = require('@/scripts/scan-quest-prod-drift')
const { diffQuestMeta } = require('@/scripts/lib/questProdDiff')

const localQuest = (questId: string) => ({
  id: null,
  quest_id: questId,
  title: questId,
  city: null,
  intro: null,
  finale: null,
  steps: [],
})

const httpError = (statusCode: number) => {
  const error: Error & { statusCode?: number } = new Error(`HTTP ${statusCode} for /api/quests/`)
  error.statusCode = statusCode
  return error
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('scanFile — квест, которого нет на проде', () => {
  it('пишет отдельную строку и продолжает обход остальных квестов файла', async () => {
    questBundles.loadLocalBundles.mockReturnValue([
      localQuest('ozero-glubokoe-crystal'),
      localQuest('glubokoe-cherry-baron'),
    ])
    questBundles.fetchQuestBundles
      .mockRejectedValueOnce(httpError(404))
      .mockResolvedValueOnce([{ quest_id: 'glubokoe-cherry-baron', steps: [] }])

    const { rows, compared } = await scanFile('scripts/ozero-glubokoe-quest-data.js', 'https://metravel.by')

    // Второй квест дошёл до сравнения — значит 404 оборвал итерацию, а не обход.
    expect(questBundles.fetchQuestBundles).toHaveBeenCalledTimes(2)
    expect(compared).toBe(1)
    expect(rows).toEqual([
      {
        file: 'scripts/ozero-glubokoe-quest-data.js',
        quest_id: 'ozero-glubokoe-crystal',
        missingOnProd: true,
        drifted: false,
      },
    ])
  })

  it('не валит код возврата: заливка такой квест не создаёт и откатить им контент нельзя', async () => {
    questBundles.loadLocalBundles.mockReturnValue([localQuest('ozero-glubokoe-crystal')])
    questBundles.fetchQuestBundles.mockRejectedValueOnce(httpError(404))

    const { rows, compared } = await scanFile('scripts/ozero-glubokoe-quest-data.js', 'https://metravel.by')

    expect(rows.some((row: { drifted: boolean }) => row.drifted)).toBe(false)
    // Ноль сравнений — то, по чему вызывающий отличает «сверили и чисто» от
    // «сверять было не с чем».
    expect(compared).toBe(0)
  })
})

describe('scanFile — порядок точек (#2426)', () => {
  it('отставший порядок валит гейт: по файлу гейт маршрута меряет крюки', async () => {
    const steps = [{ step_id: 'a', order: 1 }, { step_id: 'cafe', order: 2 }, { step_id: 'b', order: 3 }]
    questBundles.loadLocalBundles.mockReturnValue([{ ...localQuest('q'), steps: [{ step_id: 'a' }, { step_id: 'b' }, { step_id: 'cafe' }] }])
    questBundles.fetchQuestBundles.mockResolvedValueOnce([{ quest_id: 'q', steps }])
    questBundles.parseSteps.mockReturnValueOnce(steps)

    const { rows } = await scanFile('scripts/q-quest-data.js', 'https://metravel.by')

    expect(rows).toEqual([expect.objectContaining({ quest_id: 'q', drifted: true, order: { local: ['a', 'b', 'cafe'], prod: ['a', 'cafe', 'b'] } })])
  })
})

describe('scanFile — «измерить не удалось» остаётся фатальным', () => {
  it.each([
    ['5xx', httpError(502)],
    ['rate limit', httpError(429)],
    ['обрыв сокета', Object.assign(new Error('socket hang up'), { retryable: true })],
  ])('пробрасывает %s наружу, а не выдаёт за отсутствие квеста', async (_label, error) => {
    questBundles.loadLocalBundles.mockReturnValue([localQuest('minsk-cipher')])
    questBundles.fetchQuestBundles.mockRejectedValueOnce(error)

    await expect(scanFile('scripts/minsk-quest-data.js', 'https://metravel.by')).rejects.toBe(error)
  })
})

// #3373: мета квеста (точка старта, длительность, сложность, теги, pet_friendly)
// не сверялась вовсе — у pinsk-polesie старт на проде стоял в 869 м от файла,
// а гейт был зелёным.
describe('мета квеста (#3373)', () => {
  const FILE_META = {
    lat: 52.120116,
    lng: 26.115276,
    duration_min: 120,
    difficulty: 'easy',
    tags: ['history', 'citywalk', 'art'],
    pet_friendly: true,
  }
  // Форма строки каталога: координаты числом, теги объектом.
  const PROD_ROW = {
    quest_id: 'pinsk-polesie',
    lat: 52.120116,
    lng: 26.115276,
    duration_min: 120,
    difficulty: 'easy',
    tags: { citywalk: true, art: true, history: true },
    pet_friendly: true,
  }

  it('совпавшая мета в другой записи (теги объектом, другой порядок) — не расхождение', () => {
    expect(diffQuestMeta(FILE_META, PROD_ROW)).toEqual([])
    expect(diffQuestMeta(FILE_META, { ...PROD_ROW, lat: '52.1201160', tags: ['art', 'citywalk', 'history'] })).toEqual([])
  })

  it('координаты: в пределах 1e-6 — равны, дальше — расхождение', () => {
    expect(diffQuestMeta(FILE_META, { ...PROD_ROW, lat: 52.120117 })).toEqual([])
    expect(diffQuestMeta(FILE_META, { ...PROD_ROW, lat: 52.120118 })).toEqual([
      { field: 'lat', local: 52.120116, prod: 52.120118 },
    ])
  })

  it('называет каждое разошедшееся поле с обоими значениями', () => {
    const prod = { ...PROD_ROW, lat: 52.1135, duration_min: 90, difficulty: 'medium', tags: { legend: true, history: true }, pet_friendly: false }
    expect(diffQuestMeta(FILE_META, prod).map((c: { field: string }) => c.field)).toEqual([
      'lat', 'duration_min', 'difficulty', 'tags', 'pet_friendly',
    ])
  })

  it('поле, которого нет в meta файла, не сверяется: заливка его не шлёт', () => {
    const { pet_friendly: _omit, ...withoutPet } = FILE_META
    expect(diffQuestMeta(withoutPet, { ...PROD_ROW, pet_friendly: false })).toEqual([])
  })

  it('scanFile: искусственно изменённая мета валит гейт', async () => {
    questBundles.loadLocalBundles.mockReturnValue([{ ...localQuest('pinsk-polesie'), meta: FILE_META }])
    questBundles.fetchQuestBundles.mockResolvedValueOnce([{ quest_id: 'pinsk-polesie', steps: [] }])
    const prodMeta = new Map([['pinsk-polesie', { ...PROD_ROW, duration_min: 90 }]])

    const { rows } = await scanFile('scripts/pinsk-quest-data.js', 'https://metravel.by', prodMeta)

    expect(rows).toEqual([expect.objectContaining({
      quest_id: 'pinsk-polesie',
      drifted: true,
      meta: [{ field: 'duration_min', local: 120, prod: 90 }],
    })])
  })

  it('scanFile: та же мета — квест чист', async () => {
    questBundles.loadLocalBundles.mockReturnValue([{ ...localQuest('pinsk-polesie'), meta: FILE_META }])
    questBundles.fetchQuestBundles.mockResolvedValueOnce([{ quest_id: 'pinsk-polesie', steps: [] }])

    const { rows, compared } = await scanFile('scripts/pinsk-quest-data.js', 'https://metravel.by', new Map([['pinsk-polesie', PROD_ROW]]))

    expect(compared).toBe(1)
    expect(rows).toEqual([])
  })

  it('scanFile: квеста нет в каталоге — пометка «не сверена», а не «чисто»', async () => {
    questBundles.loadLocalBundles.mockReturnValue([{ ...localQuest('pinsk-polesie'), meta: FILE_META }])
    questBundles.fetchQuestBundles.mockResolvedValueOnce([{ quest_id: 'pinsk-polesie', steps: [] }])

    const { rows } = await scanFile('scripts/pinsk-quest-data.js', 'https://metravel.by', new Map())

    expect(rows).toEqual([expect.objectContaining({ quest_id: 'pinsk-polesie', drifted: false, metaUnchecked: true })])
  })

  it('fetchProdMeta: один обход каталога страницами по 200', async () => {
    questBundles.fetchQuestCatalog.mockResolvedValueOnce([PROD_ROW, { title: 'без id' }])

    const map = await fetchProdMeta('https://metravel.by')

    expect(questBundles.fetchQuestCatalog).toHaveBeenCalledTimes(1)
    expect(questBundles.fetchQuestCatalog).toHaveBeenCalledWith('https://metravel.by', 'ua-test', { pageSize: 200 })
    expect([...map.keys()]).toEqual(['pinsk-polesie'])
  })
})

// Baseline меты (#3373): 29 квестов с известным расхождением на 12.11.2026 не
// должны красить quest:gates соседям, но потолок только опускается.
describe('baseline меты (#3373)', () => {
  const META = { lat: 52.120116, lng: 26.115276, duration_min: 120, tags: ['history', 'story'] }
  const PROD = { quest_id: 'pinsk-polesie', lat: 52.120116, lng: 26.115276, duration_min: 90, tags: { history: true, legend: true } }
  const FILE = 'scripts/pinsk-quest-data.js'
  const scan = (knownKeys: string[], prod = PROD) => {
    questBundles.loadLocalBundles.mockReturnValue([{ ...localQuest('pinsk-polesie'), meta: META }])
    questBundles.fetchQuestBundles.mockResolvedValueOnce([{ quest_id: 'pinsk-polesie', steps: [] }])
    return scanFile(FILE, 'https://metravel.by', new Map([['pinsk-polesie', prod]]), knownKeys)
  }

  it('расхождение вне baseline — красный, даже если другое поле того же квеста в baseline', async () => {
    const { rows, staleBaseline } = await scan(['pinsk-polesie|duration_min'])

    expect(rows).toEqual([expect.objectContaining({
      drifted: true,
      meta: [expect.objectContaining({ field: 'tags' })],
      metaKnown: [expect.objectContaining({ field: 'duration_min' })],
    })])
    expect(staleBaseline).toEqual([])
  })

  it('расхождение из baseline — зелёный с жёлтой пометкой', async () => {
    const { rows, staleBaseline } = await scan(['pinsk-polesie|duration_min', 'pinsk-polesie|tags'])

    expect(rows).toEqual([expect.objectContaining({ drifted: false, meta: [] })])
    expect(rows[0].metaKnown.map((m: { field: string }) => m.field)).toEqual(['duration_min', 'tags'])
    expect(staleBaseline).toEqual([])

    const lines: string[] = []
    const spy = jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => { lines.push(args.join(' ')) })
    try { reportText(rows, 1, 1, staleBaseline) } finally { spy.mockRestore() }
    const out = lines.join('\n')
    expect(out).toContain('⚠️ известное расхождение меты (#3373): duration_min — файл 120; прод 90')
    expect(out).toContain('Расхождений с продом нет')
  })

  it('запись baseline, которой расхождение больше не отвечает, — устаревшая', async () => {
    const fixedProd = { ...PROD, duration_min: 120, tags: { history: true, story: true } }
    const { rows, staleBaseline } = await scan(['pinsk-polesie|duration_min', 'pinsk-polesie|lat', 'gone-quest|tags'], fixedProd)

    expect(rows).toEqual([])
    expect(staleBaseline).toEqual([
      { file: FILE, quest_id: 'gone-quest', field: 'tags', reason: 'квеста нет в файле' },
      { file: FILE, quest_id: 'pinsk-polesie', field: 'duration_min', reason: 'расхождения больше нет' },
      { file: FILE, quest_id: 'pinsk-polesie', field: 'lat', reason: 'расхождения больше нет' },
    ])

    // Код выхода красный, поэтому и отчёт не печатает зелёную строку.
    const logs: string[] = []
    const spy = jest.spyOn(console, 'log').mockImplementation((m) => { logs.push(String(m)) })
    try { reportText(rows, 1, 1, staleBaseline) } finally { spy.mockRestore() }
    expect(logs.join('\n')).toContain('Устаревшие записи baseline меты')
    expect(logs.join('\n')).not.toContain('Расхождений с продом нет')
  })

  it('квест, которого нет на проде, запись baseline не судит', async () => {
    questBundles.loadLocalBundles.mockReturnValue([{ ...localQuest('pinsk-polesie'), meta: META }])
    questBundles.fetchQuestBundles.mockRejectedValueOnce(httpError(404))

    const { staleBaseline } = await scanFile(FILE, 'https://metravel.by', new Map([['pinsk-polesie', PROD]]), ['pinsk-polesie|tags'])

    expect(staleBaseline).toEqual([])
  })

  describe('main', () => {
    const originalArgv = process.argv
    const originalExitCode = process.exitCode
    let dir = ''
    let logs: string[]

    const writeBaseline = (known: Record<string, string[]>) => {
      const file = path.join(dir, 'baseline.json')
      fs.writeFileSync(file, JSON.stringify({ contractVersion: 1, note: 'тест', known }))
      return file
    }
    const run = async (argv: string[]) => {
      process.argv = ['node', 'scripts/scan-quest-prod-drift.js', `--source=${FILE}`, ...argv]
      questBundles.loadLocalBundles.mockReturnValue([{ ...localQuest('pinsk-polesie'), meta: META }])
      questBundles.fetchQuestBundles.mockResolvedValue([{ quest_id: 'pinsk-polesie', steps: [] }])
      questBundles.fetchQuestCatalog.mockResolvedValue([PROD])
      return main()
    }

    beforeEach(() => {
      dir = makeTempDir('meta-baseline-')
      logs = []
      jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => { logs.push(args.join(' ')) })
      jest.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      jest.restoreAllMocks()
      process.argv = originalArgv
      process.exitCode = originalExitCode
      fs.rmSync(dir, { recursive: true, force: true })
    })

    it('вне baseline — код 1', async () => {
      await expect(run([`--baseline=${writeBaseline({})}`])).rejects.toThrow('разошлись с продом: 1 из 1 файлов')
    })

    it('всё в baseline — успех', async () => {
      await expect(run([`--baseline=${writeBaseline({ [FILE]: ['pinsk-polesie|duration_min', 'pinsk-polesie|tags'] })}`])).resolves.toBeUndefined()
    })

    it('устаревшая запись — код 1 и команда убрать; --prune-baseline только убирает', async () => {
      const keys = ['pinsk-polesie|duration_min', 'pinsk-polesie|tags', 'pinsk-polesie|lat']
      const file = writeBaseline({ [FILE]: keys })

      await expect(run([`--baseline=${file}`])).rejects.toThrow('устаревших записей baseline меты: 1 — node scripts/scan-quest-prod-drift.js --prune-baseline')
      expect(logs.join('\n')).toContain('pinsk-polesie] lat: расхождения больше нет')
      expect(logs.join('\n')).toContain('node scripts/scan-quest-prod-drift.js --prune-baseline')

      await expect(run([`--baseline=${file}`, '--prune-baseline'])).resolves.toBeUndefined()
      expect(JSON.parse(fs.readFileSync(file, 'utf8')).known).toEqual({ [FILE]: ['pinsk-polesie|duration_min', 'pinsk-polesie|tags'] })
    })

    it('несколько устаревших записей одного --source — вердикт с командой, а не TypeError счётчиков', async () => {
      const keys = ['pinsk-polesie|duration_min', 'pinsk-polesie|tags', 'pinsk-polesie|lat', 'pinsk-polesie|lng']
      await expect(run([`--baseline=${writeBaseline({ [FILE]: keys })}`]))
        .rejects.toThrow('устаревших записей baseline меты: 2 — node scripts/scan-quest-prod-drift.js --prune-baseline')
    })

    it('живой бандл без строки каталога — мета не сверена, код 1, а не «чисто»', async () => {
      process.argv = ['node', 'scripts/scan-quest-prod-drift.js', `--source=${FILE}`, `--baseline=${writeBaseline({})}`]
      questBundles.loadLocalBundles.mockReturnValue([{ ...localQuest('pinsk-polesie'), meta: META }])
      questBundles.fetchQuestBundles.mockResolvedValue([{ quest_id: 'pinsk-polesie', steps: [] }])
      questBundles.fetchQuestCatalog.mockResolvedValue([])

      await expect(main()).rejects.toThrow('мета не сверена (нет в каталоге): 1')
      expect(logs.join('\n')).toContain('Мета не сверена у 1 квестов')
      expect(logs.join('\n')).not.toContain('Расхождений с продом нет')
    })

    it('--json отдаёт новые и известные расхождения раздельно', async () => {
      await expect(run([`--baseline=${writeBaseline({ [FILE]: ['pinsk-polesie|duration_min'] })}`, '--json'])).rejects.toThrow('разошлись с продом')
      const out = JSON.parse(logs.join('\n'))
      expect(out.metaDrift.map((m: { field: string }) => m.field)).toEqual(['tags'])
      expect(out.metaKnown.map((m: { field: string }) => m.field)).toEqual(['duration_min'])
      expect(out.staleBaseline).toEqual([])
    })
  })

  it('боевой baseline: R4-квесты в него не входят', () => {
    const known = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), BASELINE_PATH), 'utf8')).known
    const quests = new Set(Object.values(known).flat().map((key) => String(key).split('|')[0]))
    for (const r4 of ['pinsk-polesie', 'minsk-dvoriki', 'vitebsk-dark-chronicle']) expect(quests.has(r4)).toBe(false)
  })
})

describe('isMissingOnProd', () => {
  it('узнаёт только 404, включая соседние 4xx', () => {
    expect(isMissingOnProd(httpError(404))).toBe(true)
    expect(isMissingOnProd(httpError(403))).toBe(false)
    expect(isMissingOnProd(httpError(410))).toBe(false)
    expect(isMissingOnProd(new Error('socket hang up'))).toBe(false)
    expect(isMissingOnProd(undefined)).toBe(false)
  })
})

describe('reportText', () => {
  const capture = (rows: unknown[], files: number, compared?: number) => {
    const lines: string[] = []
    const spy = jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      lines.push(args.join(' '))
    })
    try {
      reportText(rows, files, compared)
    } finally {
      spy.mockRestore()
    }
    return lines.join('\n')
  }

  it('называет отсутствующий квест отдельной категорией, а не расхождением полей', () => {
    const out = capture(
      [{ file: 'scripts/ozero-glubokoe-quest-data.js', quest_id: 'ozero-glubokoe-crystal', missingOnProd: true, drifted: false }],
      130,
      178,
    )

    expect(out).toContain('Сравнивать не с чем — на проде нет квеста с таким слагом: 1')
    expect(out).toContain('scripts/ozero-glubokoe-quest-data.js [ozero-glubokoe-crystal]')
    // Он не расхождение полей и не расхождение состава шагов — обе сводки о нём молчат.
    expect(out).toContain('Расхождений с продом нет')
    expect(out).not.toContain('Разошёлся состав шагов')
  })

  it('считает расхождения полей мимо отсутствующих квестов', () => {
    const out = capture(
      [
        { file: 'scripts/a-quest-data.js', quest_id: 'gone', missingOnProd: true, drifted: false },
        {
          file: 'scripts/b-quest-data.js',
          quest_id: 'drifted',
          local_steps: 3,
          prod_steps: 3,
          onlyLocal: [],
          onlyProd: [],
          changed: [{ step_id: '1-a', prod_db_id: 7, fields: ['task'] }],
          questLevel: [],
          drifted: true,
        },
      ],
      130,
      1,
    )

    expect(out).toContain('Сравнивать не с чем — на проде нет квеста с таким слагом: 1')
    expect(out).toContain('Разошлись с продом: 1 квестов, 1 шагов')
  })

  it('мета: поле и оба значения, команда — перенос файла на прод, а не обратный синк', () => {
    const out = capture(
      [{
        file: 'scripts/pinsk-quest-data.js',
        quest_id: 'pinsk-polesie',
        local_steps: 10,
        prod_steps: 10,
        onlyLocal: [],
        onlyProd: [],
        changed: [],
        questLevel: [],
        order: null,
        meta: [
          { field: 'duration_min', local: 120, prod: 90 },
          { field: 'tags', local: ['story', 'history'], prod: { legend: true, history: true } },
        ],
        drifted: true,
      }],
      1,
      1,
    )

    expect(out).toContain('мета / duration_min: файл 120; прод 90')
    expect(out).toContain('мета / tags: файл history,story; прод history,legend')
    expect(out).toContain('node scripts/sync-quest-to-prod.js --source-file=scripts/pinsk-quest-data.js --meta-only --dry-run')
    expect(out).toContain('Разошлись с продом: 1 квестов, 0 шагов, мета у 1')
    // Обратный синк меты не переносит — совет запустить его был бы ложным путём.
    expect(out).not.toContain('sync-quest-data-from-prod.js')
  })

  it('печатает охват рядом с вердиктом: «чисто» после одного сравнения не зелёное', () => {
    // Находка гейта #1811: частичный охват (свой бэкенд с парой засеянных
    // квестов, отставший прод) вердикт не валит, поэтому число сравнённых
    // обязано стоять в той же строке, а не теряться выше по отчёту.
    const missingRows = Array.from({ length: 178 }, (_, i) => ({
      file: `scripts/q${i}-quest-data.js`,
      quest_id: `q${i}`,
      missingOnProd: true,
      drifted: false,
    }))

    expect(capture(missingRows, 179, 1)).toContain('Расхождений с продом нет (сравнено 1 из 179 квестов).')
    // Полный охват без пропусков читается как раньше — лишнего шума нет.
    expect(capture([], 179, 179)).toContain('Расхождений с продом нет (сравнено 179 из 179 квестов).')
  })
})

describe('main — корпусный прогон, который ничего не сравнил', () => {
  const originalArgv = process.argv
  const originalExitCode = process.exitCode
  let logs: string[]

  // Пустой baseline меты: боевой называет реальные файлы, которых в этих
  // фикстурах нет, и все его записи читались бы как устаревшие.
  const emptyBaselineDir = makeTempDir('meta-baseline-empty-')
  const emptyBaseline = path.join(emptyBaselineDir, 'baseline.json')
  fs.writeFileSync(emptyBaseline, JSON.stringify({ contractVersion: 1, note: 'пусто', known: {} }))
  afterAll(() => removeDir(emptyBaselineDir))

  const run = (argv: string[]) => {
    process.argv = ['node', 'scripts/scan-quest-prod-drift.js', `--baseline=${emptyBaseline}`, ...argv]
    return main()
  }

  beforeEach(() => {
    logs = []
    jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.join(' '))
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    process.argv = originalArgv
    // main() пишет process.exitCode напрямую; без восстановления зелёный прогон
    // jest мог бы завершиться ненулевым кодом.
    process.exitCode = originalExitCode
  })

  it('падает, когда на проде не нашлось ни одного квеста корпуса', async () => {
    scanBaseline.localQuestDataFiles.mockReturnValue(['scripts/a-quest-data.js', 'scripts/b-quest-data.js'])
    questBundles.loadLocalBundles
      .mockReturnValueOnce([localQuest('a-quest')])
      .mockReturnValueOnce([localQuest('b-quest')])
    questBundles.fetchQuestBundles.mockRejectedValue(httpError(404))

    await expect(run(['--api-url=http://127.0.0.1:9911'])).rejects.toThrow(
      /не нашлось ни одного из 2 квестов корпуса/,
    )
    // Отчёт не напечатан вовсе: «Расхождений с продом нет» здесь было бы ложью.
    expect(logs.join('\n')).not.toContain('Расхождений с продом нет')
  })

  it('не падает, когда хоть один квест корпуса сравнился', async () => {
    scanBaseline.localQuestDataFiles.mockReturnValue(['scripts/a-quest-data.js', 'scripts/b-quest-data.js'])
    questBundles.loadLocalBundles
      .mockReturnValueOnce([localQuest('a-quest')])
      .mockReturnValueOnce([localQuest('b-quest')])
    questBundles.fetchQuestBundles
      .mockRejectedValueOnce(httpError(404))
      .mockResolvedValueOnce([{ quest_id: 'b-quest', steps: [] }])

    await expect(run([])).resolves.toBeUndefined()

    expect(logs.join('\n')).toContain('Сравнивать не с чем — на проде нет квеста с таким слагом: 1')
    expect(logs.join('\n')).toContain('Расхождений с продом нет')
    expect(process.exitCode).toBe(originalExitCode)
  })

  it('точечный --source по снятому с публикации файлу остаётся успешным', async () => {
    questBundles.loadLocalBundles.mockReturnValue([localQuest('ozero-glubokoe-crystal')])
    questBundles.fetchQuestBundles.mockRejectedValue(httpError(404))

    await expect(run(['--source=scripts/ozero-glubokoe-quest-data.js'])).resolves.toBeUndefined()

    expect(scanBaseline.localQuestDataFiles).not.toHaveBeenCalled()
    expect(logs.join('\n')).toContain('Расхождений с продом нет')
    expect(process.exitCode).toBe(originalExitCode)
  })
})

describe('parseArgs — неизвестный флаг это ошибка, а не полный корпус (#1934)', () => {
  it('отказывается от --quest-id вместо тихого обхода всего каталога', () => {
    expect(() => parseArgs(['--quest-id=brest-lantern'])).toThrow(UsageError)
    expect(() => parseArgs(['--quest-id=brest-lantern'])).toThrow(
      'Unknown argument: --quest-id=brest-lantern',
    )
  })

  it('принимает обе записи --source и --source=', () => {
    expect(parseArgs(['--source', 'scripts/brest-quest-data.js']).source).toBe(
      'scripts/brest-quest-data.js',
    )
    expect(parseArgs(['--source=scripts/brest-quest-data.js']).source).toBe(
      'scripts/brest-quest-data.js',
    )
  })
})
