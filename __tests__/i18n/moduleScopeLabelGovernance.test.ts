import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

// #2156: подпись, прочитанная при загрузке модуля, застывает на языке по
// умолчанию (RU). Сохранённый язык на native восстанавливается из AsyncStorage
// позже, а смена языка на лету модуль не перезагружает — так «Навигация» меню
// аккаунта на iPad в EN оставалась русской. Подписи читаются только при показе:
// геттер (`get label() { return i18nT(...) }`), функция или рендер.
//
// Guard ловит код, который выполняется при загрузке модуля:
// - вызов функции перевода из `@/i18n` (`translate`, `t`, `i18nT`);
// - чтение `.label` / `.title` / `.accessibilityLabel` вне геттера — на верхнем
//   уровне и в колбэках `.map`/`.filter`/… и IIFE, которые тоже выполняются сразу.

const SOURCE_ROOTS = ['app', 'components', 'screens', 'constants', 'hooks', 'utils', 'context', 'stores']
const TRANSLATE_EXPORTS = new Set(['translate', 't', 'i18nT'])
const LOCALE_EXPORTS = new Set(['translatePlural', 'getFixedTranslator', 'getActiveLocale', 'getActiveLocaleDefinition', 'getFormatLocale'])
const { localeReturningExport, resolveImport } = require('@/i18n/babel-reactive-locale-plugin') as {
  localeReturningExport(file: string, name: string, root: string, platform: string): boolean
  resolveImport(source: string, file: string, root: string, platform: string): string | null
}
const LABEL_PROPERTIES = new Set(['label', 'title', 'accessibilityLabel'])
const EAGER_ARRAY_METHODS = new Set(['map', 'flatMap', 'filter', 'forEach', 'reduce', 'find', 'some', 'every', 'sort'])

const walk = (directory: string): string[] => {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) return walk(absolute)
    return /\.(?:js|jsx|ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [absolute] : []
  })
}

const isEagerFunction = (node: ts.ArrowFunction | ts.FunctionExpression): boolean => {
  let parent: ts.Node = node.parent
  while (ts.isParenthesizedExpression(parent)) parent = parent.parent
  if (!ts.isCallExpression(parent)) return false
  // IIFE: `(() => …)()`
  if (parent.expression === node || (ts.isParenthesizedExpression(parent.expression) && parent.expression.expression === node)) {
    return true
  }
  return (
    parent.arguments.includes(node) &&
    ts.isPropertyAccessExpression(parent.expression) &&
    EAGER_ARRAY_METHODS.has(parent.expression.name.text)
  )
}

const visitEager = (node: ts.Node, inspect: (node: ts.Node) => void) => {
  if (ts.isFunctionDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node)
    || ts.isMethodDeclaration(node) || ts.isClassDeclaration(node)) return
  if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && !isEagerFunction(node)) return
  inspect(node)
  ts.forEachChild(node, (child) => visitEager(child, inspect))
}

const findModuleScopeLabelReads = (fileName: string, source: string): string[] => {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true)
  const translateNames = new Set<string>()
  const eagerCalls = new Set<string>()
  visitEager(sourceFile, (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) eagerCalls.add(node.expression.text)
  })
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
    const source = statement.moduleSpecifier.text
    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    for (const element of bindings.elements) {
      if (!eagerCalls.has(element.name.text)) continue
      const name = (element.propertyName ?? element.name).text
      if (source.startsWith('@/i18n') && (TRANSLATE_EXPORTS.has(name) || LOCALE_EXPORTS.has(name) || name.startsWith('format'))) {
        translateNames.add(element.name.text)
        continue
      }
      // Reuse the presentation dependency analysis used by the Babel locale
      // transform: an imported getter can translate without a direct i18n call.
      if (source.startsWith('@/i18n')) continue
      const dependency = resolveImport(source, path.resolve(process.cwd(), fileName), process.cwd(), 'web')
      if (dependency && localeReturningExport(dependency, name, process.cwd(), 'web')) translateNames.add(element.name.text)
    }
  }

  const violations: string[] = []
  const report = (node: ts.Node, what: string) => {
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
    violations.push(`${fileName}:${line} ${what}`)
  }

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && translateNames.has(node.expression.text)) {
      report(node, `calls ${node.expression.text}() at module load`)
    }
    if (ts.isPropertyAccessExpression(node) && LABEL_PROPERTIES.has(node.name.text)) {
      report(node, `reads .${node.name.text} at module load`)
    }
  }
  visitEager(sourceFile, visit)
  return violations
}

describe('module-scope label governance (#2156)', () => {
  it('ловит чтение подписи в .map при загрузке модуля и пропускает геттер', () => {
    const frozen = `
      import { translate as i18nT } from '@/i18n'
      import { NAV } from './nav'
      const LINKS = NAV.map((item) => ({ title: item.label }))
      const HEADING = i18nT('ns:key')
    `
    expect(findModuleScopeLabelReads('frozen.ts', frozen)).toEqual([
      'frozen.ts:4 reads .label at module load',
      'frozen.ts:5 calls i18nT() at module load',
    ])

    const lazy = `
      import { translate as i18nT } from '@/i18n'
      import { NAV } from './nav'
      const toLink = (item) => ({ get title() { return item.label } })
      const LINKS = NAV.map(toLink)
      const ITEMS = [{ get label() { return i18nT('ns:key') } }]
      function render() { return NAV.map((item) => item.label) }
    `
    expect(findModuleScopeLabelReads('lazy.ts', lazy)).toEqual([])
  })

  it('в исходниках приложения подписи не читаются при загрузке модуля', () => {
    const violations = SOURCE_ROOTS.flatMap((root) =>
      walk(path.resolve(process.cwd(), root)).map((file) => {
        const relative = path.relative(process.cwd(), file)
        return findModuleScopeLabelReads(relative, fs.readFileSync(file, 'utf8'))
      }),
    ).flat()

    expect(violations).toEqual([])
  })

  it('ловит косвенное замораживание SEO-перевода через импортированную функцию', () => {
    expect(findModuleScopeLabelReads('document.ts', `
      import { getMapSeoTitle } from '@/constants/mapSeo'
      const TITLE = getMapSeoTitle()
      function current() { return getMapSeoTitle() }
    `)).toEqual(['document.ts:3 calls getMapSeoTitle() at module load'])
    // Relative imports resolve through the same plugin resolver.
    expect(findModuleScopeLabelReads('app/document.ts', `
      import { getMapSeoDescription } from '../constants/mapSeo'
      const DESCRIPTION = getMapSeoDescription()
    `)).toEqual(['app/document.ts:3 calls getMapSeoDescription() at module load'])
  })
})
