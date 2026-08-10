/**
 * #1372: инлайновый прогрев каталога `/search` из статического HTML.
 *
 * Тест исполняет РЕАЛЬНЫЙ IIFE из `app/+html.tsx`, а не его копию: иначе
 * разъехавшийся guard по маршруту или query-строке остался бы незамеченным.
 */
import fs from 'fs'
import path from 'path'

import { PER_PAGE } from '@/components/listTravel/utils/listTravelConstants'
import { TEST_API_BASE_URL } from '@/utils/resolveApiBaseUrl'
import {
  buildTravelListPreloadUrl,
  TRAVEL_LIST_FILTER_PARAM_KEYS,
  TRAVEL_LIST_PRELOAD_GLOBAL,
  TRAVEL_LIST_PRELOAD_TIMEOUT_MS,
} from '@/utils/travelListPreload'

const SOURCE_PATH = path.resolve(process.cwd(), 'app/+html.tsx')
const ENDPOINT = buildTravelListPreloadUrl(TEST_API_BASE_URL, PER_PAGE)

function readSource(): string {
  return fs.readFileSync(SOURCE_PATH, 'utf8')
}

/**
 * Достаёт тело шаблона и собирает из него исполняемый скрипт с теми же
 * подстановками, что делает сборка. `String.raw` обязателен: в теле есть
 * регулярка `/\/+$/`, и обычный шаблонный литерал съел бы экранирование.
 */
function loadPreloadScript(endpoint: string): string {
  const source = readSource()
  const marker = 'const getTravelListPreloadScript = () => String.raw`'
  const start = source.indexOf(marker)
  expect(start).toBeGreaterThan(-1)
  const bodyStart = start + marker.length
  const end = source.indexOf('`', bodyStart) // в IIFE нет обратных кавычек
  expect(end).toBeGreaterThan(bodyStart)
  const body = source.slice(bodyStart, end)

  return new Function(
    'TRAVEL_LIST_PRELOAD_ENDPOINT',
    'TRAVEL_LIST_PRELOAD_GLOBAL',
    'TRAVEL_LIST_FILTER_PARAM_KEYS',
    'TRAVEL_LIST_PRELOAD_TIMEOUT_MS',
    'JSON',
    `return String.raw\`${body}\``,
  )(
    endpoint,
    TRAVEL_LIST_PRELOAD_GLOBAL,
    TRAVEL_LIST_FILTER_PARAM_KEYS,
    TRAVEL_LIST_PRELOAD_TIMEOUT_MS,
    JSON,
  )
}

type FakeWindow = Record<string, unknown> & { location: { pathname: string; search: string } }

function makeWindow(pathname: string, search = ''): FakeWindow {
  return { location: { pathname, search }, AbortController } as unknown as FakeWindow
}

function run(win: FakeWindow, fetchMock: jest.Mock, endpoint = ENDPOINT): void {
  new Function('window', 'fetch', loadPreloadScript(endpoint))(win, fetchMock)
}

describe('+html travel list preload script', () => {
  let fetchMock: jest.Mock

  beforeEach(() => {
    fetchMock = jest.fn(() => Promise.resolve({ ok: true }))
  })

  it('стартует ровно тот запрос, который потом построит fetchTravels', () => {
    const win = makeWindow('/search')
    run(win, fetchMock)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(ENDPOINT)
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('GET')
    expect(init.credentials).toBe('omit')
    expect(init.signal).toBeInstanceOf(AbortSignal)

    const entry = win[TRAVEL_LIST_PRELOAD_GLOBAL] as {
      url: string
      startedAt: number
      response: Promise<unknown>
    }
    expect(entry.url).toBe(ENDPOINT)
    expect(Number.isFinite(entry.startedAt)).toBe(true)
    expect(typeof entry.response.then).toBe('function')
  })

  it('работает при завершающем слэше /search/', () => {
    const win = makeWindow('/search/')
    run(win, fetchMock)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('молчит на любом другом маршруте', () => {
    for (const pathname of ['/', '/map', '/travels/some-slug', '/searchable']) {
      const win = makeWindow(pathname)
      run(win, fetchMock)
      expect(win[TRAVEL_LIST_PRELOAD_GLOBAL]).toBeUndefined()
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('молчит при фильтрующем query-параметре: это уже другой запрос', () => {
    const searches = [
      '?search=minsk',
      '?sort=popular',
      '?categoryTravelAddress=84',
      '?category__travel__address=84',
      '?over_nights_stay=1',
      '?over__nights__stay=1',
      '?categories=3',
      '?companions=2',
      '?complexity=1',
      '?month=7',
      '?user_id=1',
      '?utm_source=telegram&sort=popular',
    ]
    for (const search of searches) {
      const win = makeWindow('/search', search)
      run(win, fetchMock)
      expect(win[TRAVEL_LIST_PRELOAD_GLOBAL]).toBeUndefined()
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // Рекламный/соцсетевой холодный вход — как раз тот трафик, ради которого
  // прогрев и делался; трекинговые метки на URL запроса не влияют.
  it('греет при трекинговых параметрах, которые запрос не меняют', () => {
    for (const search of ['?utm_source=telegram&utm_medium=post', '?fbclid=abc', '?yclid=42']) {
      fetchMock.mockClear()
      const win = makeWindow('/search', search)
      run(win, fetchMock)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0][0]).toBe(ENDPOINT)
    }
  })

  it('не греет дважды и не перетирает уже занятую глобаль', () => {
    const win = makeWindow('/search')
    const existing = { url: 'already-there' }
    win[TRAVEL_LIST_PRELOAD_GLOBAL] = existing

    run(win, fetchMock)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(win[TRAVEL_LIST_PRELOAD_GLOBAL]).toBe(existing)
  })

  it('без известной базы API ничего не запрашивает', () => {
    const win = makeWindow('/search')
    run(win, fetchMock, '')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(win[TRAVEL_LIST_PRELOAD_GLOBAL]).toBeUndefined()
  })

  // Потребитель ждёт именно этот промис, поэтому обрыв должен быть свой:
  // повисший бэкенд иначе держал бы список в загрузке бесконечно.
  it('обрывает прогрев по своему таймауту', () => {
    jest.useFakeTimers()
    try {
      const win = makeWindow('/search')
      run(win, fetchMock)

      const { signal } = fetchMock.mock.calls[0][1] as RequestInit
      expect(signal?.aborted).toBe(false)
      jest.advanceTimersByTime(TRAVEL_LIST_PRELOAD_TIMEOUT_MS - 1)
      expect(signal?.aborted).toBe(false)
      jest.advanceTimersByTime(1)
      expect(signal?.aborted).toBe(true)
    } finally {
      jest.useRealTimers()
    }
  })

  it('снимает таймер после ответа', async () => {
    jest.useFakeTimers()
    try {
      const win = makeWindow('/search')
      run(win, fetchMock)

      const { signal } = fetchMock.mock.calls[0][1] as RequestInit
      const entry = win[TRAVEL_LIST_PRELOAD_GLOBAL] as { response: Promise<unknown> }
      await entry.response
      await Promise.resolve()

      jest.advanceTimersByTime(TRAVEL_LIST_PRELOAD_TIMEOUT_MS)
      expect(signal?.aborted).toBe(false)
    } finally {
      jest.useRealTimers()
    }
  })

  it('гасит unhandled rejection, не подменяя промис потребителю', async () => {
    const failure = new Error('network down')
    const rejecting = jest.fn(() => Promise.reject(failure))
    const win = makeWindow('/search')

    run(win, rejecting as unknown as jest.Mock)

    const entry = win[TRAVEL_LIST_PRELOAD_GLOBAL] as { response: Promise<unknown> }
    await expect(entry.response).rejects.toBe(failure)
  })

  // Если у /search появится новый фильтрующий query-параметр, а список ключей
  // про него не узнает, прогрев начнёт стрелять лишним запросом.
  it('список фильтрующих ключей покрывает всё, что читает useListTravelInitialFilter', () => {
    const hookSource = fs.readFileSync(
      path.resolve(process.cwd(), 'components/listTravel/hooks/useListTravelInitialFilter.ts'),
      'utf8',
    )
    const readKeys = [...hookSource.matchAll(/\bparams\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1])

    expect(readKeys.length).toBeGreaterThan(0)
    for (const key of new Set(readKeys)) {
      expect(TRAVEL_LIST_FILTER_PARAM_KEYS).toContain(key)
    }
  })

  it('окно прогрева совпадает с LONG_TIMEOUT обычного запроса', () => {
    const { LONG_TIMEOUT } = require('@/api/travelQueryShared') as { LONG_TIMEOUT: number }
    expect(TRAVEL_LIST_PRELOAD_TIMEOUT_MS).toBe(LONG_TIMEOUT)
  })

  it('скрипт зарегистрирован в <head> и не выпускается при рантайм-зависимой базе API', () => {
    const source = readSource()
    expect(source).toContain('getTravelListPreloadScript()')
    // Ветки resolveApiBaseUrl, которые на рантайме смотрят на window.location:
    // при них сборочный URL мог бы разойтись с рантаймовым.
    expect(source).toContain('if (isE2E || isLocalApi || isLikelySelfProxyApiUrl(envApiUrl)) return \'\'')
    // Прогрев обязан стоять до тяжёлых head-скриптов, но после hardening storage.
    expect(source.indexOf('getStorageHardeningScript()')).toBeLessThan(
      source.indexOf('getTravelListPreloadScript()'),
    )
    expect(source.indexOf('getTravelListPreloadScript()')).toBeLessThan(
      source.indexOf('getCriticalHeadScript()'),
    )
  })
})
