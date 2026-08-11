import {
  applyListDensity,
  buildListTravelFallbackSteps,
  getCatalogCardMediaLoading,
} from '@/components/listTravel/listTravelBaseModel'
import {
  getRightColumnVirtualizationConfig,
  WEB_ROW_HEIGHT_DESKTOP,
  WEB_ROW_HEIGHT_MOBILE,
} from '@/components/listTravel/rightColumnModel'

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

// #1400: eager (вместе с fetchPriority=high через isFirst) остаётся только у
// начального видимого ряда; остальные обложки стартуют по нативному lazy, чтобы
// быстрый скролл не запускал загрузки, которые рециклинг тут же отменяет.
describe('getCatalogCardMediaLoading', () => {
  it('keeps the whole first row eager and everything below lazy', () => {
    const gridColumns = 3
    expect(getCatalogCardMediaLoading(0, gridColumns)).toBe('eager')
    expect(getCatalogCardMediaLoading(2, gridColumns)).toBe('eager')
    expect(getCatalogCardMediaLoading(3, gridColumns)).toBe('lazy')
    expect(getCatalogCardMediaLoading(30, gridColumns)).toBe('lazy')
  })

  it('matches the isFirst boundary on a single-column mobile list', () => {
    expect(getCatalogCardMediaLoading(0, 1)).toBe('eager')
    expect(getCatalogCardMediaLoading(1, 1)).toBe('lazy')
  })

  // Ремоунт первого ряда на развороте быстрой прокрутки не должен заново
  // стартовать eager-загрузку: разворот вниз тут же её отменяет.
  it('demotes the first row to lazy after the user has scrolled', () => {
    expect(getCatalogCardMediaLoading(0, 3, true)).toBe('lazy')
    expect(getCatalogCardMediaLoading(2, 3, true)).toBe('lazy')
    expect(getCatalogCardMediaLoading(0, 1, true)).toBe('lazy')
  })
})

// FlashList v2 держит буфер `drawDistance * 2` и делит его по направлению
// скролла 0.3 назад / 0.7 вперёд, то есть реальный запас — `0.6 × drawDistance`
// назад и `1.4 × drawDistance` вперёд (`RVEngagedIndicesTrackerImpl`).
const BUFFER_BEHIND_RATIO = 0.6
const BUFFER_AHEAD_RATIO = 1.4

describe('search result virtualization budget', () => {
  // Инвариант выводится из заявленной высоты строки, а не из самого значения
  // lookahead: если строка станет выше, а запас не подтянут, тест упадёт.
  // Одна полная строка позади — возврат на шаг не роняет уже отрисованную
  // обложку; две впереди — следующая успевает декодировать до входа в кадр.
  it.each<[string, boolean, number]>([
    ['desktop', false, WEB_ROW_HEIGHT_DESKTOP],
    ['mobile', true, WEB_ROW_HEIGHT_MOBILE],
  ])('keeps one web row behind and two ahead on %s', (_label, isMobile, rowHeight) => {
    const { drawDistance } = getRightColumnVirtualizationConfig(true, isMobile)

    expect(drawDistance * BUFFER_BEHIND_RATIO).toBeGreaterThanOrEqual(rowHeight)
    expect(drawDistance * BUFFER_AHEAD_RATIO).toBeGreaterThanOrEqual(rowHeight * 2)
  })

  // Окно обязано остаться ограниченным: запас, сопоставимый со страницей выдачи,
  // смонтировал бы всю страницу разом и утянул байты низкоприоритетных обложек.
  it.each<[string, boolean, number]>([
    ['desktop', false, WEB_ROW_HEIGHT_DESKTOP],
    ['mobile', true, WEB_ROW_HEIGHT_MOBILE],
  ])('keeps the %s lookahead bounded to a few rows', (_label, isMobile, rowHeight) => {
    const { drawDistance } = getRightColumnVirtualizationConfig(true, isMobile)

    expect(drawDistance * BUFFER_AHEAD_RATIO).toBeLessThanOrEqual(rowHeight * 4)
  })

  it('prepares a wider window on desktop, where rows are taller', () => {
    expect(getRightColumnVirtualizationConfig(true, false).drawDistance).toBeGreaterThan(
      getRightColumnVirtualizationConfig(true, true).drawDistance,
    )
  })

  // Native рециклит ячейки: FlashList делит буфер `drawDistance * 2` как 0.3
  // назад / 0.7 вперёд, а карточка поиска на телефоне занимает ~300 dp. Запас
  // назад (0.6 × drawDistance) обязан покрывать целую карточку, иначе возврат на
  // один шаг рециклит ячейку и `expo-image` перерисовывает фото с плейсхолдера.
  it('keeps the native lookahead wider than one card in both directions', () => {
    const CARD_HEIGHT_DP = 300
    const { drawDistance } = getRightColumnVirtualizationConfig(false, true)

    // Значение закреплено device-verify на Pixel 10 Pro (#1263): правка web-веток
    // не должна трогать native, поэтому пин точный, а не только по инварианту.
    expect(drawDistance).toBe(560)
    expect(drawDistance * BUFFER_BEHIND_RATIO).toBeGreaterThanOrEqual(CARD_HEIGHT_DP)
    expect(drawDistance * BUFFER_AHEAD_RATIO).toBeGreaterThanOrEqual(CARD_HEIGHT_DP * 2)
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
