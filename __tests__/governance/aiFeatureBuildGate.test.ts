import fs from 'node:fs'
import path from 'node:path'

/**
 * Сборочный контракт AI-фич (#2738, ROUTE-BUNDLE-001).
 *
 * Смысловой подбор (#2459) и ассистент (#2460) на проде выключены флагами, но до
 * #2738 их код всё равно собирался: точки подключения проверяли флаг вызовом
 * `isAiPicksEnabled()`/`isAiAssistantEnabled()`, а вызов функции Metro не
 * сворачивает, и `import()`/статический импорт оставались в графе — 59.5 KB
 * минифицированного кода и отдельный чанк экрана ассистента (18.4 KB gzip) в
 * релизном бюджете. Литеральное `process.env.EXPO_PUBLIC_AI_*` Expo подставляет
 * при сборке (`void 0` без переменной), и Metro сворачивает ветку до сбора
 * зависимостей (metro-transform-worker: constantFoldingPlugin → collectDependencies).
 *
 * Тест держит это для всего семейства: код вне папок фич подключает их модули
 * только внутри такого условия; статический импорт значения — ошибка, кроме
 * `KNOWN_STATIC_IMPORTS`. Те три импорта блоков подбора свёртку прошли бы, но замер
 * #2738 показал обратный эффект: без них группировка shared-чанков по сходству
 * маршрутов (патч @expo/metro-config) разложила 47 KB Brotli из `__shared-0` в пять
 * мелких чанков, и eager `(tabs)/profile.html` вырос 768.5 → 782.6 KB при потолке
 * 775. Их судьба решается вместе с переходом на upstream-чанкинг (#2741); новый
 * статический импорт в этот список не добавляется.
 */

const repoRoot = path.resolve(__dirname, '../..')
const ROOTS = ['app', 'components', 'screens', 'hooks', 'context', 'utils', 'stores', 'api', 'constants']

// Модули фич: их код должен уходить из сборки без флага.
const FEATURE_SPECIFIER =
  /^@\/(?:components\/aiPicks\/|api\/aiPicks(?:\/|$)|api\/aiAssist(?:\/|$)|hooks\/useAiPicks(?:\/|$)|components\/screens\/assistant\/(?!assistantSeo$))/
// Файлы самих фич импортируют друг друга свободно.
const FEATURE_FILE =
  /^(?:components\/aiPicks\/|api\/aiPicks|api\/aiAssist\/|hooks\/useAiPicks|components\/screens\/assistant\/)/
const KNOWN_STATIC_IMPORTS = new Set([
  'app/(tabs)/quests/[city]/[questId].tsx',
  'components/listTravel/ListTravelBase.tsx',
  'components/listTravel/SearchPageSkeleton.tsx',
])
// Ветка условия: от литерального флага до `?` и дальше без `;`/`:` до самого вызова.
const FLAG_BRANCH = /process\.env\.EXPO_PUBLIC_AI_(?:PICKS|ASSISTANT)\b[^;]*\?[^;:]*$/
const STATEMENT_START = /[\n;]\s*(?:export\s+)?(?:const|let|var|function|return|if|import)\b/g

const listSources = (dir: string): string[] => {
  const abs = path.join(repoRoot, dir)
  if (!fs.existsSync(abs)) return []
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : listSources(rel)
    return /\.(?:tsx?|jsx?)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name) ? [rel] : []
  })
}

type Reference = { file: string; line: number; kind: 'static' | 'gated' | 'ungated'; text: string }

const lineOf = (source: string, index: number) => source.slice(0, index).split('\n').length

const collectReferences = (): Reference[] => {
  const references: Reference[] = []
  for (const file of ROOTS.flatMap(listSources)) {
    const posix = file.split(path.sep).join('/')
    if (FEATURE_FILE.test(posix)) continue
    const source = fs.readFileSync(path.join(repoRoot, file), 'utf8')
    for (const match of source.matchAll(/^\s*import\s+(type\s+)?[^;]*?from\s+['"]([^'"]+)['"]/gm)) {
      if (match[1] || !FEATURE_SPECIFIER.test(match[2]) || KNOWN_STATIC_IMPORTS.has(posix)) continue
      references.push({ file: posix, line: lineOf(source, match.index ?? 0), kind: 'static', text: match[0].trim() })
    }
    for (const match of source.matchAll(/(typeof\s+)?\b(require|import)\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      if (match[1] || !FEATURE_SPECIFIER.test(match[3])) continue
      const index = match.index ?? 0
      // Только текущий оператор: от последнего начала объявления/оператора до вызова,
      // иначе `?` соседнего выражения засчитал бы незащищённый import() (code-review-gate #2738).
      const window = source.slice(Math.max(0, index - 400), index)
      const statementStart = Math.max(
        0,
        ...[...window.matchAll(STATEMENT_START)].map((start) => (start.index ?? 0) + 1),
      )
      // `cond ? import(a) : null` и `React.lazy(() => cached ?? import(a))` внутри той же ветки.
      const gated = FLAG_BRANCH.test(window.slice(statementStart))
      references.push({
        file: posix,
        line: lineOf(source, index),
        kind: gated ? 'gated' : 'ungated',
        text: match[0],
      })
    }
  }
  return references
}

describe('AI feature build gate (#2738)', () => {
  const references = collectReferences()

  it('finds the known entry points, so the scan is not vacuous', () => {
    const files = new Set(references.filter((r) => r.kind === 'gated').map((r) => r.file))
    expect([...files].sort()).toEqual(
      expect.arrayContaining([
        'app/(tabs)/assistant.tsx',
        'components/travel/details/sections/TravelDetailsSidebarSection.tsx',
      ]),
    )
  })

  it('never imports AI feature modules statically outside the feature folders', () => {
    expect(references.filter((r) => r.kind === 'static')).toEqual([])
  })

  it('keeps the known static imports list from going stale', () => {
    for (const file of KNOWN_STATIC_IMPORTS) {
      const source = fs.readFileSync(path.join(repoRoot, file), 'utf8')
      expect([file, /from\s+['"]@\/components\/aiPicks\//.test(source)]).toEqual([file, true])
    }
  })

  it('loads AI feature modules only under a literal process.env flag condition', () => {
    expect(references.filter((r) => r.kind === 'ungated')).toEqual([])
  })
})
