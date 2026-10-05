#!/usr/bin/env node
// #2099: guard контракта useScreenHeader. Экран, у которого HeaderContextBar на
// телефоне показывает «←», обязан объявить шапку через `useScreenHeader` и не
// рисовать в своём теле заголовок первого уровня с названием экрана
// (`accessibilityRole="header"` / `role="heading"`). Заголовок рисует строка «←»
// на телефоне и `ScreenHeader` на desktop. Baseline пуст; исключения — поимённо.

const fs = require('node:fs')
const path = require('node:path')

// Вложенные экраны: файл, который владеет шапкой экрана.
const SCREEN_HEADER_OWNERS = [
  'components/trips/MyTripsDashboard.tsx',
  'components/trips/PublicTripsCatalog.tsx',
  'app/(tabs)/trips/plan/create.tsx',
  'app/(tabs)/subscriptions.tsx',
  'components/screens/settings/SettingsScreen.tsx',
  'components/UserPoints/PointsListHeader.tsx',
  'app/contact.tsx',
  'screens/tabs/usePlacesScreenHeader.ts',
  'components/screens/roulette/RouletteScreen.tsx',
  'app/(tabs)/about.tsx',
  'app/(tabs)/favorites.tsx',
  'components/screens/history/HistoryScreen.tsx',
  'components/screens/calendar/CalendarScreen.tsx',
  // #2148: экран прохождения квеста — декларацию зовёт визард
  // (`guard-screen-actions.js` требует вызов в `QuestWizard.tsx`).
  'components/quests/useQuestScreenHeader.ts',
]

// Файл → причина, почему прямой заголовок в теле допустим.
const DIRECT_HEADING_EXCEPTIONS = {}

const HEADING_PATTERN = /accessibilityRole\s*=\s*["']header["']|role\s*=\s*["']heading["']|role:\s*["']heading["']/

function scanOwnerSource(rel, source) {
  const failures = []
  if (!/\buseScreenHeader\s*\(/.test(source)) {
    failures.push(`${rel}: вложенный экран обязан вызвать useScreenHeader (заголовок, (i), действия объявляются один раз)`)
  }
  if (HEADING_PATTERN.test(source) && !DIRECT_HEADING_EXCEPTIONS[rel]) {
    failures.push(`${rel}: прямой заголовок (accessibilityRole="header") в теле экрана запрещён — его рисует ScreenHeader/HeaderContextBar`)
  }
  return failures
}

function scanScreenHeaders(root) {
  const failures = []
  for (const rel of SCREEN_HEADER_OWNERS) {
    const file = path.join(root, rel)
    if (!fs.existsSync(file)) {
      failures.push(`${rel}: файл из списка не найден — обнови scripts/guard-screen-header.js`)
      continue
    }
    failures.push(...scanOwnerSource(rel, fs.readFileSync(file, 'utf8')))
  }
  return failures
}

// #2234: верхний безопасный отступ шапки на native — у одного владельца, контейнера
// `CustomHeader` (`useSafeAreaInsetsSafe().top` → `createCustomHeaderStyles`). Строки
// шапки (бренд-строка, строка «←», действия) отступ под статус-бар не задают: на Android
// его нёс стиль бренд-строки, #2100 убрал строку на вложенных экранах — и строка «←»
// ушла под статус-бар. `StatusBar.currentHeight` в оболочке шапки запрещён.
const HEADER_INSET_OWNER = 'components/layout/CustomHeader.tsx'
const HEADER_SHELL_FILES = [
  'components/layout/customHeaderStyles.ts',
  'components/layout/HeaderContextBar.tsx',
  'components/layout/ScreenHeaderBarActions.tsx',
  'components/ui/ScreenHeader.tsx',
]
const STATUS_BAR_HEIGHT_PATTERN = /\bStatusBar\.currentHeight\b/
const ROW_INSET_PATTERN = /\buseSafeAreaInsets(?:Safe)?\s*\(|\bSafeAreaView\b/
const OWNER_INSET_PATTERN = /createCustomHeaderStyles\([^)]*\.top\b/

const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

function scanHeaderInsetSource(rel, source) {
  const code = stripComments(source)
  const failures = []
  if (rel === HEADER_INSET_OWNER) {
    if (!OWNER_INSET_PATTERN.test(code)) {
      failures.push(`${rel}: контейнер шапки обязан передать верхний инсет (useSafeAreaInsetsSafe().top) в createCustomHeaderStyles (#2234)`)
    }
  } else if (ROW_INSET_PATTERN.test(code)) {
    failures.push(`${rel}: строка шапки не берёт safe-area сама — верхний инсет у контейнера CustomHeader (#2234)`)
  }
  if (STATUS_BAR_HEIGHT_PATTERN.test(code)) {
    failures.push(`${rel}: StatusBar.currentHeight в оболочке шапки запрещён — отступ под статус-бар даёт контейнер из useSafeAreaInsets (#2234)`)
  }
  return failures
}

function scanHeaderInsets(root) {
  const failures = []
  for (const rel of [HEADER_INSET_OWNER, ...HEADER_SHELL_FILES]) {
    const file = path.join(root, rel)
    if (!fs.existsSync(file)) {
      failures.push(`${rel}: файл оболочки шапки не найден — обнови scripts/guard-screen-header.js`)
      continue
    }
    failures.push(...scanHeaderInsetSource(rel, fs.readFileSync(file, 'utf8')))
  }
  return failures
}

module.exports = {
  SCREEN_HEADER_OWNERS,
  DIRECT_HEADING_EXCEPTIONS,
  HEADER_INSET_OWNER,
  HEADER_SHELL_FILES,
  scanOwnerSource,
  scanScreenHeaders,
  scanHeaderInsetSource,
  scanHeaderInsets,
}

if (require.main === module) {
  const root = process.argv.includes('--root') ? path.resolve(process.argv[process.argv.indexOf('--root') + 1]) : process.cwd()
  const failures = [...scanScreenHeaders(root), ...scanHeaderInsets(root)]
  if (failures.length) {
    console.error('guard-screen-header failed:\n' + failures.map((f) => `  - ${f}`).join('\n'))
    process.exit(1)
  }
  console.log(
    `guard-screen-header ok (${SCREEN_HEADER_OWNERS.length} screens, ${HEADER_SHELL_FILES.length + 1} header shell files)`,
  )
}
