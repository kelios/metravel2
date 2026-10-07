import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '../..')
const SCAN = ['app', 'components', 'screens']
const SOURCE = new Set(['.ts', '.tsx', '.js', '.jsx'])

const filesOf = (dir: string): string[] => {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...filesOf(full))
    else if (SOURCE.has(entry.slice(entry.lastIndexOf('.')))) out.push(full)
  }
  return out
}

describe('StatusBar literal barStyle (#2095)', () => {
  it('allows a literal barStyle only in the root layout', () => {
    const hits: string[] = []
    for (const dir of SCAN) {
      for (const file of filesOf(join(ROOT, dir))) {
        const rel = relative(ROOT, file)
        if (rel === 'app/_layout.tsx') continue
        const text = readFileSync(file, 'utf8')
        if (/<StatusBar[\s\S]{0,200}barStyle\s*=\s*["']/.test(text)) hits.push(rel)
      }
    }
    expect(hits).toEqual([])
  })
})

/** Bounded AST dataflow for the root consumer, including renamed imports and
 * the RootLayoutNav -> ThemedContent prop boundary. Text mentions are not calls. */
function systemThemeBarStyles(text: string): string[] {
  const ts = require('typescript') as typeof import('typescript')
  const name = '/root-layout.tsx'
  const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const host = ts.createCompilerHost({ noLib: true, noResolve: true, jsx: ts.JsxEmit.Preserve })
  host.getSourceFile = file => file === name ? source : undefined
  host.fileExists = file => file === name
  host.readFile = file => file === name ? text : undefined
  const checker = ts.createProgram([name], { noLib: true, noResolve: true, jsx: ts.JsxEmit.Preserve }, host).getTypeChecker()
  const symbol = (node: import('typescript').Node) => checker.getSymbolAtLocation(node)
  const hooks = new Set<import('typescript').Symbol>()
  const bars = new Set<import('typescript').Symbol>()
  const namespaces = new Set<import('typescript').Symbol>()
  const tainted = new Set<import('typescript').Symbol>()
  const properties = new Map<import('typescript').Symbol, Set<string>>()
  const declarations: import('typescript').VariableDeclaration[] = []
  const jsx: (import('typescript').JsxOpeningElement | import('typescript').JsxSelfClosingElement)[] = []
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== 'react-native') continue
    const binding = statement.importClause?.namedBindings
    if (binding && ts.isNamedImports(binding)) for (const specifier of binding.elements) {
      const original = (specifier.propertyName || specifier.name).text, value = symbol(specifier.name)
      if (value && original === 'useColorScheme') hooks.add(value)
      if (value && original === 'StatusBar') bars.add(value)
    }
    else if (binding && ts.isNamespaceImport(binding)) { const value = symbol(binding.name); if (value) namespaces.add(value) }
    const value = statement.importClause?.name && symbol(statement.importClause.name)
    if (value) namespaces.add(value)
  }
  const namespaceMember = (node: import('typescript').Node, member: string) => ts.isPropertyAccessExpression(node) && node.name.text === member && namespaces.has(symbol(node.expression)!)
  const hook = (node: import('typescript').Node) => hooks.has(symbol(node)!) || namespaceMember(node, 'useColorScheme')
  const depends = (node: import('typescript').Node): boolean => {
    if (ts.isCallExpression(node) && hook(node.expression)) return true
    if (ts.isIdentifier(node) && tainted.has(symbol(node)!)) return true
    if (ts.isPropertyAccessExpression(node) && properties.get(symbol(node.expression)!)?.has(node.name.text)) return true
    if (ts.isElementAccessExpression(node) && node.argumentExpression && ts.isStringLiteral(node.argumentExpression) && properties.get(symbol(node.expression)!)?.has(node.argumentExpression.text)) return true
    return ts.forEachChild(node, child => depends(child) || undefined) === true
  }
  const collect = (node: import('typescript').Node) => {
    if (ts.isVariableDeclaration(node)) declarations.push(node)
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) jsx.push(node)
    ts.forEachChild(node, collect)
  }
  collect(source)
  let changed = true
  const mark = (node: import('typescript').Node) => { const value = symbol(node); if (value && !tainted.has(value)) { tainted.add(value); changed = true } }
  while (changed) {
    changed = false
    for (const declaration of declarations) {
      if (!declaration.initializer) continue
      if (ts.isIdentifier(declaration.name)) {
        if (hook(declaration.initializer)) { const value = symbol(declaration.name); if (value && !hooks.has(value)) { hooks.add(value); changed = true } }
        if (depends(declaration.initializer)) mark(declaration.name)
      } else if (ts.isObjectBindingPattern(declaration.name)) for (const element of declaration.name.elements) {
        const key = (element.propertyName || element.name).getText(source)
        if (depends(declaration.initializer) || properties.get(symbol(declaration.initializer)!)?.has(key)) mark(element.name)
      }
    }
    for (const element of jsx) {
      const declaration = symbol(element.tagName)?.valueDeclaration
      const fn = declaration && (ts.isFunctionDeclaration(declaration) ? declaration : ts.isVariableDeclaration(declaration) && declaration.initializer && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer)) ? declaration.initializer : undefined)
      const param = fn?.parameters[0]?.name
      if (!param) continue
      for (const attr of element.attributes.properties) {
        if (!ts.isJsxAttribute(attr) || !attr.initializer || !depends(attr.initializer)) continue
        const key = attr.name.getText(source)
        if (ts.isObjectBindingPattern(param)) for (const binding of param.elements) { if ((binding.propertyName || binding.name).getText(source) === key) mark(binding.name) }
        else if (ts.isIdentifier(param)) {
          const value = symbol(param)
          if (value) { const keys = properties.get(value) || new Set<string>(); if (!keys.has(key)) { keys.add(key); properties.set(value, keys); changed = true } }
        }
      }
    }
  }
  return jsx.flatMap(element => {
    if (!bars.has(symbol(element.tagName)!) && !namespaceMember(element.tagName, 'StatusBar')) return []
    return element.attributes.properties.filter(attr => ts.isJsxAttribute(attr) && attr.name.getText(source) === 'barStyle' && attr.initializer && depends(attr.initializer)).map(attr => attr.getText(source))
  })
}

describe('root StatusBar source guard (#2273)', () => {
  it('actual root does not derive barStyle from system useColorScheme', () => {
    expect(systemThemeBarStyles(readFileSync(join(ROOT, 'app/_layout.tsx'), 'utf8'))).toEqual([])
  })
  it.each([
    `import {StatusBar as Bar, useColorScheme as system} from 'react-native'; function Root(){const mode=system();return <Bar barStyle={mode==='dark'?'light-content':'dark-content'}/>}`,
    `import * as Native from 'react-native'; function Root(){const mode=Native.useColorScheme();const alias=mode;return <Native.StatusBar barStyle={alias==='dark'?'light-content':'dark-content'}/>}`,
    `import {StatusBar as Bar, useColorScheme as system} from 'react-native'; function Root(){const mode=system();return <Content scheme={mode}/>}; function Content({scheme: renamed}){return <Bar barStyle={renamed==='dark'?'light-content':'dark-content'}/>}`,
    `import {StatusBar as Bar, useColorScheme} from 'react-native'; function Root(){const read=useColorScheme;return <Content scheme={read()}/>}; const Content=(props)=>{const {scheme: mode}=props;return <Bar barStyle={mode==='dark'?'light-content':'dark-content'}/>}`,
  ])('rejects actual system-derived alias/prop source %#', source => {
    expect(systemThemeBarStyles(source)).toHaveLength(1)
  })
  it.each([
    `import {StatusBar as Bar, useColorScheme as system} from 'react-native'; function Root(){const ignored=system();const {isDark}=useTheme();return <Bar barStyle={isDark?'light-content':'dark-content'}/>}`,
    `import {StatusBar as Bar, useColorScheme as system} from 'react-native'; // system() is not a call\nconst copy='useColorScheme()';function Root(){return <Bar barStyle={'dark-content'}/>}`,
    `import {StatusBar as Bar, useColorScheme as system} from 'react-native'; function Root(){return <Content scheme={'dark'} appDark={false}/>}; function Content(props){return <Bar barStyle={props.appDark?'light-content':'dark-content'}/>}`,
  ])('accepts app-only source, unused imports and text-only mentions %#', source => {
    expect(systemThemeBarStyles(source)).toEqual([])
  })
})
