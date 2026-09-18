import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const { STATIC_PAGES } = require('@/scripts/generate-seo-pages')

const ROUTE_FILE_OVERRIDES: Record<string, string[]> = {
  '/article': ['app/(tabs)/article/[id].web.tsx'],
}

export const normalizeRobots = (value: string): string =>
  String(value || '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .join(', ')

export const fileDeclaresRobots = (content: string, robots: string): boolean => {
  const wanted = normalizeRobots(robots)
  const matches = String(content || '').matchAll(/robots\s*=\s*\{?\s*['"`]([^'"`]+)['"`]/g)
  for (const match of matches) {
    if (normalizeRobots(match[1]) === wanted) return true
  }
  if (
    /robots\s*=\s*\{/.test(content) &&
    (content.includes(`'${robots}'`) || content.includes(`"${robots}"`))
  ) {
    return true
  }
  return false
}

const firstExisting = (candidates: string[]): string | null => {
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(ROOT, candidate))) return candidate
  }
  return null
}

const candidateRouteFiles = (route: string): string[] => {
  if (ROUTE_FILE_OVERRIDES[route]) return ROUTE_FILE_OVERRIDES[route]
  const rel = route.replace(/^\//, '')
  return [
    `app/(tabs)/${rel}.tsx`,
    `app/(tabs)/${rel}.web.tsx`,
    `app/${rel}.tsx`,
    `app/(tabs)/${rel}/index.tsx`,
  ]
}

const resolveImport = (fromFile: string, spec: string): string | null => {
  if (spec.startsWith('@/')) {
    const base = spec.slice(2)
    return firstExisting([
      `${base}.tsx`,
      `${base}.ts`,
      `${base}.web.tsx`,
      `${base}/index.tsx`,
      `${base}/index.ts`,
    ])
  }
  if (spec.startsWith('.')) {
    const resolved = path.posix.normalize(
      path.posix.join(path.posix.dirname(fromFile.replace(/\\/g, '/')), spec),
    )
    return firstExisting([
      `${resolved}.tsx`,
      `${resolved}.ts`,
      `${resolved}.web.tsx`,
      `${resolved}/index.tsx`,
    ])
  }
  return null
}

const localImports = (fromFile: string, content: string): string[] => {
  const specs = [...String(content || '').matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1])
  return specs
    .map((spec) => resolveImport(fromFile, spec))
    .filter((file): file is string => Boolean(file))
}

const clientFilesForPage = (page: { route: string; canonicalRoute?: string }): string[] => {
  const route = page.canonicalRoute || page.route
  const files = new Set<string>()
  for (const candidate of candidateRouteFiles(route)) {
    const existing = firstExisting([candidate])
    if (!existing) continue
    files.add(existing)
    const content = fs.readFileSync(path.join(ROOT, existing), 'utf8')
    for (const imported of localImports(existing, content)) files.add(imported)
  }
  return [...files]
}

describe('STATIC_PAGES robots client parity (#1968)', () => {
  it('recognizes robots props with or without a space after the comma', () => {
    expect(fileDeclaresRobots('robots="noindex, follow"', 'noindex, follow')).toBe(true)
    expect(fileDeclaresRobots('robots="noindex,nofollow"', 'noindex, nofollow')).toBe(true)
    expect(fileDeclaresRobots('robots={seo.robots}\nconst robots = \'noindex, nofollow\'', 'noindex, nofollow')).toBe(true)
    expect(fileDeclaresRobots('export default function Page() { return null }', 'noindex, follow')).toBe(false)
  })

  it('requires every STATIC_PAGES robots entry to be declared on the client screen', () => {
    const pages = (STATIC_PAGES as Array<{ route: string; robots?: string; canonicalRoute?: string }>)
      .filter((page) => page.robots)
    expect(pages.length).toBeGreaterThan(0)

    const missing = pages.flatMap((page) => {
      const files = clientFilesForPage(page)
      if (files.length === 0) {
        return [`${page.route}: no client route file`]
      }
      const declares = files.some((file) =>
        fileDeclaresRobots(fs.readFileSync(path.join(ROOT, file), 'utf8'), page.robots as string),
      )
      if (declares) return []
      return [`${page.route}: ${page.robots} not declared in ${files.join(', ')}`]
    })

    expect(missing).toEqual([])
  })
})
