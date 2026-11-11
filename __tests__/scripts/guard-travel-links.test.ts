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
