const fs = require('fs')
const path = require('path')
const { makeTempDir, writeTextFile } = require('./cli-test-utils')
const {
  ensure,
  collectFilesRecursive,
  toPosixRelative,
  readTextFile,
  readScriptsTestFile,
  findDuplicates,
  buildForbiddenUsageMessage,
} = require('./policy-test-utils')
const exported = require('./policy-test-utils')

describe('policy-test-utils', () => {
  it('keeps exported policy-test-utils API stable', () => {
    expect(Object.keys(exported).sort()).toEqual([
      'buildForbiddenUsageMessage',
      'collectFilesRecursive',
      'ensure',
      'findDuplicates',
      'readScriptsTestFile',
      'readTextFile',
      'toPosixRelative',
    ])
  })

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

  it('readScriptsTestFile reads file from __tests__/scripts by default', () => {
    const content = readScriptsTestFile('policy-test-utils.js')
    expect(content).toContain('const fs = require(\'fs\')')
  })

  it('buildForbiddenUsageMessage formats context and remediation', () => {
    const message = buildForbiddenUsageMessage({
      subject: 'mkdtempSync usage',
      forbidden: ['a.test.ts', 'b.test.ts'],
      remediation: 'Use makeTempDir from __tests__/scripts/cli-test-utils.ts.',
    })
    expect(message).toContain('Found forbidden mkdtempSync usage in: [a.test.ts, b.test.ts].')
    expect(message).toContain('Use makeTempDir from __tests__/scripts/cli-test-utils.ts.')
  })

  it('findDuplicates returns only repeated values', () => {
    expect(findDuplicates(['a', 'b', 'a', 'c', 'b', 'd'])).toEqual(['a', 'b'])
    expect(findDuplicates(['x', 'y', 'z'])).toEqual([])
  })
})
