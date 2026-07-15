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

describe('test quality governance', () => {
  it('does not allow disabled or focused tests', () => {
    const violations = testFiles.flatMap((file) => {
      const source = fs.readFileSync(path.join(ROOT, file), 'utf8')
      const disabled = /\b(?:describe|it|test)\.(?:skip|only|todo)\s*\(|\b(?:xdescribe|xit|xtest)\s*\(/.test(source)
      return disabled ? [file] : []
    })

    expect(violations).toEqual([])
  })

  it('does not allow literal boolean assertions or bare expect calls', () => {
    const violations = testFiles.flatMap((file) => {
      const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/)
      return lines.flatMap((line, index) => {
        const literalBoolean = /\bexpect\s*\(\s*(?:true|false)\s*\)\s*\.\s*(?:toBe|toEqual|toBeTruthy|toBeFalsy)\s*\(/.test(line)
        const bareExpect = /^(?:await\s+)?expect\((?!.*\)\s*\.).+\);?$/.test(line.trim())
        return literalBoolean || bareExpect ? [`${file}:${index + 1}`] : []
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
