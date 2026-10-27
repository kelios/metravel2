import type { ImmutableRequest } from 'expo-server'

export type PublicRouteRequest = Pick<ImmutableRequest, 'signal'>

const REQUEST_DATA = Symbol.for('metravel.ssr.publicRouteData')
type RequestData = WeakMap<AbortSignal, Map<string, Promise<unknown>>>

/** Loader and metadata live in separate Metro modules, but share the request signal. */
export function memoizePublicRouteData<T>(
  request: PublicRouteRequest,
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  const scope = globalThis as typeof globalThis & { [REQUEST_DATA]?: RequestData }
  const requests = scope[REQUEST_DATA] ?? (scope[REQUEST_DATA] = new WeakMap())
  let entries = requests.get(request.signal)
  if (!entries) {
    entries = new Map()
    requests.set(request.signal, entries)
  }
  let result = entries.get(key)
  if (!result) {
    result = Promise.resolve().then(load)
    entries.set(key, result)
  }
  return result as Promise<T>
}
