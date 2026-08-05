// #1261: Android — потребитель ТОГО ЖЕ контракта `media.article_body`, что и web.
//
// `StableContent.native.tsx` зовёт тот же `prepareStableContentHtml` с тем же
// индексом манифеста, поэтому снятие фронтового потолка семейств меняет native
// ровно так же, как web, и проверять это надо парно (правило platform impact в
// CLAUDE.md: mobile web и Android всегда вместе).
//
// Отдельный смысл теста — вьюпорта на native нет вовсе: `getWebViewportWidth`
// возвращает 0, слот считается мобильным, и ступень выбирается фолбэком. Именно
// на этой ветке клиентский клэмп никогда не срабатывал (мобильный набор кончается
// на 800, потолок `route_point` — 960), так что регресс тут был бы незаметен.
import { Dimensions, Platform } from 'react-native'

jest.mock('@/utils/sanitizeRichText', () => ({
  sanitizeRichText: jest.fn((html: string) => html),
}))

jest.mock('@/components/article/articleEditorConfig', () => ({
  normalizeArticleEditorHtmlForInput: jest.fn((html: string) => html),
}))

import { buildArticleBodyMediaIndex } from '@/components/travel/stableContent/articleBodyMedia'
import { prepareStableContentHtml } from '@/components/travel/stableContent/htmlTransform'
import {
  ARTICLE_BODY_ADDRESS_IMAGE_URL,
  ARTICLE_BODY_DESCRIPTION_IMAGE_URL,
  ARTICLE_BODY_LEGACY_UPLOAD_URL,
  PROD_ARTICLE_BODY_GROUP,
  ROUTE_POINT_MANIFEST_WIDTHS,
} from '@/__tests__/fixtures/prodArticleBodyManifest'

const MEDIA = buildArticleBodyMediaIndex(PROD_ARTICLE_BODY_GROUP)

/** Экран телефона: ширина слота тела статьи на Android (#1268). */
const PHONE_WINDOW = { width: 411, height: 890, scale: 2.625, fontScale: 1 }
/** Планшет: тот же native, но слот уже десктопный. */
const TABLET_WINDOW = { width: 1024, height: 1366, scale: 2, fontScale: 1 }
/** Потолок мобильного набора `IMAGE_WIDTHS.articleBodyMobile`. */
const MOBILE_LADDER_MAX = 800

const withNativeWindow = <T,>(window: typeof PHONE_WINDOW, run: () => T): T => {
  const originalOs = Platform.OS
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true })
  const dimensions = jest.spyOn(Dimensions, 'get').mockReturnValue(window as any)
  try {
    return run()
  } finally {
    dimensions.mockRestore()
    Object.defineProperty(Platform, 'OS', { value: originalOs, configurable: true })
  }
}

const withAndroid = <T,>(run: () => T): T => withNativeWindow(PHONE_WINDOW, run)

const prepare = (rawSrc: string) =>
  withAndroid(() =>
    prepareStableContentHtml(`<p><img src="${rawSrc}" /></p>`, { articleBodyMedia: MEDIA }),
  )

const emittedWidths = (html: string): number[] =>
  Array.from(new Set(Array.from(html.matchAll(/[?&]w=(\d+)/g), (m) => Number(m[1])))).sort(
    (a, b) => a - b,
  )

describe('Android потребляет тот же media.article_body, что и web (#1261)', () => {
  it('берёт адреса из манифеста, а не собирает их сам', () => {
    const out = prepare(ARTICLE_BODY_DESCRIPTION_IMAGE_URL)

    expect(out).not.toContain('q=80')
    expect(out).not.toContain('fit=contain')
    expect(out).toContain(ARTICLE_BODY_DESCRIPTION_IMAGE_URL)
  })

  it('ключ чужого семейства не просит ступеней, которых нет в манифесте', () => {
    const out = prepare(ARTICLE_BODY_ADDRESS_IMAGE_URL)
    const emitted = emittedWidths(out)

    expect(emitted.length).toBeGreaterThan(0)
    // Ни одной ширины мимо лестницы манифеста — прежде это держал фронтовой потолок.
    for (const width of emitted) {
      expect(ROUTE_POINT_MANIFEST_WIDTHS).toContain(width)
    }
    expect(Math.max(...emitted)).toBeLessThanOrEqual(
      ROUTE_POINT_MANIFEST_WIDTHS[ROUTE_POINT_MANIFEST_WIDTHS.length - 1],
    )
  })

  // #1268: слот на native — экран телефона, а не «десктоп по умолчанию». Раньше
  // `isMobileWebViewport()` требовал `Platform.OS === 'web'`, поэтому на Android
  // ширина вьюпорта была 0 всегда, слот считался десктопным и в мобильный канал
  // уезжали ступени до 1600.
  it('слот на native считается мобильным: ступеней выше мобильного набора нет', () => {
    const emitted = emittedWidths(prepare(ARTICLE_BODY_DESCRIPTION_IMAGE_URL))

    expect(emitted.length).toBeGreaterThan(0)
    expect(Math.max(...emitted)).toBeLessThanOrEqual(MOBILE_LADDER_MAX)
  })

  // Планшет — тот же native, но слот там реально десктопный: набор выбирается по
  // ширине окна, а не по платформе.
  it('на широком окне native берёт десктопный набор', () => {
    const out = withNativeWindow(TABLET_WINDOW, () =>
      prepareStableContentHtml(`<p><img src="${ARTICLE_BODY_DESCRIPTION_IMAGE_URL}" /></p>`, {
        articleBodyMedia: MEDIA,
      }),
    )

    expect(Math.max(...emittedWidths(out))).toBeGreaterThan(MOBILE_LADDER_MAX)
  })

  // Смена набора меняет только лестницу: `src` — единственный атрибут, который
  // читает native-рендерер (`CustomImageRenderer` берёт `srcset` лишь когда `src`
  // пуст), поэтому фактически скачиваемый кадр остался прежним.
  it('атрибут src не изменился — native скачивает тот же кадр', () => {
    const out = prepare(ARTICLE_BODY_DESCRIPTION_IMAGE_URL)
    const src = /<img[^>]*\ssrc="([^"]+)"/.exec(out)?.[1]

    expect(src).toContain('w=800')
  })

  it('legacy-класс uploads/** остаётся на клиентской ветке и на Android', () => {
    const out = prepare(ARTICLE_BODY_LEGACY_UPLOAD_URL)

    expect(out).not.toContain('metravelprod.s3')
    expect(out).toContain('/media-resize/uploads/1591620319350_original.jpg')
    expect(out).toContain('f=jpeg')
  })
})
