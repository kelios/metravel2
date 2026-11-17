import type { BrowserContext, BrowserContextOptions, Page } from '@playwright/test'
import { installReadOnlyTravelApi } from './readOnlyTravelApi'

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const COMPILED_API_ORIGIN = 'https://metravel.by'
export const LOCAL_REPLAY_TRAVEL_ID = 990081
type Boundary = {
  context: BrowserContext
  api: Awaited<ReturnType<typeof installReadOnlyTravelApi>> | null
  otherWrites: Array<{ method: string; path: string }>
}
const boundaries = new Map<BrowserContext, Boundary>()
let cleanupUnconfirmed = false

export type LocalCanonicalReplayOwner = Readonly<{ token: symbol }>
let lifecycle: { owner: LocalCanonicalReplayOwner; closing: boolean } | null = null

/** Only the auto fixture owns admission and the final late-write/cleanup assertion. */
export function beginLocalCanonicalReplayLifecycle(): LocalCanonicalReplayOwner {
  if (!isLocalCanonicalReplay()) throw new Error('LOCAL replay lifecycle requires the explicit replay opt-in')
  if (cleanupUnconfirmed) throw new Error('LOCAL replay stopped: previous context cleanup is unconfirmed')
  if (lifecycle) throw new Error('LOCAL replay already has an active fixture lifecycle owner')
  const owner = { token: Symbol('LOCAL replay fixture owner') }
  lifecycle = { owner, closing: false }
  return owner
}

export const isLocalCanonicalReplay = () => process.env.E2E_CANONICAL_CLIENT_REPLAY === '1'
// Both default and separately created cold contexts must keep routing authoritative.
export const localCanonicalReplayContextOptions = (): Pick<BrowserContextOptions, 'serviceWorkers'> =>
  isLocalCanonicalReplay() ? { serviceWorkers: 'block' } : {}

function localOrigin(value: string | undefined): string {
  let parsed: URL
  try { parsed = new URL(value ?? '') } catch { throw new Error('LOCAL replay requires an explicit loopback base URL') }
  if (parsed.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(parsed.hostname)
    || parsed.username || parsed.password || (value !== parsed.origin && value !== `${parsed.origin}/`)) {
    throw new Error('LOCAL replay requires an explicit loopback base URL')
  }
  return parsed.origin
}

/** Only the declared synthetic route opts into the existing nullable client fallback. */
export async function mockLocalFixtureLoaderFallback(page: Page, routePath: string): Promise<void> {
  if (!/^\/\(tabs\)\/(?:travels\/[a-z0-9-]+|quests\/[a-z0-9-]+\/[a-z0-9-]+)$/.test(routePath)) {
    throw new Error('Fixture loader requires one exact synthetic route path')
  }
  const loaderPath = `/_expo/loaders${routePath}`
  await page.route('**/_expo/loaders/**', async route => {
    const request = route.request()
    let expected: string
    try { expected = `${localOrigin(new URL(page.url()).origin)}${loaderPath}` } catch {
      await route.fallback()
      return
    }
    if (request.method() === 'GET' && request.url() === expected) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
      return
    }
    await route.fallback()
  })
}

/** Separate replay boundary: compiled production API URLs must never receive fixture writes. */
export async function installLocalCanonicalReplayBoundary(
  context: BrowserContext,
  { baseURL, travelId }: { baseURL: string | undefined; travelId: number },
): Promise<void> {
  if (!isLocalCanonicalReplay()) return
  if (cleanupUnconfirmed) throw new Error('LOCAL replay stopped: previous context cleanup is unconfirmed')
  if (!lifecycle || lifecycle.closing) throw new Error('LOCAL replay requires an active fixture lifecycle owner before routing or navigation')
  localOrigin(baseURL)
  if (travelId !== LOCAL_REPLAY_TRAVEL_ID) throw new Error('LOCAL replay requires its declared synthetic travel ID')
  if (boundaries.has(context)) return
  const boundary: Boundary = { context, api: null, otherWrites: [] }
  boundaries.set(context, boundary)
  // API reads/writes use the unchanged, narrower owner registered below.
  // This lower-priority fence also covers non-API writes such as analytics.
  await context.route('**/*', async route => {
    const request = route.request()
    if (READ_METHODS.has(request.method())) { await route.continue(); return }
    boundary.otherWrites.push({ method: request.method(), path: new URL(request.url()).pathname })
    await route.abort('blockedbyclient')
  })
  boundary.api = await installReadOnlyTravelApi(context, { baseURL: COMPILED_API_ORIGIN, travelId })
}

/** Close every registered context, including perf-loop cold contexts, before checking late writes. */
export async function finishLocalCanonicalReplayBoundaries(owner: LocalCanonicalReplayOwner): Promise<void> {
  if (!lifecycle || lifecycle.owner !== owner || lifecycle.closing) {
    throw new Error('LOCAL replay cleanup requires its active fixture lifecycle owner')
  }
  lifecycle.closing = true
  const owned = [...boundaries.values()]
  const closeErrors: string[] = []
  const writes: Array<{ method: string; path: string }> = []
  try {
    await Promise.all(owned.map(async boundary => {
      try { await boundary.context.close() } catch { closeErrors.push('Replay context cleanup failed') }
    }))
    for (const boundary of owned) {
      writes.push(...boundary.otherWrites, ...(boundary.api?.unexpectedWrites ?? []))
    }
  } finally {
    for (const boundary of owned) boundaries.delete(boundary.context)
    lifecycle = null
  }
  if (closeErrors.length) cleanupUnconfirmed = true
  if (closeErrors.length || writes.length) {
    throw new Error(`LOCAL replay boundary rejected writes or cleanup: ${JSON.stringify({ writes, closeErrors })}`)
  }
}
