import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { readRetryOnce, readRetryTwice, stravaReadRetryOnce } from '@/utils/queryRetryPolicy'

// The 53 existing overrides: dropping a binding must not shrink the matrix.
const owners: Array<[string, number]> = [
  ['app/(tabs)/user/[id].tsx', 1],
  ['components/auth/TermsReacceptGate.tsx', 1],
  ['components/travel/RelatedTravelActionStack.tsx', 1],
  ['hooks/map/useMapPlaceSources.ts', 1],
  ['hooks/useAchievementsApi.ts', 8],
  ['hooks/useAuthorEngagementDetails.ts', 1],
  ['hooks/useContactRequestsApi.ts', 1],
  ['hooks/useGamification.ts', 6],
  ['hooks/useParticipantRating.ts', 1],
  ['hooks/usePlannedTripsApi.ts', 6],
  ['hooks/usePrivacySettings.ts', 1],
  ['hooks/usePublicTripsApi.ts', 5],
  ['hooks/useQuestCityWalk.ts', 1],
  ['hooks/useQuestForLocation.ts', 1],
  ['hooks/useSecurityJournal.ts', 1],
  ['hooks/useStravaIntegration.ts', 3],
  ['hooks/useSubscription.ts', 1],
  ['hooks/useSubscriptionsData.ts', 2],
  ['hooks/useTelegramLinkApi.ts', 1],
  ['hooks/useTravelDetails.ts', 1],
  ['hooks/useTravelsForQuest.ts', 1],
  ['hooks/useTripChatApi.ts', 2],
  ['hooks/useTripGearApi.ts', 1],
  ['hooks/useTripTelegramGroupApi.ts', 1],
  ['hooks/useUserProfile.ts', 1],
  ['hooks/useUserProfileCached.ts', 1],
  ['hooks/useUserSafety.ts', 2],
]
const policies = { readRetryOnce, readRetryTwice, stravaReadRetryOnce }
type PolicyName = keyof typeof policies
type WiredOption = { file: string; ordinal: number; policy: PolicyName }

function readBindings(file: string): WiredOption[] {
  const tree = ts.createSourceFile(file,
    fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), ts.ScriptTarget.Latest, true)
  const imports = new Map<string, PolicyName>()
  for (const statement of tree.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)
      || statement.moduleSpecifier.text !== '@/utils/queryRetryPolicy') continue
    const names = statement.importClause?.namedBindings
    if (!names || !ts.isNamedImports(names)) continue
    for (const entry of names.elements) {
      const imported = (entry.propertyName ?? entry.name).text
      if (imported in policies) imports.set(entry.name.text, imported as PolicyName)
    }
  }
  const result: WiredOption[] = []
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node) && node.name.getText(tree) === 'retry'
      && ts.isIdentifier(node.initializer) && imports.has(node.initializer.text)) {
      result.push({ file, ordinal: result.length + 1, policy: imports.get(node.initializer.text)! })
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return result
}

const wired = owners.flatMap(([file]) => readBindings(file))

it('keeps all 53 actual source overrides wired to their canonical imports and old maxima', () => {
  expect(wired).toHaveLength(53)
  for (const [file, count] of owners) {
    const entries = wired.filter((entry) => entry.file === file)
    expect(entries).toHaveLength(count)
    const expected = file === 'hooks/useStravaIntegration.ts' ? 'stravaReadRetryOnce'
      : ['components/auth/TermsReacceptGate.tsx', 'components/travel/RelatedTravelActionStack.tsx',
        'hooks/map/useMapPlaceSources.ts', 'hooks/useQuestCityWalk.ts'].includes(file)
        ? 'readRetryOnce' : 'readRetryTwice'
    expect(entries.every((entry) => entry.policy === expected)).toBe(true)
  }
})

// Real observer/scheduler, using the binding found in each actual source option.
// No mocked useQuery and no test-wide retry:false default.
describe.each(wired)('$file read override $ordinal ($policy)', ({ policy }) => {
  beforeEach(() => { jest.useFakeTimers() })
  afterEach(() => { jest.useRealTimers() })

  async function failedCalls(error: Error) {
    const client = new QueryClient()
    const queryFn = jest.fn(async () => { throw error })
    const observer = new QueryObserver(client, {
      queryKey: ['wired-retry', policy], queryFn, retry: policies[policy],
    })
    const unsubscribe = observer.subscribe(() => undefined)
    try {
      await jest.advanceTimersByTimeAsync(0)
      expect(queryFn).toHaveBeenCalledTimes(1)
      // Default retry delays are 1000ms then 2000ms; old maximum is two.
      await jest.advanceTimersByTimeAsync(4000)
      expect(observer.getCurrentResult().isError).toBe(true)
      expect(observer.getCurrentResult().error).toBe(error)
      return queryFn.mock.calls.length
    } finally {
      unsubscribe()
      observer.destroy()
      client.clear()
    }
  }

  it('does not repeat named timeouts in any locale or structured 504/4xx', async () => {
    for (const text of ['Превышено время ожидания', 'Перавышаны час чакання',
      'Перевищено час очікування', 'Przekroczono limit czasu', 'Request timed out']) {
      expect(await failedCalls(Object.assign(new Error(text), { name: 'TimeoutError' }))).toBe(1)
    }
    for (const status of [400, 401, 403, 408, 429, 504]) {
      expect(await failedCalls(Object.assign(new Error('Network request failed'), { status }))).toBe(1)
    }
    expect(await failedCalls(Object.assign(new Error('Network request failed'), { name: 'AbortError' }))).toBe(1)
    expect(await failedCalls(new Error('HTTP 503; localized failure'))).toBe(1)
  })

  it('keeps the old connection/502/503 maximum, including Strava 503 exclusion', async () => {
    const maximum = policy === 'readRetryTwice' ? 3 : 2
    expect(await failedCalls(new TypeError('Failed to fetch'))).toBe(maximum)
    expect(await failedCalls(Object.assign(new Error('Upstream timeout'), { status: 502 }))).toBe(maximum)
    expect(await failedCalls(Object.assign(new Error('Upstream timeout'), { status: 503 })))
      .toBe(policy === 'stravaReadRetryOnce' ? 1 : maximum)
  })
})
