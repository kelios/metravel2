const fs = require('fs')
const path = require('path')
const { makeTempDir, writeTextFile } = require('./cli-test-utils')
const {
  ensure,
  collectFilesRecursive,
  toPosixRelative,
  readTextFile,
} = require('./policy-test-utils')

describe('policy-test-utils', () => {
  it('ensure passes when condition is true', () => {
    expect(() => ensure(true, 'should not throw')).not.toThrow()
  })

  it('ensure throws provided message when condition is false', () => {
    expect(() => ensure(false, 'expected failure message')).toThrow('expected failure message')
  })

  it('collectFilesRecursive returns nested files', () => {
    const dir = makeTempDir('policy-utils-files-')
    const fileA = path.join(dir, 'a.txt')
    const fileB = path.join(dir, 'nested', 'b.txt')
    writeTextFile(fileA, 'A')
    writeTextFile(fileB, 'B')

    const files = collectFilesRecursive(dir).map((file) => toPosixRelative(dir, file)).sort()
    expect(files).toEqual(['a.txt', 'nested/b.txt'])
  })

  it('toPosixRelative returns posix separators', () => {
    const base = path.join(process.cwd(), '__tests__')
    const target = path.join(base, 'scripts', 'policy-test-utils.test.ts')
    expect(toPosixRelative(base, target)).toBe('scripts/policy-test-utils.test.ts')
  })

  it('readTextFile reads utf8 content', () => {
    const dir = makeTempDir('policy-utils-read-')
    const file = path.join(dir, 'sample.txt')
    fs.writeFileSync(file, 'hello-policy', 'utf8')
    expect(readTextFile(file)).toBe('hello-policy')
  })
})
