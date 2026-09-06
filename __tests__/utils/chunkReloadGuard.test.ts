import vm from 'node:vm'
import fs from 'node:fs'
import path from 'node:path'
import {
  getChunkReloadBootstrapScript,
  reloadOnceForStaleChunk,
} from '@/utils/chunkReloadGuard'

const KEY = 'mt:chunk-reload-ts'

function makeStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
}

function makeWindow(storage = makeStorage()) {
  const listeners: Record<string, (event: unknown) => void> = {}
  const win = {
    sessionStorage: storage,
    location: {
      href: 'https://metravel.by/search?q=river#results',
      origin: 'https://metravel.by',
      reload: jest.fn(),
    },
    addEventListener: jest.fn((name: string, callback: (event: unknown) => void) => {
      listeners[name] = callback
    }),
  }
  return { win, listeners }
}

function bootstrap(win: ReturnType<typeof makeWindow>['win']) {
  vm.runInNewContext(getChunkReloadBootstrapScript(), { window: win, URL, Date })
}

describe('pre-entry stale bundle recovery', () => {
  afterEach(() => jest.restoreAllMocks())

  it('captures persistent storage before the HTML shell can install an in-memory shim', () => {
    const htmlSource = fs.readFileSync(path.join(process.cwd(), 'app/+html.tsx'), 'utf8')
    expect(htmlSource.indexOf('getChunkReloadBootstrapScript()')).toBeGreaterThan(0)
    expect(htmlSource.indexOf('getChunkReloadBootstrapScript()')).toBeLessThan(
      htmlSource.indexOf('getStorageHardeningScript()'),
    )
  })

  it('works without loading any application module, before entry or common errors', () => {
    const { win, listeners } = makeWindow()
    bootstrap(win)
    expect(win.addEventListener).toHaveBeenCalledWith('error', expect.any(Function), true)
    expect(win.location.reload).not.toHaveBeenCalled()
    for (const filename of ['__common-old.js', 'entry-old.js', '_layout-old.js']) {
      listeners.error({ target: { tagName: 'SCRIPT', src: `/_expo/static/js/web/${filename}` } })
    }
    expect(win.location.reload).toHaveBeenCalledTimes(1)
    expect(Number(win.sessionStorage.getItem(KEY))).toBeGreaterThan(0)
    expect(win.location.href).toBe('https://metravel.by/search?q=river#results')
  })

  it('shares the 30-second fuse with runtime imports and a fresh document', () => {
    const storage = makeStorage()
    const first = makeWindow(storage)
    bootstrap(first.win)
    expect(reloadOnceForStaleChunk(first.win as unknown as Window)).toBe(true)
    first.listeners.error({ target: { tagName: 'SCRIPT', src: '/_expo/static/js/web/entry-old.js' } })
    const second = makeWindow(storage)
    bootstrap(second.win)
    second.listeners.error({ target: { tagName: 'SCRIPT', src: '/_expo/static/js/web/entry-old.js' } })
    expect(reloadOnceForStaleChunk(second.win as unknown as Window)).toBe(false)
    expect(first.win.location.reload).toHaveBeenCalledTimes(1)
    expect(second.win.location.reload).not.toHaveBeenCalled()
  })

  it('allows a later document after the fuse expires, but never repeats within one document', () => {
    let now = 1_800_000_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => now)
    const storage = makeStorage()
    const first = makeWindow(storage)
    bootstrap(first.win)
    expect(reloadOnceForStaleChunk(first.win as unknown as Window)).toBe(true)
    now += 30_000
    expect(reloadOnceForStaleChunk(first.win as unknown as Window)).toBe(false)
    const second = makeWindow(storage)
    bootstrap(second.win)
    expect(reloadOnceForStaleChunk(second.win as unknown as Window)).toBe(true)
  })

  it.each(['Infinity', '-Infinity', 'not-a-timestamp'])(
    'ignores a corrupted persisted timestamp: %s',
    (value) => {
      const { win, listeners } = makeWindow()
      win.sessionStorage.setItem(KEY, value)
      bootstrap(win)
      listeners.error({ target: { tagName: 'SCRIPT', src: '/_expo/static/js/web/entry-old.js' } })
      expect(win.location.reload).toHaveBeenCalledTimes(1)
      expect(Number.isFinite(Number(win.sessionStorage.getItem(KEY)))).toBe(true)
    },
  )

  it.each([
    ['LINK', '/_expo/static/css/global-old.css'],
    ['IMG', '/_expo/static/js/web/entry-old.js'],
    ['SCRIPT', 'https://example.com/_expo/static/js/web/entry-old.js'],
    ['SCRIPT', '/analytics.js'],
    ['SCRIPT', '/_expo/static/js/web/not-javascript.css'],
  ])('ignores unrelated resource failures: %s %s', (tagName, src) => {
    const { win, listeners } = makeWindow()
    bootstrap(win)
    listeners.error({ target: { tagName, src } })
    listeners.error({ error: new Error('Unrelated application error') })
    expect(win.location.reload).not.toHaveBeenCalled()
  })

  it.each(['getter', 'read', 'write', 'discard'] as const)(
    'does not reload with unavailable storage (%s), even after a memory shim replaces it',
    (failure) => {
      const { win, listeners } = makeWindow()
      if (failure === 'getter') {
        Object.defineProperty(win, 'sessionStorage', {
          configurable: true,
          get: () => { throw new Error('SecurityError') },
        })
      } else if (failure === 'read') {
        win.sessionStorage.getItem = () => { throw new Error('SecurityError') }
      } else {
        win.sessionStorage.setItem = () => {
          if (failure === 'write') throw new Error('QuotaExceededError')
        }
      }
      bootstrap(win)
      Object.defineProperty(win, 'sessionStorage', { value: makeStorage(), configurable: true })
      listeners.error({ target: { tagName: 'SCRIPT', src: '/_expo/static/js/web/entry-old.js' } })
      expect(reloadOnceForStaleChunk(win as unknown as Window)).toBe(false)
      expect(win.location.reload).not.toHaveBeenCalled()
    },
  )

  it('retains runtime recovery on legacy HTML and shares its fuse with the bootstrap', () => {
    const { win } = makeWindow()
    expect(reloadOnceForStaleChunk(win as unknown as Window)).toBe(true)
    bootstrap(win)
    expect(reloadOnceForStaleChunk(win as unknown as Window)).toBe(false)
    expect(win.location.reload).toHaveBeenCalledTimes(1)
  })
})
