/**
 * Guard #3227: экраны квестов не показывают сырой текст ошибки.
 *
 * До правки `useQuestBundle` отдавал экрану `error.message`, и на 404 бэкенда
 * гость видел «error: Quest with quest_id=… not found» с кнопкой «Повторить».
 * Контракт (`utils/questAddressState.ts`): хуки данных квестов отдают только
 * классификацию сбоя, экраны рисуют свой текст из `@/i18n`.
 *
 * Запрет держится с двух сторон:
 * 1. хуки данных (`hooks/useQuestsApi.ts`) не извлекают текст из ошибки вовсе;
 * 2. экраны раздела не читают `.message` у пойманной ошибки и не зовут
 *    `getErrorMessage` / `getApiErrorMessage`.
 */
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '..', '..')

/** Читает текст из объекта ошибки: `error.message`, `e?.message`, хелперы сообщений. */
const RAW_ERROR_TEXT = /\b(?:error|err|e|ex|cause|reason|failure|bundleError|questsError)\??\.message\b|\bget(?:Api)?ErrorMessage\s*\(/

/**
 * Исключения — только с причиной. Сюда попадает экран, у которого текст ошибки
 * уже локализован на API-слое и не является ответом адресного чтения квеста.
 */
const ALLOWED: Record<string, string> = {
  'components/quests/QuestInaccuracyReportModal.tsx':
    'форма обратной связи: `sendFeedback` (api/misc.ts) сам переводит ответ в текст из @/i18n',
}

const SCREEN_ROOTS = ['app/(tabs)/quests', 'components/quests', 'screens/tabs']
const SCREEN_FILES = ['app/[...missing].web.tsx']

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return entry.name.endsWith('.tsx') ? [full] : []
  })

const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join('/')

const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const questScreens = () => [
  ...SCREEN_ROOTS.flatMap((dir) => walk(path.join(ROOT, dir))),
  ...SCREEN_FILES.map((file) => path.join(ROOT, file)),
].filter((file) => /quest/i.test(rel(file)))

describe('guard #3227: сырой текст ошибки не доходит до экранов квестов', () => {
  it('хуки данных квестов не извлекают текст из ошибки', () => {
    const source = stripComments(fs.readFileSync(path.join(ROOT, 'hooks/useQuestsApi.ts'), 'utf8'))
    expect(source).not.toMatch(/\.message\b/)
    expect(source).not.toMatch(/\bget(?:Api)?ErrorMessage\b/)
    // Экран получает классификацию (`failure`) или факт сбоя (`failed`), а не поле `error`.
    expect(source).not.toMatch(/^\s*error\s*[:,]/m)
    expect(source).toMatch(/failure: addressedReadFailure\(questId, error\)/)
  })

  it('экраны раздела не читают `.message` пойманной ошибки', () => {
    const files = questScreens()
    // Срез не пуст и видит и маршруты, и компоненты: иначе guard молча ничего не проверяет.
    expect(files.map(rel)).toEqual(expect.arrayContaining([
      'app/(tabs)/quests/[city]/[questId].tsx',
      'app/(tabs)/quests/[city]/index.tsx',
      'app/(tabs)/quests/country/[country]/index.tsx',
      'components/quests/QuestNotFoundScreen.tsx',
      'screens/tabs/QuestsScreen.tsx',
    ]))

    const offenders = files
      .filter((file) => !(rel(file) in ALLOWED))
      .filter((file) => RAW_ERROR_TEXT.test(stripComments(fs.readFileSync(file, 'utf8'))))
      .map(rel)
    expect(offenders).toEqual([])
  })

  it('список исключений не протух: каждый файл существует и всё ещё читает текст ошибки', () => {
    for (const file of Object.keys(ALLOWED)) {
      const source = stripComments(fs.readFileSync(path.join(ROOT, file), 'utf8'))
      expect({ file, reads: RAW_ERROR_TEXT.test(source) }).toEqual({ file, reads: true })
    }
  })
})
