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
import { Platform } from 'react-native'

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

const withAndroid = <T,>(run: () => T): T => {
  const originalOs = Platform.OS
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true })
  try {
    return run()
  } finally {
    Object.defineProperty(Platform, 'OS', { value: originalOs, configurable: true })
  }
}

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

  // ЗАФИКСИРОВАНО КАК ЕСТЬ, а не как хотелось бы: `isMobileWebViewport()` требует
  // `Platform.OS === 'web'`, поэтому на native слот всегда считается ДЕСКТОПНЫМ и
  // тело статьи на Android тянет ступени до 1600 в мобильный канал. Поведение
  // существует до #1261 (та же ветка на HEAD) и этой задачей не менялось: раньше
  // потолок семейства `article_body` тоже был 1600. Трогать это здесь нельзя —
  // смена набора меняет native-трафик и требует замера на устройстве, поэтому
  // заведена отдельная задача #1268. Тест держит поведение зафиксированным, чтобы
  // «починка» не проехала молча.
  it('слот на native считается десктопным — известное поведение, не регресс #1261', () => {
    expect(Math.max(...emittedWidths(prepare(ARTICLE_BODY_DESCRIPTION_IMAGE_URL)))).toBe(1600)
  })

  it('legacy-класс uploads/** остаётся на клиентской ветке и на Android', () => {
    const out = prepare(ARTICLE_BODY_LEGACY_UPLOAD_URL)

    expect(out).not.toContain('metravelprod.s3')
    expect(out).toContain('/media-resize/uploads/1591620319350_original.jpg')
    expect(out).toContain('f=jpeg')
  })
})
