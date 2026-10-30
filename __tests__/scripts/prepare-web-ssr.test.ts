const fs = require('fs')
const path = require('path')
const { shellRoute, publicConfig, writePublicConfig, sharedCriticalCss, writeSharedCss, renderLegacyShells } = require('@/scripts/prepare-web-ssr')
const { externalizeHeadStyles } = require('@/scripts/externalize-head-styles')
const { makeTempDir } = require('./cli-test-utils')

const CRITICAL = `body{margin:0}${'.x{color:red}'.repeat(300)}`
const shell = (css: string) => `<html><head><style id="metravel-critical-css">${css}</style><style id="react-native-stylesheet">${'.r{}'.repeat(900)}</style></head><body><div id="root"></div></body></html>`

describe('one-export SSR transition', () => {
  it('keeps legacy file names while resolving layout groups and index URLs', () => {
    expect(shellRoute({ page: '/(tabs)/index' })).toEqual({ file: 'index.html', pathname: '/', params: {} })
    expect(shellRoute({ page: '/(tabs)/quests/[city]/index' })).toEqual({
      file: 'quests/[city]/index.html', pathname: '/quests/[city]', params: { city: '[city]' },
    })
    expect(shellRoute({ page: '/(tabs)/travels/[param]' })).toEqual({
      file: 'travels/[param].html', pathname: '/travels/[param]', params: { param: '[param]' },
    })
    expect(shellRoute({ page: '/[...missing]' })).toEqual({
      file: '[...missing].html', pathname: '/[...missing]', params: { missing: ['[...missing]'] },
    })
  })

  it('rejects route output paths outside the static artifact', () => {
    expect(() => shellRoute({ page: '/../private' })).toThrow('Invalid SSR route path')
    expect(() => shellRoute({ page: '/foo\\bar' })).toThrow('Invalid SSR route path')
  })

  it('publishes concrete catalogue book documents with the same renderer, parameters and assets', async () => {
    const root = makeTempDir('ssr-book-publication-')
    const renderer = path.join(root, 'renderer.cjs')
    const calls = path.join(root, 'calls.jsonl')
    fs.writeFileSync(renderer, `
      const fs = require('node:fs');
      const record = (call) => fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify(call) + '\\n');
      exports.resolveMetadata = async (input) => { record({kind:'metadata', ...input}); return {slug:input.params.slug}; };
      exports.getStreamingContent = async (url, input) => {
        record({kind:'render', url:String(url), ...input});
        return '<html><head></head><body><div id="root">'+JSON.stringify(input.params)+'</div></body></html>';
      };
    `)
    const bookRoute = { file: 'books-route.js', page: '/(tabs)/books/[slug]', assets: { js: ['/books.js'], css: ['/books.css'] } }
    const manifest = {
      htmlRoutes: [{ file: 'index.js', page: '/(tabs)/index' }, bookRoute,
        { file: 'travel.js', page: '/(tabs)/travels/[param]', loader: true }],
      notFoundRoutes: [{ file: 'missing.js', page: '/[...missing]', generated: true }],
      assets: { js: ['/entry.js'], css: ['/base.css'], favicon: '/favicon.ico' },
    }
    const books = require('@/data/travelBooks/manifest.json').books as { slug: string }[]
    try {
      expect(await renderLegacyShells(renderer, { manifest, staticDir: root })).toBe(4 + books.length)
      const recorded = fs.readFileSync(calls, 'utf8').trim().split('\n').map((line: string) => JSON.parse(line))
      for (const { slug } of books) {
        const document = fs.readFileSync(path.join(root, 'books', `${slug}.html`), 'utf8')
        expect(document).toContain(JSON.stringify({ slug }))
        expect(recorded.find((call: any) => call.kind === 'metadata' && call.params.slug === slug)).toEqual({
          kind: 'metadata', route: { file: bookRoute.file, page: bookRoute.page }, params: { slug },
        })
        expect(recorded.find((call: any) => call.url === `https://metravel.by/books/${slug}`)).toMatchObject({
          kind: 'render', route: { file: bookRoute.file, page: bookRoute.page }, params: { slug }, metadata: { slug },
          assets: { js: ['/entry.js', '/books.js'], css: ['/base.css', '/books.css'], favicon: '/favicon.ico' }, output: 'static',
        })
      }
      expect(recorded.find((call: any) => call.url === 'https://metravel.by/travels/[param]')).toMatchObject({
        params: { param: '[param]' }, loader: { data: null, key: '/(tabs)/travels/[param]' },
      })
      expect(recorded.filter((call: any) => call.kind === 'metadata')).toHaveLength(3 + books.length)
      expect(fs.existsSync(path.join(root, 'books', 'unknown.html'))).toBe(false)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('packages only public configuration, with the same loader-aware client flag', () => {
    expect(publicConfig(undefined, {
      EXPO_PUBLIC_API_URL: 'https://metravel.by',
      EXPO_PUBLIC_WEB_RUNTIME_SSR: 'false',
      SSR_API_ORIGIN: 'http://private-api:8000',
      DATABASE_PASSWORD: 'private',
    })).toEqual({
      EXPO_PUBLIC_API_URL: 'https://metravel.by',
      EXPO_PUBLIC_WEB_RUNTIME_SSR: 'true',
    })
  })

  it('writes the public configuration readable by the backend gateway uid', () => {
    const dir = makeTempDir('ssr-env-')
    const file = writePublicConfig(dir, { EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR: 'true' })
    expect(fs.statSync(file).mode & 0o777).toBe(0o644)
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR: 'true' })
    fs.chmodSync(file, 0o600)
    expect(fs.statSync(writePublicConfig(dir, {})).mode & 0o777).toBe(0o644)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('derives the shared critical CSS file from the rendered shell with the static externalizer name', () => {
    const asset = sharedCriticalCss(shell(CRITICAL))
    const staticName = externalizeHeadStyles(shell(CRITICAL)).assets.find((a: { fileName: string }) => a.fileName.startsWith('critical-')).fileName
    expect(asset).toEqual({ fileName: staticName, css: CRITICAL })
    expect(asset.fileName).toMatch(/^critical-[a-f0-9]{16}\.css$/)
    expect(() => sharedCriticalCss('<html><head></head><body></body></html>')).toThrow('no shared critical CSS')
  })

  it('writes the shared file once and refuses a same-name file with other content', () => {
    const root = makeTempDir('ssr-critical-')
    try {
      const asset = sharedCriticalCss(shell(CRITICAL))
      writeSharedCss(root, asset)
      writeSharedCss(root, asset)
      const target = path.join(root, '_expo/static/css', asset.fileName)
      expect(fs.readFileSync(target, 'utf8')).toBe(CRITICAL)
      fs.writeFileSync(target, 'body{}')
      expect(() => writeSharedCss(root, asset)).toThrow('differs from the rendered shell')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
