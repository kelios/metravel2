import { render } from '@testing-library/react-native';
import TabTravelCard from '@/components/listTravel/TabTravelCard';
import { MIN_PUBLIC_VIEW_COUNT, shouldShowViewCount } from '@/components/travel/utils/travelHelpers';

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isPhone: false,
    isLargePhone: false,
  }),
}));

jest.mock('@/components/ui/UnifiedTravelCard', () => ({
  __esModule: true,
  default: (props: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View testID={props.testID || 'unified-travel-card'}>{props.bottomRightSlot}</View>;
  },
}));

const renderCard = (views: number) =>
  render(
    <TabTravelCard
      item={{ id: '940', title: 'Глубокие и чистые озёра', imageUrl: null, views } as any}
      testID="card"
    />,
  );

// #2780: the recommendation shelves (hits of the week, recommendations,
// favourites) share the public view-count threshold with catalog cards.
describe('TabTravelCard view count', () => {
  it('hides a small view count from readers', () => {
    expect(renderCard(8).queryByTestId('card-views')).toBeNull();
  });

  it('shows the view count from the public threshold', () => {
    expect(renderCard(MIN_PUBLIC_VIEW_COUNT).getByTestId('card-views')).toBeTruthy();
  });

  it('keeps small counts visible to the owner through the shared rule', () => {
    expect(shouldShowViewCount(8, { isOwner: true })).toBe(true);
    expect(shouldShowViewCount(8)).toBe(false);
    expect(shouldShowViewCount(0, { isOwner: true })).toBe(false);
  });
});
