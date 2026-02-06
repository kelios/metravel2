import { fetchWithTimeout } from '@/utils/fetchWithTimeout'
import { safeJsonParse, safeJsonParseString } from '@/utils/safeJsonParse'
import { openBookPreviewWindow } from '@/utils/openBookPreviewWindow'

class FakeResponse {
  status: number
  statusText: string
  private body: string

  constructor(body: string, status = 200, statusText = 'OK') {
    this.body = body
    this.status = status
    this.statusText = statusText
  }

  async text(): Promise<string> {
    return this.body
  }
}

describe('fetchWithTimeout', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.useRealTimers()
  })

  afterEach(() => {
    global.fetch = originalFetch as any
  })

  it('resolves successfully before timeout', async () => {
    const mockResponse = { ok: true } as Response
    const fetchMock = jest.fn().mockResolvedValue(mockResponse)
    global.fetch = fetchMock as any

    const result = await fetchWithTimeout('https://example.com/api', { method: 'GET' }, 100)

    expect(result).toBe(mockResponse)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, options] = fetchMock.mock.calls[0]
    expect(options.signal).toBeDefined()
  })

  it('rejects with timeout error when request exceeds timeout', async () => {
    jest.useFakeTimers()

    const fetchMock = jest.fn((url: string, options: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = options.signal as AbortSignal | undefined
        if (signal) {
          signal.addEventListener('abort', () => {
            reject({ name: 'AbortError' })
          })
        }
      })
    })

    global.fetch = fetchMock as any

    const promise = fetchWithTimeout('https://example.com/slow', {}, 10)

    jest.advanceTimersByTime(20)

    await expect(promise).rejects.toThrow(/Превышено время ожидания/)
  })

  it('propagates external abort signal error without wrapping into timeout message', async () => {
    jest.useFakeTimers()

    const externalController = new AbortController()

    const fetchMock = jest.fn((url: string, options: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = options.signal as AbortSignal | undefined
        if (signal) {
          signal.addEventListener('abort', () => {
            reject({ name: 'AbortError', reason: 'external' } as any)
          })
        }
      })
    })

    global.fetch = fetchMock as any

    const promise = fetchWithTimeout('https://example.com/aborted', { signal: externalController.signal }, 1000)

    externalController.abort()
    jest.runAllTimers()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError', reason: 'external' })
  })
})

describe('safeJsonParse', () => {
  it('parses valid JSON response', async () => {
    const response = new FakeResponse('{"value":42}', 200, 'OK') as any as Response
    const data = await safeJsonParse<{ value: number }>(response)
    expect(data.value).toBe(42)
  })

  it('returns fallback for empty body when fallback provided', async () => {
    const response = new FakeResponse('', 200, 'OK') as any as Response
    const fallback = { value: 1 }
    const data = await safeJsonParse(response, fallback)
    expect(data).toBe(fallback)
  })

  it('throws for empty body when fallback not provided', async () => {
    const response = new FakeResponse('', 200, 'OK') as any as Response
    await expect(safeJsonParse(response)).rejects.toThrow(/Пустой ответ от сервера/)
  })

  it('returns fallback when JSON is invalid and fallback provided', async () => {
    const response = new FakeResponse('not-json', 500, 'Server Error') as any as Response
    const fallback = { ok: false }
    const data = await safeJsonParse(response, fallback)
    expect(data).toBe(fallback)
  })

  it('throws when JSON is invalid and no fallback is provided', async () => {
    const response = new FakeResponse('not-json', 500, 'Server Error') as any as Response
    await expect(safeJsonParse(response)).rejects.toThrow(/Не удалось прочитать ответ сервера/)
  })
})

describe('safeJsonParseString', () => {
  it('parses valid JSON string', () => {
    const result = safeJsonParseString<{ a: number }>(' {"a": 1} ')
    expect(result.a).toBe(1)
  })

  it('returns fallback for empty string when fallback provided', () => {
    const fallback = { ok: true }
    const result = safeJsonParseString('', fallback)
    expect(result).toBe(fallback)
  })

  it('throws for empty string when no fallback provided', () => {
    // Реализация сначала детектит пустую строку, логирует ошибку и в итоге
    // пробрасывает общее сообщение о неудачном парсинге JSON-строки
    expect(() => safeJsonParseString('')).toThrow(/Не удалось распарсить JSON строку/)
  })

  it('returns fallback when JSON string is invalid and fallback provided', () => {
    const fallback = { ok: false }
    const result = safeJsonParseString('not-json', fallback)
    expect(result).toBe(fallback)
  })

  it('throws when JSON string is invalid and no fallback provided', () => {
    expect(() => safeJsonParseString('not-json')).toThrow(/Не удалось распарсить JSON строку/)
  })
})

describe('openBookPreviewWindow', () => {
  const originalWindow = global.window

  afterEach(() => {
    // Восстанавливаем window после каждого теста
    global.window = originalWindow as any
  })

  it('does nothing when window.open returns null', () => {
    const mockWindow: any = {
      open: jest.fn(() => null),
    }
    global.window = mockWindow as any

    openBookPreviewWindow('<html></html>')

    expect(mockWindow.open).toHaveBeenCalledWith('about:blank', '_blank')
  })

  it('writes HTML into newly opened window document', () => {
    const write = jest.fn()
    const open = jest.fn(() => ({
      document: {
        open: jest.fn(),
        write,
        close: jest.fn(),
      },
    }))

    const mockWindow: any = { open }
    global.window = mockWindow as any

    const html = '<html><body>Test</body></html>'
    openBookPreviewWindow(html)

    expect(open).toHaveBeenCalledWith('about:blank', '_blank')
    expect(write).toHaveBeenCalledWith(html)
  })

  it('attempts to write HTML even if initial write throws', () => {
    jest.useFakeTimers()

    const firstWrite = jest.fn(() => {
      throw new Error('document not ready')
    })
    const secondWrite = jest.fn()

    const mockWindow: any = {
      open: jest.fn(() => ({
        document: {
          open: jest.fn(),
          write: firstWrite,
          close: jest.fn(),
        },
      })),
    }

    // При повторной попытке подменим document.write
    // При повторной попытке используем тот же window, но подменяем write
    const winInstance: any = {
      document: {
        open: jest.fn(),
        write: firstWrite,
        close: jest.fn(),
      },
    }

    mockWindow.open.mockReturnValue(winInstance)

    global.window = mockWindow as any

    const html = '<html><body>Retry</body></html>'
    openBookPreviewWindow(html)

    // Подменяем write перед срабатыванием таймера fallback-записи
    winInstance.document.write = secondWrite

    // продвигаем таймер, чтобы сработал setTimeout внутри утилиты
    jest.advanceTimersByTime(60)

    expect(firstWrite).toHaveBeenCalled()
    expect(secondWrite).toHaveBeenCalledWith(html)
  })
})
