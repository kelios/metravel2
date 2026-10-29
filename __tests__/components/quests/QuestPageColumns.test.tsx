import React, { useEffect } from 'react'
import { render } from '@testing-library/react-native'
import { Text } from 'react-native'

import { getAffiliateOffers } from '@/components/affiliate/affiliateConfig'
import { QuestPageColumns } from '@/components/quests/QuestPageColumns'
import { QUEST_PAGE_COLUMNS_LAYOUT, QUEST_PUBLIC_NAV_LAYOUT } from '@/components/quests/questPageColumnsLayout'
import { buildBreakpointLayoutCss } from '@/utils/breakpointLayout'
import { buildCriticalCSS } from '@/utils/criticalCSSBuilder'

let mockWidth = 390
let mockPromotionMounts = 0
let mockOffers = [{ key: 'tours', title: 'Tours', subtitle: 'Local guides', cta: 'Open', url: 'https://example.test/' }]

jest.mock('@/hooks/useResponsive', () => ({ useBreakpoints: () => ({ width: mockWidth }) }))
jest.mock('@/components/affiliate/affiliateConfig', () => ({ getAffiliateOffers: jest.fn(() => mockOffers) }))
jest.mock('@/components/affiliate/AffiliateOffers', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return function MockAffiliateOffers() {
    React.useEffect(() => { mockPromotionMounts++ }, [])
    return React.createElement(Text, { testID: 'generic-promotion' }, 'Partner offers')
  }
})

beforeEach(() => {
  mockWidth = 390
  mockPromotionMounts = 0
  mockOffers = [{ key: 'tours', title: 'Tours', subtitle: 'Local guides', cta: 'Open', url: 'https://example.test/' }]
  jest.clearAllMocks()
})

it('keeps one advertising mount when the viewport moves between inline and rail layouts', async () => {
  const { getAllByTestId, rerender } = await render(<QuestPageColumns><Text>Reading</Text></QuestPageColumns>)
  expect(getAllByTestId('generic-promotion')).toHaveLength(1)
  mockWidth = 2048
  await rerender(<QuestPageColumns><Text>Reading</Text></QuestPageColumns>)
  expect(getAllByTestId('generic-promotion')).toHaveLength(1)
  expect(mockPromotionMounts).toBe(1)
})

it('does not reserve a rail when configured offers are unavailable', async () => {
  mockOffers = []
  const { getByText, queryByTestId } = await render(<QuestPageColumns><Text>Reading</Text></QuestPageColumns>)
  expect(getByText('Reading')).toBeTruthy()
  expect(queryByTestId('quest-page-promotion')).toBeNull()
})

it('replaces generic advertising with the caller provider and preserves reading state when it is removed', async () => {
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
  expect(queryByTestId('generic-promotion')).toBeNull()
  expect(getAffiliateOffers).not.toHaveBeenCalled()
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
