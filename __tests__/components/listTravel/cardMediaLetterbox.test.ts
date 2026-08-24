// #1487 (пересмотр 2026-08-24): карточка маршрута кадрирует обложку `contain`
// (`docs/RULES.md` → «Images and placeholders»), а медиа-слот ЕДИНЫЙ квадратный —
// решение владельца: каталог обязан быть ровной сеткой одинаковых карточек.
// Первый заход #1487 (слот из пропорций обложки) убирал поле в ноль, но ломал
// выравнивание рядов и был отклонён.
//
// Тест фиксирует оба края контракта:
//   1) сетка: слот не зависит от пропорций конкретной обложки;
//   2) поле: на моде прод-контента (квадратные обложки, 80% выдачи) поле 0%,
//      а на остатке не превышает измеренного потолка — расти ему некуда.

import {
  CARD_MEDIA_SLOT_RATIO,
  resolveCoverSlotGeometry,
} from '@/components/listTravel/travelListItemHelpers'

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

/** Ширины медиа-слота с прод-замеров: каталог desktop/mobile, главная, рейл. */
const PROD_SLOT_WIDTHS = [
  { label: 'каталог desktop 1280', width: 396 },
  { label: 'каталог mobile 390', width: 368 },
  { label: 'главная, крупная карточка', width: 643 },
  { label: 'главная, карточка стека', width: 454 },
  { label: 'рейл главной', width: 298 },
] as const

/**
 * Максимум доли плоского поля с одной стороны при квадратном слоте — задаёт
 * его самая далёкая от квадрата пропорция выдачи (9:16 и 16:9): (1 − 0.563)/2.
 * Выше этой планки поле уехать не может, пока слот квадратный.
 */
const MAX_FLAT_SHARE_TAIL = (1 - 0.563) / 2 + 0.001

/** Доли поля так, как их считает браузерная приёмка. */
function measureFlatShares(slotWidth: number, aspectRatio: number) {
  const slotHeight = slotWidth / CARD_MEDIA_SLOT_RATIO
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

describe('#1487 единый квадратный медиа-слот карточки маршрута', () => {
  it('слот один для всех обложек — сетка не может разъехаться', () => {
    // Инвариант сетки: пропорции слота — константа, не функция обложки.
    // Если слот снова станет считаться от `aspect_ratio`, ряды каталога
    // получат разную высоту, и это падение — прямое решение владельца
    // 2026-08-24, а не деталь реализации.
    expect(CARD_MEDIA_SLOT_RATIO).toBe(1)
  })

  it('мода прод-выдачи (квадратные обложки) не оставляет поля вовсе', () => {
    for (const slot of PROD_SLOT_WIDTHS) {
      const { sideShare, bandShare } = measureFlatShares(slot.width, 1)
      expect(sideShare).toBeCloseTo(0, 3)
      expect(bandShare).toBeCloseTo(0, 3)
    }
  })

  it('поле на остатке выдачи не превышает измеренного потолка', () => {
    // 4:3 и 3:4 → 12.5%; 3:2 → 16.7%; 16:9 и 9:16 → 21.9%. Это контентный
    // долг (квадратные варианты обложек, прецедент #134/#152), но потолок
    // закреплён: если слот дрейфанёт от квадрата, худшая доля вырастет и тест
    // упадёт раньше, чем полосы вернутся на большинство карточек.
    const offenders: string[] = []
    for (const slot of PROD_SLOT_WIDTHS) {
      for (const cover of PROD_COVER_RATIOS) {
        const { sideShare, bandShare } = measureFlatShares(slot.width, cover.ratio)
        const worst = Math.max(sideShare, bandShare)
        if (worst > MAX_FLAT_SHARE_TAIL) {
          offenders.push(
            `${slot.label} (${slot.width}px) × ${cover.label}: ${(worst * 100).toFixed(1)}%`,
          )
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('большинство выдачи остаётся в пороге ≤10% тикета #1487', () => {
    // Взвешенная по числу маршрутов доля карточек с полем >10%: только
    // не-квадратный хвост. Рост выше 20% значит, что либо слот уехал от моды,
    // либо мода контента сменилась — оба случая требуют пересмотра, а не
    // тихого прохода.
    const total = PROD_COVER_RATIOS.reduce((sum, c) => sum + c.travels, 0)
    const over10 = PROD_COVER_RATIOS.filter((c) => {
      const { sideShare, bandShare } = measureFlatShares(396, c.ratio)
      return Math.max(sideShare, bandShare) > 0.1
    }).reduce((sum, c) => sum + c.travels, 0)

    expect(total).toBe(360)
    expect(over10 / total).toBeLessThanOrEqual(0.2)
  })

  it('прежний фиксированный ландшафтный слот ломал именно моду', () => {
    // Якорь регрессии: слот 396×270 (до #1487) давал квадратной обложке —
    // то есть 80% выдачи — 15.9% поля с каждой стороны; квадратный слот даёт
    // ей 0%. Возврат к ландшафтной константе провалит и этот тест, и владельца.
    const legacy = (slotWidth: number, slotHeight: number, aspectRatio: number) => {
      const { renderedWidth } = resolveCoverSlotGeometry({ slotWidth, slotHeight, aspectRatio })
      return ((slotWidth - (renderedWidth as number)) / 2) / slotWidth
    }
    expect(legacy(396, 270, 1)).toBeGreaterThan(0.1)
    expect(legacy(635, 316, 1)).toBeGreaterThan(0.2)
  })
})
