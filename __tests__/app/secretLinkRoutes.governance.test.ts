import fs from 'node:fs'
import path from 'node:path'
import {
  SECRET_LINK_QUERY_PARAMS,
  SECRET_LINK_ROUTES,
} from '@/utils/secretLinkRoutes'
import { getAnalyticsInlineScript } from '@/utils/analyticsInlineScript'

// #2121: страницы, куда ведут ссылки из писем с секретом в query, держат три
// контура одним списком — noindex в SSG и до гидрации, noindex на экране и
// вырезание секрета из аналитики. Новая такая страница без любого из них
// роняет этот тест.

const ROOT = path.resolve(__dirname, '../..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const routeFiles = (route: string): string[] => {
  const base = path.join('app/(tabs)', route.replace(/^\//, ''))
  return ['.tsx', '.native.tsx', '.web.tsx', '/index.tsx']
    .map((suffix) => `${base}${suffix}`)
    .filter((rel) => fs.existsSync(path.join(ROOT, rel)))
}

const resolveAlias = (spec: string): string | null => {
  if (!spec.startsWith('@/')) return null
  const rel = spec.slice(2)
  for (const suffix of ['.tsx', '.ts', '/index.tsx']) {
    if (fs.existsSync(path.join(ROOT, `${rel}${suffix}`))) return `${rel}${suffix}`
  }
  return null
}

// Экран сам ставит noindex или рендерит компонент, который его ставит.
const screenDeclaresNoindex = (rel: string): boolean => {
  const source = read(rel)
  if (source.includes('robots="noindex, nofollow"')) return true
  const imports = [...source.matchAll(/from '(@\/components\/[^']+)'/g)].map((m) => m[1])
  return imports
    .map(resolveAlias)
    .filter((file): file is string => Boolean(file))
    .some((file) => read(file).includes('robots="noindex, nofollow"'))
}

const generatorEntry = (source: string, route: string): string | null => {
  const start = source.indexOf(`route: '${route}',`)
  if (start < 0) return null
  const next = source.indexOf('route: ', start + 1)
  return source.slice(start, next < 0 ? undefined : next)
}

describe('secret e-mail link routes', () => {
  const generator = read('scripts/generate-seo-pages.js')

  it.each(SECRET_LINK_ROUTES.map((entry) => entry.route))('%s: screen exists and is noindex', (route) => {
    const files = routeFiles(route)
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      expect({ file, noindex: screenDeclaresNoindex(file) }).toEqual({ file, noindex: true })
    }
  })

  it.each(SECRET_LINK_ROUTES.map((entry) => entry.route))('%s: SSG page is noindex', (route) => {
    const entry = generatorEntry(generator, route)
    expect(entry).not.toBeNull()
    expect(entry).toContain("robots: 'noindex, nofollow'")
  })

  it('pre-hydration noindex reads the shared list, not a hand copy', () => {
    const html = read('app/+html.tsx')
    expect(html).toContain("from '@/utils/secretLinkRoutes'")
    expect(html).toMatch(/SECRET_LINK_PATHS=\$\{JSON\.stringify\(SECRET_LINK_ROUTE_PATHS\)\}/)
    expect(html).toMatch(/function shouldNoindexPath[\s\S]*?SECRET_LINK_PATHS\.indexOf\(p\)!==-1/)
  })

  it('analytics script embeds every secret param name', () => {
    const script = getAnalyticsInlineScript(12345678, 'G-TEST')
    expect(script).toContain(`var SECRET_QUERY_PARAMS = ${JSON.stringify(SECRET_LINK_QUERY_PARAMS)};`)
    expect(SECRET_LINK_QUERY_PARAMS).toEqual(expect.arrayContaining(['token', 'hash', 'password_reset_token']))
  })
})
