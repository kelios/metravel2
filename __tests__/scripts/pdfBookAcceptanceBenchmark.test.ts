// Pure validation fixtures below are unit-test data, never production evidence.
const benchmark = require('../../scripts/pdf-book-acceptance-benchmark.cjs')
const { EventEmitter } = require('node:events')

const fixture = (label: 'before' | 'after') => ({
  schema: 1, mode: 'desktop-two-travel', byteMetric: benchmark.BYTE_METRIC, label, accountId: '104', ids: ['11', '22'],
  inputHash: benchmark.hash([{ id: 11, gallery: [{ id: 1 }] }, { id: 22, gallery: [{ id: 2 }] }]),
  settings: { template: 'minimal', includeGallery: true, sortOrder: 'manual' },
  viewport: { width: 1280, height: 900 }, browser: 'Chromium 1', dpr: 1,
  cache: 'fresh-isolated-context-initially-empty-http-cache-serviceworkers-blocked', url: 'https://metravel.by/export',
  source: { sha: label === 'before' ? 'old' : 'new', dirty: false },
  sourceEnd: { sha: label === 'before' ? 'old' : 'new', dirty: false },
  printReadyMs: 2000, errors: [],
  api: [{ url: 'https://metravel.by/api/travels/11/', method: 'GET', status: 200 }],
  snapshotApi: [
    { id: '11', phase: 'before', status: 200 }, { id: '22', phase: 'before', status: 200 },
    { id: '11', phase: 'after', status: 200 }, { id: '22', phase: 'after', status: 200 },
  ],
  requests: [
    { url: 'https://metravel.by/export', type: 'document', phase: 'page', status: 200, byteSource: 'content-length', encodedBodyBytes: 500 },
    { url: 'https://metravel.by/media/1.jpg', type: 'image', phase: 'print', status: 200, byteSource: 'content-length', encodedBodyBytes: 1000 },
  ],
  images: [{ complete: true, naturalWidth: 1080, naturalHeight: 1350 }],
  expectedGallery: [
    { travelId: '11', id: '1', asset: 'metravel.by/media/1.jpg' },
    { travelId: '22', id: '2', asset: 'metravel.by/media/2.jpg' },
  ],
  galleryImages: [
    { asset: 'metravel.by/media/1.jpg', complete: true, naturalWidth: 320, naturalHeight: 640, width: 100, height: 200, objectFit: 'contain' },
    { asset: 'metravel.by/media/2.jpg', complete: true, naturalWidth: 640, naturalHeight: 320, width: 200, height: 100, objectFit: 'contain' },
  ],
})

describe('PDF production benchmark comparison contract (#2232)', () => {
  it('compares identical book/environment across different deployed SHAs', () => {
    expect(benchmark.compareReports(fixture('before'), fixture('after')).pass).toBe(true)
  })

  it.each(['ids', 'inputHash', 'settings', 'viewport', 'browser', 'dpr', 'cache', 'url', 'byteMetric'])(
    'rejects incompatible %s rather than claiming a regression pass', (key) => {
      const after = { ...fixture('after'), [key]: 'different' }
      expect(benchmark.compareReports(fixture('before'), after).failures).toContain(`incomparable:${key}`)
    },
  )

  it('rejects a missing comparison input', () => {
    const after = { ...fixture('after'), inputHash: undefined }
    expect(benchmark.compareReports(fixture('before'), after).pass).toBe(false)
  })

  it('rejects missing or failed real API snapshots', () => {
    const after = fixture('after')
    after.snapshotApi[3].status = 500
    expect(benchmark.compareReports(fixture('before'), after).failures).toContain('after:invalid-snapshot-api')
    expect(benchmark.compareReports(fixture('before'), { ...after, snapshotApi: [] }).pass).toBe(false)
  })

  it('rejects a deploy during either probe', () => {
    const before = { ...fixture('before'), sourceEnd: { sha: 'changed', dirty: false } }
    expect(benchmark.compareReports(before, fixture('after')).failures).toContain('before:unstable-source')
  })

  it('rejects page errors, failed requests, missing transfer bytes and broken images', () => {
    const before = fixture('before')
    expect(benchmark.compareReports(before, { ...fixture('after'), errors: ['runtime error'] }).failures).toContain('after:page-errors')
    expect(benchmark.compareReports(before, { ...fixture('after'), requests: [{ status: 500, type: 'image' }] }).failures).toContain('after:network-errors')
    expect(benchmark.compareReports(before, { ...fixture('after'), requests: [{ status: 200, type: 'image' }] }).failures).toContain('after:missing-byte-evidence')
    expect(benchmark.compareReports(before, { ...fixture('after'), images: [{ complete: true, naturalWidth: 0, naturalHeight: 0 }] }).failures).toContain('after:broken-images')
  })

  it('rejects increasing print and page-wide image request counts', () => {
    const after = fixture('after')
    after.requests.push({ ...after.requests[1] })
    expect(benchmark.compareReports(fixture('before'), after).failures).toEqual(expect.arrayContaining([
      'regression:print-image-count', 'regression:page-image-count',
    ]))
  })

  it('rejects missing or substituted gallery photos even when a cover loads and requests decrease', () => {
    const before = fixture('before')
    for (const galleryImages of [[], before.galleryImages.slice(0, 1), [before.galleryImages[0], before.galleryImages[0]]]) {
      const after = { ...fixture('after'), galleryImages, requests: before.requests.slice(0, 1) }
      expect(benchmark.compareReports(before, after).failures).toContain('after:invalid-gallery-coverage')
    }
    const after = fixture('after')
    after.settings.includeGallery = false
    expect(benchmark.compareReports(after, { ...after, label: 'after' }).failures).toContain('after:invalid-gallery-coverage')
  })

  it('rejects hidden, rotated or distorted foreground gallery output with unchanged network', () => {
    const before = fixture('before')
    for (const changes of [{ width: 0 }, { width: 105 }, { naturalWidth: undefined }, { naturalWidth: 640, naturalHeight: 320 }, { objectFit: 'cover' }, { objectFit: undefined }]) {
      const after = fixture('after')
      Object.assign(after.galleryImages[0], changes)
      expect(benchmark.compareReports(before, after).pass).toBe(false)
    }
    const after = fixture('after')
    after.galleryImages[0].width += 0.5
    expect(benchmark.compareReports(before, after).pass).toBe(true)
  })

  it('checks the page-wide budget even when print requests decrease', () => {
    const after = fixture('after')
    after.requests = [after.requests[0], { ...after.requests[1], phase: 'page' }, { ...after.requests[1], phase: 'page' }]
    const result = benchmark.compareReports(fixture('before'), after)
    expect(result.failures).toContain('regression:page-image-count')
    expect(result.failures).not.toContain('regression:print-image-count')
  })

  it('rejects increased encoded bytes even with unchanged request count', () => {
    const after = fixture('after')
    after.requests[1].encodedBodyBytes += 1
    expect(benchmark.compareReports(fixture('before'), after).failures).toEqual(expect.arrayContaining([
      'regression:print-image-bytes', 'regression:page-image-bytes', 'regression:page-encoded-bytes',
    ]))
  })

  it('rejects an increased real API count independently of image requests', () => {
    const after = fixture('after')
    after.requests.push({ url: 'https://metravel.by/api/travels/11/', type: 'fetch', phase: 'print', status: 200, byteSource: 'content-length', encodedBodyBytes: 0 })
    expect(benchmark.compareReports(fixture('before'), after).failures).toContain('regression:api-count')
  })

  it('reports explicit timing noise and fails above its boundary', () => {
    const before = fixture('before')
    const within = { ...fixture('after'), printReadyMs: 2500 }
    expect(benchmark.compareReports(before, within).printReadyMs.allowedIncreaseMs).toBe(500)
    expect(benchmark.compareReports(before, within).pass).toBe(true)
    expect(benchmark.compareReports(before, { ...within, printReadyMs: 2501 }).failures).toContain('regression:print-ready-time')
    expect(benchmark.compareReports(before, within, { noiseMs: 0, noiseRatio: 0 }).pass).toBe(false)
    expect(() => benchmark.compareReports(before, within, { noiseMs: -1 })).toThrow()
  })
})

describe('PDF benchmark safety and reproducibility', () => {
  it('matches the actual gallery asset independently of print proxy sizing and keeps duplicate photos', () => {
    const gallery = [{ id: 1, url: 'https://metravel.by/media/photo.jpg?w=100' }, { id: 1, print_url: 'https://metravel.by/media/photo.jpg?w=2500&q=85' }]
    expect(benchmark.expectedGallery([{ id: 11, gallery }])).toEqual([
      { travelId: '11', id: '1', asset: 'metravel.by/media/photo.jpg' },
      { travelId: '11', id: '1', asset: 'metravel.by/media/photo.jpg' },
    ])
  })
  it('requires precisely the requested two selected cards, regardless of DOM order', () => {
    const expected = ['travel-card-selectable-a', 'travel-card-selectable-b']
    expect(() => benchmark.assertSelection([...expected].reverse(), expected)).not.toThrow()
    for (const selected of [[], [expected[0]], [expected[0], expected[0]], [expected[0], 'another-card'], [...expected, 'another-card'], [expected[0], null]]) {
      expect(() => benchmark.assertSelection(selected, expected)).toThrow(/Exactly the two requested/)
    }
  })

  it('requires two explicit distinct IDs; never selects a whole catalog', () => {
    const suffix = ['--label', 'before', '--output', '.codex-temp/pdf-test.json']
    for (const ids of ['11', '11,11', '11,22,33', '0,22', 'all']) {
      expect(() => benchmark.parseArgs(['--ids', ids, ...suffix])).toThrow(/two distinct/)
    }
    expect(benchmark.parseArgs(['--ids', '11,22', ...suffix]).ids).toEqual(['11', '22'])
  })

  it('restricts persisted evidence to ignored .codex-temp JSON files', () => {
    for (const file of ['report.json', '.codex-temp/../report.json', '.codex-temp/report.txt', '.secrets/file.json']) {
      expect(() => benchmark.outputPath(file)).toThrow()
    }
    expect(benchmark.outputPath('.codex-temp/pdf/report.json')).toMatch(/\.codex-temp[/\\]pdf[/\\]report\.json$/)
  })

  it('hashes real generator fields stably while ignoring changing view counters', () => {
    const travel = { id: 11, description: '<p>one</p>', media: { gallery: [{ id: 1, aspect_ratio: 0.8 }] }, countUnicIpView: 20 }
    expect(benchmark.hash(benchmark.bookInput(travel))).toBe(benchmark.hash(benchmark.bookInput({ ...travel, countUnicIpView: 21 })))
    expect(benchmark.hash(benchmark.bookInput(travel))).not.toBe(benchmark.hash(benchmark.bookInput({ ...travel, description: '<p>two</p>' })))
    expect(benchmark.hash({ a: 1, b: 2 })).toBe(benchmark.hash({ b: 2, a: 1 }))
  })
})

describe('PDF benchmark bounded encoded-entity byte evidence', () => {
  const url = 'https://metravel.by/media/photo.jpg?token=private'
  const request = (page: any, method = 'GET', hasFrame = true) => ({
    url: () => url, method: () => method, resourceType: () => 'image',
    frame: () => { if (!hasFrame) throw new Error('No frame'); return { page: () => page } },
    sizes: jest.fn(() => new Promise(() => {})),
    failure: () => ({ errorText: 'net::ERR_FAILED' }),
  })
  const start = (context: any, image: any, headers = {}, status = 200) => {
    context.emit('request', image)
    context.emit('response', { request: () => image, status: () => status, headers: () => headers })
  }
  const timingPage = (bytes = 37) => ({ evaluate: jest.fn(async () => [{ name: url, responseEnd: 10, encodedBodySize: bytes }]) })

  it('uses completed synchronous Content-Length without SDK metadata or decoded body length', async () => {
    const context = new EventEmitter(), page = timingPage(99)
    const capture = benchmark.captureNetwork(context, () => 'print', String)
    const image = request(page)
    start(context, image, { 'content-length': '37' })
    expect(capture.requests[0].encodedBodyBytes).toBeUndefined()
    context.emit('requestfinished', image)
    await capture.waitForCompletion(100)
    expect(image.sizes).not.toHaveBeenCalled()
    expect(page.evaluate).not.toHaveBeenCalled()
    expect(capture.requests[0]).toMatchObject({ status: 200, encodedBodyBytes: 37, byteSource: 'content-length', networkState: 'complete' })
    expect(capture.requests[0].url).not.toContain('private')
    capture.stop()
    expect(context.listenerCount('requestfinished')).toBe(0)
  })

  it('uses a positive completed unique Resource Timing entity size when Content-Length is absent', async () => {
    const context = new EventEmitter(), page = timingPage()
    const capture = benchmark.captureNetwork(context, () => 'print', String)
    const image = request(page)
    start(context, image)
    context.emit('requestfinished', image)
    await capture.waitForCompletion(100)
    expect(capture.requests[0]).toMatchObject({ encodedBodyBytes: 37, byteSource: 'resource-timing', networkState: 'complete' })
    expect(image.sizes).not.toHaveBeenCalled()
    capture.stop()
  })

  it('accepts a proven empty Content-Length even without a frame', async () => {
    const context = new EventEmitter()
    const capture = benchmark.captureNetwork(context, () => 'page', String)
    const image = request(undefined, 'GET', false)
    start(context, image, { 'content-length': '0' })
    context.emit('requestfinished', image)
    await capture.waitForCompletion(100)
    expect(capture.requests[0]).toMatchObject({ encodedBodyBytes: 0, byteSource: 'content-length', pageUnavailable: true })
    capture.stop()
  })

  it.each(['in-flight', 'opaque-zero', 'duplicate-requests', 'duplicate-timings', 'no-frame', 'stuck-evaluate'])(
    'bounds %s without manufacturing or double-counting bytes', async (kind) => {
      jest.useFakeTimers()
      try {
        const context = new EventEmitter(), page = timingPage(kind === 'opaque-zero' ? 0 : 37)
        if (kind === 'stuck-evaluate') page.evaluate = jest.fn(() => new Promise<any>(() => {}))
        if (kind === 'duplicate-timings') page.evaluate = jest.fn(async () => [
          { name: url, responseEnd: 10, encodedBodySize: 37 }, { name: url, responseEnd: 20, encodedBodySize: 37 },
        ])
        const capture = benchmark.captureNetwork(context, () => 'page', String)
        const image = request(page, 'GET', kind !== 'no-frame')
        start(context, image)
        if (kind !== 'in-flight') context.emit('requestfinished', image)
        if (kind === 'duplicate-requests') {
          const duplicate = request(page)
          start(context, duplicate)
          context.emit('requestfinished', duplicate)
        }
        const failed = expect(capture.waitForCompletion()).rejects.toThrow(/30000ms.*requests unfinished/)
        await jest.advanceTimersByTimeAsync(30_000)
        await failed
        expect(capture.pending().length).toBe(kind === 'duplicate-requests' ? 2 : 1)
        expect(capture.requests.every((entry: any) => entry.encodedBodyBytes === undefined)).toBe(true)
        capture.stop()
      } finally { jest.useRealTimers() }
    },
  )

  it.each(['failed-request', 'invalid-length', 'HEAD', '304'])('fails %s without zero byte fallback', async (kind) => {
    const context = new EventEmitter()
    const capture = benchmark.captureNetwork(context, () => 'print', String)
    const image = request(timingPage(), kind === 'HEAD' ? 'HEAD' : 'GET')
    start(context, image, { 'content-length': kind === 'invalid-length' ? 'unknown' : '37' }, kind === '304' ? 304 : 200)
    context.emit(kind === 'failed-request' ? 'requestfailed' : 'requestfinished', image)
    await expect(capture.waitForCompletion(100)).rejects.toThrow(/Network completion failed/)
    expect(capture.requests[0].encodedBodyBytes).toBeUndefined()
    expect(capture.requests[0][kind === 'failed-request' ? 'failure' : 'sizeError']).toBeTruthy()
    capture.stop()
  })
})
