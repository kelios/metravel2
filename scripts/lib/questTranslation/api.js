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

const fs = require('fs')
const os = require('os')
const path = require('path')

const { ExpectedFailureError, UsageError } = require('../cli-contract')

const RETRYABLE_STATUS = new Set([429, 502, 503, 504])
const RETRY_DELAYS_MS = [2000, 12000]
const USER_AGENT = 'metravel-quest-translate/1.0 (+https://metravel.by)'

function resolveToken(explicit, { env = process.env, homeDir = os.homedir() } = {}) {
  if (explicit) return explicit
  if (env.METRAVEL_TOKEN) return env.METRAVEL_TOKEN
  const tokenFile = path.join(homeDir, '.metravel_token')
  return fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, 'utf8').trim() || null : null
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function createApi({ apiUrl, token, fetchImpl = fetch, sleep = defaultSleep }) {
  const base = apiUrl.replace(/\/+$/, '')

  async function request(method, endpoint, { body, admin = false } = {}) {
    if (admin && !token) {
      throw new UsageError('Нужен токен администратора: --token, METRAVEL_TOKEN или ~/.metravel_token')
    }
    const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`
    const headers = { Accept: 'application/json', 'User-Agent': USER_AGENT }
    if (admin) headers.Authorization = `Token ${token}`
    if (body !== undefined) headers['Content-Type'] = 'application/json'

    for (let attempt = 0; ; attempt += 1) {
      let response
      try {
        response = await fetchImpl(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
      } catch (error) {
        if (attempt >= RETRY_DELAYS_MS.length) throw new ExpectedFailureError(`${method} ${url}: ${error.message}`)
        await sleep(RETRY_DELAYS_MS[attempt])
        continue
      }
      if (RETRYABLE_STATUS.has(response.status) && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt])
        continue
      }
      const text = await response.text()
      let json = null
      try {
        json = text ? JSON.parse(text) : null
      } catch {
        json = null
      }
      return { status: response.status, json, text }
    }
  }

  async function expectOk(method, endpoint, options) {
    const result = await request(method, endpoint, options)
    if (result.status === 401 || result.status === 403) {
      throw new ExpectedFailureError(`${method} ${endpoint}: HTTP ${result.status} — токен не принят или не администратор; свежий токен: METRAVEL_TOKEN=$(node scripts/get-quest-token.js)`)
    }
    if (result.status < 200 || result.status >= 300) {
      throw new ExpectedFailureError(`${method} ${endpoint}: HTTP ${result.status} ${result.text.slice(0, 300)}`)
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
      if (result.status !== 200) throw new ExpectedFailureError(`GET ${endpoint}: HTTP ${result.status} ${result.text.slice(0, 300)}`)
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
