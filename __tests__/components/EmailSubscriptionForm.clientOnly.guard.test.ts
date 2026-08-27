import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * #1588. The form's responsive styles must use the live viewport on their first
 * visible render. `clientOnly` is safe only when the parent keeps the form out
 * of static HTML; otherwise it would trade the layout shift for React #418.
 *
 * Five mounts are behind loading/deferred boundaries. `/quests/scenario` is the
 * exception: its form is emitted by the static export, so it must keep the
 * hydration-safe width-0 snapshot until its own first commit.
 */

const PROJECT_ROOT = resolve(__dirname, '../..')
const MOUNT_ROOTS = ['app', 'components', 'screens'] as const

const readSource = (relativePath: string) =>
  readFileSync(resolve(PROJECT_ROOT, relativePath), 'utf8')

const listTsxFiles = (relativeDirectory: string): string[] =>
  readdirSync(resolve(PROJECT_ROOT, relativeDirectory), { withFileTypes: true }).flatMap(
    (entry) => {
      const relativePath = `${relativeDirectory}/${entry.name}`
      if (entry.isDirectory()) return listTsxFiles(relativePath)
      return entry.isFile() && entry.name.endsWith('.tsx') ? [relativePath] : []
    },
  )

const readMounts = () =>
  MOUNT_ROOTS.flatMap(listTsxFiles).flatMap((path) =>
    [...readSource(path).matchAll(/<EmailSubscriptionForm\b[\s\S]*?\/>/g)].map(
      (match) => ({ path, source: match[0] }),
    ),
  )

const hasClientOnlyOptIn = (source: string) =>
  /\bclientOnly(?:\s*=\s*\{true\})?(?=\s|\/>)/.test(source)

describe('#1588 EmailSubscriptionForm clientOnly precondition', () => {
  it('keeps clientOnly opt-in and hydration-safe by default', () => {
    const component = readSource('components/common/EmailSubscriptionForm.tsx')

    expect(component).toMatch(/clientOnly\?: boolean/)
    expect(component).toMatch(/clientOnly\s*=\s*false/)
    expect(component).toMatch(/useResponsive\(\{\s*clientOnly\s*\}\)/)
    expect(component).toMatch(
      /<ResponsiveContainer\b[^>]*\bclientOnly=\{clientOnly\}/,
    )
  })

  it('covers exactly six mounts and opts in only the five post-hydration mounts', () => {
    const mounts = readMounts()

    expect(mounts).toHaveLength(6)
    expect(mounts.filter(({ source }) => hasClientOnlyOptIn(source))).toHaveLength(5)

    const scenarioMounts = mounts.filter(
      ({ path }) => path === 'screens/tabs/QuestScenarioScreen.tsx',
    )
    expect(scenarioMounts).toHaveLength(1)
    expect(scenarioMounts[0].source).not.toMatch(/\bclientOnly\b/)

    for (const mount of mounts) {
      if (mount.path === 'screens/tabs/QuestScenarioScreen.tsx') continue
      expect(hasClientOnlyOptIn(mount.source)).toBe(true)
    }
  })

  it('keeps the route/loading boundaries that make the five opt-ins safe', () => {
    const articles = readSource('app/(tabs)/articles.tsx')
    const questDetail = readSource('app/(tabs)/quests/[city]/[questId].tsx')
    const home = readSource('components/home/Home.tsx')
    const travelDeferred = readSource('components/travel/details/TravelDetailsDeferred.tsx')

    expect(articles.indexOf('if (isLoading && !articles)')).toBeLessThan(
      articles.indexOf('<EmailSubscriptionForm'),
    )
    const questLoadingGate = questDetail.indexOf(
      'if (isLoading) {\n    return <LoadingState',
    )
    expect(questLoadingGate).toBeGreaterThan(-1)
    const questWizardMounts = [...questDetail.matchAll(/<QuestWizardComponent\b/g)].map(
      (match) => match.index ?? -1,
    )
    expect(questWizardMounts.length).toBeGreaterThan(0)
    for (const wizardMount of questWizardMounts) {
      expect(wizardMount).toBeGreaterThan(questLoadingGate)
    }
    expect(home).toMatch(
      /<DeferredSection[^>]*priority="low"[^>]*>\s*<EmailSubscriptionForm\b[\s\S]*?<\/DeferredSection>/,
    )
    expect(travelDeferred).toMatch(
      /shouldLoadFooterSection\s*\?[\s\S]*?<TravelDetailsFooterSectionLazy\b/,
    )
  })
})
