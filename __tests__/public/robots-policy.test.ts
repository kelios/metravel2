import fs from 'fs'
import path from 'path'

type RobotsGroup = {
  agents: string[]
  disallow: string[]
}

const robotsSource = fs.readFileSync(path.join(process.cwd(), 'public', 'robots.txt'), 'utf8')

// Group semantics of RFC 9309: consecutive User-agent lines open one group,
// the rules below belong to it, and a crawler obeys only its most specific
// group — the "*" group is not merged into a named one.
function parseGroups(source: string): RobotsGroup[] {
  const groups: RobotsGroup[] = []
  let current: RobotsGroup | null = null
  let lastWasAgent = false

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    const separator = line.indexOf(':')
    if (separator === -1) continue

    const field = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim()

    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], disallow: [] }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
      continue
    }

    lastWasAgent = false
    if (field === 'disallow' && current && value) current.disallow.push(value)
  }

  return groups
}

const groups = parseGroups(robotsSource)

function groupFor(userAgent: string): RobotsGroup {
  const token = userAgent.toLowerCase()
  const named = groups.find((group) => group.agents.includes(token))
  const fallback = groups.find((group) => group.agents.includes('*'))
  const group = named ?? fallback
  if (!group) throw new Error(`robots.txt has no group for ${userAgent}`)
  return group
}

function isBlocked(userAgent: string, url: string): boolean {
  return groupFor(userAgent).disallow.some((rule) => {
    const pattern = rule
      .split('*')
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*')
    return new RegExp(`^${pattern}`).test(url)
  })
}

const CONTENT_URLS = ['/', '/travels/nesvizh', '/quests/warsaw']
const CLOSED_CRAWLERS = ['meta-externalagent']
const OPEN_CRAWLERS = ['facebookexternalhit', 'Googlebot', 'YandexBot', 'bingbot', 'SomeOtherBot']

describe('public/robots.txt crawler policy', () => {
  it.each(CLOSED_CRAWLERS)('closes the whole site for %s', (crawler) => {
    expect(groupFor(crawler).disallow).toEqual(['/'])
    for (const url of [...CONTENT_URLS, '/api/travels/']) {
      expect(isBlocked(crawler, url)).toBe(true)
    }
  })

  it('names only the closed crawlers besides the "*" group', () => {
    const named = groups.flatMap((group) => group.agents).filter((agent) => agent !== '*')
    expect(named.sort()).toEqual([...CLOSED_CRAWLERS].sort())
  })

  it.each(OPEN_CRAWLERS)('keeps articles and quests crawlable for %s', (crawler) => {
    for (const url of CONTENT_URLS) {
      expect(isBlocked(crawler, url)).toBe(false)
    }
  })

  it.each(OPEN_CRAWLERS)('keeps service paths closed for %s', (crawler) => {
    expect(isBlocked(crawler, '/api/travels/')).toBe(true)
    expect(isBlocked(crawler, '/search?search=x')).toBe(true)
    expect(isBlocked(crawler, '/search')).toBe(false)
  })

  it('declares exactly one "*" group and the sitemap', () => {
    expect(groups.filter((group) => group.agents.includes('*'))).toHaveLength(1)
    expect(robotsSource).toMatch(/^Sitemap: https:\/\/metravel\.by\/sitemap\.xml$/m)
  })
})
