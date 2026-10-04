import { readdirSync } from 'fs'
import path from 'path'

import {
  APP_PARAM_ROUTE_ROOTS,
  APP_ROUTE_ROOTS,
  isAppRoutePath,
  resolveAppRouteForSiteUrl,
  resolveSitePath,
  isSiteArticlePath,
} from '@/utils/siteLinks'

const APP_DIR = path.resolve(__dirname, '../../app')

/**
 * Корневые сегменты экранов expo-router из файловой системы `app/` и `app/(tabs)/`:
 * файлы-экраны (без `_layout`, `+html`, `+native-intent`, catch-all `[...missing]`)
 * и каталоги; каталог без index — экран только с параметром.
 */
const readRouteRoots = () => {
  const indexRoots = new Set<string>()
  const paramRoots = new Set<string>()
  for (const dir of [APP_DIR, path.join(APP_DIR, '(tabs)')]) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith('(')) continue
        const hasIndex = readdirSync(path.join(dir, entry.name)).some((name) => /^index(\.\w+)?\.tsx?$/.test(name))
        ;(hasIndex ? indexRoots : paramRoots).add(entry.name)
        continue
      }
      if (!/\.tsx?$/.test(entry.name)) continue
      const base = entry.name.replace(/\.tsx?$/, '').replace(/\.(web|native|ios|android)$/, '')
      if (/^[_+[]/.test(base)) continue
      indexRoots.add(base === 'index' ? '' : base)
    }
  }
  return { indexRoots, paramRoots }
}

describe('siteLinks', () => {
  it('keeps the app route allowlist in sync with the expo-router file tree', () => {
    const { indexRoots, paramRoots } = readRouteRoots()

    expect([...APP_ROUTE_ROOTS].sort()).toEqual([...indexRoots].sort())
    expect([...APP_PARAM_ROUTE_ROOTS].sort()).toEqual([...paramRoots].sort())
  })

  it('resolves own-site paths for relative and metravel.by URLs only', () => {
    expect(resolveSitePath('/travels/123')).toBe('/travels/123')
    expect(resolveSitePath('https://metravel.by/article/slug?x=1#h')).toBe('/article/slug?x=1#h')
    expect(resolveSitePath('https://www.metravel.by/travels/7')).toBe('/travels/7')
    expect(resolveSitePath('http://METRAVEL.BY/quests/minsk')).toBe('/quests/minsk')
    expect(resolveSitePath('https://metravel.by')).toBe('/')
    expect(resolveSitePath('about:///travels/oriavskii-zamok')).toBe('/travels/oriavskii-zamok')

    expect(resolveSitePath('https://evil-metravel.by/x')).toBeNull()
    expect(resolveSitePath('https://metravel.by.evil.com/x')).toBeNull()
    expect(resolveSitePath('//evil.com/path')).toBeNull()
    expect(resolveSitePath('mailto:a@b.by')).toBeNull()
    expect(resolveSitePath('#section')).toBeNull()
    expect(resolveSitePath(null)).toBeNull()
  })

  it('treats only paths with an app screen as app routes', () => {
    expect(isAppRoutePath('/')).toBe(true)
    expect(isAppRoutePath('/places?country=BY')).toBe(true)
    expect(isAppRoutePath('/quests/minsk/old-town')).toBe(true)
    expect(isAppRoutePath('/travels/forty-krakova')).toBe(true)
    expect(isAppRoutePath('/user/42')).toBe(true)

    expect(isAppRoutePath('/travels')).toBe(false)
    expect(isAppRoutePath('/board')).toBe(false)
    expect(isAppRoutePath('/api/travels/1/')).toBe(false)
    expect(isAppRoutePath('/media/x.jpg')).toBe(false)
    expect(isAppRoutePath('/achievements/901')).toBe(false)
  })

  it('returns the app route without the hash (NATIVE_COMPAT_RULES §9)', () => {
    expect(resolveAppRouteForSiteUrl('https://metravel.by/travels/slug?returnTo=%2Fsearch#points')).toBe(
      '/travels/slug?returnTo=%2Fsearch',
    )
    expect(resolveAppRouteForSiteUrl('https://metravel.by/#top')).toBe('/')
    expect(resolveAppRouteForSiteUrl('https://metravel.by/board')).toBeNull()
    expect(resolveAppRouteForSiteUrl('https://example.com/travels/slug')).toBeNull()
  })
})

describe('isSiteArticlePath (#2144)', () => {
  it.each(['/travel/1', '/travels/slug?x=1', '/article/post', '/articles/post#h'])('%s — статья', (path) => {
    expect(isSiteArticlePath(path)).toBe(true)
  })

  it.each(['/travels', '/travels/', '/quests/minsk', '/media/x.jpg', '/', ''])('%s — не статья', (path) => {
    expect(isSiteArticlePath(path)).toBe(false)
  })
})
