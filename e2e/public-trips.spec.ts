import fs from 'node:fs'
import { test, expect, request, type Page } from '@playwright/test'
import { resetTripApplicationsViaAdmin } from './helpers/tripApplicationsReset'

/**
 * Публичные поездки «Поехали со мной» (Sprint 14, #416).
 *
 * Two-account real-BE flow против dev (E2E_API_URL=http://192.168.50.36).
 *   A = E2E_EMAIL  / E2E_PASSWORD  → owner trip id=1 (user id 104, superuser),
 *                                     storageState.json
 *   B = E2E_EMAIL2 / E2E_PASSWORD2 → applicant (user id 1),
 *                                     storageState.b.json
 *
 * Идемпотентность через admin-reset:
 *   beforeAll логинится суперпользователем A в Django admin и DELETE-ит все
 *   существующие заявки B на trip 1. Это единственный способ сбросить
 *   terminal-статусы (approved/rejected): API PATCH→new возвращает 400.
 *
 * AC:
 *   1. B подаёт заявку через реальную форму TripApplyForm → POST /api/trip-applications/
 *      → 201 → UI показывает «trip-apply-confirmation».
 *   2. A одобряет заявку через OrganizerApplicationsPanel → PATCH→approved
 *      → UI меняет бейдж на «Одобрена» → API ground truth обоих аккаунтов.
 *
 * НИКАКИХ page.route / интерсептов — всё против реального BE.
 */

const TRIP_ID = 1
const STORAGE_STATE_A = 'e2e/.auth/storageState.json'
const STORAGE_STATE_B = 'e2e/.auth/storageState.b.json'

// ── env ───────────────────────────────────────────────────────────────────────

const emailA = (process.env.E2E_EMAIL ?? '').trim()
const passwordA = (process.env.E2E_PASSWORD ?? '').trim()
const emailB = (process.env.E2E_EMAIL2 ?? '').trim()
const passwordB = (process.env.E2E_PASSWORD2 ?? '').trim()
const hasCredsB = !!emailB && !!passwordB
const hasBState = () => fs.existsSync(STORAGE_STATE_B)

function requireSecondAccountState() {
  const missing: string[] = []
  if (!hasCredsB) missing.push('E2E_EMAIL2/E2E_PASSWORD2')
  if (!hasBState()) missing.push(STORAGE_STATE_B)
  if (missing.length > 0) {
    throw new Error(
      `public-trips two-account flow requires ${missing.join(' and ')}. ` +
        'Configure the second e2e account before running this spec.',
    )
  }
}

function getApiBase(): string {
  const raw = (process.env.E2E_API_URL ?? process.env.EXPO_PUBLIC_API_URL ?? '').trim()
  if (!raw) throw new Error('E2E_API_URL must be set for two-account BE flow')
  return raw.replace(/\/+$/, '')
}

// ── XOR crypto (mirrors secureStorage) ──────────────────────────────────────

const ENC_KEY = 'metravel_encryption_key_v1'

function simpleDecrypt(base64: string, key: string): string {
  const raw = Buffer.from(String(base64 ?? ''), 'base64').toString('binary')
  let result = ''
  for (let i = 0; i < raw.length; i++) {
    result += String.fromCharCode(raw.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return result
}

function tokenFromStateFile(filePath: string): string {
  try {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8')) as any
    const origins: any[] = Array.isArray(json?.origins) ? json.origins : []
    for (const origin of origins) {
      const ls: any[] = Array.isArray(origin?.localStorage) ? origin.localStorage : []
      const entry = ls.find((x: any) => x?.name === 'secure_userToken')
      const encrypted = String(entry?.value ?? '').trim()
      if (!encrypted) continue
      const withPrefix = encrypted.startsWith('enc1:') ? encrypted.slice('enc1:'.length) : encrypted
      const looksBase64 = /^[A-Za-z0-9+/]+=*$/.test(withPrefix) && withPrefix.length % 4 === 0
      if (looksBase64) {
        const token = simpleDecrypt(withPrefix, ENC_KEY).trim()
        if (token) return token
      }
    }
  } catch {
    // ignore
  }
  return ''
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiLogin(email: string, password: string): Promise<string> {
  const ctx = await request.newContext({
    baseURL: getApiBase(),
    extraHTTPHeaders: { 'Content-Type': 'application/json' },
  })
  try {
    let resp: any = null
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      resp = await ctx.post('/api/user/login/', { data: { email, password } })
      if (resp.ok() || resp.status() !== 429 || attempt === 3) break
      await new Promise((resolve) => setTimeout(resolve, 30_000 * attempt))
    }
    if (!resp.ok()) throw new Error(`Login failed: ${resp.status()}`)
    const json = await resp.json()
    const token = String(json?.token ?? '').trim()
    if (!token) throw new Error(`No token for ${email}`)
    return token
  } finally {
    await ctx.dispose()
  }
}

async function makeApi(token: string) {
  return request.newContext({
    baseURL: getApiBase(),
    extraHTTPHeaders: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
    },
  })
}

async function fetchBApplication(tokenB: string): Promise<any | null> {
  const api = await makeApi(tokenB)
  try {
    const resp = await api.get(`/api/trip-applications/?trip=${TRIP_ID}`)
    if (!resp.ok()) return null
    const json = await resp.json()
    const results: any[] = json?.data ?? json?.results ?? (Array.isArray(json) ? json : [])
    return results.find((a: any) => String(a.trip) === String(TRIP_ID)) ?? null
  } finally {
    await api.dispose()
  }
}

// ── RN-web Pressable helper ───────────────────────────────────────────────────
// RN-web Pressable реагирует на pointerdown→pointerup, а не на голый click().
// Диспатчим полную цепочку pointer-событий чтобы гарантированно триггернуть onPress.

async function pressRNElement(page: import('@playwright/test').Page, testId: string) {
  const loc = page.getByTestId(testId)
  await loc.waitFor({ state: 'visible', timeout: 10_000 })
  await loc.scrollIntoViewIfNeeded().catch(() => null)

  const box = await loc.boundingBox()
  if (box) {
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await loc.dispatchEvent('pointerover', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', x, y })
    await loc.dispatchEvent('pointerenter', { bubbles: false, cancelable: false, pointerId: 1, pointerType: 'mouse', x, y })
    await loc.dispatchEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0, x, y })
    await loc.dispatchEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0, x, y })
    await loc.dispatchEvent('click', { bubbles: true, cancelable: true, x, y })
  } else {
    await loc.click({ force: true }).catch(() => null)
  }
}

// ── consent seed ─────────────────────────────────────────────────────────────

function seedConsent(page: import('@playwright/test').Page) {
  return page.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'metravel_consent_v1',
        JSON.stringify({ necessary: true, analytics: false, date: '2026-01-01T00:00:00.000Z' }),
      )
    } catch {
      // ignore
    }
  })
}

function isTripDetailResponse(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.pathname.replace(/\/+$/, '') === `/api/public-trips/${TRIP_ID}`
  } catch {
    return false
  }
}

async function gotoTripDetail(page: Page, accountLabel: string) {
  let lastStatus: number | null = null

  for (let attempt = 1; attempt <= 3; attempt++) {
    const detailRespP = page
      .waitForResponse(
        (r) => isTripDetailResponse(r.url()) && r.request().method() === 'GET',
        { timeout: 45_000 },
      )
      .catch(() => null)

    await page.goto(`/trips/${TRIP_ID}`, { waitUntil: 'domcontentloaded' })

    const resp = await detailRespP
    lastStatus = resp?.status() ?? null

    if (resp?.status() === 200) {
      await expect(
        page.getByTestId(`trip-detail-${TRIP_ID}`),
        `${accountLabel}: trip detail should render after GET /api/public-trips/${TRIP_ID}/ returned 200`,
      ).toBeVisible({ timeout: 30_000 })
      return resp
    }

    if (attempt < 3 && (lastStatus == null || [404, 502, 503, 504].includes(lastStatus))) {
      await page.waitForTimeout(1000)
      continue
    }

    break
  }

  throw new Error(
    `${accountLabel}: GET /api/public-trips/${TRIP_ID}/ did not return 200 after navigation attempts ` +
      `(last status: ${lastStatus ?? 'no response'})`,
  )
}

// ── Token cache (module-level, retry-safe) ────────────────────────────────────

let _tokenA = ''
let _tokenB = ''
let _tokensFetched = false

async function ensureTokens() {
  if (_tokensFetched) return
  _tokenA = tokenFromStateFile(STORAGE_STATE_A) || (await apiLogin(emailA, passwordA))
  _tokenB = tokenFromStateFile(STORAGE_STATE_B) || (await apiLogin(emailB, passwordB))
  _tokensFetched = true
}

// ── Suite ─────────────────────────────────────────────────────────────────────

// serial — BE state мутабельный, параллель недопустима.
test.describe.serial('Публичные поездки — two-account real-BE flow', () => {
  // Shared между тестами 1 и 2 внутри serial-suite.
  let _createdAppId = 0

  // beforeAll: admin-reset — удаляем все заявки B через Django admin.
  // Это единственный идемпотентный способ: API не позволяет сбросить
  // terminal-статусы (PATCH approved→new → 400).
  // Также сбрасываем _createdAppId чтобы Тест 2 всегда брал свежий id из API,
  // а не устаревший id из предыдущего прогона.
  test.beforeAll(async () => {
    _createdAppId = 0

    requireSecondAccountState()

    await ensureTokens()
    await resetTripApplicationsViaAdmin(TRIP_ID, _tokenA, _tokenB)

    // Verify: после удаления заявок нет.
    const api = await makeApi(_tokenB)
    try {
      const resp = await api.get(`/api/trip-applications/?trip=${TRIP_ID}`)
      if (resp.ok()) {
        const json = await resp.json()
        const results: any[] = json?.data ?? json?.results ?? (Array.isArray(json) ? json : [])
        if (results.length > 0) {
          process.stderr.write(
            `[beforeAll] WARNING: after admin reset still ${results.length} app(s) — reset may have partially failed\n`,
          )
        }
      }
    } finally {
      await api.dispose()
    }
  })

  // ── Тест 1: B подаёт заявку через реальную форму ─────────────────────────

  test('заявитель подаёт заявку → статус «Новая» в UI + подтверждение API', async ({ browser }) => {
    requireSecondAccountState()

    await ensureTokens()

    // B открывает деталь trip в своём браузерном контексте.
    const ctx = await browser.newContext({ storageState: STORAGE_STATE_B })
    const pageB = await ctx.newPage()

    try {
      await seedConsent(pageB)

      // Ждём реального сетевого ответа от BE — только после этого trip-data в RQ актуальна.
      const r = await gotoTripDetail(pageB, 'applicant')
      expect(r.status(), 'detail GET /api/public-trips/1/').toBe(200)

      // Форма «Хочу поехать» видна: B не владелец, trip.status=open, нет активной заявки.
      await expect(pageB.getByTestId('trip-apply-form')).toBeVisible({ timeout: 30_000 })

      // Сообщение ≥ 10 символов.
      await pageB
        .getByTestId('trip-apply-message')
        .fill('Хочу поехать, опыт в походах есть, буду полезен команде.')

      // ConsentCheckbox — RN-web Pressable, триггерится через pointer-события.
      await pressRNElement(pageB, 'trip-apply-consent-rules')
      await pressRNElement(pageB, 'trip-apply-consent-disclaimer')

      // Submit активен когда message≥10 и оба чекбокса отмечены.
      await expect(pageB.getByTestId('trip-apply-submit')).toBeEnabled({ timeout: 10_000 })
      await pageB.getByTestId('trip-apply-submit').click({ force: true })

      // Ждём подтверждения: блок «Заявка отправлена».
      await expect(pageB.getByTestId('trip-apply-confirmation')).toBeVisible({ timeout: 20_000 })
    } finally {
      await ctx.close()
    }

    // Ground truth: заявка B существует на trip 1 со статусом new.
    const api = await makeApi(_tokenB)
    try {
      const resp = await api.get(`/api/trip-applications/?trip=${TRIP_ID}`)
      expect(resp.ok(), `B GET trip-applications: ${resp.status()}`).toBeTruthy()
      const json = await resp.json()
      const results: any[] = Array.isArray(json) ? json : ((json as any)?.data ?? (json as any)?.results ?? [])
      const app = results.find((a: any) => String(a.trip) === String(TRIP_ID))
      expect(app, 'Заявка B на trip 1 не найдена через API').toBeTruthy()
      expect(app.status, `Ожидался статус new, получен ${app?.status}`).toBe('new')
      _createdAppId = Number(app.id)
    } finally {
      await api.dispose()
    }
  })

  // ── Тест 2: A одобряет через реальный UI ─────────────────────────────────

  test('организатор одобряет заявку → статус «Одобрена» в UI + подтверждение API', async ({ browser }) => {
    requireSecondAccountState()

    await ensureTokens()

    // Всегда берём актуальный appId из BE — это гарантирует корректность
    // как при первом запуске (_createdAppId выставлен тестом 1), так и при
    // retry Теста 2 после того как beforeAll создал новое чистое состояние.
    const beApp = await fetchBApplication(_tokenB)
    if (!beApp) throw new Error('Нет new-заявки B на trip 1 — тест 1 должен был создать её')
    if (beApp.status !== 'new') {
      throw new Error(
        `Ожидался статус new, но BE вернул «${beApp.status}». ` +
          `Это означает что admin-reset в beforeAll не отработал корректно.`,
      )
    }
    const appId = Number(beApp.id)
    _createdAppId = appId

    // A открывает деталь поездки в свежем контексте storageState A.
    //
    // Ключевой момент: React Query хранит кэш in-memory (staleTime=5min).
    // Если страница была открыта в этом же browser-context раньше (retry или
    // предыдущий тест), OrganizerApplicationsPanel отрендерится из stale-кэша
    // со старыми appId. Решение:
    //   1. page.goto() с waitUntil='domcontentloaded'
    //   2. waitForResponse на GET /api/trip-applications/ — ждём реальный сетевой
    //      ответ от BE, что гарантирует что RQ обновил кэш свежими данными.
    //   3. Только после этого ищем карточку по appId.
    const ctx = await browser.newContext({ storageState: STORAGE_STATE_A })
    const page = await ctx.newPage()

    try {
      await seedConsent(page)

      // Запускаем ожидание ответа до goto, чтобы не пропустить быстрый fetch.
      const applicationsResponseP = page.waitForResponse(
        (r) => r.url().includes('/api/trip-applications/') && r.request().method() === 'GET',
        { timeout: 30_000 },
      )

      await gotoTripDetail(page, 'organizer')

      // OrganizerApplicationsPanel рендерится для владельца (isOwner вычисляется
      // на клиенте через authStore userId == trip.organizer.id).
      const panel = page.getByTestId('organizer-applications-panel')
      await expect(panel).toBeVisible({ timeout: 20_000 })

      // Ждём реального сетевого ответа от BE — RQ теперь содержит актуальный список.
      await applicationsResponseP

      // Карточка заявки B видна (по свежему appId из BE, не из stale-кэша).
      const appCard = page.getByTestId(`trip-application-${appId}`)
      await expect(appCard).toBeVisible({ timeout: 15_000 })
      await appCard.scrollIntoViewIfNeeded().catch(() => null)

      // Кнопка «Принять» видна: заявка в статусе new → decidable.
      const approveBtn = page.getByTestId(`trip-application-${appId}-approve`)
      await expect(approveBtn).toBeVisible({ timeout: 10_000 })

      // Регистрируем ожидание PATCH ДО клика — иначе быстрый ответ можно пропустить.
      // Ждём именно /api/trip-applications/{appId}/ с методом PATCH и статусом 200.
      const patchResp = page.waitForResponse(
        (r) =>
          r.request().method() === 'PATCH' &&
          /\/api\/trip-applications\/\d+\/?$/.test(r.url()) &&
          r.status() === 200,
        { timeout: 20_000 },
      )

      // Нажимаем «Принять» через полный pointer-цикл (RN-web Pressable).
      await pressRNElement(page, `trip-application-${appId}-approve`)

      // Ждём реального PATCH 200 от сервера — только после этого идём в ground-truth.
      // Оптимистичный onMutate может показать «Одобрена» в UI раньше, но BE-проверка
      // должна опираться на реальный сетевой ответ, а не на локальный кэш.
      await patchResp

      // UI-ассерт: после onMutate оптимистичный update убирает кнопки и меняет бейдж.
      await expect(approveBtn).toBeHidden({ timeout: 15_000 })
      await expect(appCard.getByText('Одобрена')).toBeVisible({ timeout: 10_000 })
    } finally {
      await ctx.close()
    }

    // Ground truth A: реальный PATCH вернул 200 — теперь BE точно обновил статус.
    const apiA = await makeApi(_tokenA)
    try {
      const resp = await apiA.get(`/api/trip-applications/?trip=${TRIP_ID}`)
      expect(resp.ok(), `A GET trip-applications: ${resp.status()}`).toBeTruthy()
      const json = await resp.json()
      const results: any[] = json?.data ?? json?.results ?? (Array.isArray(json) ? json : [])
      const app = results.find((a: any) => a.id === appId)
      expect(app, `Заявка id=${appId} не найдена организатором через API`).toBeTruthy()
      expect(app.status, 'BE ground truth (A): статус должен быть approved').toBe('approved')
    } finally {
      await apiA.dispose()
    }

    // Ground truth B: тоже видит approved.
    const apiB = await makeApi(_tokenB)
    try {
      const resp = await apiB.get(`/api/trip-applications/?trip=${TRIP_ID}`)
      if (resp.ok()) {
        const json = await resp.json()
        const results: any[] = json?.data ?? json?.results ?? (Array.isArray(json) ? json : [])
        const app = results.find((a: any) => a.id === appId)
        if (app) expect(app.status, 'BE ground truth (B): статус должен быть approved').toBe('approved')
      }
    } finally {
      await apiB.dispose()
    }
  })
})
