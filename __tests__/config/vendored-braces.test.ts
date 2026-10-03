import fs from 'node:fs'
import path from 'node:path'

// #2077: braces ≤3.0.3 (GHSA-vfj7-8cjw-p6xm) не имеет исправленного релиза на
// npm, поэтому resolutions подключает вендоренную копию с depth-guard
// (vendor/braces/VENDORED.md). yarn v1 не аудитит `file:`-зависимости, так что
// этот тест — единственный регрессионный контроль: он падает, если resolution
// снят и micromatch снова получает уязвимую копию с npm.

const repoRoot = path.resolve(__dirname, '../..')
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
const yarnLock = fs.readFileSync(path.join(repoRoot, 'yarn.lock'), 'utf8')

const lockVersions = (name: string): string[] => {
  const header = new RegExp(`^"?${name}@[^\\n]*:\\n {2}version "([^"]+)"`, 'gm')
  return Array.from(yarnLock.matchAll(header), (match) => match[1])
}

const resolveFrom = (request: string, fromPackage: string) =>
  require.resolve(request, { paths: [path.dirname(require.resolve(`${fromPackage}/package.json`))] })

describe('vendored braces (#2077)', () => {
  it('подключён через resolutions для всех потребителей', () => {
    expect(packageJson.resolutions.braces).toBe('file:./vendor/braces')
    expect(lockVersions('braces')).toEqual(['3.0.4-metravel.0'])

    // Версию, а не абсолютный путь: jest разрешает симлинки, а node_modules в
    // worktree сборки кандидата бывает симлинком на другой checkout.
    const bracesSeenByMicromatch = require(resolveFrom('braces/package.json', 'micromatch'))
    expect(bracesSeenByMicromatch.version).toBe('3.0.4-metravel.0')
    expect(require('braces/package.json').version).toBe('3.0.4-metravel.0')
  })

  it('отклоняет глубоко вложенный паттерн исключением, а не переполнением стека', () => {
    const braces = require('braces')
    // Вписывается в MAX_LENGTH (10 000), поэтому стоковый 3.0.3 падает на нём с
    // RangeError «Maximum call stack size exceeded» в рекурсивном обходе AST.
    const nested = `${'{'.repeat(4900)}a${'}'.repeat(4900)}`
    expect(nested.length).toBeLessThan(10000)

    expect(() => braces.expand(nested)).toThrow(SyntaxError)
    expect(() => braces.compile(nested)).toThrow(SyntaxError)
  })

  it('не меняет обычные glob и stringify', () => {
    const braces = require('braces')
    const micromatch = require('micromatch')

    expect(braces.expand('a{1..3}b')).toEqual(['a1b', 'a2b', 'a3b'])
    expect(braces('src/{a,b}/*.{ts,tsx}')).toEqual(['src/(a|b)/*.(ts|tsx)'])
    expect(micromatch.isMatch('app/(tabs)/index.tsx', 'app/**/*.{ts,tsx}')).toBe(true)
    expect(braces.stringify(braces.parse('{{a}}'), { escapeInvalid: true })).toBe('{{a}}')
  })
})

describe('brace-expansion в yarn.lock (#2077)', () => {
  // Первые исправленные версии по веткам: GHSA-6j4f-fj2g-mc7p и GHSA-qhr7-859c-m2p7.
  const patchedFloor: Record<number, [number, number]> = { 1: [1, 20], 2: [1, 6], 3: [0, 8], 5: [0, 11] }

  it('каждая мажорная ветка разрешена в исправленный патч', () => {
    const versions = lockVersions('brace-expansion')
    expect(versions.length).toBeGreaterThan(0)

    for (const version of versions) {
      const [major, minor, patch] = version.split('.').map(Number)
      const floor = patchedFloor[major]
      expect({ version, known: Boolean(floor) }).toEqual({ version, known: true })
      const [minMinor, minPatch] = floor
      expect({ version, patched: minor > minMinor || (minor === minMinor && patch >= minPatch) })
        .toEqual({ version, patched: true })
    }
  })
})
