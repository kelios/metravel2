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

// #2272: верхний безопасный отступ экранов ВНЕ оболочки шапки. Экраны `app/` вне
// группы `(tabs)` лежат под корневым `Stack` с `headerShown: false` — `CustomHeader`
// из `app/(tabs)/_layout.tsx` на них не подключается. Владелец верхнего отступа у
// такого экрана один из двух: контейнер `components/layout/StandaloneScreen` или
// собственный `<CustomHeader />`. Проверка структурная по AST: каждая ветка `return`
// компонента экрана обязана содержать владельца (или быть `<Redirect>` / `null`).
// Прямой `SafeAreaView` запрещён: шаблон `edges` без `top` разошёлся копированием по
// трём экранам (журнал безопасности, гостевые «Приватность» и «Чёрный список»).
const ts = require('typescript')

const STANDALONE_ROUTES_DIR = 'app'
const HEADER_SHELL_GROUP = '(tabs)'
const STANDALONE_SCREEN_OWNER = 'components/layout/StandaloneScreen.tsx'
const TOP_INSET_OWNER_TAGS = new Set(['StandaloneScreen', 'CustomHeader'])
const NO_CONTENT_TAGS = new Set(['Redirect'])
// Файл → причина, почему экран вне оболочки шапки обходится без владельца отступа.
const STANDALONE_SCREEN_EXCEPTIONS = {}

const isRouteFile = (name) => /\.tsx$/.test(name) && !/^[_+]/.test(name)

function listStandaloneRouteFiles(root) {
  const found = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name !== HEADER_SHELL_GROUP && entry.name !== 'node_modules') walk(path.join(dir, entry.name))
      } else if (isRouteFile(entry.name)) {
        found.push(path.relative(root, path.join(dir, entry.name)).split(path.sep).join('/'))
      }
    }
  }
  const start = path.join(root, STANDALONE_ROUTES_DIR)
  if (fs.existsSync(start)) walk(start)
  return found.sort()
}

const isFunctionLike = (node) =>
  ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node)

const jsxTagName = (node) => (ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName).getText().split('.').pop()

const hasModifier = (node, kind) => (node.modifiers ?? []).some((modifier) => modifier.kind === kind)

/** Компонент экрана: функция под `export default` (в том числе `export default memo(Name)`). */
function findDefaultExportedComponent(sourceFile) {
  const named = new Map()
  let direct = null
  let exportedName = null
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement)) {
      if (statement.name) named.set(statement.name.text, statement)
      if (hasModifier(statement, ts.SyntaxKind.ExportKeyword) && hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
        direct = statement
      }
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer) {
          named.set(declaration.name.text, declaration.initializer)
        }
      }
    } else if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      let expression = statement.expression
      // `memo(Screen)`, `React.memo(Screen)`, `observer(Screen)` — первый аргумент.
      while (ts.isCallExpression(expression) && expression.arguments.length > 0) expression = expression.arguments[0]
      if (ts.isIdentifier(expression)) exportedName = expression.text
      else if (isFunctionLike(expression)) direct = expression
    }
  }
  let component = direct ?? (exportedName ? named.get(exportedName) : null) ?? null
  while (component && ts.isCallExpression(component) && component.arguments.length > 0) component = component.arguments[0]
  return component && isFunctionLike(component) ? component : null
}

/** Выражения, которые компонент возвращает сам (вложенные функции не считаются). */
function collectReturnedExpressions(component) {
  if (!component.body) return []
  if (!ts.isBlock(component.body)) return [component.body]
  const returned = []
  const visit = (node) => {
    if (isFunctionLike(node)) return
    if (ts.isReturnStatement(node)) {
      if (node.expression) returned.push(node.expression)
      return
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(component.body, visit)
  return returned
}

function jsxContainsTopInsetOwner(node) {
  let found = false
  const visit = (child) => {
    if (found) return
    if ((ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) && TOP_INSET_OWNER_TAGS.has(jsxTagName(child))) {
      found = true
      return
    }
    ts.forEachChild(child, visit)
  }
  visit(node)
  return found
}

/** Ветка разметки доказуемо начинается ниже статус-бара (или ничего не рисует). */
function provesTopInset(expression) {
  let node = expression
  while (ts.isParenthesizedExpression(node)) node = node.expression
  if (node.kind === ts.SyntaxKind.NullKeyword) return true
  if (ts.isConditionalExpression(node)) return provesTopInset(node.whenTrue) && provesTopInset(node.whenFalse)
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    return provesTopInset(node.right)
  }
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
    if (NO_CONTENT_TAGS.has(jsxTagName(node))) return true
    return jsxContainsTopInsetOwner(node)
  }
  if (ts.isJsxFragment(node)) return jsxContainsTopInsetOwner(node)
  return false
}

function scanStandaloneScreenSource(rel, source) {
  if (STANDALONE_SCREEN_EXCEPTIONS[rel]) return []
  const failures = []
  const sourceFile = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const lineOf = (node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1

  const visitSafeArea = (node) => {
    if ((ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) && jsxTagName(node) === 'SafeAreaView') {
      failures.push(
        `${rel}:${lineOf(node)}: прямой SafeAreaView в экране вне оболочки шапки запрещён — контейнер components/layout/StandaloneScreen всегда держит верхний край (#2272)`,
      )
    }
    ts.forEachChild(node, visitSafeArea)
  }
  visitSafeArea(sourceFile)

  const component = findDefaultExportedComponent(sourceFile)
  if (!component) {
    failures.push(`${rel}: не найден компонент экрана под export default — guard не может доказать верхний отступ (#2272)`)
    return failures
  }
  for (const expression of collectReturnedExpressions(component)) {
    if (!provesTopInset(expression)) {
      failures.push(
        `${rel}:${lineOf(expression)}: ветка экрана вне оболочки шапки без владельца верхнего отступа — оберните её в StandaloneScreen или смонтируйте CustomHeader (#2272)`,
      )
    }
  }
  return failures
}

function scanStandaloneScreenOwnerSource(rel, source) {
  const code = stripComments(source)
  const failures = []
  if (!/STANDALONE_SCREEN_EDGES[^=]*=\s*\[\s*'top'/.test(code) || !/edges=\{STANDALONE_SCREEN_EDGES\}/.test(code)) {
    failures.push(`${rel}: контейнер обязан передавать в SafeAreaView постоянный набор краёв, начинающийся с 'top' (#2272)`)
  }
  if (/\bedges\s*[,:?}]/.test(code)) {
    failures.push(`${rel}: проп edges у контейнера запрещён — верхний край нельзя выключить снаружи (#2272)`)
  }
  return failures
}

function scanStandaloneScreens(root) {
  const failures = []
  const ownerFile = path.join(root, STANDALONE_SCREEN_OWNER)
  if (!fs.existsSync(ownerFile)) {
    failures.push(`${STANDALONE_SCREEN_OWNER}: контейнер экранов вне оболочки шапки не найден — обнови scripts/guard-screen-header.js`)
  } else {
    failures.push(...scanStandaloneScreenOwnerSource(STANDALONE_SCREEN_OWNER, fs.readFileSync(ownerFile, 'utf8')))
  }
  const routes = listStandaloneRouteFiles(root)
  for (const rel of Object.keys(STANDALONE_SCREEN_EXCEPTIONS)) {
    if (!routes.includes(rel)) failures.push(`${rel}: исключение для несуществующего экрана — убери из STANDALONE_SCREEN_EXCEPTIONS`)
  }
  for (const rel of routes) {
    failures.push(...scanStandaloneScreenSource(rel, fs.readFileSync(path.join(root, rel), 'utf8')))
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
  STANDALONE_SCREEN_OWNER,
  STANDALONE_SCREEN_EXCEPTIONS,
  listStandaloneRouteFiles,
  scanStandaloneScreenSource,
  scanStandaloneScreenOwnerSource,
  scanStandaloneScreens,
}

if (require.main === module) {
  const root = process.argv.includes('--root') ? path.resolve(process.argv[process.argv.indexOf('--root') + 1]) : process.cwd()
  const failures = [...scanScreenHeaders(root), ...scanHeaderInsets(root), ...scanStandaloneScreens(root)]
  if (failures.length) {
    console.error('guard-screen-header failed:\n' + failures.map((f) => `  - ${f}`).join('\n'))
    process.exit(1)
  }
  console.log(
    `guard-screen-header ok (${SCREEN_HEADER_OWNERS.length} screens, ${HEADER_SHELL_FILES.length + 1} header shell files, ${listStandaloneRouteFiles(root).length} screens outside the header shell)`,
  )
}
