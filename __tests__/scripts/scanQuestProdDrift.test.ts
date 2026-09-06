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
const questBundles = require('@/scripts/lib/questBundles')
const scanBaseline = require('@/scripts/lib/scanBaseline')

jest.mock('@/scripts/lib/questBundles', () => ({
  fetchQuestBundles: jest.fn(),
  loadLocalBundles: jest.fn(),
  parseSteps: jest.fn(() => []),
}))

jest.mock('@/scripts/lib/scanBaseline', () => ({
  ...jest.requireActual('@/scripts/lib/scanBaseline'),
  localQuestDataFiles: jest.fn(() => []),
}))

const { isMissingOnProd, main, reportText, scanFile } = require('@/scripts/scan-quest-prod-drift')

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

  const run = (argv: string[]) => {
    process.argv = ['node', 'scripts/scan-quest-prod-drift.js', ...argv]
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
