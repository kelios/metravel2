import React from 'react';
import { render } from '@testing-library/react-native';

import {
  DescriptionSkeleton,
  MapSkeleton,
  PointListSkeleton,
  SidebarSectionSkeleton,
  SectionSkeleton,
  VideoSkeleton,
} from '@/components/travel/TravelDetailSkeletons';
import { StyleSheet } from 'react-native';
import TravelTmlRound from '@/components/travel/TravelTmlRound';
import { createTravelTmlRoundStyles, TRAVEL_TML_ROUND_IMAGE_HEIGHT } from '@/components/travel/TravelTmlRound.styles';
import { getThemedColors } from '@/constants/designSystem';
import type { Travel } from '@/types/types';

// We only care about the structure and the sizing invariants.
// Mock SkeletonLoader to make counting deterministic.
jest.mock('@/components/ui/SkeletonLoader', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    SkeletonLoader: ({ testID, width, height, borderRadius, style }: any) =>
      React.createElement(View, {
        testID: testID ?? 'skeleton-loader',
        width,
        height,
        borderRadius,
        style,
      }),
  };
});

jest.mock('@/hooks/useResponsive', () => ({
  ...jest.requireActual('@/hooks/useResponsive'),
  useResponsiveWidth: () => 390,
}));

describe('TravelDetailSkeletons', () => {
  it('DescriptionSkeleton reserves stable space', () => {
    const { getByTestId, queryAllByTestId } = render(<DescriptionSkeleton />);
    expect(queryAllByTestId('skeleton-loader')).toHaveLength(0);

    const reserved = getByTestId('travel-details-description-reserved');
    const flattened = StyleSheet.flatten(reserved.props.style);
    expect(typeof flattened.height).toBe('number');
    expect(flattened.height).toBeGreaterThan(0);
  });

  it('MapSkeleton renders exactly one block', () => {
    const { getAllByTestId } = render(<MapSkeleton />);
    expect(getAllByTestId('skeleton-loader')).toHaveLength(1);
  });

  it('PointListSkeleton renders 3 point cards with expected loaders per card', () => {
    const { getAllByTestId } = render(<PointListSkeleton />);
    // per card: image + title + subtitle => 3 loaders
    expect(getAllByTestId('skeleton-loader')).toHaveLength(3 * 3);
  });

  it('sidebar placeholders use the actual card skeleton for near and popular', () => {
    const { getAllByTestId } = render(<SidebarSectionSkeleton />);
    const placeholders = getAllByTestId('travel-sidebar-round-card-skeleton', { includeHiddenElements: true });
    expect(placeholders).toHaveLength(2);
    const loaded = render(<TravelTmlRound travel={{ id: 791, name: 'Маршрут', slug: 'route', travel_image_thumb_url: '' } as Travel} />);
    const styles = createTravelTmlRoundStyles(getThemedColors(false));
    const actualContainers = loaded.UNSAFE_getAllByType(require('react-native').View)
      .filter(node => StyleSheet.flatten(node.props.style)?.height === 250);
    expect(actualContainers).toHaveLength(1);
    for (const placeholder of placeholders) {
      expect(StyleSheet.flatten(placeholder.props.style)).toEqual(styles.container);
      expect(StyleSheet.flatten(placeholder.props.style)).toEqual(StyleSheet.flatten(actualContainers[0].props.style));
      expect(placeholder.findAllByProps({ testID: 'skeleton-loader' })[0].props.height).toBe(TRAVEL_TML_ROUND_IMAGE_HEIGHT);
    }
    expect(TRAVEL_TML_ROUND_IMAGE_HEIGHT).toBe(170);
  });

  it('VideoSkeleton renders exactly one block', () => {
    const { getAllByTestId } = render(<VideoSkeleton />);
    expect(getAllByTestId('skeleton-loader')).toHaveLength(1);
  });

  it('SectionSkeleton reserves stable space', () => {
    const { getByTestId, queryAllByTestId } = render(<SectionSkeleton lines={5} />);
    expect(queryAllByTestId('skeleton-loader')).toHaveLength(0);

    const reserved = getByTestId('travel-details-section-reserved');
    const flattened = StyleSheet.flatten(reserved.props.style);
    expect(typeof flattened.height).toBe('number');
    expect(flattened.height).toBeGreaterThan(0);
  });
});
