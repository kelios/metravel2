/**
 * #1221: og:image / twitter:image / JSON-LD уходили «голым» ownership-URL без `?w=`,
 * а такой адрес отдаёт МАСТЕР с `no-store`: ownership-роуты объявлены
 * `X-Cache-Status: BYPASS`, кэшируемым ответ делает только ширина в URL. Замер прода
 * 2026-08-03: 6% медиа-запросов уходили без `w=` — 44 МБ за 4 ч 43 мин и самые
 * медленные ответы сайта (avg 18 с, max 58 с).
 */
import {
  DERIVATIVE_WIDTHS_BY_ROUTE,
  IMAGE_STORAGE_POLICY_V1,
  SOCIAL_PREVIEW_TARGET_WIDTH,
  socialPreviewWidthForRoute,
} from '@/constants/imageContract'
import { toLegacyResizePath } from '@/utils/mediaUrl'
import { normalizeOgImageUrl } from '@/utils/seo'

describe('социальное превью просит производную, а не мастер (#1221)', () => {
  const previousSiteUrl = process.env.EXPO_PUBLIC_SITE_URL

  beforeAll(() => {
    process.env.EXPO_PUBLIC_SITE_URL = 'https://metravel.by'
  })

  afterAll(() => {
    process.env.EXPO_PUBLIC_SITE_URL = previousSiteUrl
  })

  it('ступень семейства существует в его derivatives и не превышает целевую ширину', () => {
    for (const [route, widths] of DERIVATIVE_WIDTHS_BY_ROUTE) {
      const picked = socialPreviewWidthForRoute(route)
      expect({ route, picked, isDerivative: widths.includes(picked as number) }).toEqual({
        route,
        picked,
        isDerivative: true,
      })
      // Либо укладывается в целевую ширину, либо это самая мелкая ступень семейства,
      // у которого ступени такого размера нет вовсе.
      const withinTarget = (picked as number) <= SOCIAL_PREVIEW_TARGET_WIDTH
      expect({ route, picked, ok: withinTarget || picked === widths[0] }).toEqual({
        route,
        picked,
        ok: true,
      })
    }
  })

  it('ни одна ступень превью не совпадает с мастером профиля', () => {
    for (const profile of Object.values(IMAGE_STORAGE_POLICY_V1)) {
      for (const route of profile.routes) {
        expect({ route, picked: socialPreviewWidthForRoute(route) }).not.toEqual({
          route,
          picked: profile.master.width,
        })
      }
    }
  })

  it.each([
    ['gallery', 'https://metravel.by/gallery/8e643f0e.webp', 'https://metravel.by/gallery/8e643f0e.webp?w=1280'],
    [
      'address-image',
      'https://metravel.by/address-image/15850/conversions/8ed5a60e.webp',
      // Conversion-ключ уезжает на кэшируемый legacy-роут и СОХРАНЯЕТ ступень (#1873).
      'https://metravel.by/media-resize/legacy/15850/conversions/8ed5a60e.webp?w=960',
    ],
    [
      'quest-cover',
      'https://metravel.by/quest-cover/quests/71/main/c992a209.webp',
      'https://metravel.by/quest-cover/quests/71/main/c992a209.webp?w=800',
    ],
    [
      'travel-description-image',
      'https://metravel.by/travel-description-image/135/description/be0b1723.JPG',
      'https://metravel.by/travel-description-image/135/description/be0b1723.JPG?w=960',
    ],
  ])('%s получает ширину производной', (_route, input, expected) => {
    expect(normalizeOgImageUrl(input)).toBe(expected)
  })

  it('относительный путь тоже становится абсолютным и получает ширину', () => {
    expect(normalizeOgImageUrl('/travel-image/958/conversions/abc-thumb_200.jpg')).toBe(
      'https://metravel.by/media-resize/legacy/958/conversions/abc-thumb_200.jpg?w=1280',
    )
  })

  it('уже заданную ширину не переписывает — иначе появился бы второй адрес того же файла', () => {
    const withWidth = 'https://metravel.by/gallery/8e643f0e.webp?w=640'
    expect(normalizeOgImageUrl(withWidth)).toBe(withWidth)
  })

  it('статику и чужие хосты не трогает', () => {
    expect(normalizeOgImageUrl('/og-home.jpg')).toBe('https://metravel.by/og-home.jpg')
    expect(normalizeOgImageUrl('/assets/icons/logo_yellow_512x512.png')).toBe(
      'https://metravel.by/assets/icons/logo_yellow_512x512.png',
    )
    expect(normalizeOgImageUrl('https://example.com/pic.jpg')).toBe('https://example.com/pic.jpg')
  })

  it('http поднимается до https и получает ширину', () => {
    expect(normalizeOgImageUrl('http://metravel.by/gallery/abc.webp')).toBe(
      'https://metravel.by/gallery/abc.webp?w=1280',
    )
  })

  it('пустой вход остаётся null', () => {
    expect(normalizeOgImageUrl('')).toBeNull()
    expect(normalizeOgImageUrl(null)).toBeNull()
    expect(normalizeOgImageUrl(undefined)).toBeNull()
  })
})

/**
 * #1873: ступень (#1221) и кэшируемость — разные вещи, и до этой правки клиент
 * держал только первую. Ownership/family-роуты объявлены `x-cache-status: BYPASS`
 * в nginx: ответ со ступенью правильный и `immutable`, но не кэшируется, поэтому
 * каждый обход краулера и каждый шеринг заново гоняют ресайз в Django — на одном
 * vCPU с transform concurrency = 1. Замер прода 07.09.2026, ключ
 * `3860/conversions/…-detail_hd.jpg`: family с `?w=1280` — 83 182 B `BYPASS`;
 * тот же ключ на legacy-роуте — те же 83 182 B `MISS` → `HIT`.
 *
 * SSG увёл свою ветку в #1872, а клиентские писатели меты возвращали family-роут
 * поверх неё после гидрации — выигрыш жил только до выполнения JS.
 */
describe('адрес соцпревью — ступень семейства НА роуте читателя (#1873)', () => {
  const previousSiteUrl = process.env.EXPO_PUBLIC_SITE_URL

  beforeAll(() => {
    process.env.EXPO_PUBLIC_SITE_URL = 'https://metravel.by'
  })

  afterAll(() => {
    process.env.EXPO_PUBLIC_SITE_URL = previousSiteUrl
  })

  /** Ступень контракта и путь читателя — два независимых источника; композиция обязана дать оба. */
  const expectPreview = (input: string, family: string) => {
    const preview = new URL(normalizeOgImageUrl(input) as string)
    const expectedWidth = socialPreviewWidthForRoute(family)

    expect({ path: preview.pathname, width: preview.searchParams.get('w') }).toEqual({
      path: new URL(toLegacyResizePath(input) ?? input, 'https://metravel.by').pathname,
      width: expectedWidth === null ? null : String(expectedWidth),
    })
    return preview
  }

  it.each([
    ['https://metravel.by/gallery/3860/conversions/x-detail_hd.jpg', 'gallery'],
    ['https://metravel.by/travel-image/682/conversions/10f0a8f2.webp', 'travel-image'],
    ['https://metravel.by/travel-description-image/12/conversions/x.WEBP', 'travel-description-image'],
    ['https://metravel.by/address-image/15601/conversions/ee55dead.webp', 'address-image'],
    // `uploads/**` за family-роутом: свой legacy-роут, ступени у класса нет.
    ['https://metravel.by/gallery/uploads/1614096729IMG_6960.JPG', 'gallery'],
  ])('ступень семейства переживает переписывание роута: %s', (input, family) => {
    expect(expectPreview(input, family).pathname).toMatch(/^\/media-resize\//)
  })

  it.each([
    // Плоский корень — большинство обложек каталога: legacy-роута у класса нет.
    ['https://metravel.by/gallery/613eb392.jpg.webp', 'gallery'],
    // Роут, которого переписывание фронта не знает.
    ['https://metravel.by/quest-cover/9/conversions/x.webp', 'quest-cover'],
    // Класс, который legacy-роут не обслуживает.
    ['https://metravel.by/gallery/682/responsive-images/x.webp', 'gallery'],
  ])('класс без legacy-роута остаётся на своём адресе: %s', (input, family) => {
    expect(expectPreview(input, family).pathname).not.toMatch(/^\/media-resize\//)
  })

  it('обратный порядок терял бы ширину — перестановка шагов обязана краснеть (#1221)', () => {
    // Механизм регресса, а не его пересказ: у переписанного адреса первый сегмент
    // `media-resize`, и семейства с таким именем в контракте нет. Появись оно там —
    // перестановка стала бы незаметной, и этот expect об этом скажет.
    expect(DERIVATIVE_WIDTHS_BY_ROUTE.has('media-resize')).toBe(false)

    const rewrittenFirst = toLegacyResizePath(
      'https://metravel.by/gallery/3860/conversions/x-detail_hd.jpg',
    )
    expect(rewrittenFirst).toBe('/media-resize/legacy/3860/conversions/x-detail_hd.jpg')
    expect(socialPreviewWidthForRoute(String(rewrittenFirst).split('/')[1])).toBeNull()

    // И наблюдаемый выход композиции ширину несёт.
    expect(
      normalizeOgImageUrl('https://metravel.by/gallery/3860/conversions/x-detail_hd.jpg'),
    ).toBe('https://metravel.by/media-resize/legacy/3860/conversions/x-detail_hd.jpg?w=1280')
  })

  it('чужой хост и прямая ссылка в бакет не получают наш transform-роут', () => {
    // Построить чужому хосту наш роут значило бы выдать краулеру адрес, по
    // которому картинки нет вовсе. Ширину `withSocialPreviewWidth` ставит по
    // одному лишь первому сегменту пути и origin не смотрит — это его поведение
    // с #1221, и правка роута его не меняет.
    expect(normalizeOgImageUrl('https://example.com/gallery/1/conversions/y.jpg')).toBe(
      'https://example.com/gallery/1/conversions/y.jpg?w=1280',
    )

    // Ссылку в бакет обслуживает наш backend, но origin для неё берётся из
    // конфигурации, а не из адреса (`resolveLegacyResizeOrigin` отдаёт `null`),
    // и придумывать его здесь нельзя.
    expect(
      normalizeOgImageUrl(
        'https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/1614096729IMG_6960.JPG',
      ),
    ).toBe('https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/1614096729IMG_6960.JPG')
  })
})
