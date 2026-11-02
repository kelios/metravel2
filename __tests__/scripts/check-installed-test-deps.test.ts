const path = require('path')
const { makeTempDir, writeTextFile } = require('./cli-test-utils')
const {
  findTestStackDrift,
  formatDriftMessage,
  resolveLockedVersion,
} = require('@/scripts/check-installed-test-deps')

const LOCKFILE = [
  '# yarn lockfile v1',
  '',
  '"@testing-library/react-native@14.1.0":',
  '  version "14.1.0"',
  '',
  'test-renderer@1.3.0:',
  '  version "1.3.0"',
  '',
  'test-renderer@1.3.1, test-renderer@^1.3.1:',
  '  version "1.3.1"',
  '',
  'jest@~30.5.2:',
  '  version "30.5.2"',
  '',
].join('\n')

const writeCheckout = (installed: Record<string, string>) => {
  const rootDir = makeTempDir('test-stack-drift-')
  writeTextFile(path.join(rootDir, 'package.json'), JSON.stringify({
    dependencies: { 'test-renderer': '1.3.1' },
    devDependencies: { '@testing-library/react-native': '14.1.0', jest: '~30.5.2' },
  }))
  writeTextFile(path.join(rootDir, 'yarn.lock'), LOCKFILE)
  for (const [name, version] of Object.entries(installed)) {
    writeTextFile(
      path.join(rootDir, 'node_modules', name, 'package.json'),
      JSON.stringify({ name, version }),
    )
  }
  return rootDir
}

describe('check-installed-test-deps (#2915)', () => {
  it('resolves the lockfile entry of the declared specifier, not another copy', () => {
    expect(resolveLockedVersion(LOCKFILE, 'test-renderer', '1.3.1')).toBe('1.3.1')
    expect(resolveLockedVersion(LOCKFILE, 'test-renderer', '^1.3.1')).toBe('1.3.1')
    expect(resolveLockedVersion(LOCKFILE, '@testing-library/react-native', '14.1.0')).toBe('14.1.0')
    expect(resolveLockedVersion(LOCKFILE, 'jest', '^29.0.0')).toBeNull()
  })

  it('passes when installed versions match yarn.lock', () => {
    const rootDir = writeCheckout({
      '@testing-library/react-native': '14.1.0',
      'test-renderer': '1.3.1',
      jest: '30.5.2',
    })
    expect(findTestStackDrift({ rootDir })).toEqual([])
  })

  it('reports stale and missing packages of a harness worktree', () => {
    const rootDir = writeCheckout({
      '@testing-library/react-native': '13.3.3',
      jest: '30.5.2',
    })
    const drift = findTestStackDrift({ rootDir })
    expect(drift).toEqual([
      { name: '@testing-library/react-native', locked: '14.1.0', installed: '13.3.3' },
      { name: 'test-renderer', locked: '1.3.1', installed: null },
    ])
    const message = formatDriftMessage(drift)
    expect(message).toContain('yarn install --frozen-lockfile')
    expect(message).toContain('@testing-library/react-native: yarn.lock 14.1.0, установлено 13.3.3')
  })

  it('is a no-op outside a checkout with package.json and yarn.lock', () => {
    expect(findTestStackDrift({ rootDir: makeTempDir('test-stack-empty-') })).toEqual([])
  })
})
