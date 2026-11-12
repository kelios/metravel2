/**
 * #3302: «Популярные квесты» на экране «не найдено» (блок 840 px) и сетка
 * страны раскладывали QuestCard по базису ссылок-списков 240 px: три колонки
 * по ~259 px, высота карточки 259 / 380 × 260 ≈ 177 — заголовок обрезался,
 * бейджи наезжали на текст. Колонка сетки — та же, что у каталога (380).
 */
import React from 'react'
import { Platform, type LayoutChangeEvent } from 'react-native'
import { act, render } from '@testing-library/react-native'

import { QUEST_CARD_BASE_HEIGHT, QUESTS_GRID_MIN_COLUMN_WIDTH } from '@/constants/questLayout'

const mockCardWidths: number[] = []
jest.mock('@/screens/tabs/QuestCard', () => (props: { cardWidth: number }) => {
  mockCardWidths.push(props.cardWidth)
  return null
})

const quest = (id: string) => ({ id, cityId: 'minsk', title: id }) as never

const layoutEvent = (width: number) =>
  ({ nativeEvent: { layout: { x: 0, y: 0, width, height: 600 } } }) as LayoutChangeEvent

describe('QuestLandingGrid (#3302)', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'web')
    mockCardWidths.length = 0
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it.each([
    // Блок «не найдено» на десктопе: две колонки каталожной ширины, не три по 259.
    [840, 404],
    // Мобильный блок: одна колонка во всю ширину, как и раньше.
    [342, 342],
  ])('сетка %i px даёт карточку %i px не уже каталожной колонки', async (gridWidth, cardWidth) => {
    const { QuestLandingGrid } = require('@/components/quests/QuestLandingLayout')
    const view = await render(
      <QuestLandingGrid styles={{ questsGrid: {} }} quests={[quest('q1'), quest('q2'), quest('q3')]} />,
    )
    const grid = view.container.queryAll((node) => typeof node.props.onLayout === 'function')[0]

    expect(JSON.stringify(grid.props.style)).toContain(`minmax(min(100%, ${QUESTS_GRID_MIN_COLUMN_WIDTH}px), 1fr)`)

    await act(() => grid.props.onLayout(layoutEvent(gridWidth)))
    const measured = mockCardWidths.at(-1)!
    expect(measured).toBe(cardWidth)
    if (gridWidth >= QUESTS_GRID_MIN_COLUMN_WIDTH) {
      // Высота QuestCard на десктопе: cardWidth / 380 × 260 — не ниже каталожной.
      expect(Math.round((measured / QUESTS_GRID_MIN_COLUMN_WIDTH) * QUEST_CARD_BASE_HEIGHT))
        .toBeGreaterThanOrEqual(QUEST_CARD_BASE_HEIGHT)
    }
  })
})
