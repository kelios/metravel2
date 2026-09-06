const fs = require('fs')
const path = require('path')

const { makeTempDir, removeDir } = require('./cli-test-utils')

// `buildDir` фиксируется на загрузке модуля, поэтому сборка-фикстура собирается
// до `require`: иначе резолвер смотрел бы в реальный `dist`, которого в прогоне
// может не быть вовсе.
const buildDir = makeTempDir('serve-web-build-routes-')
fs.mkdirSync(path.join(buildDir, 'quests', '[city]'), { recursive: true })
fs.writeFileSync(path.join(buildDir, 'quests', '[city]', '[questId].html'), '<html>quest</html>')
fs.mkdirSync(path.join(buildDir, 'travels'), { recursive: true })
fs.writeFileSync(path.join(buildDir, 'travels', '[param].html'), '<html>travel</html>')
fs.writeFileSync(path.join(buildDir, 'index.html'), '<html>home</html>')
process.env.E2E_BUILD_DIR = buildDir

const {
  getDynamicRouteFallbackCandidates,
  isExpectedProxyTransportFailure,
  resolveApiProxyTarget,
} = require('../../scripts/serve-web-build')

const { DEFAULT_LOCAL_E2E_API_URL } = require('../../scripts/e2e-target-safety')
// Фолбэк нормализован через URL, как и заданный таргет.
const LOCAL_FALLBACK = new URL(DEFAULT_LOCAL_E2E_API_URL).toString()

afterAll(() => {
  removeDir(buildDir)
})

describe('E2E web proxy transport logging', () => {
  it.each([
    'EAI_AGAIN',
    'ECONNREFUSED',
    'EHOSTDOWN',
    'ENETDOWN',
    'ENETUNREACH',
    'ETIMEDOUT',
  ])('treats an unavailable guest-E2E upstream as expected (%s)', (code) => {
    expect(isExpectedProxyTransportFailure({ code, message: 'upstream unavailable' })).toBe(true)
  })

  it('treats proxy timeouts and socket shutdowns as expected transport failures', () => {
    expect(
      isExpectedProxyTransportFailure(new Error('Proxy timeout after 60000ms')),
    ).toBe(true)
    expect(isExpectedProxyTransportFailure(new Error('socket hang up'))).toBe(true)
  })

  it('keeps unexpected proxy failures visible', () => {
    expect(
      isExpectedProxyTransportFailure({ code: 'EPROTO', message: 'TLS protocol failure' }),
    ).toBe(false)
  })
})

// Предохранитель таргета. Прямой запуск `node scripts/e2e-webserver.js` без
// `E2E_API_PROXY_TARGET` молча уводил ВЕСЬ регрессионный набор на боевой API:
// набор зеленел на проде, а локальные дефекты не проявлялись вовсе. Правило
// то же, что в `scripts/e2e-target-safety.js`: не выведенный таргет — это
// локальный бэкенд, никогда не прод.
describe('E2E API proxy target is fail-closed to the local backend', () => {
  const HOST = '127.0.0.1'
  const PORT = 8085

  it('falls back to the local backend when nothing is configured', () => {
    expect(resolveApiProxyTarget({}, HOST, PORT)).toBe(LOCAL_FALLBACK)
  })

  it('never falls back to production', () => {
    for (const env of [{}, { E2E_API_PROXY_TARGET: 'not a url' }]) {
      expect(resolveApiProxyTarget(env, HOST, PORT)).not.toContain('metravel.by')
    }
  })

  it('falls back to the local backend on an unparseable target', () => {
    expect(resolveApiProxyTarget({ E2E_API_PROXY_TARGET: 'not a url' }, HOST, PORT)).toBe(
      LOCAL_FALLBACK,
    )
  })

  it('falls back to the local backend instead of self-proxying', () => {
    // Бандл запекает `EXPO_PUBLIC_API_URL` самого e2e-сервера — прокси на себя
    // это петля, а не повод уехать на прод.
    expect(
      resolveApiProxyTarget({ EXPO_PUBLIC_API_URL: `http://${HOST}:${PORT}` }, HOST, PORT),
    ).toBe(LOCAL_FALLBACK)
    expect(
      resolveApiProxyTarget({ EXPO_PUBLIC_API_URL: `http://localhost:${PORT}` }, HOST, PORT),
    ).toBe(LOCAL_FALLBACK)
  })

  it('honours an explicit target, production included', () => {
    // production-smoke выставляет таргет сам — явный прод обязан работать.
    expect(resolveApiProxyTarget({ E2E_API_PROXY_TARGET: 'https://metravel.by' }, HOST, PORT)).toBe(
      'https://metravel.by/',
    )
    expect(resolveApiProxyTarget({ E2E_API_URL: 'http://localhost:8000' }, HOST, PORT)).toBe(
      'http://localhost:8000/',
    )
  })

  it('prefers an explicit proxy target over the inherited API url', () => {
    expect(
      resolveApiProxyTarget(
        { E2E_API_PROXY_TARGET: 'http://localhost:8000', EXPO_PUBLIC_API_URL: 'https://metravel.by' },
        HOST,
        PORT,
      ),
    ).toBe('http://localhost:8000/')
  })
})

// Продакшен-nginx раскладывает `/quests/<city>/<questId>` на
// `/quests/[city]/[questId].html` (nginx.conf:685). Локальный сервер обязан
// резолвить так же: со списком имён `['[param]', '[id]']` этот маршрут молча
// отдавался домашней оболочкой, и e2e мерил чужую страницу.
describe('static route fallback for exported dynamic segments', () => {
  const candidatePaths = (pathname: string) =>
    getDynamicRouteFallbackCandidates(pathname, path.join(buildDir, pathname)).map(
      (candidate: { filePath: string }) => path.relative(buildDir, candidate.filePath),
    )

  it('resolves a route whose dynamic segments are not named [param] or [id]', () => {
    expect(candidatePaths('/quests/minsk/old-town')).toContain(
      path.join('quests', '[city]', '[questId].html'),
    )
  })

  it('keeps resolving the single-segment travel route', () => {
    expect(candidatePaths('/travels/some-slug')).toContain(path.join('travels', '[param].html'))
  })

  it('carries the requested segment values as replacements', () => {
    const [candidate] = getDynamicRouteFallbackCandidates(
      '/quests/minsk/old-town',
      path.join(buildDir, 'quests', 'minsk', 'old-town'),
    )

    expect(candidate.replacements).toEqual({ '[city]': 'minsk', '[questId]': 'old-town' })
  })

  it('offers nothing for a route the build never exported', () => {
    expect(candidatePaths('/definitely/not/a/route')).toEqual([])
  })

  it('ignores asset paths that already carry an extension', () => {
    expect(candidatePaths('/_expo/static/js/web/[param]-hash.js')).toEqual([])
  })
})
