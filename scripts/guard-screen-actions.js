#!/usr/bin/env node
// #2101: guard действий экрана деталей (семейство MOBILE-ACTION-LABELS-001).
// На телефоне правка владельца — иконка в строке экрана (`useScreenHeader`),
// удаление/печать/экспорт — подписанные пункты «⋯» (`ActionListSheet`), удаление
// последним, `destructive`, через `ConfirmDialog`. Полноширинная кнопка
// `variant="danger"` и безымянная иконка корзины в теле экрана запрещены.
// Что остаётся в теле на desktop, помечается `SCREEN_HEADER_DESKTOP_PROPS` (блок
// снимается на телефоне). Исключения — только поимённо, с причиной.

const fs = require('node:fs')
const path = require('node:path')

// Экраны деталей и карточки, на которых действует правило.
const ACTION_SCREENS = [
  'app/(tabs)/trips/plan/[id].tsx',
  'components/trips/planning/TripPlanScreenHeader.tsx',
  'components/trips/PublicTripDetail.tsx',
  'components/UserPoints/PointCard.tsx',
  'components/screens/calendar/CalendarScreen.tsx',
  'components/screens/calendar/calendarScreen.parts.tsx',
]

// Экран, который обязан объявить действия в шапке (`useScreenHeader` прямо или через
// компонент-декларацию).
const REQUIRE_HEADER_DECLARATION = {
  'app/(tabs)/trips/plan/[id].tsx': /TripPlanScreenHeader|useScreenHeader\s*\(/,
  'components/trips/planning/TripPlanScreenHeader.tsx': /useScreenHeader\s*\(/,
  'components/trips/PublicTripDetail.tsx': /useScreenHeader\s*\(/,
  'components/screens/calendar/CalendarScreen.tsx': /useScreenHeader\s*\(/,
}

// Файл → причина, почему корзина/danger-кнопка вне «⋯» допустима. Пусто = нарушение.
const EXCEPTIONS = {
  'components/screens/calendar/calendarScreen.parts.tsx':
    'карточка календаря: одно действие, иконка с accessibilityLabel и confirmAction; лист даты — подписанная кнопка внутри листа. Перевод карточки на «⋯» — отдельная карточка.',
}

const DESKTOP_MARKER = 'SCREEN_HEADER_DESKTOP_PROPS'
const DANGER_BUTTON = /variant\s*=\s*["']danger["']/
const TRASH_ICON = /["']trash(?:-2)?["']/
// Потребитель пункта «⋯»: `overflow` шапки, `menuActions` карточки или `ActionListSheet`.
// Пункт с `destructive`, который уходит только в ряд чипов, ничего не делает (P2 #2101).
const OVERFLOW_CONSUMER = /\boverflow\s*[:=,}]|\bmenuActions\s*=|<ActionListSheet\b/

const hasNear = (lines, index, back, forward, test) => {
  const from = Math.max(0, index - back)
  const to = Math.min(lines.length - 1, index + forward)
  for (let i = from; i <= to; i += 1) {
    if (test(lines[i])) return true
  }
  return false
}

// Литерал объекта, внутри которого стоит строка: от ближайшей несбалансированной `{`
// назад до парной `}` вперёд.
function enclosingLiteral(source, offset) {
  let depth = 0
  let start = -1
  for (let i = offset; i >= 0; i -= 1) {
    const ch = source[i]
    if (ch === '}') depth += 1
    else if (ch === '{') {
      if (depth === 0) {
        start = i
        break
      }
      depth -= 1
    }
  }
  if (start < 0) return ''
  depth = 0
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  return ''
}

const isEffectiveDestructiveItem = (source, offset) => {
  const literal = enclosingLiteral(source, offset)
  return /\bdestructive\s*:\s*true\b|\bdestructive\b\s*[,}]/.test(literal) &&
    /\bonPress\b/.test(literal) &&
    OVERFLOW_CONSUMER.test(source)
}

function scanSource(rel, source) {
  const findings = []
  const lines = source.split('\n')
  const exception = EXCEPTIONS[rel]
  let lineStart = 0
  lines.forEach((line, index) => {
    const offset = lineStart + Math.max(0, line.search(TRASH_ICON))
    lineStart += line.length + 1
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
    const inDesktopBlock = hasNear(lines, index, 20, 0, (l) => l.includes(DESKTOP_MARKER))
    if (DANGER_BUTTON.test(line) && !inDesktopBlock && !exception) {
      findings.push(`${rel}:${index + 1}: Button variant="danger" в теле экрана — удаление это пункт «⋯» (destructive) + ConfirmDialog; на desktop блок помечают ${DESKTOP_MARKER}`)
    }
    if (TRASH_ICON.test(line) && !inDesktopBlock && !exception && !isEffectiveDestructiveItem(source, offset)) {
      findings.push(`${rel}:${index + 1}: иконка корзины вне пункта «⋯» с destructive — безымянное удаление в теле экрана запрещено`)
    }
  })
  if (REQUIRE_HEADER_DECLARATION[rel] && !REQUIRE_HEADER_DECLARATION[rel].test(source)) {
    findings.push(`${rel}: экран обязан объявить действия шапки через useScreenHeader`)
  }
  return findings
}

function scanScreenActions(rootDir) {
  const findings = []
  for (const rel of ACTION_SCREENS) {
    const file = path.join(rootDir, rel)
    if (!fs.existsSync(file)) {
      findings.push(`${rel}: файл из списка не найден — обнови scripts/guard-screen-actions.js`)
      continue
    }
    findings.push(...scanSource(rel, fs.readFileSync(file, 'utf8')))
  }
  for (const [rel, reason] of Object.entries(EXCEPTIONS)) {
    if (!ACTION_SCREENS.includes(rel) || !String(reason).trim()) {
      findings.push(`${rel}: исключение без причины или вне списка экранов`)
    }
  }
  return findings
}

module.exports = { ACTION_SCREENS, EXCEPTIONS, scanSource, scanScreenActions }

if (require.main === module) {
  const rootIdx = process.argv.indexOf('--root')
  const root = rootIdx > -1 ? path.resolve(process.argv[rootIdx + 1]) : process.cwd()
  const findings = scanScreenActions(root)
  if (findings.length) {
    console.error('guard-screen-actions failed:\n' + findings.map((f) => `  - ${f}`).join('\n'))
    process.exit(1)
  }
  console.log(`guard-screen-actions ok (${ACTION_SCREENS.length} files)`)
}
