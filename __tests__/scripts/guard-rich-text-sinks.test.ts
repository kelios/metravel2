const {
  SINK_ALLOWLIST,
  ATTRIBUTE_REWRITE_FILES,
  parseArgs,
  lexSource,
  shouldScanFile,
  findSinkViolations,
  findAttributeRewriteViolations,
  evaluateGuard,
  buildJsonResult,
  OUTPUT_CONTRACT_VERSION,
} = require('@/scripts/guard-rich-text-sinks')

describe('guard-rich-text-sinks', () => {
  it('parses --json flag', () => {
    expect(parseArgs([])).toEqual({ output: 'text' })
    expect(parseArgs(['--json'])).toEqual({ output: 'json' })
  })

  it('scans components/app sources and the attribute rewriters only', () => {
    expect(shouldScanFile('components/travel/StableContent.web.tsx')).toBe(true)
    expect(shouldScanFile('app/(tabs)/article/[id].web.tsx')).toBe(true)
    expect(shouldScanFile('utils/richTextImageLayout.ts')).toBe(true)
    expect(shouldScanFile('utils/other.ts')).toBe(false)
    expect(shouldScanFile('components/__tests__/A.test.tsx')).toBe(false)
  })

  it('keeps an explicit, reasoned allowlist of non-rich-text sinks', () => {
    expect(Array.from(SINK_ALLOWLIST.keys())).toEqual(['app/+html.tsx'])
    for (const reason of SINK_ALLOWLIST.values()) expect(String(reason).length).toBeGreaterThan(20)
  })

  it('flags a raw __html sink and a sink without inertMarkup', () => {
    const raw = findSinkViolations({
      filePath: 'components/article/Body.tsx',
      content: 'export const Body = ({ html }) => <div dangerouslySetInnerHTML={{ __html: html }} />',
    })
    expect(raw).toHaveLength(1)
    expect(raw[0]).toMatchObject({ rule: 'sink', line: 1 })

    const viaVariable = findSinkViolations({
      filePath: 'components/article/Body.tsx',
      content: 'const markup = build(html)\nexport const Body = () => <div\n  dangerouslySetInnerHTML={markup}\n/>',
    })
    expect(viaVariable).toEqual([expect.objectContaining({ line: 3, rule: 'sink' })])
  })

  it('accepts a sink fed by inertMarkup and ignores mentions in comments', () => {
    expect(findSinkViolations({
      filePath: 'components/travel/StableContent.web.tsx',
      content: [
        "import { inertMarkup, toInertHtml } from '@/utils/inertHtml'",
        '// раньше: dangerouslySetInnerHTML={{ __html: html }}',
        'const markup = inertMarkup(toInertHtml(html))',
        'export const Body = () => <div dangerouslySetInnerHTML={markup} />',
      ].join('\n'),
    })).toEqual([])
    expect(findSinkViolations({
      filePath: 'components/seo/jsonLdScript.tsx',
      content: '/** dangerouslySetInnerHTML is dropped by Helmet */\nexport const x = 1',
    })).toEqual([])
    expect(findSinkViolations({ filePath: 'app/+html.tsx', content: '<script dangerouslySetInnerHTML={{ __html: s }} />' }))
      .toEqual([])
  })

  it('flags attribute regexes in tag rewriters, including the #3202 shapes', () => {
    const content = [
      'const a = tag.match(/\\bsrc="([^"]+)"/i)',
      "const b = attrs.replace(/class=\"([^\"]*)\"/i, 'x')",
      'const c = /\\bid\\s*=\\s*"[^"]+"/i.test(attrs)',
      'const d = html.replace(/<div\\b[^>]*class="[^"]*\\bimg-grid\\b[^"]*"[^>]*>/gi, "")',
    ].join('\n')
    const violations = findAttributeRewriteViolations({ filePath: ATTRIBUTE_REWRITE_FILES[0], content })
    expect(violations.map((v: { line: number }) => v.line)).toEqual([1, 2, 3, 4])
  })

  it('does not confuse markup in strings, division or CSS regexes with attribute regexes', () => {
    const content = [
      'const wrap = `<div class="${name}">${inner}</div>`',
      "const s = '<p class=\"x\">' + a / b",
      'const ratio = html.match(/aspect-ratio:\\s*(\\d+)\\s*\\/\\s*(\\d+)/i)',
      'const yt = src.match(/[?&]v=([a-z0-9_-]{6,})/i)',
    ].join('\n')
    expect(findAttributeRewriteViolations({ filePath: 'utils/richTextImageLayout.ts', content })).toEqual([])
    expect(findAttributeRewriteViolations({ filePath: 'utils/other.ts', content: 'x.match(/\\bsrc="/)' })).toEqual([])
  })

  it('lexer keeps line numbers and strips comments', () => {
    const { code, regexes } = lexSource('// a /x/\nconst r = /y=/\n/* b\n*/ const s = "/z/"')
    expect(code.split('\n')).toHaveLength(4)
    expect(code).not.toContain('a /x/')
    expect(regexes).toEqual([{ line: 2, body: 'y=' }])
  })

  it('builds the JSON contract', () => {
    const result = evaluateGuard({
      sources: [{ filePath: 'components/A.tsx', content: '<div dangerouslySetInnerHTML={{ __html: x }} />' }],
    })
    expect(result.ok).toBe(false)
    expect(buildJsonResult(result)).toMatchObject({
      contractVersion: OUTPUT_CONTRACT_VERSION,
      ok: false,
      violationCount: 1,
    })
  })
})
