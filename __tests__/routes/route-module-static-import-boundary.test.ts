/**
 * Route modules (`app/**`) are entry points of their own web chunks. A static
 * import of one route module from anywhere else pulls that whole screen into the
 * importer's module graph, and the shared-chunk split then ships it as eager JS
 * on unrelated routes: #2389 — `app/[...missing].web.tsx` imported the quest
 * screen statically and +74 KB brotli landed on userpoints/messages/cookies.
 * Reusing a route screen goes through `import()` (React.lazy or a preload).
 * Platform adapters of the same route (`_layout.web.tsx` -> `./_layout.tsx`)
 * stay allowed: they are one route module, not two.
 */
const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..', '..')
const SOURCE_DIRS = ['app', 'components', 'hooks', 'utils', 'screens', 'context', 'stores', 'services', 'api', 'i18n', 'constants']
const SOURCE_RE = /\.(tsx?|jsx?)$/

function walk(dir: string, out: string[]): string[] {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (SOURCE_RE.test(entry.name)) out.push(full)
  }
  return out
}

// Static `import … from '<spec>'`, `export … from '<spec>'` and `require('<spec>')`.
const STATIC_SPEC_RE = /(?:^|[\s;])(?:import|export)\s[^'"`;]*?\sfrom\s*['"]([^'"]+)['"]|(?:^|[^.\w])require\(\s*['"]([^'"]+)['"]\s*\)/gm

function routeTarget(file: string, spec: string): string | null {
  if (spec.startsWith('@/app/')) return path.join(repoRoot, spec.slice(2))
  if (spec.startsWith('.') && file.startsWith(path.join(repoRoot, 'app') + path.sep)) {
    const resolved = path.resolve(path.dirname(file), spec)
    return resolved.startsWith(path.join(repoRoot, 'app') + path.sep) ? resolved : null
  }
  return null
}

const stripPlatform = (p: string) => p.replace(/\.(web|native|ios|android)?\.?(tsx?|jsx?)$/, '').replace(/\.(web|native|ios|android)$/, '')

describe('route module static import boundary (#2389)', () => {
  it('no module statically imports a route module of another route', () => {
    const offenders: string[] = []
    for (const dir of SOURCE_DIRS) {
      for (const file of walk(path.join(repoRoot, dir), [])) {
        const source = fs.readFileSync(file, 'utf8')
        for (const match of source.matchAll(STATIC_SPEC_RE)) {
          const spec = match[1] ?? match[2]
          const target = routeTarget(file, spec)
          if (!target) continue
          if (/\.(css|png|jpe?g|svg|webp|json)$/.test(target)) continue
          // Same route, other platform variant: app/x.web.tsx -> ./x.tsx.
          if (stripPlatform(target) === stripPlatform(file)) continue
          offenders.push(`${path.relative(repoRoot, file)} -> ${spec}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('detects a static cross-route import (control)', () => {
    const file = path.join(repoRoot, 'app', '[...missing].web.tsx')
    const source = "import QuestByIdScreen from '@/app/(tabs)/quests/[city]/[questId]'\n"
    const specs = [...source.matchAll(STATIC_SPEC_RE)].map((m) => m[1] ?? m[2])
    expect(specs).toEqual(['@/app/(tabs)/quests/[city]/[questId]'])
    expect(routeTarget(file, specs[0])).not.toBeNull()
    const lazy = "const Q = React.lazy(() => import('@/app/(tabs)/quests/[city]/[questId]'))\n"
    expect([...lazy.matchAll(STATIC_SPEC_RE)]).toHaveLength(0)
  })
})
