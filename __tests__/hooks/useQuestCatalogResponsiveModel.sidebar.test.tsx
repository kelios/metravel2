// #1989: знание о сайдбаре каталога было зашито внутрь модели, и лендинги
// страны и города, взявшие хук ради `cardWidth`, получили вычет ЧУЖОГО
// сайдбара: карточка считалась для узкой колонки `/quests`, а грид
// раскладывался по полной ширине страницы. На вьюпорте 1024 это давало дыру
// 118 px между колонками и 216 px справа.

import { Dimensions } from 'react-native'
import { act, renderHook } from '@testing-library/react-native'

import { useQuestCatalogResponsiveModel, type QuestCatalogResponsiveOptions } from '@/hooks/useQuestCatalogResponsiveModel'
import { QUESTS_GRID_WEB_GAP, QUESTS_LANDING_CONTENT_WIDTH } from '@/constants/questLayout'

const setViewport = async (width: number, height = 900) => {
  await act(() => {
    Dimensions.set({
      window: { width, height, scale: 2, fontScale: 1 },
      screen: { width, height, scale: 2, fontScale: 1 },
    })
  })
}

const model = async (
  width: number,
  options?: QuestCatalogResponsiveOptions,
  questCount = 69,
) => {
  await setViewport(width)
  return (await renderHook(() => useQuestCatalogResponsiveModel(questCount, options))).result.current
}

describe('вычет сайдбара в модели каталога квестов', () => {
  it.each([[390, 1, 342], [768, 1, 424], [1024, 2, 318], [1440, 2, 420]])('сохраняет размеры каталога на %i', async (width, columns, cardWidth) => {
    const catalog = await model(width)
    expect(catalog.cardColumns).toBe(columns)
    expect(catalog.cardWidth).toBe(cardWidth)
  })

  it('по умолчанию вычитает сайдбар — поведение `/quests` не меняется', async () => {
    const withSidebar = await model(1440)
    const explicit = await model(1440, { hasSidebar: true })
    expect(explicit.cardWidth).toBe(withSidebar.cardWidth)
  })

  it('без сайдбара отдаёт лендингу больше места, чем каталогу', async () => {
    const catalog = await model(1440)
    const landing = await model(1440, { hasSidebar: false })
    // Лендинг не обязан быть ШИРЕ по карточке (её ограничивает потолок), но
    // контент-ширина, от которой считаются колонки, обязана вырасти.
    expect(landing.cardColumns).toBeGreaterThanOrEqual(catalog.cardColumns)
    expect(landing.cardWidth).toBeGreaterThanOrEqual(catalog.cardWidth)
  })

  it('на вьюпорте 1024 лендинг перестаёт считать себя узкой колонкой', async () => {
    const catalog = await model(1024)
    const landing = await model(1024, { hasSidebar: false })
    expect(landing.cardWidth).toBeGreaterThan(catalog.cardWidth)
  })

  it('на телефоне сайдбара нет в обоих режимах — числа совпадают', async () => {
    const catalog = await model(390)
    const landing = await model(390, { hasSidebar: false })
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

  it.each([
    [320, 272, 1], [390, 342, 1], [767, 719, 1],
    [768, 720, 1], [800, 752, 1], [839, 791, 1],
    [840, 792, 2], [855, 807, 2], [888, 840, 2],
    [1024, 840, 2], [1280, 840, 2], [1440, 840, 2],
  ])('на %i px карточки заполняют контейнер %i px в %i колонках', async (width, container, columns) => {
    const landing = await model(width, landingOptions)
    expect(landing.cardColumns).toBe(columns)
    expect(landing.cardWidth * columns + QUESTS_GRID_WEB_GAP * (columns - 1)).toBe(container)
    expect(Math.abs(landing.cardWidth - trackWidth(container, columns))).toBeLessThan(1)
  })

  it.each([0, 1, 2, 69])('при %i квестах модель сохраняет треки сетки', async (count) => {
    const landing = await model(1024, landingOptions, count)
    expect(landing.cardColumns).toBe(2)
    expect(landing.cardWidth).toBe(404)
  })

  it('потолок контента не даёт карточке раздуться на широком экране', async () => {
    const narrow = await model(1024, landingOptions)
    const wide = await model(2560, landingOptions)
    expect(wide.cardWidth).toBe(narrow.cardWidth)
  })
})
