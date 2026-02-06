import React from 'react'
import { render } from '@testing-library/react-native'

const mockUseQuery = jest.fn((_opts: any) => ({ data: null }))

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => ({ viewHistory: [] }),
}))

jest.mock('@tanstack/react-query', () => ({
  useQuery: (opts: any) => mockUseQuery(opts),
}))

jest.mock('@/src/api/map', () => ({
  fetchTravelsOfMonth: jest.fn(async () => ({})),
}))

import WeeklyHighlights from '@/components/travel/WeeklyHighlights'

describe('WeeklyHighlights enabled gating', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('passes enabled=false to useQuery when disabled', () => {
    render(<WeeklyHighlights enabled={false} />)
    expect(mockUseQuery).toHaveBeenCalled()
    const arg = (mockUseQuery.mock.calls[0] && mockUseQuery.mock.calls[0][0]) as any
    expect(arg).toBeTruthy()
    expect(arg.enabled).toBe(false)
  })

  it('defaults enabled=true', () => {
    render(<WeeklyHighlights />)
    expect(mockUseQuery).toHaveBeenCalled()
    const arg = (mockUseQuery.mock.calls[0] && mockUseQuery.mock.calls[0][0]) as any
    expect(arg).toBeTruthy()
    expect(arg.enabled).toBe(true)
  })
})
