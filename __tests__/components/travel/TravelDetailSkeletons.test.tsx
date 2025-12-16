import React from 'react';
import { render } from '@testing-library/react-native';

import {
  DescriptionSkeleton,
  MapSkeleton,
  PointListSkeleton,
  TravelListSkeleton,
  SectionSkeleton,
  VideoSkeleton,
} from '@/components/travel/TravelDetailSkeletons';

// We only care about the structure and the sizing invariants.
// Mock SkeletonLoader to make counting deterministic.
jest.mock('@/components/SkeletonLoader', () => {
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

describe('TravelDetailSkeletons', () => {
  it('DescriptionSkeleton renders stable number of lines', () => {
    const { getAllByTestId } = render(<DescriptionSkeleton />);
    expect(getAllByTestId('skeleton-loader')).toHaveLength(8);
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

  it('TravelListSkeleton renders correct count (default=3)', () => {
    const { getAllByTestId } = render(<TravelListSkeleton />);
    // per item: image + title + subtitle => 3 loaders
    expect(getAllByTestId('skeleton-loader')).toHaveLength(3 * 3);
  });

  it('TravelListSkeleton renders correct count (custom)', () => {
    const { getAllByTestId } = render(<TravelListSkeleton count={2} />);
    expect(getAllByTestId('skeleton-loader')).toHaveLength(2 * 3);
  });

  it('VideoSkeleton renders exactly one block', () => {
    const { getAllByTestId } = render(<VideoSkeleton />);
    expect(getAllByTestId('skeleton-loader')).toHaveLength(1);
  });

  it('SectionSkeleton renders correct number of lines', () => {
    const { getAllByTestId } = render(<SectionSkeleton lines={5} />);
    expect(getAllByTestId('skeleton-loader')).toHaveLength(5);
  });
});
