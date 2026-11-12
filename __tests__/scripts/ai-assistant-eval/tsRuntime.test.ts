/**
 * @jest-environment node
 */
import fs from 'fs'
import path from 'path'

import { runCli } from '../cli-test-utils'

// #3291: проверки контура считают ответ общим кодом приложения (`api/aiAssist/*.ts`), поэтому
// `checks.mjs` грузит TypeScript. Команды контура подключают загрузчик `scripts/lib/ts-runtime.mjs`:
// без него `npm run ai:assistant:eval` не загружался на Node без встроенного снятия типов —
// объявленном проектом 22.13.1 и Node 20, который стоит по умолчанию на рабочей машине.
const ROOT = process.cwd()
// Те же флаги, что у команд контура в `package.json`.
const PRELOAD = ['--import', './scripts/lib/ts-runtime.mjs', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON']
const [major, minor] = process.versions.node.split('.').map(Number)
/** Флаг появился вместе со снятием типов (22.6): им на новом Node проверяется путь загрузчика. */
const canDisableNative = major > 22 || (major === 22 && minor >= 6)

const PROBE = [
  "const checks = await import('./scripts/ai-assistant-eval/checks.mjs')",
  "const { loadAskProvider } = await import('./scripts/ai-assistant-eval/ask-path.mjs')",
  'const provider = await loadAskProvider()',
  "const card = { n: 1, type: 'quest', title: 'Квест про цмока', url: 'https://metravel.by/quests/4/minsk-cmok', snippet: 'Точек: 10. Длительность: 45 мин' }",
  "const observed = { answerText: 'Старт в 18:00, идите в Квест про цмока.', linkLabels: ['Квест про цмока'], modelCall: { cards: [card] } }",
  "const defects = checks.findGuardDefects({ question: 'Когда начинать квест про цмока?' }, observed)",
  "console.log(JSON.stringify({ mode: globalThis[Symbol.for('metravel.tsRuntime')], checks: defects.map((item) => item.check), askClient: typeof provider.createAskClient }))",
].join('\n')

const probe = (nodeFlags: string[]) => {
  const run = runCli(process.execPath, [...nodeFlags, ...PRELOAD, '--input-type=module', '-e', PROBE], { cwd: ROOT })
  return { status: run.status, stderr: run.stderr.replace(/^.*ExperimentalWarning.*\n|^\(Use `node --trace-warnings.*\n/gm, ''), out: run.stdout.trim() ? JSON.parse(run.stdout.trim()) : null }
}

describe('контур оценки: общий код приложения грузится на любом Node проекта (#3291)', () => {
  it('команды ai:assistant:* в package.json подключают загрузчик TypeScript и не требуют ручных флагов', () => {
    const scripts = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts as Record<string, string>
    const contour = Object.entries(scripts).filter(([, command]) => command.includes('scripts/ai-assistant-eval/'))
    expect(contour.map(([name]) => name).sort()).toEqual(['ai:assistant:accept', 'ai:assistant:eval', 'ai:assistant:quality'])
    for (const [name, command] of contour) {
      expect({ name, preload: command.includes('--import ./scripts/lib/ts-runtime.mjs') }).toEqual({ name, preload: true })
      // Флаг снятия типов Node 20 не знает и падает на нём до запуска скрипта.
      expect(command).not.toContain('--experimental-strip-types')
    }
  })

  it('с загрузчиком проверки стража и клиент пути службы работают на этом Node', () => {
    const result = probe([])
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    expect(result.out).toMatchObject({ checks: ['ungrounded_number'], askClient: 'function' })
    expect(['native', 'hooks']).toContain(result.out.mode)
  })

  const hooksOnly = canDisableNative ? it : it.skip

  // #3345: прямой `node scripts/ai-assistant-eval/run.mjs` без `--import` на Node без встроенного снятия
  // типов падал с ERR_UNKNOWN_FILE_EXTENSION на первом импорте — раньше, чем скрипт успевал что-то сказать.
  // Точка входа подключает загрузчик сама; до разбора аргументов дело доходит только после загрузки
  // всего графа модулей (`run-core.mjs` → `checks.mjs` → `api/aiAssist/*.ts`).
  const directRun = (nodeFlags: string[]) => runCli(process.execPath, [...nodeFlags, 'scripts/ai-assistant-eval/run.mjs', '--нет-такого-флага'], { cwd: ROOT })

  it('прямой запуск run.mjs без --import грузит общий код приложения и доходит до разбора аргументов', () => {
    const run = directRun([])
    expect(run.stderr).toContain('неизвестный флаг --нет-такого-флага')
    expect(run.stderr).not.toContain('ERR_UNKNOWN_FILE_EXTENSION')
    expect(run.status).toBe(1)
    // Точка входа не тянет TypeScript статически: иначе загрузчик не успел бы встать.
    const entry = fs.readFileSync(path.join(ROOT, 'scripts/ai-assistant-eval/run.mjs'), 'utf8')
    expect(entry.match(/^import .*$/gm)).toBeNull()
    expect(entry.indexOf("await import('../lib/ts-runtime.mjs')")).toBeGreaterThan(-1)
    expect(entry.indexOf("await import('../lib/ts-runtime.mjs')")).toBeLessThan(entry.indexOf("await import('./run-core.mjs')"))
  })

  hooksOnly('прямой запуск run.mjs без встроенного снятия типов (как Node 20 и 22.13) — то же самое', () => {
    const run = directRun(['--no-experimental-strip-types'])
    expect(run.stderr).toContain('неизвестный флаг --нет-такого-флага')
    expect(run.stderr).not.toContain('ERR_UNKNOWN_FILE_EXTENSION')
    expect(run.status).toBe(1)
  })
  hooksOnly('без встроенного снятия типов (как Node 20 и 22.13) тот же код грузит загрузчик проекта', () => {
    const result = probe(['--no-experimental-strip-types'])
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    expect(result.out).toEqual({ mode: 'hooks', checks: ['ungrounded_number'], askClient: 'function' })
  })
})
