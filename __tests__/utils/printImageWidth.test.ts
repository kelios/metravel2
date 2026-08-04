/**
 * Печать просила ширину, которой у семейства нет, и книга уходила с дырами.
 *
 * `PRINT_IMAGE_INLINE_WIDTH` (1600) и `PRINT_IMAGE_FULL_WIDTH` (2500) — это ЖЕЛАЕМАЯ
 * ширина, а не обещание storage-профиля. У `routePoint` (`address-image`) производные
 * кончаются на 960, мастер — 1200. Пока чтение производных было fail-open, прокси
 * дорезал недостающую ступень; после `MEDIA_IMAGE_DERIVATIVE_READ_ENABLED` он
 * отвечает 400 — тот же fail-closed, что уронил соцпревью в #1224.
 *
 * Замер прода 2026-08-04, `address-image/15057/conversions/4cd326b4….webp`:
 * `w=960|1200` → 200, `w=1600|1920|2500` → **400** (52 B). В книге это давало два
 * симптома одной причины: в теле travel 682 пропадали 14 из 37 фото (все точки —
 * `address-image`), а карточки координат оставались пустыми плитками с alt-текстом,
 * потому что разметка прячет `<img>` по `onerror`.
 */
import {
  familyRouteFromPathname,
  IMAGE_STORAGE_POLICY_V1,
  printWidthForRoute,
  REQUESTABLE_WIDTHS_BY_ROUTE,
} from '@/constants/imageContract'
import {
  buildPrintImageFallbackUrl,
  buildPrintImageOnError,
  buildPrintImageUrl,
  PRINT_IMAGE_FULL_WIDTH,
  PRINT_IMAGE_INLINE_WIDTH,
  PRINT_IMAGE_THUMB_WIDTH,
} from '@/utils/printImageUrl'

const ADDRESS_IMAGE =
  'https://metravel.by/address-image/15057/conversions/4cd326b470a94f6690c7ead794bbf320.webp'
const GALLERY_IMAGE =
  'https://metravel.by/gallery/3788/conversions/7TvKlrOnaI3n1j7q0OA0ZHAwxldhu1VOfqgkju1T-detail_hd.jpg'

const widthOf = (url: string): number => Number(new URL(url).searchParams.get('w'))

describe('печатная ширина не выходит за контракт семейства', () => {
  const printTargets = [PRINT_IMAGE_FULL_WIDTH, PRINT_IMAGE_INLINE_WIDTH, PRINT_IMAGE_THUMB_WIDTH]

  it('любая печатная цель попадает в ширины, которые роут обслуживает', () => {
    for (const [route, servedWidths] of REQUESTABLE_WIDTHS_BY_ROUTE) {
      for (const target of printTargets) {
        const picked = printWidthForRoute(route, target)
        expect({ route, target, picked, served: servedWidths.includes(picked as number) }).toEqual({
          route,
          target,
          picked,
          served: true,
        })
      }
    }
  })

  it('берёт наименьшую подходящую ступень, а не всегда мастер', () => {
    // articleBody: производные …960, 1600; мастер 1920.
    expect(printWidthForRoute('travel-description-image', PRINT_IMAGE_INLINE_WIDTH)).toBe(1600)
    expect(printWidthForRoute('travel-description-image', PRINT_IMAGE_THUMB_WIDTH)).toBe(320)
    // Выше всех производных — остаётся мастер.
    expect(printWidthForRoute('travel-description-image', PRINT_IMAGE_FULL_WIDTH)).toBe(1920)
  })

  it('routePoint не получает 1600: у него нет такой ступени (замер прода → 400)', () => {
    const picked = printWidthForRoute('address-image', PRINT_IMAGE_INLINE_WIDTH)
    expect(picked).toBe(IMAGE_STORAGE_POLICY_V1.routePoint.master.width)
    expect(picked).toBeLessThan(PRINT_IMAGE_INLINE_WIDTH)
  })

  it('путь вне семейств ширину из контракта не получает — решает вызывающий', () => {
    expect(printWidthForRoute('media-resize', PRINT_IMAGE_INLINE_WIDTH)).toBeNull()
    expect(familyRouteFromPathname('/media-resize/legacy/3508/conversions/x.jpg')).toBe(
      'media-resize',
    )
    expect(familyRouteFromPathname('/single-segment')).toBeNull()
  })
})

describe('buildPrintImageUrl', () => {
  it('миниатюра точки просит ступень своего слота, а не inline-ширину', () => {
    expect(widthOf(buildPrintImageUrl(ADDRESS_IMAGE, PRINT_IMAGE_THUMB_WIDTH))).toBe(
      PRINT_IMAGE_THUMB_WIDTH,
    )
  })

  it('фото точки в теле статьи зажимается мастером семейства вместо битых 1600', () => {
    expect(widthOf(buildPrintImageUrl(ADDRESS_IMAGE, PRINT_IMAGE_INLINE_WIDTH))).toBe(1200)
  })

  it('галерея сохраняет прежние печатные ступени', () => {
    expect(widthOf(buildPrintImageUrl(GALLERY_IMAGE, PRINT_IMAGE_INLINE_WIDTH))).toBe(1600)
    expect(widthOf(buildPrintImageUrl(GALLERY_IMAGE, PRINT_IMAGE_FULL_WIDTH))).toBe(2500)
  })

  it('legacy-роут остаётся на прежней лестнице прокси', () => {
    const legacy = 'https://metravel.by/media-resize/legacy/3508/conversions/photo.jpg'
    expect(widthOf(buildPrintImageUrl(legacy, PRINT_IMAGE_INLINE_WIDTH))).toBe(1600)
  })

  it('чужой хост параметров не получает', () => {
    const foreign = 'https://example.com/photo.jpg'
    expect(buildPrintImageUrl(foreign, PRINT_IMAGE_INLINE_WIDTH)).toBe(foreign)
  })
})

describe('страховка печати на случай необслуженной ступени', () => {
  it('fallback — тот же кадр без единого прокси-параметра', () => {
    const printed = buildPrintImageUrl(ADDRESS_IMAGE, PRINT_IMAGE_INLINE_WIDTH)
    expect(printed).toContain('w=')

    const fallback = buildPrintImageFallbackUrl(printed)
    const params = new URL(fallback).searchParams
    expect([...params.keys()]).toEqual([])
    expect(fallback.startsWith(ADDRESS_IMAGE)).toBe(true)
  })

  it('data: и blob: остаются нетронутыми', () => {
    expect(buildPrintImageFallbackUrl('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA')
    expect(buildPrintImageFallbackUrl('blob:local')).toBe('blob:local')
  })

  it('onerror сначала пробует fallback и только потом прячет кадр', () => {
    const handler = buildPrintImageOnError('https://metravel.by/address-image/1/x.webp')
    expect(handler).toContain('dataset.printFallback')
    expect(handler).toContain("this.style.display='none'")
  })

  it('без fallback остаётся прежнее поведение — спрятать', () => {
    expect(buildPrintImageOnError('')).toBe("this.style.display='none';")
  })
})
