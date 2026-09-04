#!/usr/bin/env node

// Структурный гард семейства «интерактивный элемент меньше минимального
// тач-таргета» (#192 → #1044 → #1271 → #1274).
//
// ПОЧЕМУ РАЗМЕР, А НЕ hitSlop. `hitSlop` не добирает тач-таргет, если родитель
// обтягивает элемент вплотную: на Android RN ищет цель, спускаясь по дереву
// (`TouchTargetHelper`), и hitSlop потомка проверяется ТОЛЬКО после того, как
// точка уже попала внутрь родителя. Ряд, высота которого равна высоте кнопки,
// срезает весь вертикальный hitSlop — проверено тап-пробой на устройстве
// (#1271: тап на 3,4dp ниже кнопки с `hitSlop={6}` не срабатывал).
// Поэтому единственный надёжный тач-таргет — собственный размер вью, и гард
// намеренно НЕ засчитывает hitSlop как добор.
//
// Рабочий приём: таргет задаётся размером самого вью (прозрачная рамка), а
// видимый круг/пилюля остаётся прежним внутри неё — см.
// `MAP_TOOLBAR_TOUCH_TARGET_SIZE` в
// `components/MapPage/MapMobile/MapMobileTopOverlay.styles.ts`.

const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const CONTRACT_VERSION = 2

// Порог = 44dp. Android/Material рекомендует 48dp, и для НОВЫХ компактных
// иконочных кнопок это по-прежнему правильная цель, но 44 — принятый в проекте
// фактический floor (`docs/DESIGN_SYSTEM.md`, ToolActionsRow «44/48dp»), и на
// нём стоит 58 существующих элементов. Гард ловит явные недомерки и регрессии;
// подъём floor до 48 — отдельное дизайн-решение, а не задача regression guard.
const MIN_TOUCH_TARGET = 44

const SCAN_DIRS = Object.freeze(['app', 'components', 'hooks', 'screens'])
// `.ts` нужен не ради JSX, а ради модулей стилей: размер тач-таргета всё чаще
// объявлен не рядом с `Pressable`, а в вынесенном style-модуле (#1274, приёмка).
const SOURCE_EXTENSIONS = new Set(['.tsx', '.ts'])
const IGNORED_DIRS = new Set([
  '.git',
  '.expo',
  '.codex-temp',
  '.codex-debug',
  '.claude',
  'node_modules',
  'dist',
  'web-build',
  'coverage',
  'test-results',
  'playwright-report',
  '__tests__',
  'e2e',
])

// Элементы, которые сами являются тач-таргетом.
//
// `IconButton` (#1280) входит сюда, потому что его `Pressable` и есть видимая
// поверхность, а проп `style` потребителя применяется ПОСЛЕ собственных
// размеров примитива и может перебить их в меньшую сторону. Без этого пункта
// гард видит только «сырые» Pressable и пропускает целый слой мест, где
// сабминимальный таргет приходит из стиля вызывающего экрана.
//
// Список — не справочник «на глаз», а контракт: `findUnlistedWrappers` ниже
// находит каждую экспортированную обёртку проекта, которая пробрасывает `style`
// в интерактивный элемент и используется из другого файла, и гард падает, если
// её здесь нет (#1734). Иначе следующая обёртка выпадает молча — так
// `CardActionPressable` с 53 вызовами в 18 файлах прожил вне проверки, а зелёный
// гейт всё это время означал «не проверяли», а не «в норме».
const INTERACTIVE_ELEMENTS = new Set([
  'Pressable',
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'TouchableNativeFeedback',
  'IconButton',
  // Тот же `IconButton` под алиасом импорта (редактор статьи): гард сверяет
  // имя тега, поэтому алиас — отдельная запись.
  'UiIconButton',
  // Обёртки проекта: имя — как его пишут потребители в JSX (для default-экспорта
  // это имя импорта, а не внутреннее имя компонента).
  'CardActionPressable',
  'Chip',
  'ColorChip',
  'Toggle',
  'SubscribeButton',
  'FavoriteButton',
  'TravelStatusButton',
  'DeleteAction',
  'PeerBadgeGiveButton',
  'PlaceFirstBadgeCard',
  'QuestForCityCard',
  'UserSafetyMenu',
  // Общая кнопка проекта: `forwardRef` над `Pressable`, проп `style`
  // потребителя ложится ПОСЛЕ размеров варианта и может ужать таргет (#1748).
  // `ButtonBase` — тот же default-экспорт под алиасом импорта рядом с
  // Paper-кнопкой; Paper `Button` тоже пробрасывает `style` в свой Touchable,
  // так что одна запись `Button` закрывает обе.
  'Button',
  'ButtonBase',
  'UIButton',
  // Обёртка над `Button`, отдающая `style` дальше (#1748).
  'AdminGrantRareAward',
])

// Дешёвый фильтр «в файле вообще есть интерактивный элемент» перед разбором AST.
// Выводится из `INTERACTIVE_ELEMENTS`, а не пишется руками: рукописный
// `/Pressable|Touchable/` не открывал файлы, где единственная кнопка —
// `<IconButton style={...}>`, и пять сабминимальных стилей поверх
// `IconButton`/`ColorChip` жили вне проверки при зелёном гейте (#1739).
// Тот же фильтр служит поиску экспортированных обёрток: сама обёртка содержит
// `Pressable`, а её потребитель — только имя обёртки из списка.
const INTERACTIVE_HINT = new RegExp([...INTERACTIVE_ELEMENTS].join('|'))

// Ключи, которыми вью задаёт собственный размер. `maxWidth`/`maxHeight`
// намеренно не входят: они ограничивают, но не назначают тач-таргет.
const SIZE_KEYS = Object.freeze(['width', 'height', 'minWidth', 'minHeight'])

// Примитивы, у которых нажимаемая область задаётся не `style`, а числовым
// пропом. `ColorChip` рисует круг `chipSize` (по умолчанию 32) и без
// `touchTargetSize` нажимается ровно в этом круге; до `style` размер не доходит,
// и по ключам `width/height` гард такого потребителя не видел — третий способ
// спрятать сабминимальную кнопку после обёртки вне списка (#1734) и файла без
// слова Pressable (#1739). Для каждого элемента: проп размера, его значение по
// умолчанию в примитиве и проп, расширяющий рамку до `max(target, size)`.
// `IconButton.visualSize` сюда не входит: его рамка не опускается ниже 44
// независимо от значения (#1280).
const NUMERIC_SIZE_PROPS = Object.freeze({
  ColorChip: Object.freeze({ sizeProp: 'chipSize', defaultSize: 32, targetProp: 'touchTargetSize' }),
})

const normalizePath = (value) => String(value || '').replace(/\\/g, '/')

const shouldIgnoreDir = (name) => IGNORED_DIRS.has(name) || name.startsWith('dist-')

const collectSourceFiles = (rootDir) => {
  const files = []
  const walk = (dirPath) => {
    if (!fs.existsSync(dirPath)) return
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const absolute = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        if (shouldIgnoreDir(entry.name)) continue
        walk(absolute)
        continue
      }
      if (!entry.isFile()) continue
      // Стили лежат и в `.ts`-сиблингах — они нужны для резолва, но сами не
      // содержат JSX, поэтому подхватываются отдельно в `readStyleSheets`.
      if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue
      files.push(normalizePath(path.relative(rootDir, absolute)))
    }
  }
  for (const dir of SCAN_DIRS) walk(path.join(rootDir, dir))
  return files.sort()
}

const parseSource = (filePath, content) =>
  ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

const numericValue = (node) => {
  if (!node) return null
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) return numericValue(node.expression)
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const inner = numericValue(node.operand)
    return inner === null ? null : -inner
  }
  // `width: isMobile ? 26 : 32` — самая частая форма адаптивного размера, и
  // именно на ней гард молчал про весь мастер квеста. Для гарда значение ветки
  // — худший случай: если хоть одна ветка даёт недомерок, он реален на
  // соответствующей поверхности.
  if (ts.isConditionalExpression(node)) {
    const whenTrue = numericValue(node.whenTrue)
    const whenFalse = numericValue(node.whenFalse)
    if (whenTrue === null || whenFalse === null) return null
    return Math.min(whenTrue, whenFalse)
  }
  return null
}

const propertyName = (node) => {
  if (!node.name) return null
  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) return node.name.text
  return null
}

const readStyleObject = (objectLiteral) => {
  const dims = {}
  for (const prop of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    const key = propertyName(prop)
    if (!key || !SIZE_KEYS.includes(key)) continue
    const value = numericValue(prop.initializer)
    // `minWidth/minHeight: 0` — flex-идиома «разрешить сжатие», а не размер.
    if (value !== null && value > 0) dims[key] = value
  }
  return dims
}

const unwrap = (node) => (node && ts.isAsExpression(node) ? node.expression : node)

const isStyleSheetCreateCall = (node) =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  ts.isIdentifier(node.expression.expression) &&
  node.expression.expression.text === 'StyleSheet' &&
  node.expression.name.text === 'create'

const isPlatformSelectCall = (node) =>
  !!node &&
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  ts.isIdentifier(node.expression.expression) &&
  node.expression.expression.text === 'Platform' &&
  node.expression.name.text === 'select'

/** `Platform.select({ web: {...}, android: {...} })` — не таблица стилей. */
const isPlatformSelectArgument = (node) => isPlatformSelectCall(node.parent)

/**
 * Объектный литерал похож на таблицу стилей: минимум два имени, за каждым из
 * которых стоит объект. Порог в два имени отсекает одиночные обёртки вроде
 * `Platform.select({ web: {...} })`, а сами `Platform.select` исключены явно.
 */
const isStyleMapLiteral = (node) => {
  if (!ts.isObjectLiteralExpression(node)) return false
  let objectProps = 0
  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    if (ts.isObjectLiteralExpression(unwrap(prop.initializer))) objectProps += 1
  }
  return objectProps >= 2
}

const readStyleMap = (objectLiteral, styles) => {
  for (const prop of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    const name = propertyName(prop)
    if (!name) continue
    const initializer = unwrap(prop.initializer)
    if (!ts.isObjectLiteralExpression(initializer)) continue
    const dims = readStyleObject(initializer)
    const known = styles[name]
    // Один файл может объявить имя дважды (варианты темы) — держим худший.
    if (!known) styles[name] = dims
    else for (const key of SIZE_KEYS) {
      if (typeof dims[key] === 'number' && (typeof known[key] !== 'number' || dims[key] < known[key])) {
        known[key] = dims[key]
      }
    }
  }
}

/**
 * Все объявленные размеры стилей файла.
 * Возвращает `{ [styleName]: { width?, height?, minWidth?, minHeight? } }`.
 *
 * `StyleSheet.create({...})` читается везде. В модулях стилей (`includeFactories`)
 * дополнительно читаются таблицы, возвращаемые фабриками вида
 * `createHeaderStyles = (colors, isMobile) => ({ ... })`: они не проходят через
 * `StyleSheet.create` в своём файле, поэтому раньше были невидимы целиком.
 */
const collectStyleSizes = (sourceFile, { includeFactories = false } = {}) => {
  const styles = {}

  const visit = (node) => {
    if (isStyleSheetCreateCall(node)) {
      const [arg] = node.arguments
      if (arg && ts.isObjectLiteralExpression(arg)) readStyleMap(arg, styles)
    } else if (includeFactories && isStyleMapLiteral(node) && !isPlatformSelectArgument(node)) {
      readStyleMap(node, styles)
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return styles
}

/**
 * Имена стилей, на которые ссылается `style`-проп.
 * Разбирает member-доступ, массивы, условия и — что критично для `Pressable` —
 * колбэк-форму `style={({ pressed }) => [...]}`. Без неё гард пропускает
 * большинство `Pressable` в проекте (именно так две находки #1274 сначала не
 * попали в аудит).
 */
const collectStyleReferences = (expression, out = []) => {
  if (!expression) return out
  let node = expression
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) {
    return collectStyleReferences(node.expression, out)
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    if (ts.isBlock(node.body)) {
      const visit = (child) => {
        if (ts.isReturnStatement(child) && child.expression) {
          collectStyleReferences(child.expression, out)
          return
        }
        ts.forEachChild(child, visit)
      }
      visit(node.body)
      return out
    }
    return collectStyleReferences(node.body, out)
  }
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
    out.push(node.name.text)
    return out
  }
  if (ts.isArrayLiteralExpression(node)) {
    for (const element of node.elements) collectStyleReferences(element, out)
    return out
  }
  if (ts.isConditionalExpression(node)) {
    collectStyleReferences(node.whenTrue, out)
    collectStyleReferences(node.whenFalse, out)
    return out
  }
  if (ts.isBinaryExpression(node)) {
    collectStyleReferences(node.left, out)
    collectStyleReferences(node.right, out)
    return out
  }
  return out
}

const elementName = (node) => {
  const tag = node.tagName
  if (ts.isIdentifier(tag)) return tag.text
  return ''
}

const isJsxElement = (node) => ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)

const jsxAttribute = (node, name) => {
  for (const attribute of node.attributes.properties) {
    if (!ts.isJsxAttribute(attribute)) continue
    if (attribute.name && ts.isIdentifier(attribute.name) && attribute.name.text === name) return attribute
  }
  return null
}

/**
 * Число из выражения пропа. Литералы, `as`, унарный минус и тернар литералов
 * разбирает общий `numericValue` (там же живёт правило «ветка тернара — худший
 * случай»); сверх него здесь резолвятся имена: локальная константа
 * `const X = 28` того же файла и импортированная из модуля проекта
 * `export const X = 32`. Всё остальное (`DESIGN_TOKENS.touchTarget.minWidth`,
 * проп родителя) статически не выводится — `null`.
 *
 * Импорт разобран не ради полноты: размер чипа и вертикальный запас родителя
 * обязаны считаться от ОДНОЙ константы, поэтому в JSX стоит не литерал, а имя
 * из соседнего `*.styles.ts` (#1744). Без резолва импорта гард молчал бы ровно
 * на том вызове, ради которого заведён: удаление `touchTargetSize` из модалки
 * «Моих точек» не давало ни одной находки (проверено пробой).
 */
const resolveNumericExpression = (expression, sourceFile, resolveImported, depth = 0) => {
  if (!expression || depth > 4) return null
  const direct = numericValue(expression)
  if (direct !== null) return direct
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression)) {
    return resolveNumericExpression(expression.expression, sourceFile, resolveImported, depth + 1)
  }
  if (!ts.isIdentifier(expression)) return null
  const local = declaredNumericConst(sourceFile, expression.text, resolveImported, depth)
  if (local !== null) return local
  return resolveImported ? resolveImported(expression.text, depth) : null
}

/** Значение объявления `const <name> = ...` в этом файле; иначе `null`. */
const declaredNumericConst = (sourceFile, name, resolveImported, depth) => {
  let value = null
  const visit = (node) => {
    if (value !== null) return
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer
    ) {
      value = resolveNumericExpression(node.initializer, sourceFile, resolveImported, depth + 1)
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return value
}

/**
 * Значение именованного импорта файла, если импортированный модуль объявляет
 * его числом. Дальше одного модуля цепочка не идёт: следующий импорт уже
 * означает, что размер собирается не константой, а логикой.
 */
const importedNumericConst = (rootDir, filePath, sourceFile, name, depth = 0) => {
  if (depth > 4) return null
  const binding = collectImportBindings(rootDir, filePath, sourceFile)[name]
  if (!binding || binding.exportName === 'default') return null
  const absolute = path.join(rootDir, binding.file)
  if (!fs.existsSync(absolute)) return null
  const imported = parseSource(binding.file, fs.readFileSync(absolute, 'utf8'))
  return declaredNumericConst(imported, binding.exportName, null, depth + 1)
}

/** `{ present, value }` числового пропа JSX; `value` — `null`, если не выводится. */
const readNumericProp = (node, name, sourceFile, resolveImported) => {
  const attribute = jsxAttribute(node, name)
  if (!attribute) return { present: false, value: null }
  const initializer = attribute.initializer
  if (initializer && ts.isJsxExpression(initializer)) {
    return { present: true, value: resolveNumericExpression(initializer.expression, sourceFile, resolveImported) }
  }
  return { present: true, value: null }
}

/**
 * Сабминимальный тач-таргет элемента из `NUMERIC_SIZE_PROPS`, выведенный из
 * его пропов (#1744): `max(targetProp, sizeProp ?? default)`. Расширитель с
 * невыводимым значением (`touchTargetSize={DESIGN_TOKENS.touchTarget.minWidth}`)
 * считается намеренной рамкой и не оценивается; отсутствующий расширитель —
 * это рамка размером с видимый круг, и тогда пропущенный `sizeProp` значит
 * дефолт примитива, а не «размера нет».
 */
const numericPropTarget = (node, sourceFile, resolveImported) => {
  const contract = NUMERIC_SIZE_PROPS[elementName(node)]
  if (!contract) return null
  const target = readNumericProp(node, contract.targetProp, sourceFile, resolveImported)
  if (target.present && target.value === null) return null
  const size = readNumericProp(node, contract.sizeProp, sourceFile, resolveImported)
  const visible = size.present ? size.value : contract.defaultSize
  if (visible === null) return null
  const effective = Math.max(target.value ?? 0, visible)
  if (effective >= MIN_TOUCH_TARGET) return null
  return { prop: target.value !== null && target.value >= visible ? contract.targetProp : contract.sizeProp, size: effective }
}

/** Имена параметров функции, включая деструктуризацию `({ style })`. */
const parameterNames = (declaration) => {
  const names = new Set()
  for (const parameter of declaration.parameters || []) {
    if (ts.isIdentifier(parameter.name)) names.add(parameter.name.text)
    else if (ts.isObjectBindingPattern(parameter.name)) {
      for (const element of parameter.name.elements) {
        if (ts.isIdentifier(element.name)) names.add(element.name.text)
      }
    }
  }
  return names
}

/**
 * Локальные обёртки, пробрасывающие `style` в интерактивный элемент.
 *
 * Такой компонент САМ является тач-таргетом, но размер ему задаёт вызывающий
 * код: `<ActionButton style={styles.backButton}>`. Внутри обёртки имя стиля не
 * видно (там просто проп `style`), а снаружи тег — не `Pressable`, поэтому без
 * этого шага целый слой кнопок невидим. Ровно так гард молчал про кнопку
 * «Назад» 40dp в шапке, пока её не намерили на устройстве (#1274, приёмка).
 *
 * По той же причине в `INTERACTIVE_ELEMENTS` заведён `IconButton` (#1280).
 */
const COMPONENT_FACTORIES = new Set(['forwardRef', 'memo'])

/**
 * Снимает фабрики компонентов с инициализатора: `forwardRef(cb)`, `memo(cb)`,
 * `React.forwardRef(cb)`, `memo(forwardRef(cb))` → `cb`. Без этого обёртка,
 * объявленная не голой функцией, а вызовом, для гарда не существовала: так
 * `components/ui/Button` (`forwardRef` ради `ref` на `View`) не попадал ни в
 * список интерактивных элементов, ни в отчёт незарегистрированных обёрток, и
 * любой `<Button style={...}>` мог быть ужат ниже минимума при зелёном гейте
 * (#1748, четвёртое слепое пятно после #1734/#1739/#1744).
 */
const unwrapComponentFactory = (expression) => {
  let node = expression
  for (;;) {
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression?.(node)) {
      node = node.expression
      continue
    }
    if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const callee = node.expression
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : null
      if (name && COMPONENT_FACTORIES.has(name)) {
        node = node.arguments[0]
        continue
      }
    }
    return node
  }
}

const collectStyleForwardingWrappers = (sourceFile) => {
  const wrappers = new Set()

  const forwardsStyle = (declaration) => {
    const params = parameterNames(declaration)
    if (!params.has('style')) return false
    let found = false
    const visit = (node) => {
      if (found) return
      if (isJsxElement(node) && INTERACTIVE_ELEMENTS.has(elementName(node))) {
        const attribute = jsxAttribute(node, 'style')
        const initializer = attribute && attribute.initializer
        if (initializer && ts.isJsxExpression(initializer) && initializer.expression) {
          const usesOwnStyle = (expression) => {
            let hit = false
            const walk = (child) => {
              if (hit) return
              if (ts.isIdentifier(child) && child.text === 'style') hit = true
              else ts.forEachChild(child, walk)
            }
            walk(expression)
            return hit
          }
          if (usesOwnStyle(initializer.expression)) found = true
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(declaration)
    return found
  }

  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && forwardsStyle(node)) {
      wrappers.add(node.name.text)
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const initializer = unwrapComponentFactory(node.initializer)
      if (
        (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) &&
        forwardsStyle(initializer)
      ) {
        wrappers.add(node.name.text)
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return wrappers
}

/**
 * Размеры, объявленные прямо в JSX (`style={{ width: 32 }}`). Без этого гард
 * обходится инлайновым объектом, и контракт «таргет задаётся размером вью»
 * перестаёт быть обязательным.
 */
const collectInlineStyleDims = (expression, out = []) => {
  if (!expression) return out
  const visit = (node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const dims = readStyleObject(node)
      if (Object.keys(dims).length > 0) out.push(dims)
    }
    ts.forEachChild(node, visit)
  }
  visit(expression)
  return out
}

const smallestOf = (dimsList) => {
  let smallest = null
  for (const dims of dimsList) {
    for (const key of SIZE_KEYS) {
      const value = dims[key]
      if (typeof value !== 'number' || value >= MIN_TOUCH_TARGET) continue
      if (!smallest || value < smallest.size) smallest = { dimension: key, size: value }
    }
  }
  return smallest
}

/**
 * Находка адресуется файлу, где размер ОБЪЯВЛЕН, а не файлу с JSX: чинить нужно
 * именно объявление, и один вынесенный стиль не должен размножаться на каждого
 * потребителя отдельной записью baseline.
 */
const findSmallestDeclaredSize = (styleNames, styleTables) => {
  let smallest = null
  for (const name of styleNames) {
    let source = null
    for (const table of styleTables) {
      if (table.styles && Object.prototype.hasOwnProperty.call(table.styles, name)) {
        source = table
        break
      }
    }
    if (!source) continue
    for (const key of SIZE_KEYS) {
      const value = source.styles[name][key]
      if (typeof value !== 'number') continue
      if (value >= MIN_TOUCH_TARGET) continue
      if (!smallest || value < smallest.size) {
        smallest = { file: source.file, style: name, dimension: key, size: value }
      }
    }
  }
  return smallest
}

const isStyleModule = (filePath) =>
  /[Ss]tyles?\.(ts|tsx)$/.test(path.basename(filePath)) ||
  /[Ss]tyles?$/.test(path.basename(path.dirname(filePath)))

const readStyleSheets = (rootDir, filePath) => {
  const absolute = path.join(rootDir, filePath)
  if (!fs.existsSync(absolute)) return null
  const source = fs.readFileSync(absolute, 'utf8')
  const includeFactories = isStyleModule(filePath)
  if (!includeFactories && !source.includes('StyleSheet.create')) return {}
  return collectStyleSizes(parseSource(filePath, source), { includeFactories })
}

/** Стили компонента живут либо в нём самом, либо в сиблинге `Foo.styles.ts`. */
const resolveStyleTables = (rootDir, filePath, ownSource) => {
  const tables = [{ file: filePath, styles: collectStyleSizes(ownSource) }]
  const base = filePath.replace(/\.tsx$/, '')
  for (const candidate of [`${base}.styles.ts`, `${base}.styles.tsx`]) {
    const sibling = readStyleSheets(rootDir, candidate)
    if (sibling) tables.push({ file: candidate, styles: sibling })
  }
  return tables
}

/** Имена стилей, которыми хоть где-то стилизуется интерактивный элемент. */
const collectInteractiveStyleNames = (sourceFile, out = new Set()) => {
  const wrappers = collectStyleForwardingWrappers(sourceFile)
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = elementName(node)
      if (INTERACTIVE_ELEMENTS.has(tag) || wrappers.has(tag)) {
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute)) continue
          if (!(attribute.name && ts.isIdentifier(attribute.name) && attribute.name.text === 'style')) continue
          const initializer = attribute.initializer
          if (initializer && ts.isJsxExpression(initializer) && initializer.expression) {
            for (const name of collectStyleReferences(initializer.expression)) out.add(name)
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return out
}

const scanFile = ({ rootDir, filePath, content }) => {
  if (!INTERACTIVE_HINT.test(content)) return []
  const sourceFile = parseSource(filePath, content)
  const styleTables = resolveStyleTables(rootDir, filePath, sourceFile)
  const wrappers = collectStyleForwardingWrappers(sourceFile)
  const resolveImported = (name, depth) => importedNumericConst(rootDir, filePath, sourceFile, name, depth)
  const findings = []

  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = elementName(node)
      if (INTERACTIVE_ELEMENTS.has(name) || wrappers.has(name)) {
        let styleNames = []
        let inlineDims = []
        let hasHitSlop = false
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute)) continue
          const attributeName = attribute.name && ts.isIdentifier(attribute.name) ? attribute.name.text : ''
          if (attributeName === 'hitSlop') hasHitSlop = true
          if (attributeName !== 'style') continue
          const initializer = attribute.initializer
          if (initializer && ts.isJsxExpression(initializer) && initializer.expression) {
            styleNames = collectStyleReferences(initializer.expression)
            inlineDims = collectInlineStyleDims(initializer.expression)
          }
        }

        const named = findSmallestDeclaredSize(styleNames, styleTables)
        const inline = smallestOf(inlineDims)
        const useInline = inline && (!named || inline.size < named.size)
        const smallest = useInline ? inline : named
        const numeric = numericPropTarget(node, sourceFile, resolveImported)
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1

        if (numeric && (!smallest || numeric.size < smallest.size)) {
          // Размер объявлен пропом в самом JSX — ключ, как у инлайнового стиля,
          // адресуется файлу потребителя и несёт сам размер, а не номер строки.
          findings.push({
            file: filePath,
            key: `${filePath}::${name}(${numeric.prop}=${numeric.size})`,
            style: `${name}(${numeric.prop}=${numeric.size})`,
            dimension: numeric.prop,
            size: numeric.size,
            element: name,
            hitSlop: hasHitSlop,
            usedIn: filePath,
            line,
          })
        } else if (smallest) {
          // Инлайновый размер объявлен в самом JSX, именованный — в своём файле
          // стилей; ключ всегда указывает туда, где правится размер.
          const declaredIn = useInline ? filePath : smallest.file
          findings.push({
            file: declaredIn,
            // Ключ baseline не содержит номер строки: он не должен протухать от
            // сдвига кода, иначе гард шумит на каждом несвязанном рефакторинге.
            // У инлайнового стиля имени нет — ключом становится сам размер.
            key: useInline
              ? `${filePath}::inline(${smallest.dimension}=${smallest.size})`
              : `${declaredIn}::${smallest.style}`,
            style: useInline ? `inline(${smallest.dimension}=${smallest.size})` : smallest.style,
            dimension: smallest.dimension,
            size: smallest.size,
            element: name,
            hitSlop: hasHitSlop,
            usedIn: filePath,
            line,
          })
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return findings
}

/**
 * Второй проход — по модулям стилей.
 *
 * Резолвинг «свой файл + сиблинг `*.styles.ts`» закрывает только тот случай,
 * когда таблица стилей доезжает до JSX по импорту рядом. В проекте она сплошь и
 * рядом приезжает пропом из родителя (`styles: any`) или собирается агрегатором
 * из подпапки `<feature>Styles/*.ts` — и тогда связь «JSX → объявление» из
 * одного файла не выводится вовсе. Так целый экран мастера квеста оказался
 * невидимым для гарда при живых 26 и 36 dp.
 *
 * Поэтому связь берётся по имени стиля: имя, которым хоть где-то стилизуется
 * интерактивный элемент, считается тач-таргетом во всех модулях стилей.
 * Огрубление намеренное и однонаправленное — гард может заморозить лишний стиль
 * с совпавшим именем, но не может пропустить настоящий недомерок.
 */
const scanStyleModule = ({ rootDir, filePath, interactiveNames }) => {
  const table = readStyleSheets(rootDir, filePath)
  if (!table) return []
  const findings = []
  for (const [name, dims] of Object.entries(table)) {
    if (!interactiveNames.has(name)) continue
    // Одна находка на стиль — по худшей оси, как и в `scanFile`.
    const smallest = smallestOf([dims])
    if (!smallest) continue
    findings.push({
      file: filePath,
      key: `${filePath}::${name}`,
      style: name,
      dimension: smallest.dimension,
      size: smallest.size,
      element: 'style-module',
      hitSlop: false,
    })
  }
  return findings
}

const scanTouchTargets = (rootDir) => {
  const files = collectSourceFiles(rootDir)
  const contents = new Map()
  const readFile = (filePath) => {
    if (!contents.has(filePath)) contents.set(filePath, fs.readFileSync(path.join(rootDir, filePath), 'utf8'))
    return contents.get(filePath)
  }

  const interactiveNames = new Set()
  const findings = []
  for (const filePath of files) {
    if (path.extname(filePath) !== '.tsx') continue
    const content = readFile(filePath)
    if (!INTERACTIVE_HINT.test(content)) continue
    collectInteractiveStyleNames(parseSource(filePath, content), interactiveNames)
    findings.push(...scanFile({ rootDir, filePath, content }))
  }

  for (const filePath of files) {
    if (!isStyleModule(filePath)) continue
    findings.push(...scanStyleModule({ rootDir, filePath, interactiveNames }))
  }

  return findings
}

/**
 * Имена, которые файл экспортирует: `default` → идентификатор default-экспорта
 * (сквозь `memo(X)`, `React.memo(X)`, `forwardRef(...)`), остальные — как есть.
 */
const collectExportedNames = (sourceFile) => {
  const named = new Set()
  let defaultName = null
  const visit = (node) => {
    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      let expression = node.expression
      while (ts.isCallExpression(expression) && expression.arguments.length > 0) {
        expression = expression.arguments[0]
      }
      if (ts.isIdentifier(expression)) defaultName = expression.text
    } else if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const element of node.exportClause.elements) {
        const local = (element.propertyName || element.name).text
        if (element.name.text === 'default') defaultName = local
        else named.add(local)
      }
    } else {
      const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined
      const exported = !!modifiers && modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      const isDefault = !!modifiers && modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
      if (exported && ts.isFunctionDeclaration(node) && node.name) {
        if (isDefault) defaultName = node.name.text
        else named.add(node.name.text)
      } else if (exported && ts.isVariableStatement(node)) {
        for (const declaration of node.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) named.add(declaration.name.text)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return { named, defaultName }
}

/**
 * Резолв спецификатора импорта в путь файла проекта (относительно `rootDir`).
 * Пакеты и неизвестные алиасы дают `null` — их обёртки не наши.
 */
const resolveImportPath = (rootDir, fromFile, specifier) => {
  let base
  if (specifier.startsWith('@/')) base = path.join(rootDir, specifier.slice(2))
  else if (specifier.startsWith('.')) base = path.resolve(rootDir, path.dirname(fromFile), specifier)
  else return null
  for (const candidate of [base, `${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx'), path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return normalizePath(path.relative(rootDir, candidate))
    }
  }
  return null
}

/** `{ localName: { file, exportName } }` для default- и именованных импортов. */
const collectImportBindings = (rootDir, filePath, sourceFile) => {
  const bindings = {}
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue
    const file = resolveImportPath(rootDir, filePath, statement.moduleSpecifier.text)
    if (!file) continue
    const clause = statement.importClause
    if (clause.name) bindings[clause.name.text] = { file, exportName: 'default' }
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        bindings[element.name.text] = { file, exportName: (element.propertyName || element.name).text }
      }
    }
  }
  return bindings
}

/**
 * Обёртки над интерактивным элементом, которые файл ЭКСПОРТИРУЕТ:
 * `{ named: Set<string>, defaultName: string | null }`, оба — только имена,
 * пробрасывающие `style` внутрь (`collectStyleForwardingWrappers`).
 */
const collectExportedWrappers = (sourceFile) => {
  const wrappers = collectStyleForwardingWrappers(sourceFile)
  const exportsInfo = collectExportedNames(sourceFile)
  const named = new Set([...exportsInfo.named].filter((name) => wrappers.has(name)))
  const defaultName =
    exportsInfo.defaultName && wrappers.has(exportsInfo.defaultName) ? exportsInfo.defaultName : null
  return { named, defaultName }
}

/**
 * Обёртки, которые гард НЕ видит: экспортированы из одного файла, используются
 * тегом JSX в другом и не входят в `INTERACTIVE_ELEMENTS` под тем именем, каким
 * их пишет потребитель. Локальные обёртки сюда не попадают — их закрывает
 * `collectStyleForwardingWrappers` внутри файла.
 *
 * Возвращает `[{ name, declaredIn, usedIn }]`, отсортированный и без дублей по
 * `name::usedIn`. Список не baseline-ится: пропущенная обёртка — это не
 * «находка, которую можно заморозить», а дыра в самой проверке (#1734).
 */
const findUnlistedWrappers = (rootDir) => {
  const files = collectSourceFiles(rootDir).filter((filePath) => path.extname(filePath) === '.tsx')
  const parsed = new Map()
  const exportedByFile = new Map()
  for (const filePath of files) {
    const content = fs.readFileSync(path.join(rootDir, filePath), 'utf8')
    const sourceFile = parseSource(filePath, content)
    parsed.set(filePath, sourceFile)
    if (!INTERACTIVE_HINT.test(content)) continue
    const exported = collectExportedWrappers(sourceFile)
    if (exported.named.size > 0 || exported.defaultName) exportedByFile.set(filePath, exported)
  }
  if (exportedByFile.size === 0) return []

  const unlisted = new Map()
  for (const [filePath, sourceFile] of parsed) {
    const bindings = collectImportBindings(rootDir, filePath, sourceFile)
    const wrapperTags = {}
    for (const [localName, binding] of Object.entries(bindings)) {
      const exported = exportedByFile.get(binding.file)
      if (!exported) continue
      const isWrapper =
        binding.exportName === 'default' ? !!exported.defaultName : exported.named.has(binding.exportName)
      if (isWrapper) wrapperTags[localName] = binding.file
    }
    if (Object.keys(wrapperTags).length === 0) continue
    const visit = (node) => {
      if (isJsxElement(node)) {
        const name = elementName(node)
        if (wrapperTags[name] && !INTERACTIVE_ELEMENTS.has(name)) {
          unlisted.set(`${name}::${filePath}`, { name, declaredIn: wrapperTags[name], usedIn: filePath })
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
  }
  return [...unlisted.values()].sort((left, right) =>
    left.name.localeCompare(right.name) || left.usedIn.localeCompare(right.usedIn),
  )
}

/** Baseline хранит по одному худшему размеру на `file::style`. */
const toBaselineEntries = (findings) => {
  const entries = {}
  for (const finding of findings) {
    const current = entries[finding.key]
    if (!current || finding.size < current.size) {
      entries[finding.key] = { size: finding.size, dimension: finding.dimension }
    }
  }
  return Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)))
}

const createBaseline = (rootDir) => ({
  contractVersion: CONTRACT_VERSION,
  minTouchTarget: MIN_TOUCH_TARGET,
  scope: [...SCAN_DIRS],
  entries: toBaselineEntries(scanTouchTargets(rootDir)),
})

const compareToBaseline = (findings, baseline) => {
  if (baseline?.contractVersion !== CONTRACT_VERSION) {
    throw new Error(`unsupported baseline contractVersion=${String(baseline?.contractVersion)}`)
  }
  if (baseline.minTouchTarget !== MIN_TOUCH_TARGET) {
    throw new Error('baseline minTouchTarget does not match the guard threshold')
  }
  if (JSON.stringify(baseline.scope) !== JSON.stringify([...SCAN_DIRS])) {
    throw new Error('baseline scope does not match the guard scope')
  }

  const allowed = baseline.entries || {}
  const current = toBaselineEntries(findings)
  const violations = []

  for (const [key, entry] of Object.entries(current)) {
    const known = allowed[key]
    if (!known) {
      violations.push({ key, kind: 'new', baseline: null, current: entry.size, dimension: entry.dimension })
      continue
    }
    if (entry.size < known.size) {
      violations.push({ key, kind: 'regressed', baseline: known.size, current: entry.size, dimension: entry.dimension })
    }
  }

  return violations.sort((left, right) => left.key.localeCompare(right.key))
}

const parseArgs = (argv) => {
  const args = {
    root: process.cwd(),
    baseline: 'scripts/touch-targets-baseline.json',
    update: false,
    json: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--root' && argv[index + 1]) {
      args.root = path.resolve(argv[index + 1])
      index += 1
    } else if (token === '--baseline' && argv[index + 1]) {
      args.baseline = argv[index + 1]
      index += 1
    } else if (token === '--update') {
      args.update = true
    } else if (token === '--json') {
      args.json = true
    }
  }
  return args
}

const resolveBaselinePath = (root, requestedPath) =>
  path.isAbsolute(requestedPath) ? requestedPath : path.resolve(root, requestedPath)

const run = (args = parseArgs([])) => {
  const baselinePath = resolveBaselinePath(args.root, args.baseline)

  if (args.update) {
    const baseline = createBaseline(args.root)
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true })
    fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
    process.stdout.write(`Touch-target baseline updated: ${path.relative(args.root, baselinePath)}.\n`)
    process.stdout.write(`entries=${Object.keys(baseline.entries).length}\n`)
    return 0
  }

  if (!fs.existsSync(baselinePath)) {
    process.stderr.write(`Touch-target guard failed: baseline not found at ${baselinePath}.\n`)
    return 1
  }

  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
  // Полнота самой проверки — раньше её результата: находки в файлах, которые
  // гард не смотрит, не существуют, и зелёный прогон ничего бы не значил.
  const unlistedWrappers = findUnlistedWrappers(args.root)
  const findings = scanTouchTargets(args.root)
  const violations = compareToBaseline(findings, baseline)
  const result = {
    contractVersion: CONTRACT_VERSION,
    minTouchTarget: MIN_TOUCH_TARGET,
    findingCount: findings.length,
    violationCount: violations.length,
    violations,
    unlistedWrappers,
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } else if (unlistedWrappers.length > 0) {
    process.stderr.write(
      `Touch-target guard found ${unlistedWrappers.length} interactive wrapper usage(s) outside INTERACTIVE_ELEMENTS:\n`,
    )
    for (const wrapper of unlistedWrappers) {
      process.stderr.write(`- <${wrapper.name}> from ${wrapper.declaredIn} used in ${wrapper.usedIn}\n`)
    }
    process.stderr.write(
      'A component that forwards its `style` prop into a Pressable is a touch target itself; ' +
      'add its JSX name to INTERACTIVE_ELEMENTS in scripts/guard-touch-targets.js so its callers are checked.\n',
    )
  } else if (violations.length === 0) {
    process.stdout.write(
      `Touch-target guard passed. min=${MIN_TOUCH_TARGET}dp baseline=${Object.keys(baseline.entries || {}).length}\n`,
    )
  } else {
    process.stderr.write(`Touch-target guard found ${violations.length} sub-minimum touch target(s):\n`)
    for (const violation of violations) {
      const was = violation.kind === 'new' ? 'new' : `was ${violation.baseline}dp`
      process.stderr.write(`- ${violation.key} ${violation.dimension}=${violation.current}dp (${was})\n`)
    }
    process.stderr.write(
      `Interactive elements must size their own view to >= ${MIN_TOUCH_TARGET}dp; ` +
      'hitSlop does not extend past a tight parent and does not count. ' +
      'Wrap the visible shape in a transparent target frame (see MAP_TOOLBAR_TOUCH_TARGET_SIZE).\n',
    )
  }

  return violations.length === 0 && unlistedWrappers.length === 0 ? 0 : 1
}

if (require.main === module) {
  process.exit(run(parseArgs(process.argv.slice(2))))
}

module.exports = {
  CONTRACT_VERSION,
  MIN_TOUCH_TARGET,
  SCAN_DIRS,
  SIZE_KEYS,
  NUMERIC_SIZE_PROPS,
  INTERACTIVE_ELEMENTS,
  collectStyleSizes,
  collectStyleReferences,
  collectInlineStyleDims,
  collectInteractiveStyleNames,
  collectStyleForwardingWrappers,
  unwrapComponentFactory,
  collectExportedNames,
  collectExportedWrappers,
  collectImportBindings,
  findUnlistedWrappers,
  findSmallestDeclaredSize,
  isStyleModule,
  numericValue,
  scanFile,
  scanStyleModule,
  scanTouchTargets,
  toBaselineEntries,
  createBaseline,
  compareToBaseline,
  parseArgs,
  run,
}
