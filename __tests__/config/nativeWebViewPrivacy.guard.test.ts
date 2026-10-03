import { existsSync, readdirSync, readFileSync } from 'fs'
import path from 'path'

import { THIRD_PARTY_WEBVIEW_PRIVACY_PROPS } from '@/utils/thirdPartyWebViewPrivacy'

/**
 * #2135 / App Review 5.1.2(i): ни одна WebView приложения не хранит и не передаёт
 * cookies стороннего веб-контента. Каждый файл, импортирующий
 * `react-native-webview`, обязан быть классифицирован ниже — новая WebView без
 * решения роняет тест, а не уезжает в сборку молча.
 */

const ROOT = path.resolve(__dirname, '../..')
const SOURCE_DIRS = ['app', 'components', 'screens', 'hooks', 'utils', 'context', 'stores', 'ui']

/** Сторонний удалённый контент: обязан применять `THIRD_PARTY_WEBVIEW_PRIVACY_PROPS`. */
const THIRD_PARTY_CONTENT_WEBVIEWS: Record<string, string> = {
  'components/belkraj/BelkrajWidget.native.tsx': 'партнёрский виджет belkraj.by',
  'components/travel/details/sections/LazyYouTubeSection.native.tsx': 'плеер YouTube (iframe youtube.com)',
}

/** Собственный HTML приложения (карты Leaflet, редактор): стороннего сайта внутри нет. */
const FIRST_PARTY_HTML_WEBVIEWS: Record<string, string> = {
  'components/MapPage/Map.ios.tsx': 'карта /map: собственный HTML Leaflet, тайлы через прокси приложения',
  'components/MapPage/TravelMap.native.tsx': 'карта статьи: собственный HTML Leaflet',
  'components/quests/QuestFullMap.native.tsx': 'карта квеста: собственный HTML Leaflet',
  'components/travel/stepRoute/NativeRoutePickerMap.native.tsx': 'выбор точек маршрута: собственный HTML Leaflet',
  'components/article/ArticleEditor.ios.tsx': 'редактор статьи: собственный HTML редактора',
}

/** Решено обходиться без WebView: возврат WebView требует нового решения по 5.1.2(i). */
const NO_WEBVIEW_BY_DECISION: Record<string, string> = {
  'components/iframe/InstagramEmbed.native.tsx':
    'embed Instagram несёт cookie-согласие и логирование Meta — карточка-ссылка (#2135)',
}

const WEBVIEW_IMPORT = /(?:from\s+['"]react-native-webview['"]|import\(\s*['"]react-native-webview['"]\s*\)|require\(\s*['"]react-native-webview['"]\s*\))/
const COOKIE_FLAG_ENABLED = /\b(?:sharedCookiesEnabled|thirdPartyCookiesEnabled)\b(?!\s*=\s*\{\s*false\s*\})(?!\s*:\s*false)/

const listSourceFiles = (dir: string): string[] => {
  const absolute = path.join(ROOT, dir)
  if (!existsSync(absolute)) return []
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') return []
      return listSourceFiles(relative)
    }
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [relative] : []
  })
}

const sourceFiles = SOURCE_DIRS.flatMap(listSourceFiles).map((file) => file.split(path.sep).join('/'))
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8')

/** Базовый `X.tsx` не попадает ни в один бандл, если рядом есть и native-, и web-вариант. */
const isShadowedByPlatformFiles = (file: string) => {
  if (/\.(native|ios|android|web)\.tsx?$/.test(file)) return false
  const base = file.replace(/\.tsx?$/, '')
  const has = (suffix: string) => ['.tsx', '.ts'].some((ext) => existsSync(path.join(ROOT, `${base}.${suffix}${ext}`)))
  const hasNative = has('native') || (has('ios') && has('android'))
  return hasNative && has('web')
}

const webViewFiles = sourceFiles.filter((file) => WEBVIEW_IMPORT.test(read(file)))

describe('native WebView privacy guard (#2135)', () => {
  it('pins the third-party WebView privacy contract', () => {
    expect(THIRD_PARTY_WEBVIEW_PRIVACY_PROPS).toEqual({
      incognito: true,
      sharedCookiesEnabled: false,
      thirdPartyCookiesEnabled: false,
    })
    expect(Object.isFrozen(THIRD_PARTY_WEBVIEW_PRIVACY_PROPS)).toBe(true)
  })

  it('classifies every file that imports react-native-webview', () => {
    const unclassified = webViewFiles.filter(
      (file) =>
        !(file in THIRD_PARTY_CONTENT_WEBVIEWS) &&
        !(file in FIRST_PARTY_HTML_WEBVIEWS) &&
        !isShadowedByPlatformFiles(file),
    )

    expect(unclassified).toEqual([])
  })

  it('applies the privacy props to every third-party content WebView', () => {
    for (const file of Object.keys(THIRD_PARTY_CONTENT_WEBVIEWS)) {
      const source = read(file)
      expect({ file, imports: /from ['"]@\/utils\/thirdPartyWebViewPrivacy['"]/.test(source) }).toEqual({
        file,
        imports: true,
      })
      expect({ file, spreads: /\{\.\.\.THIRD_PARTY_WEBVIEW_PRIVACY_PROPS\}\s*\/>/.test(source) }).toEqual({
        file,
        spreads: true,
      })
    }
  })

  it('never enables shared or third-party cookies in any WebView', () => {
    const offenders = webViewFiles.filter((file) => COOKIE_FLAG_ENABLED.test(read(file)))

    expect(offenders).toEqual([])
  })

  it('keeps decided surfaces free of WebView', () => {
    for (const file of Object.keys(NO_WEBVIEW_BY_DECISION)) {
      expect({ file, webView: WEBVIEW_IMPORT.test(read(file)) }).toEqual({ file, webView: false })
    }
  })

  it('keeps the registry free of stale entries', () => {
    const registered = [...Object.keys(THIRD_PARTY_CONTENT_WEBVIEWS), ...Object.keys(FIRST_PARTY_HTML_WEBVIEWS)]

    expect(registered.filter((file) => !webViewFiles.includes(file))).toEqual([])
  })
})
