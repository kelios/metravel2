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

  it('maps ERR_STREAM_PREMATURE_CLOSE to user-friendly network error', async () => {
    const fetchMock = jest.fn().mockRejectedValue({
      code: 'ERR_STREAM_PREMATURE_CLOSE',
      message: 'Premature close',
    })
    global.fetch = fetchMock as any

    await expect(fetchWithTimeout('https://example.com/interrupted', {}, 1000)).rejects.toThrow(
      /Сетевое соединение было прервано/
    )
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
  let mockCreateObjectURL: jest.Mock
  let mockRevokeObjectURL: jest.Mock

  beforeEach(() => {
    mockCreateObjectURL = jest.fn(() => 'blob:http://localhost/mock-blob-url')
    mockRevokeObjectURL = jest.fn()
    global.URL.createObjectURL = mockCreateObjectURL
    global.URL.revokeObjectURL = mockRevokeObjectURL
  })

  afterEach(() => {
    global.window = originalWindow as any
    jest.restoreAllMocks()
  })

  it('does nothing when window.open returns null', () => {
    const mockWindow: any = {
      ...window,
      open: jest.fn(() => null),
    }
    global.window = mockWindow as any

    openBookPreviewWindow('<html></html>')

    expect(mockCreateObjectURL).toHaveBeenCalled()
    expect(mockWindow.open).toHaveBeenCalledWith(
      'blob:http://localhost/mock-blob-url',
      '_blank',
      'noopener,noreferrer'
    )
  })

  it('opens Blob URL in a new window', () => {
    const winInstance: any = {}
    const open = jest.fn(() => winInstance)

    const mockWindow: any = { ...window, open }
    global.window = mockWindow as any

    const html = '<html><body>Test</body></html>'
    openBookPreviewWindow(html)

    expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(open).toHaveBeenCalledWith(
      'blob:http://localhost/mock-blob-url',
      '_blank',
      'noopener,noreferrer'
    )
  })

  it('falls back to document.write when Blob URL fails', () => {
    mockCreateObjectURL.mockImplementation(() => {
      throw new Error('Blob not supported')
    })

    const write = jest.fn()
    const winInstance: any = {
      document: {
        open: jest.fn(),
        write,
        close: jest.fn(),
      },
    }

    const mockWindow: any = {
      ...window,
      open: jest.fn(() => winInstance),
    }
    global.window = mockWindow as any

    const html = '<html><body>Fallback</body></html>'
    openBookPreviewWindow(html)

    expect(mockWindow.open).toHaveBeenCalledWith('about:blank', '_blank', 'noopener,noreferrer')
    expect(write).toHaveBeenCalledWith(html)
  })
})
