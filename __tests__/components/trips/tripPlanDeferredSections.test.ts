import { existsSync, readFileSync } from 'fs'
import { join, resolve } from 'path'

/**
 * #1543: платформенный сплит отложенных секций планировщика.
 *
 * `safeLazy` намеренно НЕ падает: если `import()` не резолвится, он после ретраев
 * отдаёт no-op компонент, и панель просто не появляется. Это правильно в
 * рантайме (лучше пустая секция, чем белый экран), но означает, что опечатка в
 * пути прошла бы и ревью, и сборку, и e2e «страница открылась». Поэтому пути
 * проверяются статически, а web- и native-половины сплита обязаны экспортировать
 * один и тот же набор имён — иначе на одной платформе секция тихо исчезает.
 */
const ROOT = resolve(__dirname, '..', '..', '..')
const WEB = 'components/trips/planning/tripPlanDeferredSections.web.tsx'
const NATIVE = 'components/trips/planning/tripPlanDeferredSections.tsx'

const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

const exportedNames = (source: string): string[] =>
  [...source.matchAll(/^export const ([A-Za-z0-9_]+)\s*=/gm)].map((match) => match[1]).sort()

const RESOLVE_EXTS = ['.web.tsx', '.web.ts', '.tsx', '.ts', '/index.web.tsx', '/index.tsx', '/index.ts']

const resolveAlias = (specifier: string): string | null => {
  if (!specifier.startsWith('@/')) return null
  const base = join(ROOT, specifier.slice(2))
  return RESOLVE_EXTS.map((ext) => base + ext).find((candidate) => existsSync(candidate)) ?? null
}

describe('tripPlanDeferredSections — платформенный сплит (#1543)', () => {
  it('web- и native-половины экспортируют один и тот же набор секций', () => {
    expect(exportedNames(read(WEB))).toEqual(exportedNames(read(NATIVE)))
  })

  it('каждый динамический import() web-половины ведёт в существующий модуль с default-экспортом', () => {
    const web = read(WEB)
    const specifiers = [...web.matchAll(/import\(\s*'([^']+)'\s*\)/g)].map((match) => match[1])

    // Контроль детектора: секции есть, и их столько же, сколько экспортов.
    expect(specifiers.length).toBe(exportedNames(web).length)
    expect(specifiers.length).toBeGreaterThan(0)

    const broken = specifiers
      .map((specifier) => ({ specifier, file: resolveAlias(specifier) }))
      .filter((entry) => entry.file === null || !/export default|as default/.test(readFileSync(entry.file, 'utf8')))
      .map((entry) => `${entry.specifier} -> ${entry.file ?? 'NOT RESOLVED'}`)

    expect(broken).toEqual([])
  })

  it('native-половина подключает те же модули синхронно', () => {
    const native = read(NATIVE)
    const syncSpecifiers = [...native.matchAll(/^import [A-Za-z0-9_]+ from '([^']+)'$/gm)].map((match) => match[1]).sort()
    const webSpecifiers = [...read(WEB).matchAll(/import\(\s*'([^']+)'\s*\)/g)].map((match) => match[1]).sort()

    expect(syncSpecifiers).toEqual(webSpecifiers)
  })
})
