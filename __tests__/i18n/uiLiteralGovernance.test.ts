import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const UI_ROOTS = ['app', 'components', 'screens']
const CYRILLIC = /[А-Яа-яЁё]/

// These files contain compatibility aliases or stable backend classifier values,
// not copy rendered directly by the UI. They stay in Russian until the API
// exposes locale-independent codes for the corresponding domain values.
const DATA_CONTRACT_ALLOWLIST = new Set([
  'components/navigation/navigationActionMeta.ts',
  'components/roulette/useRoulette.ts',
  'components/screens/profile/profileCountries.ts',
  'components/ui/ErrorDisplay.tsx',
  'components/UserPoints/pointsListLogic.ts',
  'screens/tabs/PlacesScreen.helpers.ts',
])

const walk = (directory: string): string[] => {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) return walk(absolute)
    return /\.(?:js|jsx|ts|tsx)$/.test(entry.name) ? [absolute] : []
  })
}

describe('UI localization governance', () => {
  it('does not allow untranslated Cyrillic runtime strings in UI source', () => {
    const violations: string[] = []

    const isConsoleMessage = (node: ts.Node) => {
      let current: ts.Node | undefined = node.parent
      while (current) {
        if (ts.isCallExpression(current)) {
          const callee = current.expression
          return (
            ts.isPropertyAccessExpression(callee) &&
            ts.isIdentifier(callee.expression) &&
            callee.expression.text === 'console'
          )
        }
        if (ts.isFunctionLike(current) || ts.isSourceFile(current)) return false
        current = current.parent
      }
      return false
    }

    for (const root of UI_ROOTS) {
      for (const file of walk(path.resolve(process.cwd(), root))) {
        const relativeFile = path.relative(process.cwd(), file)
        if (DATA_CONTRACT_ALLOWLIST.has(relativeFile)) continue

        const source = fs.readFileSync(file, 'utf8')
        const sourceFile = ts.createSourceFile(
          file,
          source,
          ts.ScriptTarget.Latest,
          true,
          file.endsWith('.tsx') || file.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        )

        const visit = (node: ts.Node) => {
          if (
            (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
            CYRILLIC.test(node.text) &&
            !isConsoleMessage(node)
          ) {
            const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
            violations.push(
              `${relativeFile}:${location.line + 1} ${node.text.trim().replace(/\s+/g, ' ').slice(0, 80)}`,
            )
          }
          ts.forEachChild(node, visit)
        }

        visit(sourceFile)
      }
    }

    expect(violations).toEqual([])
  })

  it('does not allow new Cyrillic text directly in JSX nodes or attributes', () => {
    const violations: string[] = []

    for (const root of UI_ROOTS) {
      for (const file of walk(path.resolve(process.cwd(), root))) {
        const source = fs.readFileSync(file, 'utf8')
        const sourceFile = ts.createSourceFile(
          file,
          source,
          ts.ScriptTarget.Latest,
          true,
          file.endsWith('.tsx') || file.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        )

        const addViolation = (node: ts.Node, text: string) => {
          const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
          violations.push(
            `${path.relative(process.cwd(), file)}:${location.line + 1} ${text.trim().slice(0, 80)}`,
          )
        }

        const visit = (node: ts.Node) => {
          if (ts.isJsxText(node) && CYRILLIC.test(node.text)) addViolation(node, node.text)
          if (
            ts.isJsxAttribute(node) &&
            node.initializer &&
            ts.isStringLiteral(node.initializer) &&
            CYRILLIC.test(node.initializer.text)
          ) {
            addViolation(node, node.initializer.text)
          }
          ts.forEachChild(node, visit)
        }

        visit(sourceFile)
      }
    }

    expect(violations).toEqual([])
  })

  it('does not hardcode the Russian locale in application formatting or SEO markup', () => {
    const violations: string[] = []
    const markupPatterns = [
      /<html[^>]+lang=["']ru["']/,
      /property=["']og:locale["'][^>]+content=["']ru_RU["']/,
      /inLanguage\s*:\s*['"]ru['"]/,
    ]
    const localeSensitiveMethods = new Set([
      'localeCompare',
      'toLocaleDateString',
      'toLocaleLowerCase',
      'toLocaleString',
      'toLocaleTimeString',
      'toLocaleUpperCase',
    ])

    for (const root of [...UI_ROOTS, 'hooks', 'utils', 'services']) {
      for (const file of walk(path.resolve(process.cwd(), root))) {
        const source = fs.readFileSync(file, 'utf8')
        const sourceFile = ts.createSourceFile(
          file,
          source,
          ts.ScriptTarget.Latest,
          true,
          file.endsWith('.tsx') || file.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        )
        let containsHardcodedLocale = markupPatterns.some((pattern) => pattern.test(source))

        const visit = (node: ts.Node) => {
          if (containsHardcodedLocale) return
          if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            localeSensitiveMethods.has(node.expression.name.text) &&
            node.arguments.some(
              (argument) =>
                ts.isStringLiteralLike(argument) && /^ru(?:-RU)?$/i.test(argument.text),
            )
          ) {
            containsHardcodedLocale = true
            return
          }
          ts.forEachChild(node, visit)
        }

        visit(sourceFile)
        if (containsHardcodedLocale) {
          violations.push(path.relative(process.cwd(), file))
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('does not implement locale-specific plural rules with modulo arithmetic', () => {
    const violations: string[] = []

    for (const root of [...UI_ROOTS, 'hooks', 'utils', 'services']) {
      for (const file of walk(path.resolve(process.cwd(), root))) {
        const source = fs.readFileSync(file, 'utf8')
        const sourceFile = ts.createSourceFile(
          file,
          source,
          ts.ScriptTarget.Latest,
          true,
          file.endsWith('.tsx') || file.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        )
        const pluralModuli = new Set<number>()

        const visit = (node: ts.Node) => {
          if (
            ts.isBinaryExpression(node) &&
            node.operatorToken.kind === ts.SyntaxKind.PercentToken &&
            ts.isNumericLiteral(node.right)
          ) {
            const modulus = Number(node.right.text)
            if (modulus === 10 || modulus === 100) pluralModuli.add(modulus)
          }
          ts.forEachChild(node, visit)
        }

        visit(sourceFile)
        if (pluralModuli.has(10) && pluralModuli.has(100)) {
          violations.push(path.relative(process.cwd(), file))
        }
      }
    }

    expect(violations).toEqual([])
  })
})
