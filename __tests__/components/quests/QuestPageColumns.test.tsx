import React, { useEffect } from 'react'
import { render } from '@testing-library/react-native'
import { Text } from 'react-native'

import { QuestPageColumns } from '@/components/quests/QuestPageColumns'
import { QUEST_PAGE_COLUMNS_LAYOUT, QUEST_PUBLIC_NAV_LAYOUT } from '@/components/quests/questPageColumnsLayout'
import { buildBreakpointLayoutCss } from '@/utils/breakpointLayout'
import { buildCriticalCSS } from '@/utils/criticalCSSBuilder'

let mockWidth = 390
let mockPromotionMounts = 0

jest.mock('@/hooks/useResponsive', () => ({ useBreakpoints: () => ({ width: mockWidth }) }))

beforeEach(() => {
  mockWidth = 390
  mockPromotionMounts = 0
  jest.clearAllMocks()
})

it('keeps one caller-provided mount when the viewport moves between inline and rail layouts', async () => {
  function Promotion() {
    useEffect(() => { mockPromotionMounts++ }, [])
    return <Text testID="custom-promotion">Existing provider</Text>
  }
  const promotion = <Promotion />
  const { getAllByTestId, rerender } = await render(<QuestPageColumns promotion={promotion}><Text>Reading</Text></QuestPageColumns>)
  expect(getAllByTestId('custom-promotion')).toHaveLength(1)
  mockWidth = 2048
  await rerender(<QuestPageColumns promotion={promotion}><Text>Reading</Text></QuestPageColumns>)
  expect(getAllByTestId('custom-promotion')).toHaveLength(1)
  expect(mockPromotionMounts).toBe(1)
})

it.each([390, 2048])('does not reserve an advertising rail without a provider at %ipx', async (width) => {
  mockWidth = width
  const { getByText, queryByTestId } = await render(<QuestPageColumns><Text>Reading</Text></QuestPageColumns>)
  expect(getByText('Reading')).toBeTruthy()
  expect(queryByTestId('quest-page-promotion')).toBeNull()
})

it('preserves reading state when the caller provider is hidden', async () => {
  let readingMounts = 0
  function Reading() {
    useEffect(() => { readingMounts++ }, [])
    return <Text>Reading</Text>
  }
  const custom = <Text testID="custom-promotion">Existing provider</Text>
  const { getAllByTestId, queryByTestId, rerender } = await render(
    <QuestPageColumns promotion={custom} hasPromotion><Reading /></QuestPageColumns>,
  )
  expect(getAllByTestId('custom-promotion')).toHaveLength(1)
  mockWidth = 2048
  await rerender(<QuestPageColumns promotion={custom} hasPromotion={false}><Reading /></QuestPageColumns>)
  expect(queryByTestId('quest-page-promotion')).toBeNull()
  expect(readingMounts).toBe(1)
})

it('publishes both shared responsive contracts in first-frame CSS', () => {
  const css = buildCriticalCSS()
  expect(css).toContain(buildBreakpointLayoutCss(QUEST_PAGE_COLUMNS_LAYOUT))
  expect(css).toContain(buildBreakpointLayoutCss(QUEST_PUBLIC_NAV_LAYOUT))
})
