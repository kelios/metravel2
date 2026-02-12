const {
  parseArgs,
  shouldScanFile,
  findViolationsInSource,
  evaluateGuard,
  buildJsonResult,
  OUTPUT_CONTRACT_VERSION,
  ALLOWED_FILES,
} = require('@/scripts/guard-no-direct-window-open')

describe('guard-no-direct-window-open', () => {
  it('parses --json flag', () => {
    expect(parseArgs([])).toEqual({ output: 'text' })
    expect(parseArgs(['--json'])).toEqual({ output: 'json' })
  })

  it('scans only supported source files outside ignored directories', () => {
    expect(shouldScanFile('components/A.tsx')).toBe(true)
    expect(shouldScanFile('components/A.md')).toBe(false)
    expect(shouldScanFile('__tests__/A.test.tsx')).toBe(false)
    expect(shouldScanFile('e2e/A.spec.ts')).toBe(false)
  })

  it('ignores allowed file utils/externalLinks.ts', () => {
    const violations = findViolationsInSource({
      filePath: 'utils/externalLinks.ts',
      content: `window.open('https://metravel.by', '_blank')`,
    })
    expect(violations).toEqual([])
  })

  it('keeps strict allowlist (single chokepoint)', () => {
    expect(Array.from(ALLOWED_FILES)).toEqual(['utils/externalLinks.ts'])
  })

  it('reports violations in non-allowed files with line numbers', () => {
    const result = evaluateGuard({
      sources: [
        {
          filePath: 'components/home/HomeHero.tsx',
          content: `const x = 1\nwindow.open(url, '_blank')\nconst y = 2`,
        },
      ],
    })

    expect(result.ok).toBe(false)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]).toMatchObject({
      file: 'components/home/HomeHero.tsx',
      line: 2,
    })
  })

  it('passes when there are no direct calls in scanned sources', () => {
    const result = evaluateGuard({
      sources: [
        {
          filePath: 'components/home/HomeHero.tsx',
          content: 'void openExternalUrlInNewTab(url)',
        },
      ],
    })

    expect(result.ok).toBe(true)
    expect(result.violations).toEqual([])
  })

  it('builds json contract output', () => {
    const json = buildJsonResult({
      ok: false,
      reason: 'fail reason',
      violations: [{ file: 'a.ts', line: 10, snippet: "window.open(url, '_blank')" }],
    })

    expect(json.contractVersion).toBe(OUTPUT_CONTRACT_VERSION)
    expect(json.ok).toBe(false)
    expect(json.violationCount).toBe(1)
  })
})
