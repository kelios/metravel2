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

module.exports = { SCREEN_HEADER_OWNERS, DIRECT_HEADING_EXCEPTIONS, scanOwnerSource, scanScreenHeaders }

if (require.main === module) {
  const root = process.argv.includes('--root') ? path.resolve(process.argv[process.argv.indexOf('--root') + 1]) : process.cwd()
  const failures = scanScreenHeaders(root)
  if (failures.length) {
    console.error('guard-screen-header failed:\n' + failures.map((f) => `  - ${f}`).join('\n'))
    process.exit(1)
  }
  console.log(`guard-screen-header ok (${SCREEN_HEADER_OWNERS.length} screens)`)
}
