const {
  parseArgs,
  shouldScanFile,
  findViolationsInSource,
  evaluateGuard,
  buildJsonResult,
  OUTPUT_CONTRACT_VERSION,
  ALLOWED_FILES,
} = require('@/scripts/guard-no-inline-back-navigation')

describe('guard-no-inline-back-navigation', () => {
  it('parses --json flag', () => {
    expect(parseArgs([])).toEqual({ output: 'text' })
    expect(parseArgs(['--json'])).toEqual({ output: 'json' })
  })

  it('scans only supported source files outside ignored directories', () => {
    expect(shouldScanFile('components/A.tsx')).toBe(true)
    expect(shouldScanFile('app/(tabs)/a.native.tsx')).toBe(true)
    expect(shouldScanFile('components/A.md')).toBe(false)
    expect(shouldScanFile('__tests__/A.test.tsx')).toBe(false)
    expect(shouldScanFile('e2e/A.spec.ts')).toBe(false)
  })

  it('keeps the allowlist to the chokepoint and the Android hardware-back hook', () => {
    expect(Array.from(ALLOWED_FILES)).toEqual(['utils/backNavigation.ts', 'hooks/useAndroidBackHandler.ts'])
  })

  it('ignores the chokepoint itself', () => {
    const violations = findViolationsInSource({
      filePath: 'utils/backNavigation.ts',
      content: `if (typeof router.canGoBack === 'function' && router.canGoBack()) router.back()`,
    })
    expect(violations).toEqual([])
  })

  it('flags a hand-written copy of the idiom with a line number (negative probe)', () => {
    const result = evaluateGuard({
      sources: [
        {
          filePath: 'components/foo/BackButton.tsx',
          content: `const onPress = () => {\n  if (router.canGoBack()) {\n    router.back()\n  } else {\n    router.replace('/')\n  }\n}`,
        },
      ],
    })

    expect(result.ok).toBe(false)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]).toMatchObject({ file: 'components/foo/BackButton.tsx', line: 2 })
  })

  it('does not count a mention inside a comment line', () => {
    const result = evaluateGuard({
      sources: [
        {
          filePath: 'app/(tabs)/travels/[param].tsx',
          content: `// зовёт router.back() при canGoBack().\nconst x = goBackOrReplace(router, '/')`,
        },
      ],
    })
    expect(result.ok).toBe(true)
  })

  it('passes sources that go through goBackOrReplace', () => {
    const result = evaluateGuard({
      sources: [{ filePath: 'components/foo/BackButton.tsx', content: `goBackOrReplace(router, '/profile')` }],
    })
    expect(result.ok).toBe(true)
    expect(result.violations).toEqual([])
  })

  it('builds a json result with the contract version', () => {
    const json = buildJsonResult(evaluateGuard({ sources: [] }))
    expect(json).toMatchObject({ contractVersion: OUTPUT_CONTRACT_VERSION, ok: true, violationCount: 0 })
  })
})
