// #3304: скрипт, пишущий на прод, не пишет при запуске без флага режима.
//
// Guard читает исходник и ничего не исполняет: у разовых скриптов нет
// `require.main === module`, загрузка файла — уже запуск с записью на прод.
// Здесь заперты обе границы: что считается пишущим скриптом и какой способ
// выбора режима считается безопасным.
const fs = require('fs')
const path = require('path')
const { makeTempDir, removeDir } = require('./cli-test-utils')

const { REGISTERED, classifySource, scanScripts } = require('@/scripts/guard-prod-write-mode')

const repoRoot = path.resolve(__dirname, '../..')

const withScripts = (files: Record<string, string>, run: (root: string) => void) => {
  const root = makeTempDir('prod-write-mode-')
  for (const [name, body] of Object.entries(files)) {
    const target = path.join(root, 'scripts', name)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, body, 'utf8')
  }
  try { run(root) } finally { removeDir(root) }
}

const WRITE = "SESSION.request('https://metravel.by/api/quest-steps/', { method: 'POST' })\n"
const SHARED = "const args = process.argv.slice(2)\nconst { isDryRun } = require('./lib/one-off-write-mode').resolveOneOffWriteMode(args, { script: __filename })\n"

describe('classifySource: кто пишет на прод и как выбирает режим', () => {
  it('не считает пишущим скрипт, который только читает', () => {
    expect(classifySource({ filePath: 'scripts/read.js', content: "fetch('https://metravel.by/api/quests/', { method: 'GET' })" })).toBeNull()
  })

  it('не считает пишущим скрипт без адреса или сессии API сайта', () => {
    expect(classifySource({ filePath: 'scripts/local.js', content: "server.on('request', (req) => req.method === 'POST')" })).toBeNull()
  })

  it('не принимает упоминание в комментарии за запись', () => {
    expect(classifySource({ filePath: 'scripts/doc.js', content: "// шлёт 'POST' на https://metravel.by\nmodule.exports = {}" })).toBeNull()
  })

  it.each([
    ["args.includes('--dry-run')", "const isDryRun = args.includes('--dry-run')\n"],
    ['без режима вовсе', ''],
    ['multipart-загрузка', "const form = new FormData()\nfetch(`${process.env.METRAVEL_API}/upload`, { body: form })\n"],
    ['метод строчными', "fetch('https://metravel.by/api/quest-steps/', { method: 'post' })\n"],
  ])('находит писателя с боевой записью по умолчанию: %s', (_label, mode) => {
    const verdict = classifySource({ filePath: 'scripts/fix-one-thing.js', content: `${mode}${WRITE}` })
    expect(verdict).toMatchObject({ file: 'scripts/fix-one-thing.js', kind: 'unguarded_writer' })
  })

  it('видит писателя, который целится в прод флагом --api-url', () => {
    const content = "const api = args.find((a) => a.startsWith('--api-url='))\nfetch(api, { method: 'PATCH' })\n"
    expect(classifySource({ filePath: 'scripts/upload-thing.js', content })).toMatchObject({ kind: 'unguarded_writer' })
  })

  it('пропускает писателя на общем помощнике', () => {
    expect(classifySource({ filePath: 'scripts/fix-one-thing.js', content: `${SHARED}${WRITE}` }))
      .toEqual({ file: 'scripts/fix-one-thing.js', mode: 'shared-mode' })
  })

  it('не засчитывает помощник, названный только в комментарии', () => {
    const content = `// require('./lib/one-off-write-mode').resolveOneOffWriteMode(args, {})\n${WRITE}`
    expect(classifySource({ filePath: 'scripts/fix-one-thing.js', content })).toMatchObject({ kind: 'unguarded_writer' })
  })

  it.each([
    "const force = args.includes('--apply')\n",
    "if (process.argv.indexOf('--dry-run') >= 0) process.exit(0)\n",
    "const dry = args.some((a) => a === '--dry-run')\n",
    "const dry = has('dry-run')\n",
  ])('краснеет, когда рядом с помощником осталось ручное чтение режима: %s', (handRolled) => {
    expect(classifySource({ filePath: 'scripts/fix-one-thing.js', content: `${SHARED}${handRolled}${WRITE}` }))
      .toMatchObject({ kind: 'hand_rolled_mode' })
  })

  it('отдаёт операторские CLI их собственному guard', () => {
    expect(classifySource({ filePath: 'scripts/seo-edit.js', content: WRITE })).toEqual({ file: 'scripts/seo-edit.js', mode: 'cli-contract' })
    // Тот же файл в библиотечном каталоге CLI-контрактом не покрыт.
    expect(classifySource({ filePath: 'scripts/ops/lib/other.js', content: WRITE })).toMatchObject({ kind: 'unguarded_writer' })
  })

  it('держит закрытый список честным: шаблон обязан найтись в коде', () => {
    const registered = { 'scripts/own.js': { evidence: /if \(!LIVE\) return/, reason: 'свой флаг' } }
    expect(classifySource({ filePath: 'scripts/own.js', content: `if (!LIVE) return\n${WRITE}`, registered }))
      .toEqual({ file: 'scripts/own.js', mode: 'registered', reason: 'свой флаг' })
    expect(classifySource({ filePath: 'scripts/own.js', content: `// if (!LIVE) return\n${WRITE}`, registered }))
      .toMatchObject({ kind: 'stale_registration' })
    expect(classifySource({ filePath: 'scripts/own.js', content: 'module.exports = {}', registered }))
      .toMatchObject({ kind: 'stale_registration' })
  })
})

describe('scanScripts', () => {
  it('обходит подкаталоги, но не библиотеки и не каталоги состояния', () => {
    withScripts({
      'fix-a.js': WRITE,
      'ops/fix-b.cjs': WRITE,
      'lib/session.js': WRITE,
      '.backups/old.js': WRITE,
      'fix-c.js': `${SHARED}${WRITE}`,
      'notes.md': WRITE,
    }, (root) => {
      const result = scanScripts(root, { registered: {} })
      expect(result.scanned).toBe(3)
      expect(result.findings.map((finding: { file: string }) => finding.file)).toEqual(['scripts/fix-a.js', 'scripts/ops/fix-b.cjs'])
      expect(result.writers).toEqual([{ file: 'scripts/fix-c.js', mode: 'shared-mode' }])
    })
  })

  it('краснеет на записи списка без файла и на пустом обходе', () => {
    withScripts({ 'read.js': 'module.exports = {}' }, (root) => {
      const registered = { 'scripts/gone.js': { evidence: /x/, reason: 'r' } }
      expect(scanScripts(root, { registered }).findings).toEqual([expect.objectContaining({ file: 'scripts/gone.js', kind: 'stale_registration' })])
    })
    const empty = makeTempDir('prod-write-mode-empty-')
    try {
      expect(scanScripts(empty, { registered: {} }).findings).toEqual([expect.objectContaining({ kind: 'empty_scan' })])
    } finally { removeDir(empty) }
  })

  // Сам инвариант карточки: в дереве нет скрипта, который пишет на прод без
  // явного флага. Перечень — фактический, не список в тесте: новый писатель
  // попадает сюда в день появления.
  it('в репозитории каждый пишущий скрипт выбирает режим проверенным способом', () => {
    const result = scanScripts(repoRoot)
    expect(result.findings).toEqual([])
    const files = result.writers.map((writer: { file: string }) => writer.file)
    expect(files).toEqual(expect.arrayContaining([
      'scripts/add-quest-spots.js',
      'scripts/create-brest-guide.js',
      'scripts/fix-quest-cafes.js',
      'scripts/migrate-antalya-quest.js',
      'scripts/migrate-description-images.js',
      'scripts/update-quest-content.js',
      'scripts/update-warsaw-steps.js',
      'scripts/upload-quest-finales.js',
      'scripts/upload-quest-media.js',
    ]))
    const registered = result.writers.filter((writer: { mode: string }) => writer.mode === 'registered').map((writer: { file: string }) => writer.file)
    expect(registered.sort()).toEqual(Object.keys(REGISTERED).sort())
  })
})
