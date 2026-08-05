import {
  applyListDensity,
  buildListTravelFallbackSteps,
} from '@/components/listTravel/listTravelBaseModel'
import { getRightColumnVirtualizationConfig } from '@/components/listTravel/rightColumnModel'

describe('applyListDensity', () => {
  const base = { gridColumns: 3, isCardsSingleColumn: false, imageHeight: 300 }

  it('returns the base layout unchanged for comfortable density', () => {
    expect(applyListDensity(base, 'comfortable')).toEqual(base)
  })

  it('switches single-column mobile to a 2-up compact grid', () => {
    const result = applyListDensity(
      { gridColumns: 1, isCardsSingleColumn: true, imageHeight: 220 },
      'compact',
    )
    expect(result.gridColumns).toBe(2)
    expect(result.isCardsSingleColumn).toBe(false)
    expect(result.imageHeight).toBeLessThan(220)
  })

  it('adds one column (capped at 4) and shrinks media on multi-column compact', () => {
    expect(applyListDensity(base, 'compact').gridColumns).toBe(4)
    expect(applyListDensity({ ...base, gridColumns: 4 }, 'compact').gridColumns).toBe(4)
    expect(applyListDensity(base, 'compact').imageHeight).toBeLessThan(base.imageHeight)
  })
})

describe('search result virtualization budget', () => {
  it('keeps desktop lookahead below one additional viewport', () => {
    expect(getRightColumnVirtualizationConfig(true, false)).toEqual({
      drawDistance: 180,
    })
  })

  it('uses a smaller lookahead for the shorter mobile rows', () => {
    expect(getRightColumnVirtualizationConfig(true, true)).toEqual({
      drawDistance: 160,
    })
  })

  // Native рециклит ячейки: FlashList делит буфер `drawDistance * 2` как 0.3
  // назад / 0.7 вперёд, а карточка поиска на телефоне занимает ~300 dp. Запас
  // назад (0.6 × drawDistance) обязан покрывать целую карточку, иначе возврат на
  // один шаг рециклит ячейку и `expo-image` перерисовывает фото с плейсхолдера.
  it('keeps the native lookahead wider than one card in both directions', () => {
    const CARD_HEIGHT_DP = 300
    const { drawDistance } = getRightColumnVirtualizationConfig(false, true)

    expect(drawDistance * 0.6).toBeGreaterThanOrEqual(CARD_HEIGHT_DP)
    expect(drawDistance * 1.4).toBeGreaterThanOrEqual(CARD_HEIGHT_DP * 2)
    expect(getRightColumnVirtualizationConfig(false, false).drawDistance).toBe(drawDistance)
  })
})

describe('buildListTravelFallbackSteps', () => {
  it('builds progressively broader fallback steps for narrow filters', () => {
    const steps = buildListTravelFallbackSteps({
      queryParams: {
        publish: 1,
        moderation: 1,
        categories: [4],
        categoryTravelAddress: [12],
        transports: [2],
        month: [6],
        complexity: [3],
      },
      search: 'озёра',
    })

    expect(steps.map((step) => step.id)).toEqual(['light', 'medium', 'broad', 'searchless'])
    expect(steps[0]?.params).toEqual({
      categories: [4],
      categoryTravelAddress: [12],
      moderation: 1,
      publish: 1,
      transports: [2],
    })
    expect(steps[1]?.params).toEqual({
      categories: [4],
      moderation: 1,
      publish: 1,
    })
    expect(steps[2]?.params).toEqual({
      moderation: 1,
      publish: 1,
    })
    expect(steps[3]?.search).toBe('')
  })

  it('avoids duplicate steps when only text search can be relaxed', () => {
    const steps = buildListTravelFallbackSteps({
      queryParams: {
        moderation: 1,
        publish: 1,
      },
      search: 'минск',
    })

    expect(steps).toHaveLength(1)
    expect(steps[0]).toMatchObject({
      id: 'searchless',
      params: {
        moderation: 1,
        publish: 1,
      },
      search: '',
    })
  })

  it('does not relax pending-review moderation queue filters', () => {
    const steps = buildListTravelFallbackSteps({
      queryParams: {
        publication_status: 'pending_review',
        categories: [4],
      },
      search: 'минск',
    })

    expect(steps).toEqual([])
  })
})
