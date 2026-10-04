/**
 * #2150: XHR-загрузка со сторожем простоя вместо таймаута на всю попытку,
 * `onProgress` в долях 0–1 и ровно один повтор на 502/503/504.
 */

import {
  UploadTransportError,
  sendXhrUpload,
  sendXhrUploadWithTransientRetry,
  type XhrUploadRequest,
} from '@/api/clientUploadTransport'
import { UPLOAD_IDLE_TIMEOUT_MS } from '@/api/clientTypes'

type Handler = ((event?: unknown) => void) | null

class FakeXhr {
  static instances: FakeXhr[] = []
  upload: { onprogress: Handler; onload: Handler } = { onprogress: null, onload: null }
  onload: Handler = null
  onerror: Handler = null
  onabort: Handler = null
  status = 0
  statusText = ''
  responseText = ''
  withCredentials = false
  aborted = false
  headers: Record<string, string> = {}
  constructor() {
    FakeXhr.instances.push(this)
  }
  open() {}
  setRequestHeader(key: string, value: string) {
    this.headers[key] = value
  }
  send() {}
  abort() {
    this.aborted = true
    this.onabort?.()
  }
  progress(loaded: number, total = 100) {
    this.upload.onprogress?.({ loaded, total, lengthComputable: true })
  }
  respond(status: number, body = '{}') {
    this.status = status
    this.responseText = body
    this.onload?.()
  }
}

const request = (over: Partial<XhrUploadRequest> = {}): XhrUploadRequest => ({
  url: 'https://metravel.by/api/upload',
  method: 'POST',
  formData: {} as FormData,
  headers: { 'X-CSRFToken': 'csrf' },
  withCredentials: true,
  responseTimeoutMs: 65_000,
  ...over,
})

const lastXhr = () => FakeXhr.instances[FakeXhr.instances.length - 1]

describe('sendXhrUpload', () => {
  const originalXhr = global.XMLHttpRequest

  beforeEach(() => {
    jest.useFakeTimers()
    FakeXhr.instances = []
    ;(global as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr
  })

  afterEach(() => {
    jest.useRealTimers()
    ;(global as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = originalXhr
  })

  it('reports progress as a 0–1 fraction and resolves with the server response', async () => {
    const onProgress = jest.fn()
    const pending = sendXhrUpload(request({ onProgress }))
    const xhr = lastXhr()
    expect(xhr.headers['X-CSRFToken']).toBe('csrf')
    expect(xhr.withCredentials).toBe(true)

    xhr.progress(25)
    xhr.progress(100)
    xhr.respond(201, '{"id":5}')

    await expect(pending).resolves.toEqual({ status: 201, statusText: '', responseText: '{"id":5}' })
    expect(onProgress.mock.calls.map(([value]) => value)).toEqual([0.25, 1])
  })

  it('aborts with idle_timeout when sent bytes stop growing', async () => {
    const pending = sendXhrUpload(request())
    const xhr = lastXhr()
    xhr.progress(10)
    jest.advanceTimersByTime(UPLOAD_IDLE_TIMEOUT_MS - 1)
    xhr.progress(10) // тот же объём — не прогресс
    jest.advanceTimersByTime(1)

    await expect(pending).rejects.toMatchObject({ reason: 'idle_timeout', status: 0 })
    expect(xhr.aborted).toBe(true)
  })

  it('does not cut a slow upload while bytes keep flowing', async () => {
    const pending = sendXhrUpload(request())
    const xhr = lastXhr()
    // 3 минуты медленной, но живой отправки: дольше любого таймаута на попытку.
    for (let loaded = 1; loaded < 100; loaded += 1) {
      jest.advanceTimersByTime(UPLOAD_IDLE_TIMEOUT_MS - 1_000)
      xhr.progress(loaded)
    }
    xhr.progress(100)
    xhr.respond(201)
    await expect(pending).resolves.toMatchObject({ status: 201 })
  })

  it('waits for the response up to the server ceiling once the body is sent', async () => {
    const pending = sendXhrUpload(request({ responseTimeoutMs: 65_000 }))
    const xhr = lastXhr()
    xhr.progress(100)
    jest.advanceTimersByTime(64_999)
    expect(xhr.aborted).toBe(false)
    jest.advanceTimersByTime(1)
    await expect(pending).rejects.toMatchObject({ reason: 'response_timeout' })
  })

  it('keeps the overall ceiling when the platform never reports upload progress', async () => {
    const pending = sendXhrUpload(request({ responseTimeoutMs: 65_000 }))
    const xhr = lastXhr()
    jest.advanceTimersByTime(UPLOAD_IDLE_TIMEOUT_MS + 1)
    expect(xhr.aborted).toBe(false)
    xhr.respond(201)
    await expect(pending).resolves.toMatchObject({ status: 201 })
  })

  it('keeps the overall ceiling when the body size is unknown', async () => {
    const pending = sendXhrUpload(request({ responseTimeoutMs: 65_000 }))
    const xhr = lastXhr()
    xhr.upload.onprogress?.({ loaded: 50, total: 0, lengthComputable: true })
    jest.advanceTimersByTime(UPLOAD_IDLE_TIMEOUT_MS + 1)
    expect(xhr.aborted).toBe(false)
    xhr.respond(201)
    await expect(pending).resolves.toMatchObject({ status: 201 })
  })

  it('maps a dropped connection to network', async () => {
    const pending = sendXhrUpload(request())
    lastXhr().onerror?.()
    const error = await pending.catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(UploadTransportError)
    expect(error).toMatchObject({ reason: 'network' })
  })

  it('retries a transient 503 exactly once', async () => {
    const pending = sendXhrUploadWithTransientRetry(request())
    lastXhr().respond(503)
    await jest.advanceTimersByTimeAsync(0)
    expect(FakeXhr.instances).toHaveLength(2)
    lastXhr().respond(503)

    await expect(pending).resolves.toMatchObject({ status: 503 })
    expect(FakeXhr.instances).toHaveLength(2)
  })
})
