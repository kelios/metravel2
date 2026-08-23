// #1487: карточка маршрута обязана кадрировать обложку `contain`
// (`docs/RULES.md` → «Images and placeholders», исключений по поверхностям нет),
// поэтому плоское поле `dominant_color` лечится только геометрией слота.
// Тест считает ровно ту величину, которую приёмка меряет в браузере:
// `(slotWidth − renderedBitmapWidth) / 2 / slotWidth`, и падает при >10%.

import {
  CARD_MEDIA_SLOT_MAX_RATIO,
  CARD_MEDIA_SLOT_MIN_RATIO,
  resolveCardMediaSlotRatio,
  resolveCoverSlotGeometry,
} from '@/components/listTravel/travelListItemHelpers'

/** Порог из Acceptance Criteria тикета: поле с одной стороны ≤10%. */
const MAX_FLAT_SHARE = 0.1

/**
 * Соотношения сторон обложек прод-выдачи. Замер 2026-08-23 по всем 360
 * опубликованным маршрутам `/api/travels/?publish=1`.
 */
const PROD_COVER_RATIOS = [
  { label: '9:16 портрет', ratio: 0.563, travels: 1 },
  { label: '3:4 портрет', ratio: 0.75, travels: 13 },
  { label: '1:1 квадрат', ratio: 1, travels: 288 },
  { label: '4:3 ландшафт', ratio: 4 / 3, travels: 37 },
  { label: '3:2 ландшафт', ratio: 1.5013, travels: 1 },
  { label: '16:9 ландшафт', ratio: 16 / 9, travels: 20 },
] as const

/**
 * Ширины медиа-слота с тех же прод-замеров: каталог `/search` (desktop 1280 и
 * mobile 390), редакционная сетка главной и рейл.
 */
const PROD_SLOT_WIDTHS = [
  { label: 'каталог desktop 1280', width: 386 },
  { label: 'каталог mobile 390', width: 368 },
  { label: 'главная, крупная карточка', width: 635 },
  { label: 'главная, карточка стека', width: 448 },
  { label: 'рейл главной', width: 320 },
] as const

/**
 * Доли плоского поля так, как их видит браузер: слот получает пропорции из
 * `resolveCardMediaSlotRatio`, а отрисованный битмап — из
 * `resolveCoverSlotGeometry`, то есть ровно из прод-кода.
 */
function measureFlatShares(slotWidth: number, aspectRatio: number) {
  const slotRatio = resolveCardMediaSlotRatio(aspectRatio)
  expect(slotRatio).not.toBeNull()
  const slotHeight = slotWidth / (slotRatio as number)

  const { renderedWidth } = resolveCoverSlotGeometry({
    slotWidth,
    slotHeight,
    aspectRatio,
  })
  const renderedHeight = Math.min(slotHeight, slotWidth / aspectRatio)

  return {
    sideShare: ((slotWidth - (renderedWidth as number)) / 2) / slotWidth,
    bandShare: (slotHeight - renderedHeight) / 2 / slotHeight,
  }
}

describe('#1487 плоские поля медиа-слота карточки маршрута', () => {
  it('ни одно соотношение прод-выдачи не даёт поля шире 10% ни на одном слоте', () => {
    const offenders: string[] = []

    for (const slot of PROD_SLOT_WIDTHS) {
      for (const cover of PROD_COVER_RATIOS) {
        const { sideShare, bandShare } = measureFlatShares(slot.width, cover.ratio)
        const worst = Math.max(sideShare, bandShare)
        if (worst > MAX_FLAT_SHARE) {
          offenders.push(
            `${slot.label} (${slot.width}px) × ${cover.label}: ${(worst * 100).toFixed(1)}%`,
          )
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it('обложки внутри диапазона слота вообще не оставляют поля', () => {
    // 3:4, 1:1, 4:3, 3:2 и 16:9 — это 359 из 360 маршрутов выдачи.
    for (const ratio of [0.75, 1, 4 / 3, 1.5013, 16 / 9]) {
      const { sideShare, bandShare } = measureFlatShares(386, ratio)
      expect(sideShare).toBeCloseTo(0, 3)
      expect(bandShare).toBeCloseTo(0, 3)
    }
  })

  it('прежняя фиксированная геометрия слота этот порог нарушала', () => {
    // Якорь регрессии: прод 2026-08-23, каталог desktop 386×270 и квадратная
    // обложка — 15.9% поля с каждой стороны; главная 635×316 — 24.9%.
    const legacy = (slotWidth: number, slotHeight: number, aspectRatio: number) => {
      const { renderedWidth } = resolveCoverSlotGeometry({ slotWidth, slotHeight, aspectRatio })
      return ((slotWidth - (renderedWidth as number)) / 2) / slotWidth
    }

    expect(legacy(386, 270, 1)).toBeGreaterThan(MAX_FLAT_SHARE)
    expect(legacy(635, 316, 1)).toBeGreaterThan(MAX_FLAT_SHARE)
    expect(legacy(386, 270, 0.75)).toBeGreaterThan(MAX_FLAT_SHARE)
  })

  it('крайности за пределами выдачи остаются в пределах порога', () => {
    // Клип соотношения держит поле ≤10% вплоть до 0.53 и 2.22 — запас к
    // наблюдаемым 0.563 и 1.778 на случай новых обложек.
    expect(measureFlatShares(386, 0.53).sideShare).toBeLessThanOrEqual(MAX_FLAT_SHARE)
    expect(measureFlatShares(386, 2.22).bandShare).toBeLessThanOrEqual(MAX_FLAT_SHARE)
  })

  it('без пропорций обложки слот остаётся на прежней фиксированной высоте', () => {
    // Старые payload'ы без `width`/`height`: адаптировать нечего, вызывающий код
    // обязан оставить `imageHeight`.
    expect(resolveCardMediaSlotRatio(null)).toBeNull()
    expect(resolveCardMediaSlotRatio(undefined)).toBeNull()
    expect(resolveCardMediaSlotRatio(0)).toBeNull()
    expect(resolveCardMediaSlotRatio(Number.NaN)).toBeNull()
  })

  it('соотношение слота зажато между 5:8 и 16:9', () => {
    expect(resolveCardMediaSlotRatio(0.2)).toBe(CARD_MEDIA_SLOT_MIN_RATIO)
    expect(resolveCardMediaSlotRatio(5)).toBe(CARD_MEDIA_SLOT_MAX_RATIO)
    expect(resolveCardMediaSlotRatio(1)).toBe(1)
  })
})
