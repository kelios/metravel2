import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const TEST_ROOTS = ['__tests__', 'e2e']
const TEST_FILE_PATTERN = /\.(?:test|spec)\.(?:ts|tsx|js)$/
const SELF = '__tests__/scripts/test-quality-governance.test.ts'

const collectTestFiles = (relativeDir: string): string[] => {
  const absoluteDir = path.join(ROOT, relativeDir)
  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.posix.join(relativeDir, entry.name)
    if (entry.isDirectory()) return collectTestFiles(relativePath)
    return TEST_FILE_PATTERN.test(entry.name) ? [relativePath] : []
  })
}

const testFiles = TEST_ROOTS.flatMap(collectTestFiles).filter((file) => file !== SELF)

const FOCUSED_OR_DISABLED = /\b(?:describe|it|test)\.(?:only|todo)\s*\(|\b(?:xdescribe|xit|xtest)\s*\(/g
const SKIP_CALL = /\b(?:describe|it|test)\.skip\s*\(\s*/g
const NAMED_SKIP_HEAD = new Set([')', "'", '"', '`'])

const lineOf = (source: string, index: number): number => source.slice(0, index).split(/\r?\n/).length

const collectMatches = (file: string, source: string, pattern: RegExp): string[] => {
  pattern.lastIndex = 0
  const found: string[] = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(source)) !== null) {
    found.push(`${file}:${lineOf(source, match.index)}`)
  }
  return found
}

// `test.skip(condition, 'reason')` — рантайм-ветка Playwright: тест остаётся в
// наборе, выполняется при других условиях и виден в отчёте как skipped с
// причиной. Отключением считаем только формы, которые убирают тест насовсем:
// именованный `test.skip('name', fn)` и безаргументный `test.skip()`.
const collectDisablingSkips = (file: string, source: string): string[] => {
  SKIP_CALL.lastIndex = 0
  const found: string[] = []
  let match: RegExpExecArray | null
  while ((match = SKIP_CALL.exec(source)) !== null) {
    const head = source[match.index + match[0].length]
    if (head !== undefined && NAMED_SKIP_HEAD.has(head)) {
      found.push(`${file}:${lineOf(source, match.index)}`)
    }
  }
  return found
}

describe('test quality governance', () => {
  it('does not allow disabled or focused tests', () => {
    const violations = testFiles.flatMap((file) => {
      const source = fs.readFileSync(path.join(ROOT, file), 'utf8')
      return [
        ...collectMatches(file, source, FOCUSED_OR_DISABLED),
        ...collectDisablingSkips(file, source),
      ]
    })

    expect(violations).toEqual([])
  })

  it('does not allow literal boolean assertions', () => {
    const violations = testFiles.flatMap((file) => {
      const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/)
      return lines.flatMap((line, index) => {
        const literalBoolean = /\bexpect\s*\(\s*(?:true|false)\s*\)\s*\.\s*(?:toBe|toEqual|toBeTruthy|toBeFalsy)\s*\(/.test(line)
        return literalBoolean ? [`${file}:${index + 1}`] : []
      })
    })

    expect(violations).toEqual([])
  })

  it('keeps diagnostic and manual artifacts out of the automated E2E spec set', () => {
    const invalidNames = testFiles
      .filter((file) => file.startsWith('e2e/'))
      .filter((file) => /(?:^e2e\/_|\/manual-qa-|\/qa-pending-)/.test(file))

    expect(invalidNames).toEqual([])
  })
})
