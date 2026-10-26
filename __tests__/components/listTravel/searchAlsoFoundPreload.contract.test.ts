/** @jest-environment node */

import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Exercise the real preload function with Metro's permitted import results;
// Jest's import transform otherwise always supplies a native Promise.
function preloadWith(loadModule: () => unknown): () => Promise<unknown> {
  const source = fs.readFileSync('components/listTravel/hooks/useSearchAlsoFound.tsx', 'utf8')
  const parsed = ts.createSourceFile('preload.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let declaration: ts.VariableDeclaration | undefined
  for (const statement of parsed.statements) {
    if (!ts.isVariableStatement(statement)) continue
    declaration = statement.declarationList.declarations.find((entry) => entry.name.getText(parsed) === 'loadList')
    if (declaration) break
  }
  if (!declaration?.initializer) throw new Error('Search preload owner is missing')
  const transformed = ts.transpileModule(`let listRequest = null; const loadList = ${declaration.initializer.getText(parsed)}; exports.load = loadList;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    transformers: { before: [(context) => {
      const visit: ts.Visitor = (node) => ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
        ? ts.factory.createCallExpression(ts.factory.createIdentifier('loadModule'), undefined, [])
        : ts.visitEachChild(node, visit, context)
      return (root) => ts.visitNode(root, visit) as ts.SourceFile
    }] },
  }).outputText
  const exports: { load?: () => Promise<unknown> } = {}
  vm.runInNewContext(transformed, { exports, loadModule, Promise })
  return exports.load!
}

describe('Search also-found preload import contract (#2812)', () => {
  it('normalizes a synchronously available module and memoizes the in-flight result', async () => {
    const module = { default: () => null }
    const loadModule = jest.fn(() => module)
    const load = preloadWith(loadModule)
    const first = load()
    expect(load()).toBe(first)
    await expect(first).resolves.toBe(module)
    expect(loadModule).toHaveBeenCalledTimes(1)
  })

  it('assimilates a bare thenable without a catch method', async () => {
    const module = { default: () => null }
    const load = preloadWith(() => ({ then: (resolve: (value: unknown) => void) => resolve(module) }))
    await expect(load()).resolves.toBe(module)
  })

  it('releases a rejected preload so opening the list can retry', async () => {
    const error = new Error('chunk unavailable')
    const module = { default: () => null }
    const loadModule = jest.fn<unknown, []>()
      .mockReturnValueOnce({ then: (_resolve: unknown, reject: (reason: Error) => void) => reject(error) })
      .mockReturnValueOnce(module)
    const load = preloadWith(loadModule)
    const first = load()
    await expect(first).rejects.toBe(error)
    const retry = load()
    expect(retry).not.toBe(first)
    await expect(retry).resolves.toBe(module)
    expect(loadModule).toHaveBeenCalledTimes(2)
  })
})
