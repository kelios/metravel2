/**
 * Admin-reset helper for trip applications (e2e idempotency).
 *
 * Uses Django admin (superuser A) to DELETE all trip applications by B
 * so each test run starts from a clean state, even after terminal statuses
 * (approved/rejected cannot be reset via API — admin DELETE is the only way).
 *
 * Never prints credentials to stdout/stderr.
 */
import { request } from '@playwright/test'

const ADMIN_BASE = (process.env.E2E_API_URL || 'http://192.168.50.36').replace(/\/+$/, '')

/**
 * Logs into Django admin as superuser A and deletes all trip applications
 * for the given tripId. After this call the applicant can submit a fresh
 * application in the same test run.
 *
 * @param tripId  Django pk of the Trip object (e.g. 1)
 * @param tokenA  DRF token for superuser A (used to list applications)
 * @param tokenB  DRF token for applicant B  (used to verify cleanup)
 */
export async function resetTripApplicationsViaAdmin(
  tripId: number,
  tokenA: string,
  _tokenB?: string,
): Promise<void> {
  const apiBase = ADMIN_BASE

  // ── 1. Collect application ids via DRF (A sees all) ──────────────────────
  const apiCtx = await request.newContext({
    baseURL: apiBase,
    extraHTTPHeaders: { Authorization: `Token ${tokenA}`, 'Content-Type': 'application/json' },
  })

  let appIds: number[] = []
  try {
    const resp = await apiCtx.get(`/api/trip-applications/?trip=${tripId}`)
    if (resp.ok()) {
      const json: any = await resp.json()
      const results: any[] = json?.data ?? json?.results ?? (Array.isArray(json) ? json : [])
      appIds = results.map((a: any) => Number(a.id)).filter((id) => id > 0)
    }
  } finally {
    await apiCtx.dispose()
  }

  if (appIds.length === 0) {
    // Nothing to clean up — already in a fresh state.
    return
  }

  // ── 2. Authenticate with Django admin ─────────────────────────────────────
  const adminCtx = await request.newContext({ baseURL: apiBase })

  try {
    // Step 2a: GET /admin/login/ → seed csrftoken cookie
    const loginPageResp = await adminCtx.get('/admin/login/', {
      headers: { Accept: 'text/html' },
    })
    if (!loginPageResp.ok()) {
      throw new Error(`Django admin login page returned ${loginPageResp.status()}`)
    }
    const resolvedLoginUrl = loginPageResp.url()
    const adminOrigin = new URL(resolvedLoginUrl).origin

    // Step 2b: use Django's masked hidden form token. The cookie stores the
    // underlying secret and is not a portable substitute across Django versions.
    const loginHtml = await loginPageResp.text()
    let csrf = csrfTokenFromHtml(loginHtml) || csrftokenFromContext(await adminCtx.storageState())
    if (!csrf) throw new Error('No csrftoken after GET /admin/login/')

    // Step 2c: POST /admin/login/ with superuser credentials
    const loginResp = await adminCtx.post(resolvedLoginUrl, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: resolvedLoginUrl,
      },
      form: {
        username: process.env.E2E_EMAIL ?? '',
        password: process.env.E2E_PASSWORD ?? '',
        csrfmiddlewaretoken: csrf,
        next: '/admin/',
      },
    })

    // Django redirects to /admin/ on success (302)
    if (loginResp.status() !== 302 && loginResp.status() !== 200) {
      const responseText = await loginResp.text().catch(() => '')
      const csrfReason = responseText
        .match(/Reason given for failure:\s*<\/p>\s*<pre>\s*([^<]+?)\s*<\/pre>/i)?.[1]
        ?.replace(/\s+/g, ' ')
        .trim()
      throw new Error(
        `Django admin login POST returned ${loginResp.status()}` +
          (csrfReason ? `: ${csrfReason}` : ''),
      )
    }

    const authenticatedState = await adminCtx.storageState()
    if (!authenticatedState.cookies.some((cookie) => cookie.name === 'sessionid')) {
      throw new Error(`Django admin login did not create a session cookie (HTTP ${loginResp.status()})`)
    }

    // Refresh csrf after login (Django rotates it on successful auth)
    csrf = csrftokenFromContext(authenticatedState) || csrf

    // ── 3. Delete each application ───────────────────────────────────────────
    for (const appId of appIds) {
      const deleteUrl = `/admin/trips/tripapplication/${appId}/delete/`

      // GET the delete confirmation page (may rotate csrf again)
      const resolvedDeleteUrl = new URL(deleteUrl, adminOrigin).toString()
      const deletePageResp = await adminCtx.get(resolvedDeleteUrl, {
        headers: { Accept: 'text/html' },
      })

      // Accept 200 (form shown) or 302/404 (already gone)
      if (deletePageResp.status() === 404) continue

      // Prefer the masked token rendered by Django's confirmation form.
      const deleteHtml = await deletePageResp.text().catch(() => '')
      csrf =
        csrfTokenFromHtml(deleteHtml) ||
        csrftokenFromContext(await adminCtx.storageState()) ||
        csrf

      // POST to confirm deletion
      const confirmResp = await adminCtx.post(resolvedDeleteUrl, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: resolvedDeleteUrl,
        },
        form: {
          post: 'yes',
          csrfmiddlewaretoken: csrf,
        },
      })

      // 302 redirect to list = success; 404 = already gone; anything else = warn
      if (confirmResp.status() !== 302 && confirmResp.status() !== 404 && confirmResp.status() !== 200) {
        // Log but don't throw: a stale app shouldn't block the whole suite.
        process.stderr.write(
          `[tripApplicationsReset] Unexpected status ${confirmResp.status()} deleting app ${appId}\n`,
        )
      }
    }
  } finally {
    await adminCtx.dispose()
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function csrftokenFromContext(state: { cookies: Array<{ name: string; value: string }> }): string {
  const cookie = state.cookies.find((c) => c.name === 'csrftoken')
  return cookie?.value ?? ''
}

function csrfTokenFromHtml(html: string): string {
  const input = String(html || '').match(
    /<input[^>]*name=["']csrfmiddlewaretoken["'][^>]*value=["']([^"']+)["'][^>]*>/i,
  )
  return input?.[1]?.trim() ?? ''
}
