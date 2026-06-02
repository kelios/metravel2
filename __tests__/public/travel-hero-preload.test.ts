import fs from 'fs'
import path from 'path'
import vm from 'vm'

type ScriptContextOptions = {
  apiUrl?: string
  hostname?: string
  origin?: string
  pathname?: string
}

function createScriptContext(options: ScriptContextOptions = {}) {
  const fetchMock = jest.fn().mockResolvedValue({ ok: false })
  const querySelector = jest.fn(() => null)
  const appendChild = jest.fn()

  class AbortControllerMock {
    signal = { aborted: false }
    abort() {
      this.signal.aborted = true
    }
  }

  const windowObject = {
    location: {
      hostname: options.hostname ?? 'metravel.by',
      origin: options.origin ?? 'https://metravel.by',
      pathname: options.pathname ?? '/travels/hala-krupowa',
    },
    __METRAVEL_API_URL__: options.apiUrl ?? 'http://127.0.0.1:8085',
    AbortController: AbortControllerMock,
  }

  const context = {
    window: windowObject,
    document: {
      head: { appendChild },
      body: { appendChild },
      querySelector,
      querySelectorAll: jest.fn(() => []),
      getElementById: jest.fn(() => null),
      createElement: jest.fn(() => ({
        setAttribute: jest.fn(),
      })),
    },
    fetch: fetchMock,
    URL,
    setTimeout,
    clearTimeout,
    AbortController: AbortControllerMock,
    console: {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
    },
  }

  return { context, fetchMock }
}

describe('public/travel-hero-preload-v2.js', () => {
  const scriptPath = path.resolve(process.cwd(), 'public/travel-hero-preload-v2.js')
  const source = fs.readFileSync(scriptPath, 'utf8')

  it('uses same-origin api on public host when leaked localhost e2e api url is present', async () => {
    const { context, fetchMock } = createScriptContext()

    vm.runInNewContext(source, context)
    await Promise.resolve()
    await Promise.resolve()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://metravel.by/api/travels/by-slug/hala-krupowa/',
      expect.objectContaining({
        method: 'GET',
        credentials: 'omit',
      })
    )
  })
})
