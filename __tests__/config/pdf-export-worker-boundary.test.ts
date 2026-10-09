/** @jest-environment node */
import fs from 'fs'
import { builtinModules } from 'module'
import path from 'path'
import ts from 'typescript'

const ROOT = path.resolve(__dirname, '../..')
// Renderer/parser code and neutral data contracts. The app-owned entitlement
// adapter reads authStore; it is outside these foundations and is not a worker entrypoint.
const SHARED_DIRS = [
  'services/pdf-export/generators',
  'services/pdf-export/parsers',
  'services/pdf-export/renderers',
  'services/pdf-export/themes',
  'services/pdf-export/quotes',
  'services/pdf-export/utils',
  'services/book',
]
const FOUNDATIONAL_ENTRYPOINTS = [
  'types/bookSettings.ts',
  'types/book.ts',
  'services/pdf-export/parsers/contentParser/htmlTree.parse5.ts',
  'services/pdf-export/parsers/contentParser/htmlTree.ts',
]
const NODE_MODULES = new Set(builtinModules.map((name) => name.replace(/^node:/, '')))
const isPlatformAdapter = (file: string) => /\.(?:web|node)\.[jt]sx?$/.test(file)

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const file = `${dir}/${entry.name}`
    return entry.isDirectory() ? sourceFiles(file) : /\.[jt]sx?$/.test(file) ? [file] : []
  })
}

/** Include type edges: importing an app-owned type must not pull the UI into the worker contract. */
function moduleReferences(source: string, file: string): string[] {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const modules: string[] = []
  const add = (node: ts.Node | undefined) => {
    if (node && ts.isStringLiteralLike(node)) modules.push(node.text)
  }
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier)
    else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      add(node.moduleReference.expression)
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      add(node.argument.literal)
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      add(node.arguments[0])
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return modules
}

function localModulePath(specifier: string, importer: string): string | null {
  if (specifier.startsWith('@/')) return path.resolve(ROOT, specifier.slice(2))
  if (specifier.startsWith('.')) return path.resolve(ROOT, path.dirname(importer), specifier)
  return null
}

function forbiddenModule(specifier: string, importer: string): boolean {
  const local = localModulePath(specifier, importer)
  const projectPath = local ? path.relative(ROOT, local) : specifier
  return (
    /^(?:components|app|screens|hooks|context|stores)(?:\/|$)/.test(projectPath) ||
    /^(?:react|react-dom|react-native|react-native-web|expo(?:-[^/]+)?)(?:\/|$)/.test(specifier) ||
    specifier.startsWith('node:') || NODE_MODULES.has(specifier) ||
    /^(?:@playwright\/|playwright(?:-core)?(?:\/|$)|puppeteer(?:-core)?(?:\/|$))/.test(specifier) ||
    /\.node(?:\.[jt]sx?)?$/.test(specifier) ||
    /(?:^|\/)(?:workers?|[^/]+\.worker)(?:\/|\.[jt]sx?$|$)/.test(projectPath)
  )
}

function boundaryViolations(source: string, file: string): string[] {
  return moduleReferences(source, file).filter((specifier) => forbiddenModule(specifier, file))
}

function collectFoundationalGraph(entrypoints: string[]): { files: string[]; violations: string[] } {
  const seen = new Set<string>()
  const violations: string[] = []
  const visit = (file: string) => {
    if (seen.has(file)) return
    seen.add(file)
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8')
    for (const specifier of moduleReferences(source, file)) {
      if (forbiddenModule(specifier, file)) violations.push(`${file} -> ${specifier}`)
      const local = localModulePath(specifier, file)
      if (!local) continue
      const resolved = [local, `${local}.ts`, `${local}.tsx`, path.join(local, 'index.ts')]
        .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
      if (!resolved) throw new Error(`Unresolved foundational dependency: ${file} -> ${specifier}`)
      visit(path.relative(ROOT, resolved))
    }
  }
  entrypoints.forEach(visit)
  return { files: [...seen].sort(), violations }
}

describe('PDF document foundations stay outside the app UI and worker runtime', () => {
  it('scans the live generator, book service, settings and parser seams', () => {
    const files = [
      ...SHARED_DIRS.flatMap(sourceFiles).filter((file) => !isPlatformAdapter(file)),
      'services/pdf-export/TravelDataTransformer.ts',
      'services/pdf-export/premiumSettingsGate.ts',
      'types/book.ts', 'types/bookSettings.ts',
    ]
    expect(files).toEqual(expect.arrayContaining([
      ...FOUNDATIONAL_ENTRYPOINTS,
      'services/book/BookHtmlExportService.ts',
      'services/pdf-export/parsers/ContentParser.ts',
      'services/pdf-export/parsers/contentParser/htmlTree.native.ts',
      'services/pdf-export/parsers/contentParser/htmlTree.parse5.ts',
      'services/pdf-export/generators/v2/runtime/EnhancedPdfGeneratorBase.ts',
      'services/pdf-export/generators/v2/runtime/legacyGalleryLayouts.ts',
      'services/pdf-export/quotes/travelQuotes.ts',
    ]))
    const violations = files.flatMap((file) =>
      boundaryViolations(fs.readFileSync(path.join(ROOT, file), 'utf8'), file)
        .map((specifier) => `${file} -> ${specifier}`),
    )
    expect(violations).toEqual([])
  })

  it('follows the entire foundational dependency graph, including type-only transitive edges', () => {
    const graph = collectFoundationalGraph(FOUNDATIONAL_ENTRYPOINTS)
    expect(graph.files).toEqual(expect.arrayContaining([
      ...FOUNDATIONAL_ENTRYPOINTS,
      'services/pdf-export/themes/types.ts',
      'types/pdf-gallery.ts',
      'services/pdf-export/parsers/contentParser/htmlTree.native.ts',
      'services/pdf-export/parsers/contentParser/htmlTree.parse5.ts',
    ]))
    expect(graph.violations).toEqual([])
    expect(graph.files.filter(isPlatformAdapter)).toEqual([])
  })

  it.each([
    ['import type { BookSettings } from "@/components/export/BookSettingsModal"', '@/components/export/BookSettingsModal'],
    ['export type { BookSettings } from "../components/export/BookSettingsModal.types"', '../components/export/BookSettingsModal.types'],
    ['import { Platform } from "react-native"', 'react-native'],
    ['import "expo-file-system/legacy"', 'expo-file-system/legacy'],
    ['import { readFile } from "node:fs/promises"', 'node:fs/promises'],
    ['import fs = require("fs")', 'fs'],
    ['const fs = require("fs/promises")', 'fs/promises'],
    ['type Thread = import("node:worker_threads").Worker', 'node:worker_threads'],
    ['const browser = import("playwright")', 'playwright'],
    ['export { parseHtmlBody } from "@/services/pdf-export/parsers/contentParser/htmlTree.node"', '@/services/pdf-export/parsers/contentParser/htmlTree.node'],
    ['import "../workers/pdf-export"', '../workers/pdf-export'],
  ])('rejects a regressed dependency in the real settings source: %s', (injected, forbidden) => {
    const file = 'types/bookSettings.ts'
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8')
    expect(boundaryViolations(`${source}\n${injected}`, file)).toEqual([forbidden])
  })

  it('ignores module names in documentation and strings while accepting the shared parse5 seam', () => {
    expect(moduleReferences(`
      // import { BookSettings } from '@/components/export/BookSettingsModal'
      const documentation = 'require("node:fs")'
      export { parseHtmlBody } from './htmlTree.parse5'
    `, 'adapter.ts')).toEqual(['./htmlTree.parse5'])
  })
})
