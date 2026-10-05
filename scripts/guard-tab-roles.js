#!/usr/bin/env node
/**
 * #2262 / IOS-TAB-ROLE-TRAIT-001: роли вкладки и ряда вкладок ставятся только
 * через `getTabA11yProps` / `getTabListA11yProps` (`utils/a11yTabRoles.ts`).
 *
 * RN 0.86 на iOS не переводит `accessibilityRole` `tab`/`tablist` в трейт
 * (`fromString` в `accessibilityPropsConversions.h` → `None`): VoiceOver не
 * объявляет ни вкладку, ни ряд. Помощник отдаёт на iOS `button` + `selected` и
 * `tabbar`, на web и Android — прежние `tab`/`tablist`. Прямая запись роли в
 * компоненте снова теряет трейт на iPhone и iPad, поэтому она — нарушение:
 *   accessibilityRole="tab"            role="tablist"
 *   accessibilityRole={'tablist' as any}
 *   accessibilityRole={isWeb ? 'tab' : 'button'}
 *   role: 'tab'                        role: Platform.select({ default: 'tab' })
 * Владелец ролей (`utils/a11yTabRoles.ts`) записывает их сам.
 */
const fs = require('node:fs')
const path = require('node:path')
const { maskSource } = require('./lib/maskSource')

const ROOT = path.resolve(__dirname, '..')
const SCAN_DIRS = ['app', 'components', 'screens', 'hooks', 'context', 'ui', 'utils']
const ALLOW_FILES = new Set(['utils/a11yTabRoles.ts'])
const SOURCE = new Set(['.js', '.jsx', '.ts', '.tsx'])

const TAB_VALUE = String.raw`["'\`](?:tab|tablist)["'\`]`
// `(?<!\[)`: селектор `[role="tab"]` в querySelector — не запись роли.
const ROLE_PROP = String.raw`(?<!\[)\b(?:accessibilityRole|role)`
const PATTERNS = [
  // JSX: accessibilityRole="tab"
  new RegExp(`${ROLE_PROP}\\s*=\\s*${TAB_VALUE}`),
  // JSX-выражение: {'tablist' as any}, {isWeb ? 'tab' : 'button'}
  new RegExp(`${ROLE_PROP}\\s*=\\s*\\{[^}\\n]*${TAB_VALUE}`),
  // Объект props: role: 'tab', accessibilityRole: cond ? 'tab' : 'button'
  new RegExp(`${ROLE_PROP}\\s*:\\s*[^,\\n}]*${TAB_VALUE}`),
  // Обход expo-router: role: Platform.select({ ios: 'button', default: 'tab' })
  new RegExp(`${ROLE_PROP}\\s*[:=]\\s*\\{?\\s*Platform\\.select\\([^)\\n]*${TAB_VALUE}`),
]

/** Прямая запись роли вкладки или ряда в одной строке кода. */
const lineWritesTabRole = (code) => PATTERNS.some((pattern) => pattern.test(code))

/**
 * Нарушения в тексте одного файла: `rel:line: исходная строка`. Комментарии
 * (в том числе многострочные JSDoc) гасит общий сканер `lib/maskSource` —
 * литералы он сохраняет, номера строк не сдвигает.
 */
const findViolationsInSource = (rel, text) => {
  const lines = text.split('\n')
  const found = []
  maskSource(text).split('\n').forEach((code, index) => {
    if (lineWritesTabRole(code)) found.push(`${rel}:${index + 1}: ${lines[index].trim()}`)
  })
  return found
}

const collectViolations = (rootDir = ROOT) => {
  const violations = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!SOURCE.has(path.extname(entry.name))) continue
      const rel = path.relative(rootDir, full).split(path.sep).join('/')
      if (ALLOW_FILES.has(rel)) continue
      violations.push(...findViolationsInSource(rel, fs.readFileSync(full, 'utf8')))
    }
  }
  for (const dir of SCAN_DIRS) {
    const full = path.join(rootDir, dir)
    if (fs.existsSync(full)) walk(full)
  }
  return violations
}

function main() {
  const violations = collectViolations()
  if (violations.length) {
    console.error(
      'guard:tab-roles: прямая роль tab/tablist — ставить через getTabA11yProps / getTabListA11yProps (@/utils/a11yTabRoles)',
    )
    for (const item of violations) console.error(`  ${item}`)
    process.exit(1)
  }
  console.log('guard:tab-roles: ok')
}

if (require.main === module) main()

module.exports = {
  collectViolations,
  findViolationsInSource,
  lineWritesTabRole,
}
