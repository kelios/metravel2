/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { TravelEngagementSection } from '@/components/travel/details/TravelDetailsContainer';

// Stub heavy child components to simple markers
jest.mock('@/components/travel/TelegramDiscussionSection', () => {
  const React = require('react');
  return () => <div data-testid="mock-telegram" />;
});

jest.mock('@/components/travel/ShareButtons', () => {
  const React = require('react');
  return ({ testID }: { testID?: string }) => <div data-testid={testID || 'mock-share'} />;
});

const baseTravel: any = {
  id: 1,
  name: 'Demo Travel',
  gallery: [],
  travelAddress: [],
};

describe('TravelEngagementSection', () => {
  it('renders Telegram block once on web', () => {
    const { getAllByTestId } = render(
      <TravelEngagementSection travel={baseTravel} isMobile={false} />
    );
    expect(getAllByTestId('travel-details-telegram')).toHaveLength(1);
  });

  it('renders ShareButtons only on desktop/web variant', () => {
    const desktop = render(<TravelEngagementSection travel={baseTravel} isMobile={false} />);
    expect(desktop.getAllByTestId('travel-details-share')).toHaveLength(1);

    const mobile = render(<TravelEngagementSection travel={baseTravel} isMobile />);
    expect(mobile.queryByTestId('travel-details-share')).toBeNull();
  });
});
