import { Platform } from 'react-native'

export const MAP_RADIUS_PRELOAD_GLOBAL = '__metravelMapRadiusPreload'
export const MAP_RADIUS_PRELOAD_TTL_MS = 15_000

type MapRadiusPreloadEntry = {
  url: string
  startedAt: number
  response: Promise<Response>
  controller: AbortController
  deadline: number
}

const createAbortError = () => new DOMException('Aborted', 'AbortError')
const isEligibleDocument = () =>
  /^\/map\/?$/.test(window.location.pathname) && !window.location.search &&
  window.localStorage.getItem('userId') === null

/** One document, one matching query. The normal request owns all cache and retry policy. */
export async function consumeMapRadiusPreload<Result>(
  url: string,
  signal: AbortSignal | undefined,
  readResponse: (response: Response) => Promise<Result>,
): Promise<Result | undefined> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined
  const scope = window as typeof window & { [MAP_RADIUS_PRELOAD_GLOBAL]?: MapRadiusPreloadEntry }
  const entry = scope[MAP_RADIUS_PRELOAD_GLOBAL]
  if (!entry) return undefined

  delete scope[MAP_RADIUS_PRELOAD_GLOBAL]
  const abort = () => entry.controller.abort()
  try {
    if (signal?.aborted) throw createAbortError()
    if (entry.url !== url || entry.controller.signal.aborted ||
        Date.now() - entry.startedAt >= MAP_RADIUS_PRELOAD_TTL_MS || !isEligibleDocument()) return undefined

    signal?.addEventListener('abort', abort, { once: true })
    const response = await entry.response
    if (signal?.aborted) throw createAbortError()
    if (!response.ok || response.bodyUsed || entry.controller.signal.aborted || !isEligibleDocument()) return undefined
    const result = await readResponse(response)
    if (signal?.aborted) throw createAbortError()
    return entry.controller.signal.aborted || !isEligibleDocument() ? undefined : result
  } catch {
    if (signal?.aborted) throw createAbortError()
    return undefined
  } finally {
    clearTimeout(entry.deadline)
    signal?.removeEventListener('abort', abort)
    abort()
  }
}
