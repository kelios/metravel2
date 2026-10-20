import fs from 'fs'
import path from 'path'
import vm from 'vm'

type ScriptContextOptions = {
  apiUrl?: string
  hostname?: string
  origin?: string
  pathname?: string
  targetPath?: string
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
    __metravelTravelPreloadTargetPath: options.targetPath,
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

  it('does not anonymously preload an author-preview editor document', () => {
    const { context, fetchMock } = createScriptContext({ pathname: '/travel/new' })
    vm.runInNewContext(source, context)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(context.window).not.toHaveProperty('__metravelTravelPreloadPending')
  })

  it('ignores a delayed public script after navigation to a different travel', () => {
    const { context, fetchMock } = createScriptContext({
      pathname: '/travels/7100', targetPath: '/travels/public-slug',
    })
    vm.runInNewContext(source, context)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(context.window).not.toHaveProperty('__metravelTravelPreloadPending')
    expect(context.window).not.toHaveProperty('__metravelTravelPreloadPromise')
  })

  it('keeps anonymous preload on the matching initial public document', () => {
    const pathname = '/travels/hala-krupowa'
    const { context, fetchMock } = createScriptContext({ pathname, targetPath: pathname })
    vm.runInNewContext(source, context)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://metravel.by/api/travels/by-slug/hala-krupowa/',
      expect.objectContaining({ credentials: 'omit' }),
    )
  })

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
