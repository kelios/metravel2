'use strict'

/**
 * scripts/lib/questTranslation/api.js
 * HTTP-клиент конвейера перевода квестов (#2199): публичное чтение источника и
 * admin-эндпоинты переводов (#2194).
 *
 * Запись — `PUT` всего перевода пары «квест + локаль» одним запросом, поэтому
 * повтор после 502/503/504 безопасен: он идемпотентен. Это важно на проде —
 * compose-выкат бэка даёт окно 5xx в несколько секунд без предупреждения.
 */

const { createTokenSession, qaTokenSources, readTokenCandidate, TokenError, formatTokenError } = require('../metravel-token')
const { targetPolicy, trustedRequest, snapshotBody } = require('../metravel-token-transport')

const { ExpectedFailureError, UsageError } = require('../cli-contract')

const RETRYABLE_STATUS = new Set([429, 502, 503, 504])
const RETRY_DELAYS_MS = [2000, 12000]
const USER_AGENT = 'metravel-quest-translate/1.0 (+https://metravel.by)'

function resolveToken(explicit, options) {
  return readTokenCandidate(qaTokenSources({ explicit, ...options }))
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function createApi({ apiUrl, token, sleep = defaultSleep, tokenSession, testFixture }) {
  const target = targetPolicy(apiUrl, testFixture)
  const base = target.origin
  // Public reads and authenticated operations must share the declared target
  // and QA104 identity, including when a caller reuses an existing session.
  if (tokenSession != null && (tokenSession.origin !== base || tokenSession.profile !== 'qa104' ||
      tokenSession.expectedUserId !== 104 || typeof tokenSession.request !== 'function')) {
    throw new TokenError('configuration', { operation: 'configure' })
  }
  let session = tokenSession
  const getSession = () => {
    if (!session) session = createTokenSession({
      origin: base, profile: 'qa104', expectedUserId: 104,
      sources: [{ kind: 'value', value: token }], refreshPolicy: target.production ? 'primary-qa' : 'never',
      ...(testFixture ? { fixture: testFixture, homeDir: testFixture.homeDir } : {}),
    })
    return session
  }

  async function request(method, endpoint, { body, admin = false } = {}) {
    if (admin && !token && testFixture && !tokenSession) {
      throw new UsageError('Нужен токен администратора: используйте общий resolver QA104')
    }
    let frozen
    try { frozen = await snapshotBody(body === undefined ? undefined : JSON.stringify(body)) }
    catch (error) { throw new ExpectedFailureError(formatTokenError(error)) }
    const headers = { Accept: 'application/json', 'User-Agent': USER_AGENT }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    for (let attempt = 0; ; attempt += 1) {
      let response
      try {
        response = admin
          ? await getSession().request(endpoint, { method, headers, body: frozen.bytes })
          : await trustedRequest(base, endpoint, { method, headers, body: frozen.bytes }, { fixture: testFixture })
      } catch (error) {
        const retryNetwork = error instanceof TokenError && ['network', 'timeout'].includes(error.reason)
        if (!retryNetwork || attempt >= RETRY_DELAYS_MS.length) throw new ExpectedFailureError(`${formatTokenError(error)}${error instanceof TokenError && error.reason === 'authentication' ? '; prepare session: node scripts/get-quest-token.js' : ''}`)
        await sleep(RETRY_DELAYS_MS[attempt])
        continue
      }
      if (RETRYABLE_STATUS.has(response.status) && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt])
        continue
      }
      let text
      try { text = await response.text() } catch { throw new ExpectedFailureError('metravel-auth: request/response') }
      let json = null
      try { json = text ? JSON.parse(text) : null } catch { json = null }
      return { status: response.status, json, text }
    }
  }

  async function expectOk(method, endpoint, options) {
    const result = await request(method, endpoint, options)
    if (result.status === 401 || result.status === 403) {
      throw new ExpectedFailureError(formatTokenError(new TokenError('authentication', { status: result.status })))
    }
    if (result.status < 200 || result.status >= 300) {
      throw new ExpectedFailureError(formatTokenError(new TokenError('response', { status: result.status })))
    }
    return result.json
  }

  const langQuery = (lang) => (lang ? `&lang=${encodeURIComponent(lang)}` : '')

  return {
    hasToken: Boolean(token),

    /** Русский источник квеста: без `lang` сервер отдаёт канонический текст. */
    async getBundle(questId) {
      const endpoint = `/api/quests/by-quest-id/${encodeURIComponent(questId)}/`
      const result = await request('GET', endpoint)
      if (result.status === 404) throw new ExpectedFailureError(`квест ${questId} не найден`)
      if (result.status !== 200) throw new ExpectedFailureError(`GET ${endpoint}: HTTP ${result.status}`)
      return result.json
    },

    /** Весь публичный каталог: список пагинируется, `perPage` на сервере ограничен. */
    async getCatalog(lang) {
      const rows = []
      const seen = new Set()
      let endpoint = `/api/quests/?perPage=200${langQuery(lang)}`
      while (endpoint && !seen.has(endpoint)) {
        seen.add(endpoint)
        const page = await expectOk('GET', endpoint)
        rows.push(...(Array.isArray(page) ? page : page.results || page.data || []))
        endpoint = Array.isArray(page) ? null : page.next || page.next_page_url || null
      }
      return rows
    },

    getStatus(locale) {
      const query = locale ? `?locale=${encodeURIComponent(locale)}` : ''
      return expectOk('GET', `/api/quests/translations/status/${query}`, { admin: true })
    },

    async getTranslation(questPk, locale) {
      const endpoint = `/api/quests/${questPk}/translations/${locale}/`
      const result = await request('GET', endpoint, { admin: true })
      if (result.status === 404) return null
      if (result.status !== 200) throw new ExpectedFailureError(formatTokenError(new TokenError('response', { status: result.status })))
      return result.json
    },

    /** Возвращает и отказ 400 как данные: вызывающий печатает перечень причин. */
    putTranslation(questPk, locale, document) {
      return request('PUT', `/api/quests/${questPk}/translations/${locale}/`, { body: document, admin: true })
    },

    putCityName(cityId, locale, name) {
      return expectOk('PUT', `/api/quest-cities/${cityId}/translations/${locale}/`, { body: { name }, admin: true })
    },
  }
}

module.exports = { RETRY_DELAYS_MS, createApi, resolveToken }
