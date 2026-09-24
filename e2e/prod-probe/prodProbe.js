'use strict'

// Помощник прод-приёмки (#2074): разовые Playwright-пробы против
// https://metravel.by без повторной обвязки в каждом приёмочном скрипте.
//
// Локальный e2e-набор (`e2e/global-setup.ts`, фикстуры, моки `**/api/**`) сюда
// не подходит: он целится в `127.0.0.1:8085` и логинит оба аккаунта. Прод-проба
// ходит ТОЛЬКО под e2e-аккаунтом 104 (`E2E_EMAIL`): каждый вход под
// `E2E_EMAIL2` (владелец, id 1) перевыпускает её токен и выкидывает её из
// Android-приложения, поэтому отказ стоит ДО любого сетевого вызова.
//
// Сессия кэшируется в ignored `.codex-temp/prod-probe/` и переиспользуется, пока
// cookie `authToken` жива: повторный вход только при протухшей сессии.

const fs = require('node:fs')
const path = require('node:path')
const { chromium, request } = require('playwright')
const { applyEnvFile } = require('../../scripts/e2e-env-files')

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const PROD_BASE_URL = 'https://metravel.by'
const PROBE_ACCOUNT_ID = '104'
const AUTH_COOKIE_NAME = 'authToken'
const CONSENT_KEY = 'metravel_consent_v1'
const SESSION_PROBE_PATH = '/api/user/me/verifications/'
const STATE_DIR = path.join(REPO_ROOT, '.codex-temp', 'prod-probe')
// Запас до истечения cookie: сессия, которая умрёт посреди пробы, не годится.
const SESSION_EXPIRY_MARGIN_MS = 5 * 60 * 1000
const MAX_BODY_CHARS = 200_000

const VIEWPORTS = Object.freeze({
  narrow: Object.freeze({ width: 320, height: 640 }),
  mobile: Object.freeze({ width: 390, height: 844 }),
  desktop: Object.freeze({ width: 1440, height: 900 }),
})

// Тела этих ответов несут токены — `captureRequests` их не отдаёт: вход по
// паролю и через соцсети, подтверждение регистрации, сброс пароля, refresh.
const SECRET_BODY_URL_RE = /\/api\/(?:user\/[\w/-]*(?:login|logout|refresh|registration|password)|token)/i
// Ключи JSON-ответа, значения которых вырезаются в любом теле.
const SECRET_KEY_RE = /token|refresh|password|secret/i

class ProdProbeError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ProdProbeError'
  }
}

/**
 * Безопасный текст ошибки для stdout/stderr. Ошибка Playwright несёт «Call log»
 * со ВСЕМИ заголовками запроса и ответа — `cookie: authToken=…` и `set-cookie`,
 * поэтому печатать `error.message` как есть нельзя: хвост отрезается, а
 * оставшиеся значения cookie/токенов маскируются.
 */
function formatProbeError(error) {
  const raw = error instanceof Error ? error.message : String(error)
  return raw
    .split(/\n\s*Call log:/)[0]
    .replace(/((?:set-)?cookie:\s*)[^\n]*/gi, '$1[redacted]')
    .replace(/(authToken|token|refreshToken|userToken)=([^;\s]+)/gi, '$1=[redacted]')
    .trim()
}

function redactSecrets(value) {
  if (Array.isArray(value)) return value.map(redactSecrets)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, SECRET_KEY_RE.test(key) ? '[redacted]' : redactSecrets(item)]),
  )
}

/**
 * Учётка пробы из окружения (`.env.e2e` подгружает `openProdProbe`).
 * Отказ, если адрес совпадает с `E2E_EMAIL2` — аккаунтом владельца. Сами
 * адреса и пароль в текст ошибки не попадают.
 */
function resolveProbeCredentials(env = process.env) {
  const email = String(env.E2E_EMAIL || '').trim()
  const password = String(env.E2E_PASSWORD || '')
  const ownerEmail = String(env.E2E_EMAIL2 || '').trim()
  if (!email || !password) {
    throw new ProdProbeError('E2E_EMAIL/E2E_PASSWORD не заданы (.env.e2e) — вход e2e-аккаунтом невозможен')
  }
  if (ownerEmail && email.toLowerCase() === ownerEmail.toLowerCase()) {
    throw new ProdProbeError(
      'E2E_EMAIL совпадает с E2E_EMAIL2 (аккаунт владельца, id 1): прод-проба ходит только под e2e-аккаунтом 104',
    )
  }
  return { email, password }
}

function resolveViewport(viewport) {
  if (viewport && typeof viewport === 'object') return viewport
  const preset = VIEWPORTS[viewport || 'desktop']
  if (!preset) {
    throw new ProdProbeError(`неизвестный вьюпорт «${viewport}»: ${Object.keys(VIEWPORTS).join(', ')} или {width,height}`)
  }
  return { ...preset }
}

/** Значение `metravel_consent_v1` в формате `utils/consent.ts`. */
function buildConsentValue(analytics = false, now = new Date()) {
  return JSON.stringify({ necessary: true, analytics: analytics === true, date: now.toISOString() })
}

function stateFileFor(baseUrl) {
  return path.join(STATE_DIR, `storageState.${new URL(baseUrl).host}.json`)
}

function cookieMatchesHost(cookie, hostname) {
  const domain = String(cookie.domain || '').replace(/^\./, '')
  return hostname === domain || hostname.endsWith(`.${domain}`)
}

/**
 * Годится ли сохранённый storageState для пробы: cookie `authToken` для хоста
 * жива с запасом, а витрина `userId` — ровно аккаунт пробы. Без сети.
 */
function isReusableState(state, baseUrl, now = Date.now()) {
  if (!state || !Array.isArray(state.cookies)) return false
  const { hostname, origin } = new URL(baseUrl)
  const cookie = state.cookies.find(
    (c) => c && c.name === AUTH_COOKIE_NAME && c.value && cookieMatchesHost(c, hostname),
  )
  if (!cookie) return false
  // Playwright пишет -1 для session-cookie; иначе expires — секунды epoch.
  if (typeof cookie.expires === 'number' && cookie.expires !== -1) {
    if (cookie.expires * 1000 <= now + SESSION_EXPIRY_MARGIN_MS) return false
  }
  const originEntry = (state.origins || []).find((o) => o && o.origin === origin)
  const userId = originEntry?.localStorage?.find((item) => item.name === 'userId')?.value
  return userId === PROBE_ACCOUNT_ID
}

function readStateFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

async function sessionAnswers(baseUrl, file) {
  const api = await request.newContext({ baseURL: baseUrl, storageState: file })
  try {
    const res = await api.get(SESSION_PROBE_PATH)
    return res.ok()
  } catch {
    return false
  } finally {
    await api.dispose()
  }
}

async function loginAndWriteState(browser, baseUrl, credentials, file) {
  const context = await browser.newContext()
  try {
    // BrowserContext.request делит банк cookie с контекстом: HttpOnly `authToken`
    // из Set-Cookie попадает в storageState, токен в JS-хранилище не пишется.
    let res
    try {
      res = await context.request.post(`${baseUrl}/api/user/login/`, {
        data: { email: credentials.email, password: credentials.password },
      })
    } catch (error) {
      // Без «Call log»: в нём тело запроса с паролем и set-cookie ответа.
      throw new ProdProbeError(`вход e2e-аккаунтом не удался: ${formatProbeError(error)}`)
    }
    if (!res.ok()) {
      throw new ProdProbeError(`вход e2e-аккаунтом не удался: HTTP ${res.status()}`)
    }
    const json = await res.json().catch(() => null)
    const userId = json?.id != null ? String(json.id) : ''
    if (userId !== PROBE_ACCOUNT_ID) {
      throw new ProdProbeError(
        `вход вернул user id ${userId || '?'} вместо ${PROBE_ACCOUNT_ID} — сессия не сохранена, проба остановлена`,
      )
    }
    const state = await context.storageState()
    if (!state.cookies.some((c) => c.name === AUTH_COOKIE_NAME && cookieMatchesHost(c, new URL(baseUrl).hostname))) {
      throw new ProdProbeError('вход прошёл, но cookie authToken не выставлена — веб-сессии нет')
    }
    // Витрина, которую authStore читает ДО cookie-пробы (`stores/authStore.ts`):
    // без `userId` страница при живой cookie рисует гостя.
    state.origins = [
      {
        origin: new URL(baseUrl).origin,
        localStorage: [
          { name: 'userId', value: userId },
          { name: 'userName', value: String(json?.name ?? '').trim() },
          { name: 'isSuperuser', value: json?.is_superuser ? 'true' : 'false' },
        ],
      },
    ]
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(state, null, 2), { mode: 0o600 })
    return userId
  } finally {
    await context.close()
  }
}

/**
 * Сессия e2e-аккаунта: из кэша, если она жива, иначе один вход.
 * @returns {Promise<{file: string, userId: string, reused: boolean}>}
 */
async function ensureProbeSession({ browser, baseUrl = PROD_BASE_URL, fresh = false, env = process.env }) {
  const credentials = resolveProbeCredentials(env)
  const file = stateFileFor(baseUrl)
  if (!fresh && isReusableState(readStateFile(file), baseUrl) && (await sessionAnswers(baseUrl, file))) {
    return { file, userId: PROBE_ACCOUNT_ID, reused: true }
  }
  const userId = await loginAndWriteState(browser, baseUrl, credentials, file)
  return { file, userId, reused: false }
}

/**
 * Открывает браузер пробы.
 *
 * @param {object} [options]
 * @param {string} [options.baseUrl] — по умолчанию https://metravel.by
 * @param {'narrow'|'mobile'|'desktop'|{width:number,height:number}} [options.viewport] — 320/390/1440
 * @param {boolean} [options.auth] — false = гость (вход не выполняется)
 * @param {false|'necessary'|'all'} [options.consent] — предзапись согласия; false = баннер остаётся
 * @param {boolean} [options.fresh] — игнорировать кэш сессии и войти заново
 * @param {boolean} [options.headless]
 * @param {object} [options.contextOptions] — доп. опции `browser.newContext`
 */
async function openProdProbe(options = {}) {
  const {
    baseUrl = PROD_BASE_URL,
    viewport = 'desktop',
    auth = true,
    consent = 'necessary',
    fresh = false,
    headless = true,
    contextOptions = {},
  } = options
  applyEnvFile(path.join(REPO_ROOT, '.env.e2e'))
  // Отказ на аккаунт владельца — до запуска браузера и любого запроса.
  if (auth) resolveProbeCredentials()

  const browser = await chromium.launch({ headless })
  try {
    const session = auth ? await ensureProbeSession({ browser, baseUrl, fresh }) : null
    const context = await browser.newContext({
      ...contextOptions,
      viewport: resolveViewport(viewport),
      ...(session ? { storageState: session.file } : {}),
    })
    if (consent) {
      await context.addInitScript(
        ({ key, value }) => {
          try {
            window.localStorage.setItem(key, value)
          } catch {
            // ignore
          }
        },
        { key: CONSENT_KEY, value: buildConsentValue(consent === 'all') },
      )
    }
    const page = await context.newPage()
    return {
      browser,
      context,
      page,
      baseUrl,
      userId: session ? session.userId : null,
      reusedSession: session ? session.reused : false,
      /** Переход по пути приложения: DOM готов + короткое ожидание тишины сети. */
      goto: async (pathname, { idleMs = 15_000 } = {}) => {
        const response = await page.goto(new URL(pathname, baseUrl).toString(), { waitUntil: 'domcontentloaded' })
        await page.waitForLoadState('networkidle', { timeout: idleMs }).catch(() => undefined)
        return response
      },
      close: () => browser.close(),
    }
  } catch (error) {
    await browser.close()
    throw error
  }
}

/** Ключи localStorage страницы (все или перечисленные) как {key: rawString|null}. */
async function readLocalStorage(page, keys) {
  return page.evaluate((wanted) => {
    const out = {}
    const names = Array.isArray(wanted) && wanted.length
      ? wanted
      : Array.from({ length: window.localStorage.length }, (_, i) => window.localStorage.key(i))
    for (const name of names) {
      if (name != null) out[name] = window.localStorage.getItem(name)
    }
    return out
  }, keys || null)
}

async function readResponseBody(response, url) {
  if (SECRET_BODY_URL_RE.test(url)) return '[redacted: auth endpoint]'
  const text = await response.text()
  const clipped = text.length > MAX_BODY_CHARS ? `${text.slice(0, MAX_BODY_CHARS)}…[truncated]` : text
  try {
    return redactSecrets(JSON.parse(clipped))
  } catch {
    return clipped
  }
}

/**
 * Пишет запросы страницы, чей URL содержит подстроку / совпадает с RegExp.
 * Запись: {method, url, status, failure?, body()} — `body()` читает тело по
 * запросу (до ухода со страницы: Playwright выгружает тела при навигации).
 * `summary()` — те же записи без функции, готовые к JSON.
 */
function captureRequests(page, urlPattern) {
  const matches = typeof urlPattern === 'function'
    ? urlPattern
    : urlPattern instanceof RegExp
      ? (url) => urlPattern.test(url)
      : (url) => url.includes(String(urlPattern))
  const entries = []
  const onResponse = (response) => {
    const req = response.request()
    const url = req.url()
    if (!matches(url)) return
    entries.push({ method: req.method(), url, status: response.status(), body: () => readResponseBody(response, url) })
  }
  const onFailed = (req) => {
    const url = req.url()
    if (!matches(url)) return
    entries.push({ method: req.method(), url, status: null, failure: req.failure()?.errorText ?? 'failed', body: async () => null })
  }
  page.on('response', onResponse)
  page.on('requestfailed', onFailed)
  return {
    entries,
    summary: () =>
      entries.map(({ method, url, status, failure }) => (failure ? { method, url, status, failure } : { method, url, status })),
    stop: () => {
      page.off('response', onResponse)
      page.off('requestfailed', onFailed)
    },
  }
}

// #2107: полный заход в одной вкладке. Неизвестный город nginx отдаёт как
// +not-found.html; в тёплом кэше чанк города успевает на кадр гидратации и
// даёт pageerror #418. Холодный заход того же URL ошибку не даёт.
const HYDRATION_PAGE_ERROR = /Minified React error #418\b|Hydration failed because the server rendered/i
const WARM_UNKNOWN_CITY_SEQUENCE = Object.freeze([
  '/quests/country/belarus',
  '/quests/minsk',
  '/quests/country/no-such-country-x',
  '/quests/no-such-city-x',
])

function isHydrationPageError(error) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return HYDRATION_PAGE_ERROR.test(message)
}

function pageErrorText(error) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return message.split(/\n\s*Call log:/)[0].trim().slice(0, 300)
}

/**
 * Тёплая вкладка: страна → город → квест → назад → неизвестная страна →
 * неизвестный город. Падает, если на последнем документе есть pageerror.
 *
 * @param {import('playwright').Page} page
 * @param {object} [options]
 * @param {string} [options.baseUrl]
 * @param {number} [options.timeoutMs]
 * @param {number} [options.settleMs] пауза после перехода, чтобы гидратация успела бросить #418
 * @param {(page: import('playwright').Page) => Promise<string|null>} [options.openQuest]
 */
async function runWarmUnknownCityHydrationProbe(page, options = {}) {
  const baseUrl = options.baseUrl || PROD_BASE_URL
  const timeoutMs = options.timeoutMs || 45_000
  const settleMs = options.settleMs ?? 1_500
  const errors = []
  const onPageError = (error) => {
    errors.push(pageErrorText(error))
  }
  page.on('pageerror', onPageError)
  const goto = async (pathname) => {
    const before = errors.length
    await page.goto(new URL(pathname, baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: timeoutMs })
    if (settleMs > 0) await page.waitForTimeout(settleMs)
    return errors.slice(before)
  }
  try {
    await goto(WARM_UNKNOWN_CITY_SEQUENCE[0])
    await goto(WARM_UNKNOWN_CITY_SEQUENCE[1])
    const questHref = options.openQuest
      ? await options.openQuest(page)
      : await page.evaluate(() => {
        // Город в URL квеста — числовой id (`/quests/4/minsk-cmok`), не алиас `/quests/minsk/`.
        const links = Array.from(document.querySelectorAll('a[href*="/quests/"]'))
        const href = links
          .map((node) => node.getAttribute('href') || '')
          .find((value) => /\/quests\/[^/]+\/[^/?#]+/.test(value.split('?')[0]) && !value.includes('/country/'))
        return href || null
      })
    if (!questHref) {
      throw new ProdProbeError('на /quests/minsk нет ссылки на квест — сценарий #2107 не собран')
    }
    await goto(questHref)
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: timeoutMs })
    if (settleMs > 0) await page.waitForTimeout(settleMs)
    await goto(WARM_UNKNOWN_CITY_SEQUENCE[2])
    const cityErrors = await goto(WARM_UNKNOWN_CITY_SEQUENCE[3])
    if (cityErrors.length) {
      throw new ProdProbeError(`pageerror на неизвестном городе (/quests/<unknown>): ${cityErrors.length}`)
    }
    return { errors }
  } finally {
    page.off('pageerror', onPageError)
  }
}

/** Выкаченная сборка: `/.build-source.json` ({sha, dirty, deploy, recordedAt}). */
async function buildSource(baseUrl = PROD_BASE_URL) {
  const res = await fetch(new URL('/.build-source.json', baseUrl), { cache: 'no-store' })
  if (!res.ok) throw new ProdProbeError(`/.build-source.json: HTTP ${res.status}`)
  return res.json()
}

module.exports = {
  PROD_BASE_URL,
  PROBE_ACCOUNT_ID,
  CONSENT_KEY,
  VIEWPORTS,
  ProdProbeError,
  formatProbeError,
  redactSecrets,
  SECRET_BODY_URL_RE,
  resolveProbeCredentials,
  resolveViewport,
  buildConsentValue,
  isReusableState,
  stateFileFor,
  ensureProbeSession,
  openProdProbe,
  readLocalStorage,
  captureRequests,
  buildSource,
  HYDRATION_PAGE_ERROR,
  WARM_UNKNOWN_CITY_SEQUENCE,
  isHydrationPageError,
  runWarmUnknownCityHydrationProbe,
}
