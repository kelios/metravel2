// #1989: знание о сайдбаре каталога было зашито внутрь модели, и лендинги
// страны и города, взявшие хук ради `cardWidth`, получили вычет ЧУЖОГО
// сайдбара: карточка считалась для узкой колонки `/quests`, а грид
// раскладывался по полной ширине страницы. На вьюпорте 1024 это давало дыру
// 118 px между колонками и 216 px справа.

import { Dimensions } from 'react-native'
import { act, renderHook } from '@testing-library/react-native'

import { useQuestCatalogResponsiveModel } from '@/hooks/useQuestCatalogResponsiveModel'
import { QUESTS_GRID_WEB_GAP, QUESTS_LANDING_CONTENT_WIDTH } from '@/screens/tabs/QuestsScreen.styles'

const setViewport = (width: number, height = 900) => {
  act(() => {
    Dimensions.set({
      window: { width, height, scale: 2, fontScale: 1 },
      screen: { width, height, scale: 2, fontScale: 1 },
    })
  })
}

const model = (
  width: number,
  options?: { hasSidebar?: boolean; contentMaxWidth?: number; columnGap?: number },
) => {
  setViewport(width)
  return renderHook(() => useQuestCatalogResponsiveModel(69, options)).result.current
}

describe('вычет сайдбара в модели каталога квестов', () => {
  it('по умолчанию вычитает сайдбар — поведение `/quests` не меняется', () => {
    const withSidebar = model(1440)
    const explicit = model(1440, { hasSidebar: true })
    expect(explicit.cardWidth).toBe(withSidebar.cardWidth)
    expect(explicit.screenWidth).toBe(1440)
  })

  it('без сайдбара отдаёт лендингу больше места, чем каталогу', () => {
    const catalog = model(1440)
    const landing = model(1440, { hasSidebar: false })
    // Лендинг не обязан быть ШИРЕ по карточке (её ограничивает потолок), но
    // контент-ширина, от которой считаются колонки, обязана вырасти.
    expect(landing.cardColumns).toBeGreaterThanOrEqual(catalog.cardColumns)
    expect(landing.cardWidth).toBeGreaterThanOrEqual(catalog.cardWidth)
  })

  it('на вьюпорте 1024 лендинг перестаёт считать себя узкой колонкой', () => {
    const catalog = model(1024)
    const landing = model(1024, { hasSidebar: false })
    expect(landing.cardWidth).toBeGreaterThan(catalog.cardWidth)
  })

  it('на телефоне сайдбара нет в обоих режимах — числа совпадают', () => {
    const catalog = model(390)
    const landing = model(390, { hasSidebar: false })
    expect(landing.cardWidth).toBe(catalog.cardWidth)
    expect(landing.cardColumns).toBe(catalog.cardColumns)
  })
})

describe('карточка совпадает с треком грида', () => {
  // Грид на web делит контейнер на равные `1fr` с зазором `QUESTS_GRID_WEB_GAP`.
  // Модель обязана поделить ТУ ЖЕ ширину тем же зазором, иначе карточка не
  // совпадёт со своей колонкой — это и была дыра на лендинге страны.
  const trackWidth = (containerW: number, columns: number) =>
    Math.floor((containerW - QUESTS_GRID_WEB_GAP * (columns - 1)) / columns)

  const landingOptions = {
    hasSidebar: false,
    contentMaxWidth: QUESTS_LANDING_CONTENT_WIDTH,
    columnGap: QUESTS_GRID_WEB_GAP,
  }

  it('карточка лендинга равна треку грида на 1024', () => {
    const landing = model(1024, landingOptions)
    expect(landing.cardColumns).toBe(2)
    expect(landing.cardWidth).toBe(trackWidth(QUESTS_LANDING_CONTENT_WIDTH, 2))
  })

  it('и на 1280 — колонка контента не растёт вместе с экраном', () => {
    const landing = model(1280, landingOptions)
    expect(landing.cardColumns).toBe(2)
    expect(landing.cardWidth).toBe(trackWidth(QUESTS_LANDING_CONTENT_WIDTH, 2))
  })

  it('потолок контента не даёт карточке раздуться на широком экране', () => {
    const narrow = model(1024, landingOptions)
    const wide = model(2560, landingOptions)
    expect(wide.cardWidth).toBe(narrow.cardWidth)
  })
})
