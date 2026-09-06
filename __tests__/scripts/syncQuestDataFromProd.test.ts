import fs from 'fs'
import path from 'path'
import { makeTempDir, removeDir } from './cli-test-utils'

const questBundles = require('@/scripts/lib/questBundles')
const scanBaseline = require('@/scripts/lib/scanBaseline')

jest.mock('@/scripts/lib/questBundles', () => ({
  ...jest.requireActual('@/scripts/lib/questBundles'),
  fetchQuestBundles: jest.fn(),
}))
jest.mock('@/scripts/lib/scanBaseline', () => ({
  ...jest.requireActual('@/scripts/lib/scanBaseline'),
  localQuestDataFiles: jest.fn(),
}))

const { syncFile, main } = require('@/scripts/sync-quest-data-from-prod')
const localQuest = (questId: string, task = 'Старое задание') => ({
  quest_id: questId,
  steps: [{ step_id: `${questId}-step`, task }],
})
const httpError = (statusCode: number) => Object.assign(new Error(`HTTP ${statusCode}`), { statusCode })

describe('sync quest data — отсутствующий квест не обрывает корпус', () => {
  const originalArgv = process.argv
  const originalExitCode = process.exitCode
  let directory: string
  let logs: string[]
  let fileIndex: number

  const fixture = (quests: unknown) => {
    const file = path.join(directory, `fixture-${fileIndex++}-quest-data.js`)
    const text = `// Снятые с публикации данные сохраняются.\nmodule.exports = ${JSON.stringify(quests, null, 2)}\n`
    fs.writeFileSync(file, text)
    return { file, text }
  }
  const run = (args: string[]) => {
    process.argv = ['node', 'scripts/sync-quest-data-from-prod.js', ...args]
    return main()
  }

  beforeEach(() => {
    jest.resetAllMocks()
    directory = makeTempDir('sync-quest-test-')
    fileIndex = 0
    logs = []
    jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => { logs.push(args.join(' ')) })
    process.exitCode = undefined
  })

  afterEach(() => {
    removeDir(directory)
    jest.restoreAllMocks()
    process.argv = originalArgv
    process.exitCode = originalExitCode
  })

  it.each([true, false])('404 в массиве не мешает перенести соседний квест (dryRun=%s)', async (dryRun) => {
    const missing = localQuest('missing', 'Не трогать снятый квест')
    const present = localQuest('present')
    const { file, text } = fixture([missing, present])
    questBundles.fetchQuestBundles
      .mockRejectedValueOnce(httpError(404))
      .mockResolvedValueOnce([localQuest('present', 'Новое задание')])

    const result = await syncFile(file, { apiUrl: 'https://example.test', dryRun })

    expect(questBundles.fetchQuestBundles.mock.calls.map((call: string[]) => call[1])).toEqual(['missing', 'present'])
    expect(result).toMatchObject({
      compared: 1,
      missingOnProd: ['missing'],
      applied: [{ quest_id: 'present', step_id: 'present-step', field: 'task' }],
      skipped: [],
    })
    expect(fs.readFileSync(file, 'utf8')).toBe(dryRun ? text : text.replace('Старое задание', 'Новое задание'))
  })

  it('main обходит следующие файлы, печатает пропуск и охват; missing-файл не записывает', async () => {
    const missing = fixture(localQuest('missing'))
    const present = fixture(localQuest('present'))
    scanBaseline.localQuestDataFiles.mockReturnValue([missing.file, present.file])
    questBundles.fetchQuestBundles
      .mockRejectedValueOnce(httpError(404))
      .mockResolvedValueOnce([localQuest('present', 'Новое задание')])

    await run(['--all', '--api-url=https://example.test'])

    expect(fs.readFileSync(missing.file, 'utf8')).toBe(missing.text)
    expect(fs.readFileSync(present.file, 'utf8')).toBe(present.text.replace('Старое задание', 'Новое задание'))
    expect(logs.join('\n')).toContain('[missing] на проде нет — пропуск')
    expect(logs.join('\n')).toContain('Сравнено квестов: 1 из 2; на проде нет: 1')
    expect(logs.join('\n')).toContain('Перенесено полей: 1')
    expect(process.exitCode).toBeUndefined()
  })

  it('all-404 отклоняет нулевой охват до итогового успеха и оставляет файлы целыми', async () => {
    const files = [fixture(localQuest('missing-a')), fixture(localQuest('missing-b'))]
    scanBaseline.localQuestDataFiles.mockReturnValue(files.map(({ file }) => file))
    questBundles.fetchQuestBundles.mockRejectedValue(httpError(404))

    await expect(run(['--all', '--dry-run'])).rejects.toThrow('не нашлось ни одного из 2 квестов корпуса')

    expect(questBundles.fetchQuestBundles).toHaveBeenCalledTimes(2)
    expect(logs.join('\n')).toContain('[missing-b] на проде нет — пропуск')
    expect(logs.join('\n')).not.toContain('Перенесено полей:')
    for (const { file, text } of files) expect(fs.readFileSync(file, 'utf8')).toBe(text)
  })

  it('пустой корпус не выдаёт успешную синхронизацию', async () => {
    scanBaseline.localQuestDataFiles.mockReturnValue([])
    await expect(run(['--all'])).rejects.toThrow('синхронизация не выполнена')
    expect(logs.join('\n')).not.toContain('Перенесено полей:')
  })

  it('explicit missing --source завершается понятным пропуском без ошибки', async () => {
    const { file, text } = fixture(localQuest('ozero-glubokoe-crystal'))
    questBundles.fetchQuestBundles.mockRejectedValue(httpError(404))

    await expect(run([`--source=${file}`])).resolves.toBeUndefined()

    expect(scanBaseline.localQuestDataFiles).not.toHaveBeenCalled()
    expect(logs.join('\n')).toContain('[ozero-glubokoe-crystal] на проде нет — пропуск')
    expect(fs.readFileSync(file, 'utf8')).toBe(text)
    expect(process.exitCode).toBeUndefined()
  })

  it.each([
    ['403', httpError(403)],
    ['429', httpError(429)],
    ['502', httpError(502)],
    ['network', new Error('socket hang up')],
    ['message-only 404', new Error('HTTP 404 without statusCode')],
  ])('ошибка %s остаётся фатальной, файл не записывается', async (_label, error) => {
    const { file, text } = fixture([localQuest('present'), localQuest('failed')])
    questBundles.fetchQuestBundles
      .mockResolvedValueOnce([localQuest('present', 'Новое задание')])
      .mockRejectedValueOnce(error)

    await expect(run([`--source=${file}`])).rejects.toBe(error)

    expect(fs.readFileSync(file, 'utf8')).toBe(text)
    expect(logs.join('\n')).not.toContain('на проде нет — пропуск')
  })

  it('некорректные steps ответа не считаются отсутствующим квестом', async () => {
    const { file, text } = fixture(localQuest('present'))
    questBundles.fetchQuestBundles.mockResolvedValue([{ quest_id: 'present', steps: '{invalid JSON' }])

    await expect(run([`--source=${file}`])).rejects.toThrow()
    expect(fs.readFileSync(file, 'utf8')).toBe(text)
    expect(logs.join('\n')).not.toContain('на проде нет — пропуск')
  })

  it('сохраняет поддержку steps в виде JSON-строки', async () => {
    const { file, text } = fixture(localQuest('present'))
    const bundle = localQuest('present', 'Новое задание')
    questBundles.fetchQuestBundles.mockResolvedValue([{ ...bundle, steps: JSON.stringify(bundle.steps) }])

    const result = await syncFile(file, { apiUrl: 'https://example.test', dryRun: false })

    expect(result.compared).toBe(1)
    expect(result.applied).toHaveLength(1)
    expect(fs.readFileSync(file, 'utf8')).toBe(text.replace('Старое задание', 'Новое задание'))
  })

  it.each([
    null,
    {},
    { quest_id: 'present' },
    { quest_id: 'present', steps: '' },
    { quest_id: 'another-quest', steps: [] },
  ])('некорректный HTTP 200 bundle %j не засчитывается в охват', async (bundle) => {
    const { file, text } = fixture(localQuest('present'))
    scanBaseline.localQuestDataFiles.mockReturnValue([file])
    questBundles.fetchQuestBundles.mockResolvedValue([bundle])

    await expect(run(['--all'])).rejects.toThrow('Некорректный ответ для квеста present')
    expect(fs.readFileSync(file, 'utf8')).toBe(text)
    expect(logs.join('\n')).not.toContain('Сравнено квестов:')
    expect(logs.join('\n')).not.toContain('на проде нет — пропуск')
  })
})
