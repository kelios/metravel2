// #2184: политика повторов тяжёлого чтения — не больше одного повтора и только
// когда сервер этот запрос уже не считает.
import { ApiError } from '@/api/clientErrors'
import { heavyReadRetry, noServerWorkInFlight, readRetryOnce, readRetryTwice, stravaReadRetryOnce } from '@/utils/queryRetryPolicy'

const named = (name: string, message: string) => Object.assign(new Error(message), { name })

describe('heavyReadRetry', () => {
  it('не повторяет таймаут — в любой локали текста ошибки', () => {
    const localized = [
      'Превышено время ожидания (15000ms). Попробуйте позже.',
      'Перавышаны час чакання (15000ms). Паспрабуйце пазней.',
      'Перевищено час очікування (15000ms). Спробуйте пізніше.',
      'Przekroczono limit czasu (15000 ms). Spróbuj ponownie później.',
      'Timeout exceeded (15000ms). Please try again later.',
    ]
    localized.forEach((message) => {
      expect(heavyReadRetry.retry(0, named('TimeoutError', message))).toBe(false)
    })
  })

  it('не повторяет 504: шлюз сдался, а upstream ещё считает', () => {
    expect(heavyReadRetry.retry(0, new ApiError(504, 'HTTP 504: '))).toBe(false)
  })

  it('повторяет один раз, когда запрос не дошёл до сервера', () => {
    const failures = [
      new Error('Network error while fetching https://metravel.by/api/places/catalog/?page=1. Is the API server running and reachable from this device/browser?'),
      new TypeError('Network request failed'),
      new TypeError('Load failed'),
      new ApiError(0, 'offline'),
    ]
    failures.forEach((error) => {
      expect(heavyReadRetry.retry(0, error)).toBe(true)
      expect(heavyReadRetry.retry(1, error)).toBe(false)
    })
  })

  it('повторяет один раз 502 и 503: upstream недоступен либо сам отменил расчёт', () => {
    ;[502, 503].forEach((status) => {
      const error = new ApiError(status, `HTTP ${status}: `)
      expect(heavyReadRetry.retry(0, error)).toBe(true)
      expect(heavyReadRetry.retry(1, error)).toBe(false)
    })
  })

  it('не повторяет ответы сервера, которые повтор не исправит', () => {
    ;[400, 401, 403, 404, 429, 500].forEach((status) => {
      expect(heavyReadRetry.retry(0, new ApiError(status, `HTTP ${status}: `))).toBe(false)
    })
  })

  it('не повторяет отмену запроса и неопознанные ошибки', () => {
    expect(heavyReadRetry.retry(0, named('AbortError', 'Aborted'))).toBe(false)
    expect(heavyReadRetry.retry(0, new Error('Unexpected token < in JSON'))).toBe(false)
    expect(heavyReadRetry.retry(0, null)).toBe(false)
  })

  it('делает паузу перед повтором', () => {
    expect(heavyReadRetry.retryDelay).toBeGreaterThanOrEqual(1000)
  })
})

describe('noServerWorkInFlight', () => {
  it('таймаут важнее слова «timeout» в общем признаке сбоя связи', () => {
    // `isConnectionFailure` считает сбоем связи любое сообщение со словом
    // timeout; для повтора таймаут — обратный случай: сервер занят расчётом.
    expect(noServerWorkInFlight(new Error('Request timeout'))).toBe(false)
  })
})


it('retains each prior retry maximum and the Strava503 exception', () => {
  for (const error of [new ApiError(502, 'unavailable'), new TypeError('Failed to fetch')]) {
    expect(readRetryOnce(0, error)).toBe(true)
    expect(readRetryOnce(1, error)).toBe(false)
    expect(readRetryTwice(1, error)).toBe(true)
    expect(readRetryTwice(2, error)).toBe(false)
    expect(stravaReadRetryOnce(0, error)).toBe(true)
    expect(stravaReadRetryOnce(1, error)).toBe(false)
  }
  expect(readRetryTwice(0, new ApiError(503, 'busy'))).toBe(true)
  expect(stravaReadRetryOnce(0, new ApiError(503, 'busy'))).toBe(false)
  for (const policy of [readRetryOnce, readRetryTwice, stravaReadRetryOnce]) {
    for (const status of [400, 401, 403, 404, 408, 429, 500, 504]) expect(policy(0, new ApiError(status, 'Failed to fetch'))).toBe(false)
    expect(policy(0, named('TimeoutError', 'Przekroczono limit czasu'))).toBe(false)
    expect(policy(0, new Error('Login failed: 503'))).toBe(false)
  }
})
