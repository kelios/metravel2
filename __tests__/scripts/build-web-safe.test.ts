const fs = require('fs')
const path = require('path')
const { makeTempDir } = require('./cli-test-utils')

const {
  createIsolatedExpoTempDir,
  getExpoExportArgs,
  getPassthroughArgs,
  hasPlatformFlag,
  hasClearFlag,
  assertServerExport,
} = require('@/scripts/build-web-safe')
const { resolveWebOutput } = require('@/scripts/lib/webOutput')
const { getOutputDir } = require('@/scripts/build-web-ssr')
const { resolveClientFile } = require('@/scripts/serve-web-ssr')

describe('build-web-safe helpers', () => {
  const projectRoot = process.cwd()
  const fixtures: string[] = []

  function serverFixture() {
    const scratch = path.join(projectRoot, '.codex-temp')
    fs.mkdirSync(scratch, { recursive: true })
    const dir = makeTempDir('ssr-artifact-test-', { root: scratch })
    fixtures.push(dir)
    const files = {
      'server/_expo/server/render.js': 'exports.getStreamingContent = () => null',
      'server/_expo/loaders/travels/[param].js': 'exports.loader = () => null',
      'client/_expo/static/js/web/entry-test.js': 'console.log("entry")',
      'client/_expo/static/js/web/travel-test.js': 'console.log("travel")',
    }
    for (const [name, contents] of Object.entries(files)) {
      const file = path.join(dir, name)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, contents)
    }
    const manifest = {
      rendering: { mode: 'ssr', file: '_expo/server/render.js' },
      assets: { css: [], js: ['/_expo/static/js/web/entry-test.js'] },
      htmlRoutes: [{
        file: './travels/[param].web.tsx', page: '/travels/[param]', namedRegex: '^/travels/([^/]+)$',
        loader: '_expo/loaders/travels/[param].js',
        assets: { css: [], js: ['/_expo/static/js/web/travel-test.js'] },
      }],
      apiRoutes: [], notFoundRoutes: [],
    }
    const manifestPath = path.join(dir, 'server/_expo/routes.json')
    fs.writeFileSync(manifestPath, JSON.stringify(manifest))
    return { dir, manifest, manifestPath }
  }

  afterEach(() => {
    for (const fixture of fixtures.splice(0)) fs.rmSync(fixture, { recursive: true, force: true })
    // Удаляем ТОЛЬКО созданную этим тестом детерминированную папку (run-123-456),
    // не трогая .tmp/expo-export целиком: туда параллельно может писать реальный
    // build/preview-процесс (его metro-cache), и рекурсивный rmSync всего дерева
    // гонится с конкурентной записью → ENOTEMPTY (флака).
    const ownDir = path.join(projectRoot, '.tmp', 'expo-export', 'run-123-456')
    try {
      fs.rmSync(ownDir, { recursive: true, force: true })
    } catch {
      // best-effort cleanup
    }
  })

  it('detects Expo clear-cache flags', () => {
    expect(hasClearFlag(['-p', 'web'])).toBe(false)
    expect(hasClearFlag(['-p', 'web', '-c'])).toBe(true)
    expect(hasClearFlag(['-p', 'web', '--clear'])).toBe(true)
  })

  it('detects explicit platform flags', () => {
    expect(hasPlatformFlag(['-p', 'web'])).toBe(true)
    expect(hasPlatformFlag(['--platform', 'ios'])).toBe(true)
    expect(hasPlatformFlag(['--platform=android'])).toBe(true)
    expect(hasPlatformFlag(['--clear'])).toBe(false)
  })

  it('uses output-dir for readiness checks and passes it to Expo export', () => {
    const args = ['-p', 'web', '--output-dir', 'custom-dist', '-c']

    expect(getPassthroughArgs(args)).toEqual(['-p', 'web', '-c'])
    expect(getExpoExportArgs(args, 'custom-dist')).toEqual([
      '-p',
      'web',
      '-c',
      '--output-dir',
      'custom-dist',
    ])
  })

  it('defaults Expo export to web when platform is omitted', () => {
    expect(getExpoExportArgs(['--output-dir', 'custom-dist'], 'custom-dist')).toEqual([
      '-p',
      'web',
      '--output-dir',
      'custom-dist',
    ])
  })

  it('creates a deterministic isolated temp dir inside the repo', () => {
    const tempDir = createIsolatedExpoTempDir(projectRoot, 123, 456)

    expect(tempDir).toBe(path.join(projectRoot, '.tmp', 'expo-export', 'run-123-456'))
    expect(fs.existsSync(tempDir)).toBe(true)
  })

  it('requires both SSR mode switches and rejects malformed values', () => {
    expect(resolveWebOutput({})).toBe('static')
    expect(resolveWebOutput({ METRAVEL_WEB_OUTPUT: 'server', EXPO_PUBLIC_WEB_RUNTIME_SSR: 'true' })).toBe('server')
    expect(() => resolveWebOutput({ METRAVEL_WEB_OUTPUT: 'server' })).toThrow('requires')
    expect(() => resolveWebOutput({ EXPO_PUBLIC_WEB_RUNTIME_SSR: 'true' })).toThrow('requires')
    expect(() => resolveWebOutput({ METRAVEL_WEB_OUTPUT: 'static-ish' })).toThrow('must be')
    expect(() => resolveWebOutput({ EXPO_PUBLIC_WEB_RUNTIME_SSR: '1' })).toThrow('must be')
  })

  it('validates renderer, loader and every referenced client bundle without index.html', () => {
    const { dir } = serverFixture()
    expect(assertServerExport(dir)).toMatchObject({ modules: 2, assets: 2 })
    fs.rmSync(path.join(dir, 'server/_expo/loaders/travels/[param].js'))
    expect(() => assertServerExport(dir)).toThrow()
  })

  it('rejects missing per-route assets even when the entry bundle exists', () => {
    const { dir } = serverFixture()
    fs.rmSync(path.join(dir, 'client/_expo/static/js/web/travel-test.js'))
    expect(() => assertServerExport(dir)).toThrow()
  })

  it('rejects server paths outside the artifact and a static manifest', () => {
    const { dir, manifest, manifestPath } = serverFixture()
    manifest.rendering.file = '../client/_expo/static/js/web/entry-test.js'
    fs.writeFileSync(manifestPath, JSON.stringify(manifest))
    expect(() => assertServerExport(dir)).toThrow('escapes')
    manifest.rendering.mode = 'static'
    fs.writeFileSync(manifestPath, JSON.stringify(manifest))
    expect(() => assertServerExport(dir)).toThrow('SSR routes manifest')
  })

  // Expo listed `[city]/[questId]` first, so the server rendered
  // /quests/country/belarus with the quest-detail route (no H1, wrong screen).
  it('orders server routes so a static segment wins over a dynamic one', () => {
    const { orderServerRoutes } = require('@/scripts/lib/webServerArtifact')
    const { dir, manifest, manifestPath } = serverFixture()
    const route = manifest.htmlRoutes[0]
    const pages = ['/[...missing]', '/(tabs)/quests/[city]/[questId]', '/(tabs)/quests/[city]/index',
      '/(tabs)/quests/country/[country]/index', '/(tabs)/quests/theme/[theme]', '/(tabs)/quests/index']
    manifest.htmlRoutes = pages.map((page) => ({ ...route, page }))
    fs.writeFileSync(manifestPath, JSON.stringify(manifest))
    expect(() => assertServerExport(dir)).toThrow('specificity order')
    orderServerRoutes(dir)
    expect(assertServerExport(dir).manifest.htmlRoutes.map((entry: { page: string }) => entry.page)).toEqual([
      '/(tabs)/quests/index', '/(tabs)/quests/country/[country]/index', '/(tabs)/quests/theme/[theme]',
      '/(tabs)/quests/[city]/index', '/(tabs)/quests/[city]/[questId]', '/[...missing]'])
  })

  it('keeps the independent SSR build away from production, root and scratch root', () => {
    expect(getOutputDir([])).toBe(path.join(projectRoot, '.codex-temp/ssr-2766'))
    expect(() => getOutputDir(['--output-dir', 'dist/prod'])).toThrow('inside .codex-temp')
    expect(() => getOutputDir(['--output-dir', '.'])).toThrow('inside .codex-temp')
    expect(() => getOutputDir(['--output-dir', '.codex-temp'])).toThrow('inside .codex-temp')
    expect(() => getOutputDir(['--output-dir'])).toThrow('Usage')
  })

  it('does not follow an output symlink into the source checkout', () => {
    const { dir } = serverFixture()
    const linked = path.join(dir, 'linked-source')
    fs.symlinkSync(projectRoot, linked, 'dir')
    expect(() => getOutputDir(['--output-dir', path.join(linked, 'new-output')])).toThrow('symlink outside')
  })

  it('serves client assets without exposing server code, dot files or loader modules', () => {
    const { dir } = serverFixture()
    const client = path.join(dir, 'client')
    expect(resolveClientFile(client, '/_expo/static/js/web/entry-test.js')).toBe(path.join(client, '_expo/static/js/web/entry-test.js'))
    expect(resolveClientFile(client, '/../server/_expo/server/render.js')).toBeNull()
    expect(resolveClientFile(client, '/.ssr-env.json')).toBeNull()
    expect(resolveClientFile(client, '/_expo/loaders/travels/example')).toBeNull()
    fs.symlinkSync(path.join(dir, 'server/_expo/server/render.js'), path.join(client, 'leak.js'))
    expect(resolveClientFile(client, '/leak.js')).toBeNull()
  })
})
