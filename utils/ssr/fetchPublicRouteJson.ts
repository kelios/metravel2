import type { ImmutableRequest } from 'expo-server'

export function publicRouteError(httpStatus: 404 | 410 | 503): Error & { httpStatus: number } {
  return Object.assign(new Error(httpStatus === 503 ? 'Service Unavailable' : 'Not Found'), { httpStatus })
}

/** Guest-only transport shared by server loaders; visitor headers never reach the API. */
export async function fetchPublicRouteJsonResponse(
  request: Pick<ImmutableRequest, 'signal'>,
  endpoint: string,
): Promise<{ status: number; ok: boolean; data: unknown }> {
  const apiBase = String(process.env.SSR_API_ORIGIN || process.env.EXPO_PUBLIC_API_URL || '').trim().replace(/\/+$/, '')
  const headers: Record<string, string> = { Accept: 'application/json' }
  try {
    const transport = new URL(apiBase)
    const decodedPath = decodeURIComponent(endpoint.split('?')[0])
    if (!['http:', 'https:'].includes(transport.protocol) || transport.username || transport.password
        || transport.search || transport.hash || !/^\/(?:api)?$/.test(transport.pathname)) throw new Error('Invalid API origin')
    if (!endpoint || decodedPath.startsWith('/') || /[\\#]/.test(endpoint) || decodedPath.includes('\\')
        || decodedPath.split('/').some((part) => part === '.' || part === '..')
        || new URL(endpoint, `${apiBase}/`).origin !== transport.origin) throw new Error('Invalid API endpoint')
    if (process.env.SSR_API_ORIGIN) {
      const publicApi = new URL(String(process.env.EXPO_PUBLIC_API_URL || ''))
      if (!['http:', 'https:'].includes(publicApi.protocol) || publicApi.username || publicApi.password) throw new Error('Invalid public API origin')
      if (transport.origin !== publicApi.origin) {
        headers.Host = publicApi.host
        headers['X-Forwarded-Proto'] = publicApi.protocol.slice(0, -1)
      }
    }
  } catch {
    throw publicRouteError(503)
  }
  const apiRoot = /\/api$/.test(apiBase) ? apiBase : `${apiBase}/api`
  const controller = new AbortController()
  const cancel = () => controller.abort()
  request.signal.addEventListener('abort', cancel, { once: true })
  if (request.signal.aborted) cancel()
  const timeout = setTimeout(cancel, 10_000)
  try {
    const response = await fetch(`${apiRoot}/${endpoint}`, { headers, credentials: 'omit', redirect: 'error', signal: controller.signal })
    let data: unknown = null
    try { data = await response.json() } catch { if (response.ok) throw publicRouteError(503) }
    return { status: response.status, ok: response.ok, data }
  } catch (error) {
    if (error instanceof Error && 'httpStatus' in error) throw error
    throw publicRouteError(503)
  } finally {
    clearTimeout(timeout)
    request.signal.removeEventListener('abort', cancel)
  }
}

export async function fetchPublicRouteJson(request: Pick<ImmutableRequest, 'signal'>, endpoint: string): Promise<unknown> {
  const response = await fetchPublicRouteJsonResponse(request, endpoint)
  if (response.status === 404 || response.status === 410) throw publicRouteError(response.status)
  if (!response.ok) throw publicRouteError(503)
  return response.data
}
