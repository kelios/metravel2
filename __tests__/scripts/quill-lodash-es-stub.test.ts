/**
 * #2360: quill 2 imports cloneDeep / isEqual / merge from the `lodash-es`
 * barrel. Metro does not tree-shake, so that barrel put all of lodash-es
 * (~146 KB raw) into the web editor chunk. metro.config.js routes only quill's
 * own `lodash-es` imports to `metro-stubs/quill-lodash-es.js`.
 *
 * The stub is safe only while it exports every name quill imports: a quill
 * update that needs another lodash function must fail here, not as `undefined`
 * at runtime in the editor.
 */

import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '..', '..')
const STUB_REL = 'metro-stubs/quill-lodash-es.js'
const QUILL_DIR = path.join(ROOT, 'node_modules', 'quill')

const listJsFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : listJsFiles(full)
    return entry.name.endsWith('.js') ? [full] : []
  })

const LODASH_IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*['"]lodash-es['"]/g
// Every reference to the bare specifier, whatever the form: default/namespace
// imports, `export … from`, `require()`, `import()`.
const LODASH_SPECIFIER_RE = /['"]lodash-es['"]/g

const quillLodashImports = () => {
  const names = new Set<string>()
  const otherForms: string[] = []
  for (const file of listJsFiles(QUILL_DIR)) {
    const source = fs.readFileSync(file, 'utf8')
    const namedImports = [...source.matchAll(LODASH_IMPORT_RE)]
    for (const match of namedImports) {
      for (const specifier of match[1].split(',')) {
        const imported = specifier.trim().split(/\s+as\s+/)[0]
        if (imported) names.add(imported)
      }
    }
    // Only `import { a, b } from 'lodash-es'` can be checked against the stub.
    const references = source.match(LODASH_SPECIFIER_RE)?.length ?? 0
    if (references !== namedImports.length) otherForms.push(path.relative(ROOT, file))
  }
  return { names, otherForms }
}

const stubExports = () => {
  const source = fs.readFileSync(path.join(ROOT, STUB_REL), 'utf8')
  return new Map(
    [...source.matchAll(/export\s*\{\s*default\s+as\s+(\w+)\s*\}\s*from\s*'([^']+)'/g)].map(
      (match) => [match[1], match[2]] as const,
    ),
  )
}

describe('quill lodash-es web stub (#2360)', () => {
  let resolveRequest: (ctx: any, name: string, platform: string) => any

  beforeAll(() => {
    jest.resetModules()
    resolveRequest = require(path.join(ROOT, 'metro.config.js'))?.resolver?.resolveRequest
  })

  const ctxFrom = (originModulePath: string) => ({
    originModulePath,
    customResolverOptions: { environment: 'client' },
    resolveRequest: (_c: any, name: string) => ({ filePath: `ORIG:${name}`, type: 'sourceFile' }),
  })
  const quillOrigin = path.join(QUILL_DIR, 'core', 'quill.js')

  it('routes only quill’s own web lodash-es import to the stub', () => {
    const stubbed = resolveRequest(ctxFrom(quillOrigin), 'lodash-es', 'web')
    expect(stubbed.filePath.replace(/\\/g, '/').endsWith(STUB_REL)).toBe(true)

    expect(resolveRequest(ctxFrom(path.join(ROOT, 'utils', 'any.ts')), 'lodash-es', 'web').filePath).toBe('ORIG:lodash-es')
    expect(resolveRequest(ctxFrom(quillOrigin), 'lodash-es', 'ios').filePath).toBe('ORIG:lodash-es')
    expect(resolveRequest(ctxFrom(quillOrigin), 'lodash-es/merge.js', 'web').filePath).toBe('ORIG:lodash-es/merge.js')
  })

  it('exports every name quill imports from lodash-es, from existing per-method modules', () => {
    const { names, otherForms } = quillLodashImports()
    // Control: an empty scan would prove nothing.
    expect(names.size).toBeGreaterThan(0)
    expect(otherForms).toEqual([])

    const exported = stubExports()
    expect([...names].filter((name) => !exported.has(name))).toEqual([])
    for (const [name, specifier] of exported) {
      expect({ name, exists: fs.existsSync(path.join(ROOT, 'node_modules', specifier)) }).toEqual({ name, exists: true })
    }
  })
})
