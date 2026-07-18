import { render } from '@testing-library/react-native'

import PlaceRatingBadge from '@/components/places/PlaceRatingBadge'
import type { PlaceRating } from '@/utils/placesCatalog'

const rating = (overrides: Partial<PlaceRating> = {}): PlaceRating => ({
  value: 4.6,
  count: 128,
  sources: [
    { provider: '2gis', value: 4.7, count: 90, url: 'https://2gis.by/x' },
    { provider: 'tripadvisor', value: 4.5, count: 38, url: null },
  ],
  ...overrides,
})

describe('PlaceRatingBadge', () => {
  it('renders the score, primary provider label and review count', () => {
    const { getByText, getByTestId } = render(<PlaceRatingBadge rating={rating()} />)

    expect(getByText('4.6')).toBeTruthy()
    expect(getByText('2GIS')).toBeTruthy()
    expect(getByText('(128)')).toBeTruthy()
    // Accessible label carries the human-readable rating for screen readers.
    expect(getByTestId('place-rating-badge').props.accessibilityLabel).toContain('4.6')
  })

  it('renders nothing without an aggregate score', () => {
    const { queryByTestId, rerender } = render(<PlaceRatingBadge rating={null} />)
    expect(queryByTestId('place-rating-badge')).toBeNull()

    rerender(<PlaceRatingBadge rating={rating({ value: null })} />)
    expect(queryByTestId('place-rating-badge')).toBeNull()
  })

  it('hides the source label for the own MeTravel rating', () => {
    const { getByText, queryByText } = render(
      <PlaceRatingBadge
        rating={rating({
          sources: [{ provider: 'metravel', value: 4.6, count: 128, url: null }],
        })}
      />,
    )
    expect(getByText('4.6')).toBeTruthy()
    expect(queryByText('MeTravel')).toBeNull()
    expect(queryByText('·')).toBeNull()
  })

  it('falls back to the first source when the primary has no score', () => {
    const { getByText } = render(
      <PlaceRatingBadge
        rating={rating({
          sources: [{ provider: 'tripadvisor', value: null, count: 12, url: null }],
        })}
      />,
    )
    expect(getByText('TripAdvisor')).toBeTruthy()
  })
})
