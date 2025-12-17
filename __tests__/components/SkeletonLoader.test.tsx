import React from 'react';
import { render } from '@testing-library/react-native';
import { SkeletonLoader, TravelCardSkeleton, TravelListSkeleton } from '@/components/SkeletonLoader';
import { StyleSheet } from 'react-native';
import { TRAVEL_CARD_IMAGE_HEIGHT, TRAVEL_CARD_WEB_MOBILE_HEIGHT } from '@/components/listTravel/utils/listTravelConstants';

describe('SkeletonLoader', () => {
  it('should render with default props', () => {
    const { toJSON } = render(<SkeletonLoader />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should apply width/height/borderRadius and expose testID', () => {
    const { getByTestId } = render(
      <SkeletonLoader testID="skeleton" width={123} height={45} borderRadius={7} />
    );

    const node = getByTestId('skeleton');
    const flattened = StyleSheet.flatten(node.props.style);

    expect(flattened.width).toBe(123);
    expect(flattened.height).toBe(45);
    expect(flattened.borderRadius).toBe(7);
  });

  it('should render with custom width', () => {
    const { toJSON } = render(<SkeletonLoader width={200} />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should render with custom height', () => {
    const { toJSON } = render(<SkeletonLoader height={50} />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should render with custom borderRadius', () => {
    const { toJSON } = render(<SkeletonLoader borderRadius={8} />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should render with string width', () => {
    const { toJSON } = render(<SkeletonLoader width="50%" />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should render with custom style', () => {
    const customStyle = { marginTop: 10 };
    const { toJSON } = render(<SkeletonLoader style={customStyle} />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should combine default and custom styles', () => {
    const { toJSON } = render(
      <SkeletonLoader 
        width={100}
        height={20}
        borderRadius={4}
        style={{ margin: 10 }}
      />
    );
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });
});

describe('TravelCardSkeleton', () => {
  it('should render travel card skeleton', () => {
    const { toJSON } = render(<TravelCardSkeleton />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should render key elements with stable testIDs', () => {
    const { getByTestId } = render(<TravelCardSkeleton />);
    expect(getByTestId('travel-card-skeleton')).toBeTruthy();
    expect(getByTestId('travel-card-skeleton-image')).toBeTruthy();
  });

  // ✅ NEW: Проверка соответствия размеров skeleton и реальных карточек
  it('should match real card image height on mobile', () => {
    const { getByTestId } = render(<TravelCardSkeleton />);
    const image = getByTestId('travel-card-skeleton-image');
    const flattened = StyleSheet.flatten(image.props.style);
    expect(flattened.height).toBe(TRAVEL_CARD_IMAGE_HEIGHT);
  });

  it('should have correct card width', () => {
    const { getByTestId } = render(<TravelCardSkeleton />);
    const card = getByTestId('travel-card-skeleton');
    const flattened = StyleSheet.flatten(card.props.style);
    expect(flattened.width).toBe('100%');
  });

  it('should have matching border radius with design tokens', () => {
    const { getByTestId } = render(<TravelCardSkeleton />);
    const card = getByTestId('travel-card-skeleton');
    const flattened = StyleSheet.flatten(card.props.style);
    expect(typeof flattened.borderRadius).toBe('number');
    expect(flattened.borderRadius).toBeGreaterThan(0);
  });

  it('should expose a stable web-mobile card height constant', () => {
    expect(typeof TRAVEL_CARD_WEB_MOBILE_HEIGHT).toBe('number');
    expect(TRAVEL_CARD_WEB_MOBILE_HEIGHT).toBeGreaterThan(0);
  });
});

describe('TravelListSkeleton', () => {
  it('should render default count of skeletons', () => {
    const { toJSON } = render(<TravelListSkeleton />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should render specified count of skeletons', () => {
    const { getAllByTestId } = render(<TravelListSkeleton count={3} />);
    expect(getAllByTestId('travel-card-skeleton')).toHaveLength(3);
  });

  it('should render multiple card skeletons', () => {
    const { getAllByTestId } = render(<TravelListSkeleton count={5} />);
    expect(getAllByTestId('travel-card-skeleton')).toHaveLength(5);
  });

  it('should handle zero count', () => {
    const { toJSON } = render(<TravelListSkeleton count={0} />);
    const tree = toJSON();
    expect(tree).toBeNull();
  });
});
