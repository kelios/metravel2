import React from 'react'
import { render } from '@testing-library/react-native'

import { SearchPageSkeleton } from '@/components/listTravel/SearchPageSkeleton'

jest.mock('@/hooks/useResponsive', () => {
  const actual = jest.requireActual('@/hooks/useResponsive')
  return { ...actual, useResponsive: () => ({ ...actual.useResponsive(), width: 1440, isDesktop: true, isHydrated: true }) }
})

describe('SearchPageSkeleton reserves the AI picks panel (#2459)', () => {
  const env = process.env.EXPO_PUBLIC_AI_PICKS
  afterAll(() => {
    process.env.EXPO_PUBLIC_AI_PICKS = env
  })

  it('draws the panel header in the first frame when the flag is on', () => {
    process.env.EXPO_PUBLIC_AI_PICKS = '1'
    const { getByTestId, getByText } = render(<SearchPageSkeleton />)
    expect(getByTestId('ai-search-panel-placeholder')).toBeTruthy()
    expect(getByText('Подобрать по описанию')).toBeTruthy()
  })

  it('draws nothing extra when the flag is off', () => {
    process.env.EXPO_PUBLIC_AI_PICKS = ''
    const { queryByTestId } = render(<SearchPageSkeleton />)
    expect(queryByTestId('ai-search-panel-placeholder')).toBeNull()
  })
})
