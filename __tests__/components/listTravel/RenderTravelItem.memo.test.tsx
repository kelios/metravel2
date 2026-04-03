import React from 'react'
import { render } from '@testing-library/react-native'

import RenderTravelItem from '@/components/listTravel/RenderTravelItem'

const mockTravelListItem = jest.fn(() => null)

jest.mock('@/components/listTravel/TravelListItem', () => ({
  __esModule: true,
  default: (props: any) => mockTravelListItem(props),
}))

const baseTravel = {
  id: 1,
  slug: 'test-travel',
  name: 'Test Travel',
  travel_image_thumb_url: 'https://example.com/image.jpg',
  url: '/travels/test-travel',
  userName: 'Author',
  userIds: '42',
  countryName: 'Беларусь',
  countUnicIpView: '12',
  rating: 4.7,
  rating_count: 14,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-05T00:00:00Z',
  user: {
    id: 42,
    name: 'Author',
    first_name: 'Test',
    last_name: 'User',
  },
} as any

describe('RenderTravelItem memoization', () => {
  beforeEach(() => {
    mockTravelListItem.mockClear()
  })

  it('skips rerender when item reference changes but rendered travel snapshot stays the same', () => {
    const props = {
      item: baseTravel,
      index: 0,
      isMobile: false,
      isSuperuser: false,
      isMetravel: false,
      isFirst: false,
      isSelected: false,
      selectable: false,
      onToggle: jest.fn(),
      onDeletePress: jest.fn(),
    }

    const { rerender } = render(<RenderTravelItem {...props} />)

    expect(mockTravelListItem).toHaveBeenCalledTimes(1)

    rerender(
      <RenderTravelItem
        {...props}
        item={{
          ...baseTravel,
          description: 'Updated background-only field',
          gallery: [{ id: 5 }],
        }}
      />
    )

    expect(mockTravelListItem).toHaveBeenCalledTimes(1)
  })

  it('rerenders when visible travel metadata changes', () => {
    const props = {
      item: baseTravel,
      index: 0,
      isMobile: false,
      isSuperuser: false,
      isMetravel: false,
      isFirst: false,
      isSelected: false,
      selectable: false,
      onToggle: jest.fn(),
      onDeletePress: jest.fn(),
    }

    const { rerender } = render(<RenderTravelItem {...props} />)

    expect(mockTravelListItem).toHaveBeenCalledTimes(1)

    rerender(
      <RenderTravelItem
        {...props}
        item={{
          ...baseTravel,
          countUnicIpView: '13',
        }}
      />
    )

    expect(mockTravelListItem).toHaveBeenCalledTimes(2)
  })
})
