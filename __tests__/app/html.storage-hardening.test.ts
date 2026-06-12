import fs from 'fs'
import path from 'path'

// Extracts the actual hardening IIFE shipped in app/+html.tsx so the test runs
// the real code, not a copy.
function loadHardeningScript(): string {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'app/+html.tsx'), 'utf8')
  const marker = 'const getStorageHardeningScript = () => String.raw`'
  const start = source.indexOf(marker)
  expect(start).toBeGreaterThan(-1)
  const bodyStart = start + marker.length
  const end = source.indexOf('`', bodyStart) // IIFE contains no backticks
  expect(end).toBeGreaterThan(bodyStart)
  return source.slice(bodyStart, end)
}

function runWith(win: any): void {
  new Function('window', loadHardeningScript())(win)
}

function throwingWindow(): any {
  const win: any = {}
  const thrower = () => {
    throw new Error('The operation is insecure.')
  }
  Object.defineProperty(win, 'localStorage', { configurable: true, get: thrower })
  Object.defineProperty(win, 'sessionStorage', { configurable: true, get: thrower })
  return win
}

describe('+html storage hardening script', () => {
  it('is present and registered before the legacy redirect script', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'app/+html.tsx'), 'utf8')
    expect(source).toContain('getStorageHardeningScript()')
    // Must run before the legacy redirect script in the rendered <head>.
    expect(source.indexOf('getStorageHardeningScript()')).toBeLessThan(
      source.indexOf('getLegacyParamRedirectScript()'),
    )
  })

  it('replaces a throwing localStorage with a working in-memory shim (block-all-cookies)', () => {
    const win = throwingWindow()
    runWith(win)

    // Accessing storage no longer throws.
    expect(() => win.localStorage).not.toThrow()
    expect(() => win.sessionStorage).not.toThrow()

    // The shim is a functional storage.
    win.localStorage.setItem('theme', 'dark')
    expect(win.localStorage.getItem('theme')).toBe('dark')
    expect(win.localStorage.getItem('missing')).toBeNull()
    expect(win.localStorage.length).toBe(1)
    expect(win.localStorage.key(0)).toBe('theme')
    win.localStorage.removeItem('theme')
    expect(win.localStorage.getItem('theme')).toBeNull()
    expect(win.localStorage.length).toBe(0)
  })

  it('replaces storage whose setItem throws (iOS private mode)', () => {
    const win: any = {}
    const privateLs = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {},
    }
    Object.defineProperty(win, 'localStorage', { configurable: true, get: () => privateLs })
    Object.defineProperty(win, 'sessionStorage', { configurable: true, get: () => privateLs })

    runWith(win)

    expect(() => win.localStorage.setItem('k', 'v')).not.toThrow()
    expect(win.localStorage.getItem('k')).toBe('v')
  })

  it('leaves working localStorage untouched', () => {
    const store: Record<string, string> = {}
    const realLs = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v
      },
      removeItem: (k: string) => {
        delete store[k]
      },
    }
    const win: any = { localStorage: realLs, sessionStorage: realLs }

    runWith(win)

    // Same object — not swapped for a shim.
    expect(win.localStorage).toBe(realLs)
    expect(store.__ms_probe__).toBeUndefined() // probe cleaned up
  })
})
