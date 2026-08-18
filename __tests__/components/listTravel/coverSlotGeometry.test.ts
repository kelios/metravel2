// #1285: ступень обложки карточки считается от того, сколько кадр РИСУЕТ, а не
// от ширины бокса. Числа в тесте — прод-замер главной 2026-08-06 (mobile 412,
// DPR 1.75): бокс рейла 318×200, бокс бенто 344×220, обложки 640×640 и 640×853.

import {
  buildCoverWidths,
  resolveCoverSlotGeometry,
} from '@/components/listTravel/travelListItemHelpers'

/** Что выберет браузер: наименьший кандидат, чья ширина покрывает sizes × DPR. */
const browserPick = (ladder: readonly number[], sizesPx: number, dpr: number): number =>
  ladder.find((width) => width >= sizesPx * dpr) ?? ladder[ladder.length - 1]

describe('#1285 геометрия слота обложки', () => {
  it('квадратный кадр в рейле главной рисуется по высоте бокса, а не по ширине', () => {
    // Рейл: cardWidth 320, imageHeight 200 (HomeInspirationSection.Rail).
    const { renderedWidth, maxCoverWidth } = resolveCoverSlotGeometry({
      slotWidth: 320,
      slotHeight: 200,
      aspectRatio: 1,
    })

    expect(renderedWidth).toBe(200)
    expect(maxCoverWidth).toBe(400)
    // DPR 1.75 требует 350 device px — это ступень 480, а не прежняя 640.
    expect(browserPick(buildCoverWidths(maxCoverWidth), renderedWidth, 1.75)).toBe(480)
  })

  it('портретный кадр занимает лишь часть ширины бокса', () => {
    // 640×853 в боксе 318×200 прод рисует как 150×200 — замер DOM 2026-08-06.
    const { renderedWidth, maxCoverWidth } = resolveCoverSlotGeometry({
      slotWidth: 320,
      slotHeight: 200,
      aspectRatio: 640 / 853,
    })

    expect(renderedWidth).toBe(150)
    expect(browserPick(buildCoverWidths(maxCoverWidth), renderedWidth, 1.75)).toBe(320)
  })

  it('ландшафтный кадр упирается в ширину бокса и она остаётся ограничителем', () => {
    const { renderedWidth } = resolveCoverSlotGeometry({
      slotWidth: 320,
      slotHeight: 200,
      aspectRatio: 16 / 9,
    })

    expect(renderedWidth).toBe(320)
  })

  it('бенто главной: высота 220 даёт ступень 480 вместо 640', () => {
    const { renderedWidth, maxCoverWidth } = resolveCoverSlotGeometry({
      slotWidth: 480,
      slotHeight: 220,
      aspectRatio: 1,
    })

    expect(renderedWidth).toBe(220)
    expect(browserPick(buildCoverWidths(maxCoverWidth), renderedWidth, 1.75)).toBe(480)
  })

  it('ландшафтная обложка каталога не получает ступень мельче своей отрисовки', () => {
    // Замер прода 2026-08-06, `/travels` desktop 1280: бокс 396×270, обложка
    // 1.51:1 рисуется на всю ширину бокса. Занижение оценки ширины до 320 дало бы
    // ступень 320w на 396 px отрисовки — то самое мыло.
    const { renderedWidth } = resolveCoverSlotGeometry({
      slotWidth: 720,
      slotHeight: 270,
      aspectRatio: 1.5111,
    })

    expect(renderedWidth).toBe(408)
    expect(renderedWidth).toBeGreaterThanOrEqual(396)
  })

  it('без пропорций кадра сохраняется прежний потолок лестницы', () => {
    // Старые payload'ы и нормализаторы без `width`/`height`: считать нечего,
    // и умножение оценки ширины на DPR увело бы `src` на ступень КРУПНЕЕ прежней.
    // `renderedWidth: null` — сигнал вызывающему оставить прежние `sizes`.
    expect(resolveCoverSlotGeometry({ slotWidth: 408, slotHeight: 220, aspectRatio: null }))
      .toEqual({ renderedWidth: null, maxCoverWidth: 640 })
    expect(resolveCoverSlotGeometry({ slotWidth: 700, slotHeight: 220, aspectRatio: null }))
      .toEqual({ renderedWidth: null, maxCoverWidth: 700 })
  })

  it('нулевая высота слота не ломает лестницу', () => {
    // `imageHeight={0}` прячет медиа-бокс; ступень при этом должна остаться валидной.
    expect(resolveCoverSlotGeometry({ slotWidth: 320, slotHeight: 0, aspectRatio: 1 }))
      .toEqual({ renderedWidth: null, maxCoverWidth: 640 })
  })
})

describe('INV2-17 геометрия слота под fit=cover', () => {
  const browserPick = (ladder: readonly number[], sizesPx: number, dpr: number): number =>
    ladder.find((width) => width >= sizesPx * dpr) ?? ladder[ladder.length - 1]

  it('портрет под cover сайзится по ширине бокса, а не по draw-width', () => {
    // Тот же кадр 640×853, что под contain давал renderedWidth 150 (draw-width):
    // под cover он заполняет всю ширину бокса, поэтому renderedWidth не
    // навязывается (null → вызывающий оставляет box-based `sizes`), а лестница
    // ограничена потолком бокса.
    const geom = resolveCoverSlotGeometry({
      slotWidth: 320,
      slotHeight: 200,
      aspectRatio: 640 / 853,
      fit: 'cover',
    })
    expect(geom.renderedWidth).toBeNull()
    expect(geom.maxCoverWidth).toBe(640)
    // Бокс 320 × DPR 2 = 640 → retina-ступень 640w остаётся в наборе.
    expect(buildCoverWidths(geom.maxCoverWidth)).toContain(640)
    expect(browserPick(buildCoverWidths(geom.maxCoverWidth), 320, 2)).toBe(640)
  })

  it('квадрат под cover не режет лестницу по draw-width высоты', () => {
    const geom = resolveCoverSlotGeometry({
      slotWidth: 480,
      slotHeight: 220,
      aspectRatio: 1,
      fit: 'cover',
    })
    expect(geom.renderedWidth).toBeNull()
    // Потолок = ширина бокса (не floor 640, т.к. 480 < 640, но COVER_LEGACY_FLOOR
    // держит минимум 640 для retina-ступеней).
    expect(geom.maxCoverWidth).toBe(640)
  })

  it('широкий бокс под cover сохраняет ступень крупнее 640', () => {
    const geom = resolveCoverSlotGeometry({
      slotWidth: 720,
      slotHeight: 270,
      aspectRatio: 1.5,
      fit: 'cover',
    })
    expect(geom.renderedWidth).toBeNull()
    expect(geom.maxCoverWidth).toBe(720)
    expect(buildCoverWidths(geom.maxCoverWidth)).toContain(720)
  })
})
