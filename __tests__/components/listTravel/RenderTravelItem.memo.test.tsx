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

describe('author moderation identity and refresh', () => {
  beforeEach(() => mockTravelListItem.mockClear());

  it.each([
    ['publication_status', 'pending_review'], ['publish', true], ['moderation', true],
    ['moderation_decision', 'rejected'], ['moderation_decision_reason', 'Fix route details'],
    ['moderation_decided_at', '2026-10-22T12:00:00Z'],
  ])('refreshes after the server changes %s', (field, value) => {
    const screen = render(<RenderTravelItem item={baseTravel} currentUserId="42" showAuthorModerationFeedback />);
    screen.rerender(<RenderTravelItem item={{ ...baseTravel, [field]: value }} currentUserId="42" showAuthorModerationFeedback />);
    expect(mockTravelListItem).toHaveBeenCalledTimes(2);
  });

  it.each([
    { currentUserId: '42', showAuthorModerationFeedback: false, isMetravel: false, isSuperuser: false },
    { currentUserId: '99', showAuthorModerationFeedback: true, isMetravel: false, isSuperuser: false },
    { currentUserId: '99', showAuthorModerationFeedback: true, isMetravel: true, isSuperuser: true },
    { currentUserId: null, showAuthorModerationFeedback: true, isMetravel: true, isSuperuser: false },
  ])('does not expose private feedback outside its author context: %p', (context) => {
    render(<RenderTravelItem item={{ ...baseTravel, moderation_decision: 'rejected', moderation_decision_reason: 'Private reason' }} {...context} />);
    expect(mockTravelListItem.mock.calls[0][0].renderAuthorFeedback).toBeUndefined();
  });

  it('removes owner feedback immediately when the viewer changes and returns only for the owner', () => {
    const props = { item: baseTravel, showAuthorModerationFeedback: true };
    const screen = render(<RenderTravelItem {...props} currentUserId="42" />);
    expect(mockTravelListItem.mock.calls[0][0].renderAuthorFeedback).toEqual(expect.any(Function));
    screen.rerender(<RenderTravelItem {...props} currentUserId="99" />);
    expect(mockTravelListItem.mock.lastCall[0].renderAuthorFeedback).toBeUndefined();
    screen.rerender(<RenderTravelItem {...props} currentUserId={null} />);
    expect(mockTravelListItem.mock.lastCall[0].renderAuthorFeedback).toBeUndefined();
  });
});
