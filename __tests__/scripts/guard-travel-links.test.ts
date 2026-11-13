const fs = require('fs')
const path = require('path')

const {
  AD_HOC_BUILDER_BASELINE,
  BUILDER_FILE,
  REDIRECT_MANIFEST,
  buildJsonResult,
  buildRedirectIndex,
  evaluateGuard,
  parseArgs,
  shouldScanFile,
} = require('@/scripts/guard-travel-links')

const manifest = {
  redirects: [
    { from: 'old-slug', to: 'middle-slug' },
    { from: 'middle-slug', to: 'live-slug' },
  ],
}

const run = (filePath: string, content: string) => evaluateGuard({ sources: [{ filePath, content }], manifest })

describe('guard-travel-links', () => {
  it('parses --json flag', () => {
    expect(parseArgs([])).toEqual({ output: 'text' })
    expect(parseArgs(['--json'])).toEqual({ output: 'json' })
  })

  it('scans product sources only: reports, tests and tooling keep old addresses as data', () => {
    expect(shouldScanFile('components/home/homeHeroContent.ts')).toBe(true)
    expect(shouldScanFile('public/travel-hero-preload-v2.js')).toBe(true)
    expect(shouldScanFile('i18n/locales/ru/home.json')).toBe(true)
    expect(shouldScanFile('__tests__/components/A.test.tsx')).toBe(false)
    expect(shouldScanFile('components/__tests__/A.test.tsx')).toBe(false)
    expect(shouldScanFile('scripts/seo-redirects.json')).toBe(false)
    expect(shouldScanFile('artifacts/ui-audit/after-summary.json')).toBe(false)
    expect(shouldScanFile('docs/RULES.md')).toBe(false)
  })

  it('resolves a redirect chain to the final live slug', () => {
    const index = buildRedirectIndex(manifest)
    expect(index.get('old-slug')).toBe('live-slug')
    expect(index.get('middle-slug')).toBe('live-slug')
    expect(index.has('live-slug')).toBe(false)
  })

  it('reports a hand-written slug that now answers with a redirect and names the live one', () => {
    const result = run(
      'components/listTravel/belarusTravelHubModel.ts',
      `export const LINKS = [\n  { href: '/travels/old-slug' },\n  { href: 'https://metravel.by/travels/middle-slug?returnTo=%2Fsearch' },\n  { href: '/travels/live-slug' },\n]`,
    )

    expect(result.ok).toBe(false)
    expect(result.violations).toEqual([
      expect.objectContaining({ rule: 'stale-literal', line: 2, snippet: '/travels/old-slug', fix: '/travels/live-slug' }),
      expect.objectContaining({ rule: 'stale-literal', line: 3, snippet: '/travels/middle-slug', fix: '/travels/live-slug' }),
    ])
  })

  it('reports a stale bare slug handed to the builder', () => {
    const result = run('components/home/homeHeroContent.ts', `const href = travelHref('old-slug')\nconst ok = travelHref('live-slug')`)

    expect(result.violations).toEqual([
      expect.objectContaining({ rule: 'stale-literal', line: 1, snippet: 'old-slug', fix: 'live-slug' }),
    ])
    // Тот же литерал вне построителя — обычная строка (ключ города, id провайдера).
    expect(run('data/travelBooks/providers.json', `{ "city": "old-slug" }`).ok).toBe(true)
    expect(run('components/A.tsx', `const key = 'old-slug'`).ok).toBe(true)
  })

  it('matches a percent-encoded stale slug', () => {
    const encoded = evaluateGuard({
      sources: [{ filePath: 'components/A.tsx', content: `const href = '/travels/%D1%81%D1%82%D0%B0%D1%80%D1%8B%D0%B9'` }],
      manifest: { redirects: [{ from: 'старый', to: 'novyi' }] },
    })
    expect(encoded.violations).toEqual([expect.objectContaining({ rule: 'stale-literal', fix: '/travels/novyi' })])
  })

  it('reports an article path assembled outside the shared builder', () => {
    const template = run('components/quests/TravelsForQuestSection.tsx', 'router.push(`/travels/${travel.slug || travel.id}`)')
    const nested = run('utils/shareTravel.ts', 'const url = `/travels/${encodeURIComponent(String(id))}`')
    const concat = run('components/A.tsx', `const href = '/travels/' + slug`)

    // Хвостовой слэш не делает абсолютный адрес сайта эндпоинтом API.
    const absolute = run('services/A.ts', 'const url = `https://metravel.by/travels/${travel.slug}/`')
    const based = run('components/B.tsx', 'const url = `${getSiteBaseUrl()}/travels/${slug}/`')

    for (const result of [template, nested, concat, absolute, based]) {
      expect(result.ok).toBe(false)
      expect(result.violations).toEqual([expect.objectContaining({ rule: 'ad-hoc-builder', line: 1 })])
    }
  })

  it('does not mistake API endpoints, type templates, comments and builder calls for page links', () => {
    const result = evaluateGuard({
      sources: [
        { filePath: 'api/travelsFavorites.ts', content: 'apiClient.patch(`/travels/${travelId}/mark-as-favorite/`)' },
        { filePath: 'api/travelRoutes.ts', content: 'const u = `/api/travels/${encodeURIComponent(String(id))}/routes/`' },
        { filePath: 'components/listTravel/model.ts', content: 'type Link = { href: `/travels/${string}` }' },
        { filePath: 'utils/a.ts', content: '// раньше здесь был `/travels/${travel.id}`' },
        { filePath: 'components/B.tsx', content: 'const href = buildTravelPathFromTravel(travel)' },
        { filePath: 'components/C.tsx', content: `const href = '/travels/live-slug'` },
      ],
      manifest,
    })
    expect(result).toMatchObject({ ok: true, violations: [] })
  })

  it('accepts the real API-base-prefixed view endpoint', () => {
    const filePath = 'api/travelViews.ts'
    const result = run(filePath, fs.readFileSync(path.join(process.cwd(), filePath), 'utf8'))

    expect(result).toMatchObject({ ok: true, violations: [] })
  })

  it.each([
    ['api/client.ts', '@/api/apiConfig', 'API_BASE_URL'],
    ['api/client.ts', './apiConfig', 'API_BASE_URL as backendUrl'],
    ['services/nested/client.ts', '../../api/apiConfig.ts', 'API_BASE_URL as backendUrl'],
  ])('recognizes the canonical API base imported in %s from %s', (filePath, modulePath, binding) => {
    const localName = binding.split(' as ').at(-1)
    const content = [
      `import { DEFAULT_TIMEOUT, ${binding} } from '${modulePath}'`,
      'const endpoint = `${ ' + localName + ' }/travels/${encodeURIComponent(String(id))}/view/`',
    ].join('\n')

    expect(run(filePath, content)).toMatchObject({ ok: true, violations: [] })
  })

  it('recognizes a multiline canonical API-base interpolation', () => {
    const content = "import { API_BASE_URL } from '@/api/apiConfig'\n" +
      'const endpoint = `${\n API_BASE_URL\n}/travels/${id}/view/`'

    expect(run('api/client.ts', content)).toMatchObject({ ok: true, violations: [] })
  })

  it('keeps the canonical import valid outside an unrelated shadow scope', () => {
    const content = "import { API_BASE_URL } from '@/api/apiConfig'\n" +
      'function other(API_BASE_URL: string) { return API_BASE_URL }\n' +
      'const endpoint = `${API_BASE_URL}/travels/${id}/view/`'

    expect(run('api/client.ts', content)).toMatchObject({ ok: true, violations: [] })
  })

  it.each([
    ['parameter', 'API_BASE_URL', 'function make(API_BASE_URL: string) { return `${API_BASE_URL}/travels/${slug}/` }'],
    ['local constant', 'API_BASE_URL', 'function make() { const API_BASE_URL = getSiteBaseUrl(); return `${API_BASE_URL}/travels/${slug}/` }'],
    ['aliased arrow parameter', 'API_BASE_URL as baseUrl', 'const make = (baseUrl: string) => `${baseUrl}/travels/${slug}/`'],
    ['destructured parameter', 'API_BASE_URL', 'function make({ publicBase: API_BASE_URL }: { publicBase: string }) { return `${API_BASE_URL}/travels/${slug}/` }'],
    ['array binding', 'API_BASE_URL', 'function make() { const [API_BASE_URL] = [getSiteBaseUrl()]; return `${API_BASE_URL}/travels/${slug}/` }'],
    ['catch binding', 'API_BASE_URL', 'try {} catch (API_BASE_URL) { const href = `${API_BASE_URL}/travels/${slug}/` }'],
  ])('reports a public base shadowing the import with a %s', (_label, binding, construction) => {
    const content = `import { ${binding} } from '@/api/apiConfig'\n` + construction

    expect(run('services/links.ts', content).violations).toEqual([
      expect.objectContaining({ rule: 'ad-hoc-builder', line: 2 }),
    ])
  })

  it.each([
    ['local public base', 'const API_BASE_URL = getSiteBaseUrl()'],
    ['different module', "import { API_BASE_URL } from '@/config/site'"],
    ['different export', "import { SITE_BASE_URL as API_BASE_URL } from '@/api/apiConfig'"],
    ['commented import', "// import { API_BASE_URL } from '@/api/apiConfig'"],
    ['string import', `const note = "import { API_BASE_URL } from '@/api/apiConfig'"`],
    ['template import', "const note = `import { API_BASE_URL } from '@/api/apiConfig'`"],
  ])('does not treat a %s as API-base provenance', (_label, declaration) => {
    const result = run('api/client.ts', declaration + '\nconst href = `${API_BASE_URL}/travels/${slug}/`')

    expect(result.violations).toEqual([expect.objectContaining({ rule: 'ad-hoc-builder', line: 2 })])
  })

  it.each([
    ['public template', 'const href = `${getSiteBaseUrl()}/travels/${slug}/`'],
    ['public literal', 'const href = `https://metravel.by/travels/${slug}/`'],
    ['other base', 'const href = `${SITE_BASE_URL}/travels/${slug}/`'],
    ['extra prefix', 'const href = `https://metravel.by${API_BASE_URL}/travels/${slug}/`'],
    ['extra path', 'const href = `${API_BASE_URL}/articles/travels/${slug}/`'],
    ['missing endpoint slash', 'const href = `${API_BASE_URL}/travels/${slug}`'],
    ['string containing a template', "const href = '`${API_BASE_URL}/travels/${slug}/`'"],
    ['escaped template head', 'const href = `prefix \\`${API_BASE_URL}/travels/${slug}/`'],
    ['mixed same line', 'const endpoint = `${API_BASE_URL}/travels/${id}/view/`; const href = `${SITE_BASE_URL}/travels/${slug}/`'],
  ])('still reports a %s next to a real API import', (_label, construction) => {
    const content = "import { API_BASE_URL } from '@/api/apiConfig'\n" + construction
    const result = run('api/client.ts', content)

    expect(result.violations).toEqual([expect.objectContaining({ rule: 'ad-hoc-builder', line: 2 })])
  })

  it('keeps stale public literals enforced next to an API-base import', () => {
    const result = run('api/client.ts', [
      "import { API_BASE_URL } from '@/api/apiConfig'",
      "const href = '/travels/old-slug'",
    ].join('\n'))

    expect(result.violations).toEqual([
      expect.objectContaining({ rule: 'stale-literal', line: 2, fix: '/travels/live-slug' }),
    ])
  })

  it('lets a baseline file assemble the path and flags a baseline entry that no longer does', () => {
    const allowed = run('utils/travelLinkGraph.js', 'return key ? `/travels/${key}` : ""')
    expect(allowed.ok).toBe(true)

    const dead = run('utils/travelLinkGraph.js', 'module.exports = {}')
    expect(dead.violations).toEqual([expect.objectContaining({ rule: 'dead-baseline', file: 'utils/travelLinkGraph.js' })])

    const builder = run(BUILDER_FILE, 'export const x = 1')
    expect(builder.ok).toBe(true)
  })

  it('keeps the exception list closed', () => {
    expect([...AD_HOC_BUILDER_BASELINE.keys()].sort()).toEqual([
      'app/+html.tsx',
      'public/travel-hero-preload-v2.js',
      'services/offline/travelOfflineAdapter.ts',
      'utils/questTravelLinks.js',
      'utils/routePaths.ts',
      'utils/travelDetailsSecure.ts',
      'utils/travelLinkGraph.js',
    ])
  })

  it('reads the redirect mirror that seo-rename.js maintains', () => {
    const mirror = JSON.parse(fs.readFileSync(path.join(process.cwd(), REDIRECT_MANIFEST), 'utf8'))
    const index = buildRedirectIndex(mirror)
    expect(index.size).toBeGreaterThan(200)
    // Конечная цель цепочки сама не должна быть чьим-то `from`: иначе guard советует адрес с редиректом.
    for (const target of index.values()) expect(index.has(target)).toBe(false)
  })

  it('emits a stable JSON contract', () => {
    const json = buildJsonResult(run('components/A.tsx', `const href = '/travels/old-slug'`))
    expect(json).toMatchObject({ contractVersion: 1, ok: false, violationCount: 1 })
  })
})
