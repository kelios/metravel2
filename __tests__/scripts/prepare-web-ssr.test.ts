const fs = require('fs')
const os = require('os')
const path = require('path')
const { shellRoute, publicConfig, sharedCriticalCss, writeSharedCss } = require('@/scripts/prepare-web-ssr')
const { externalizeHeadStyles } = require('@/scripts/externalize-head-styles')

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

  it('derives the shared critical CSS file from the rendered shell with the static externalizer name', () => {
    const asset = sharedCriticalCss(shell(CRITICAL))
    const staticName = externalizeHeadStyles(shell(CRITICAL)).assets.find((a: { fileName: string }) => a.fileName.startsWith('critical-')).fileName
    expect(asset).toEqual({ fileName: staticName, css: CRITICAL })
    expect(asset.fileName).toMatch(/^critical-[a-f0-9]{16}\.css$/)
    expect(() => sharedCriticalCss('<html><head></head><body></body></html>')).toThrow('no shared critical CSS')
  })

  it('writes the shared file once and refuses a same-name file with other content', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ssr-critical-'))
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
