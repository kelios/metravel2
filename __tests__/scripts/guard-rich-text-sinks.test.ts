const {
  SINK_ALLOWLIST,
  DOM_SINK_ALLOWLIST,
  ATTRIBUTE_REWRITE_FILES,
  INLINE_SCRIPT_FILES,
  parseArgs,
  lexSource,
  shouldScanFile,
  findSinkViolations,
  findDomSinkViolations,
  findInlineScriptViolations,
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

  it('scans components/app/utils/hooks sources (#3262), not tests or scripts', () => {
    expect(shouldScanFile('components/travel/StableContent.web.tsx')).toBe(true)
    expect(shouldScanFile('app/(tabs)/article/[id].web.tsx')).toBe(true)
    expect(shouldScanFile('utils/richTextImageLayout.ts')).toBe(true)
    expect(shouldScanFile('utils/openBookPreviewWindow.ts')).toBe(true)
    expect(shouldScanFile('hooks/usePdfExport.ts')).toBe(true)
    expect(shouldScanFile('scripts/other.js')).toBe(false)
    expect(shouldScanFile('components/__tests__/A.test.tsx')).toBe(false)
  })

  it('keeps explicit, reasoned allowlists of non-rich-text sinks', () => {
    expect(Array.from(SINK_ALLOWLIST.keys())).toEqual(['app/+html.tsx', 'utils/inertHtml.ts'])
    expect(Array.from(DOM_SINK_ALLOWLIST.keys())).toEqual([
      'components/MapPage/Map/useMapPlaceRequestMarkers.web.ts',
      'utils/openBookPreviewWindow.ts',
      'utils/printHtml.web.ts',
    ])
    for (const reason of [...SINK_ALLOWLIST.values(), ...DOM_SINK_ALLOWLIST.values()]) {
      expect(String(reason).length).toBeGreaterThan(20)
    }
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

  it('checks every sink occurrence, not the file: one inertMarkup call no longer covers a second sink (#3262)', () => {
    const violations = findSinkViolations({
      filePath: 'components/article/Two.tsx',
      content: [
        "import { inertMarkup, toInertHtml } from '@/utils/inertHtml'",
        'const markup = inertMarkup(toInertHtml(a))',
        'const raw = build(b)',
        'export const A = () => <div dangerouslySetInnerHTML={markup} />',
        'export const B = () => <div dangerouslySetInnerHTML={raw} />',
        'export const C = () => <div dangerouslySetInnerHTML={inertMarkup(toInertHtml(c))} />',
        'const memo = useMemo(() => inertMarkup(toInertHtml(d)), [d])',
        'export const D = () => <div dangerouslySetInnerHTML={memo} />',
        "const s = 'dangerouslySetInnerHTML={raw}'",
        // JSX `</b>…/` в одной строке лексер принимает за литерал regex — сток не теряется.
        'export const E = () => <p><b>x</b><div dangerouslySetInnerHTML={raw} /></p>',
      ].join('\n'),
    })
    expect(violations).toEqual([
      expect.objectContaining({ line: 5, rule: 'sink' }),
      expect.objectContaining({ line: 10, rule: 'sink' }),
    ])
  })

  it('flags innerHTML/outerHTML assignment, insertAdjacentHTML and document.write (#3262)', () => {
    const content = [
      'el.innerHTML = html',
      'quill.root.innerHTML = initial',
      "el.outerHTML = '<b>' + x + '</b>'",
      "el.innerHTML += ''",
      "el.insertAdjacentHTML('beforeend', html)",
      'win.document.write(html)',
      'doc.writeln(html)',
      "el.innerHTML = ''",
      'el.innerHTML = toInertHtml(html)',
      "if (el.innerHTML === '') x()",
      "const s = 'el.innerHTML = html'",
      '// el.innerHTML = html',
    ].join('\n')
    const violations = findDomSinkViolations({ filePath: 'utils/sample.ts', content })
    expect(violations.map((v: { line: number }) => v.line)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(violations.every((v: { rule: string }) => v.rule === 'dom-sink')).toBe(true)
    expect(findDomSinkViolations({ filePath: 'utils/openBookPreviewWindow.ts', content })).toEqual([])
    expect(findDomSinkViolations({ filePath: 'services/x.ts', content })).toEqual([])
  })

  it('flags TS-side JSON.stringify in WebView/HTML document builders, not inside the script text (#3203)', () => {
    const builder = [
      "import { buildLeafletWebViewHtml } from '@/components/map-core/leafletWebViewHtml'",
      'export const build = (points) => {',
      '  const pointsJson = JSON.stringify(points)',
      '  return buildLeafletWebViewHtml({ bodyScript: `',
      '    const points = ${pointsJson};',
      '    const bird = ${JSON.stringify(bird)};',
      '    const safe = ${serializeForInlineScript(points)};',
      "    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY', n: ${`${count}`} }));",
      '  ` })',
      '}',
    ].join('\n')
    const violations = findInlineScriptViolations({ filePath: 'components/MapPage/Map/sample.ts', content: builder })
    // #3264: `${pointsJson}` объявлен через JSON.stringify — и подстановка тоже нарушение.
    expect(violations.map((v: { line: number }) => v.line)).toEqual([3, 5, 6])
    expect(violations.every((v: { rule: string }) => v.rule === 'inline-script')).toBe(true)

    // Без признаков HTML-документа JSON.stringify — обычный код.
    expect(findInlineScriptViolations({ filePath: 'utils/a.ts', content: 'export const s = JSON.stringify(x)' })).toEqual([])
    expect(findInlineScriptViolations({
      filePath: 'utils/doc.ts',
      content: 'export const d = (x) => `<!DOCTYPE html><script>var x = ${JSON.stringify(x)}</script>`',
    })).toHaveLength(1)
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

  it('lexer blanks string and template text but keeps nested ${} expressions', () => {
    const source = 'const a = `x ${f(`y ${g("z")} w`)} {v}`\nconst b = \'q\' + h({ k: 1 })'
    const { code, bare } = lexSource(source)
    expect(code).toBe(source)
    expect(bare.split('\n')).toHaveLength(2)
    expect(bare).toContain('f(')
    expect(bare).toContain('g(')
    expect(bare).toContain('h({ k: 1 })')
    for (const text of ['x ', 'y ', 'z', ' w', '{v}', 'q']) expect(bare).not.toContain(text)
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

  describe('#3264: границы правил', () => {
    const domLines = (content: string) =>
      findDomSinkViolations({ filePath: 'components/x.ts', content }).map((v: { line: number }) => v.line)

    it('reads the innerHTML value to the end of the expression', () => {
      expect(domLines([
        "el.innerHTML = '' + html",
        'el.innerHTML = toInertHtml(a) + b',
        'el.innerHTML = toInertHtml(a)',
        '  + tail',
        "el.innerHTML = ''.concat(html)",
        'el.innerHTML = toInertHtml(pick(a, (b)))[0]',
      ].join('\n'))).toEqual([1, 2, 3, 5, 6])
    })

    it('still accepts a cleared or inert value in every statement position', () => {
      expect(domLines([
        "el.innerHTML = ''",
        "el.innerHTML = '';",
        'el.innerHTML = toInertHtml(render(a, (b)))',
        "if (stale) { el.innerHTML = '' }",
        'box.innerHTML = toInertHtml(html); next()',
        "reset(() => (el.innerHTML = ''), 0)",
        "el.innerHTML = ''",
        'next()',
      ].join('\n'))).toEqual([])
    })

    it('flags bracket writes, setHTMLUnsafe and createContextualFragment', () => {
      expect(domLines([
        "el['innerHTML'] = html",
        'el["outerHTML"] += html',
        'el.setHTMLUnsafe(html)',
        'const node = range.createContextualFragment(html)',
        "const same = el['innerHTML'] === html",
        "// el['innerHTML'] = html",
      ].join('\n'))).toEqual([1, 2, 3, 4])
    })

    it('applies the inline-script rule to the first-screen web scripts, allowlisted or not', () => {
      expect(INLINE_SCRIPT_FILES).toEqual(expect.arrayContaining(['app/+html.tsx', 'utils/mapHeadBootstrap.ts']))
      const content = 'export const boot = `var endpoint = ${JSON.stringify(ENDPOINT)};`'
      for (const filePath of INLINE_SCRIPT_FILES) {
        expect(findInlineScriptViolations({ filePath, content }).map((v: { rule: string }) => v.rule)).toEqual(['inline-script'])
      }
      expect(findInlineScriptViolations({ filePath: 'utils/other.ts', content })).toEqual([])
    })

    it('accepts a pre-serialized ${…Json} only when the same file serialized it', () => {
      const builder = (declaration: string) => [
        'export const build = (points, routesJson) => {',
        declaration,
        '  return `<!DOCTYPE html><script>draw(${pointsJson}, ${routesJson}, ${ZOOM})</script>`',
        '}',
      ].join('\n')
      const lines = (content: string) =>
        findInlineScriptViolations({ filePath: 'components/x.ts', content }).map((v: { line: number }) => v.line)

      // `routesJson` пришёл параметром: чем его сериализовали, отсюда не видно.
      expect(lines(builder('  const pointsJson = serializeForInlineScript(points)'))).toEqual([3])
      expect(lines(builder("  const pointsJson = points ? serializeForInlineScript(points) : 'null'"))).toEqual([3])
      expect(lines(builder('  const pointsJson = String(points)'))).toEqual([3, 3])
    })

    it('covers the book chain and sees an attribute name inside an alternation group', () => {
      expect(ATTRIBUTE_REWRITE_FILES).toEqual(expect.arrayContaining([
        'services/pdf-export/TravelDataTransformer.ts',
        'services/pdf-export/segments/contentContinuation.ts',
      ]))
      const rules = (content: string) => findAttributeRewriteViolations({
        filePath: 'services/pdf-export/segments/contentContinuation.ts',
        content,
      }).length
      expect(rules("html.replace(/\\s(?:id|name)=(['\"])[\\s\\S]*?\\1/gi, '')")).toBe(1)
      expect(rules("html.replace(/(src|href)\\s*=\\s*\"/g, '')")).toBe(1)
      expect(rules("html.replace(/style\\s*=\\s*(\"([^\"]*)\"|'([^']*)')/gi, '')")).toBe(1)
      expect(rules("html.replace(/^<thead(?:\\s|>)/i, '')")).toBe(0)
      expect(rules("src.match(/[?&]v=([a-z0-9_-]{6,})/i)")).toBe(0)
    })
  })
})
