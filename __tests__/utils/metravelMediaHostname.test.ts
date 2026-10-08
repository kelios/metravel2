import { Platform } from 'react-native'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { buildArticleBodyMediaIndex } from '@/components/travel/stableContent/articleBodyMedia'
import { buildExternalImageUrl, prepareStableContentHtml } from '@/components/travel/stableContent/htmlTransform'
import { buildPrintImageUrl, isFirstPartyMetravelHost } from '@/utils/printImageUrl'
import { sanitizeRichText, sanitizeRichTextForPdf } from '@/utils/sanitizeRichText'
import { isMetravelMediaHostname, METRAVEL_MEDIA_HOSTS, WEB_RESOURCE_HINTS } from '@/utils/webResourceHints'

// Exercise the actual three consumers, including sanitizer and manifest lookup.
// No URL builder, sanitizer, manifest resolver or transport is substituted.
const imagePath = '/travel-description-image/540/description/photo.webp'
const image = (src: string) => `<p><img src="${src}" /></p>`
const source = (html: string) => new URL(html.match(/<img\b[^>]*src="([^"]+)"/i)![1].replace(/&amp;/g, '&'))
const consumerFiles = [
  'utils/printImageUrl.ts',
  'utils/sanitizeRichText.ts',
  'components/travel/stableContent/htmlTransform.ts',
]

// Parse imported symbols, not source substrings: aliases cannot hide raw policy access.
const mediaPolicyImports = (file: string, text: string) => {
  const parsed = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const predicates: string[] = []
  const forbidden: string[] = []
  const calls: string[] = []
  const isPolicyModule = (specifier: string) => {
    const resolved = specifier.startsWith('@/') ? path.resolve(specifier.slice(2)) :
      specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier) : null
    // TypeScript resolves explicit .js imports to the same source .ts owner.
    return resolved?.replace(/\.(?:ts|js)$/, '') === path.resolve('utils/webResourceHints')
  }
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && isPolicyModule(node.moduleSpecifier.text)) {
      const clause = node.importClause
      if (clause?.name) forbidden.push('default import')
      const bindings = clause?.namedBindings
      if (bindings && ts.isNamespaceImport(bindings)) forbidden.push('namespace import')
      if (bindings && ts.isNamedImports(bindings)) {
        for (const entry of bindings.elements) {
          const imported = (entry.propertyName ?? entry.name).text
          if (imported === 'METRAVEL_MEDIA_HOSTS') forbidden.push(entry.name.text)
          if (imported === 'isMetravelMediaHostname' && !clause?.isTypeOnly && !entry.isTypeOnly) predicates.push(entry.name.text)
        }
      }
    }
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression)) calls.push(node.expression.text)
      if ((node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
        node.arguments.some((argument) => ts.isStringLiteral(argument) && isPolicyModule(argument.text))) {
        forbidden.push('dynamic/require import')
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(parsed)
  return { forbidden, predicateCalled: predicates.some((binding) => calls.includes(binding)) }
}

describe('shared exact media-host classification (#2332)', () => {
  const originalOS = Platform.OS
  const originalApi = process.env.EXPO_PUBLIC_API_URL

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    delete process.env.EXPO_PUBLIC_API_URL
  })
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true })
    if (originalApi === undefined) delete process.env.EXPO_PUBLIC_API_URL
    else process.env.EXPO_PUBLIC_API_URL = originalApi
  })

  it('all real consumers follow an added and removed host in the shared policy', () => {
    const policy = METRAVEL_MEDIA_HOSTS as string[]
    const original = [...policy]
    const sentinel = 'policy-probe.example'
    const legacy = 'cdn.metravel.by'
    const assertConsumers = (host: string, allowed: boolean) => {
      const url = `http://${host}${imagePath}`
      expect(isMetravelMediaHostname(host)).toBe(allowed)
      expect(new URL(buildPrintImageUrl(url, 2500)).searchParams.get('w')).toBe(allowed ? '1920' : null)
      expect(source(sanitizeRichText(image(url))).searchParams.get('w')).toBe(allowed ? '1600' : null)
      expect(prepareStableContentHtml(image(url)).includes('srcset=')).toBe(allowed)
    }
    try {
      assertConsumers(sentinel, false)
      assertConsumers(legacy, true)
      policy.splice(0, policy.length, ...original.filter((host) => host !== legacy), sentinel)
      // A copied/hardcoded former classification fails both directions here.
      assertConsumers(sentinel, true)
      assertConsumers(legacy, false)
    } finally {
      policy.splice(0, policy.length, ...original)
    }
    expect(METRAVEL_MEDIA_HOSTS).toEqual(original)
  })

  it.each(consumerFiles)('%s owns no raw media policy and calls the shared predicate', (file) => {
    expect(mediaPolicyImports(file, readFileSync(path.resolve(file), 'utf8'))).toEqual({ forbidden: [], predicateCalled: true })
  })

  it('the ownership guard handles aliases without treating comments or strings as imports', () => {
    const module = '@/utils/webResourceHints'
    expect(mediaPolicyImports('utils/probe.ts', `
      // import { METRAVEL_MEDIA_HOSTS } from '${module}'
      const label = "METRAVEL_MEDIA_HOSTS";
      import { isMetravelMediaHostname as classify } from '${module}';
      classify('example.com');
    `)).toEqual({ forbidden: [], predicateCalled: true })
    expect(mediaPolicyImports('utils/probe.ts', `import { METRAVEL_MEDIA_HOSTS as copied } from '${module}'`).forbidden).toEqual(['copied'])
    expect(mediaPolicyImports('utils/probe.ts', `import * as policy from '${module}'`).forbidden).toEqual(['namespace import'])
    expect(mediaPolicyImports('utils/probe.ts', `const policy = require('${module}')`).forbidden).toEqual(['dynamic/require import'])
    for (const specifier of [`${module}.js`, `${module}.ts`, './webResourceHints.js']) {
      expect(mediaPolicyImports('utils/probe.ts', `
        import { isMetravelMediaHostname as classify } from '${module}';
        import { METRAVEL_MEDIA_HOSTS as copied } from '${specifier}';
        classify('example.com');
      `)).toEqual({ forbidden: ['copied'], predicateCalled: true })
    }
    expect(mediaPolicyImports('utils/probe.ts', `
      import { isMetravelMediaHostname as classify } from '${module}.js';
      classify('example.com');
    `)).toEqual({ forbidden: [], predicateCalled: true })
    expect(mediaPolicyImports('utils/probe.ts', `import { isMetravelMediaHostname } from '${module}'`).predicateCalled).toBe(false)
  })

  it.each(['metravel.by', 'CDN.METRAVEL.BY'])('keeps canonical/legacy media on %s in all consumers', (host) => {
    const url = `http://${host}${imagePath}`
    expect(isMetravelMediaHostname(host)).toBe(true)
    const printed = new URL(buildPrintImageUrl(url, 2500))
    expect(printed.protocol).toBe('https:')
    expect(printed.searchParams.get('w')).toBe('1920')
    expect(printed.searchParams.get('q')).toBe('85')
    expect(printed.searchParams.get('fit')).toBe('contain')
    expect(source(sanitizeRichText(image(url))).searchParams.get('w')).toBe('1600')
    const prepared = prepareStableContentHtml(image(url))
    expect(prepared).toContain('srcset=')
    expect(source(prepared).protocol).toBe('https:')
  })

  it.each(['api.metravel.by', 'metravel.by.evil.example', 'evilmetravel.by', 'unapproved.metravel.by'])('never implicitly trusts noncanonical host %s', (host) => {
    const url = `http://${host}${imagePath}?w=1600&q=75`
    expect(isMetravelMediaHostname(host)).toBe(false)
    expect(buildPrintImageUrl(url, 2500)).toBe(url)
    const rich = source(sanitizeRichText(image(url)))
    expect(rich.hostname).toBe(host)
    expect(rich.protocol).toBe('https:') // Existing external mixed-content upgrade.
    expect(rich.searchParams.has('w')).toBe(false)
    expect(prepareStableContentHtml(image(url))).not.toContain('srcset=')
  })

  it('accepts hostname only, not origins, ports, paths or trailing whitespace', () => {
    for (const value of ['https://metravel.by', 'metravel.by:8000', 'metravel.by/photo', 'metravel.by ', '']) {
      expect(isMetravelMediaHostname(value)).toBe(false)
    }
  })

  it('retains exact current browser host:port only in the print caller adapter', () => {
    const current = new URL(window.location.href)
    expect(isMetravelMediaHostname(current.hostname)).toBe(false)
    expect(isFirstPartyMetravelHost(current.hostname, current.host.toUpperCase())).toBe(true)
    expect(isFirstPartyMetravelHost(current.hostname, `${current.hostname}:8001`)).toBe(false)
    expect(isFirstPartyMetravelHost(current.hostname)).toBe(false)
  })

  it('keeps configured private dynamic-media rewriting, exact port and PDF public rewrite separate', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8000/api'
    const local = `http://10.0.0.15:8001${imagePath}?w=1600`
    const rich = source(sanitizeRichText(image(local)))
    expect(rich.origin).toBe('http://localhost:8000')
    expect(rich.pathname).toBe(imagePath)
    expect(source(sanitizeRichText(image(`http://localhost:8001${imagePath}`))).host).toBe('localhost:8000')
    expect(source(sanitizeRichTextForPdf(image(local))).origin).toBe('https://metravel.by')
    expect(source(sanitizeRichText(image('http://10.0.0.15/uploads/photo.jpg'))).origin).toBe('https://metravel.by')
    // HTML's private/local early return is intentional and independent of print.
    expect(buildExternalImageUrl(local)).toBe(local)
    expect(buildPrintImageUrl(local, 2500)).toBe(local)
  })

  it('keeps manifest-first matching even for a noncanonical sibling hostname', () => {
    const canonical = `https://metravel.by${imagePath}`
    const media = buildArticleBodyMediaIndex({ gallery: [{
      id: 540,
      src: canonical,
      srcset: `${canonical}?w=480 480w, ${canonical}?w=800 800w`,
    }] })
    const raw = `https://unapproved.metravel.by${imagePath}?v=legacy`
    const prepared = prepareStableContentHtml(image(raw), { articleBodyMedia: media })
    expect(prepared).toContain('srcset=')
    expect(prepared).toContain(`${canonical}?w=800`)
    expect(prepared).not.toContain('unapproved.metravel.by')
    expect(prepared).not.toContain('v=legacy')
  })

  it('retains explicit configured api host authorization and rewrites private media without leaking its source port', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.metravel.by:8443/api'
    expect(source(sanitizeRichText(image(`https://api.metravel.by:8443${imagePath}`))).searchParams.get('w')).toBe('1600')
    expect(source(sanitizeRichText(image(`https://api.metravel.by:8444${imagePath}`))).searchParams.has('w')).toBe(false)
    expect(prepareStableContentHtml(image(`https://api.metravel.by${imagePath}`))).not.toContain('srcset=')
    expect(buildPrintImageUrl(`https://api.metravel.by${imagePath}`, 2500)).toBe(`https://api.metravel.by${imagePath}`)
    process.env.EXPO_PUBLIC_API_URL = 'https://configured.example/api'
    expect(source(sanitizeRichText(image(`http://10.0.0.15:8001${imagePath}`))).origin).toBe('https://configured.example')
  })

  it('keeps data/blob and malformed print URLs unchanged and media aliases out of analytics hints', () => {
    for (const value of ['data:image/png;base64,AAA', 'blob:local', 'http://[invalid']) {
      expect(buildPrintImageUrl(value, 1600)).toBe(value)
    }
    expect(sanitizeRichText(image('data:image/png;base64,AAA'))).toContain('data:image/png;base64,AAA')
    expect(sanitizeRichText(image('blob:local'))).toContain('blob:local')
    expect(sanitizeRichText(image('http://[invalid'))).not.toMatch(/<img[^>]*src=/)
    for (const hint of WEB_RESOURCE_HINTS) expect(isMetravelMediaHostname(new URL(hint.href).hostname)).toBe(false)
  })
})
