/**
 * @jest-environment jsdom
 */

import React, { Suspense } from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { TravelEngagementSection } from '@/components/travel/details/TravelDetailsDeferred';

// Stub heavy child components to simple markers
jest.mock('@/components/travel/TelegramDiscussionSection', () => {
  return () => <div data-testid="mock-telegram" />;
});

jest.mock('@/components/travel/ShareButtons', () => {
  return ({ testID }: { testID?: string }) => <div data-testid={testID || 'mock-share'} />;
});

jest.mock('@/components/travel/CTASection', () => {
  return () => <div data-testid="mock-cta" />;
});

const baseTravel: any = {
  id: 1,
  name: 'Demo Travel',
  gallery: [],
  travelAddress: [],
};

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={null}>{children}</Suspense>
);

describe('TravelEngagementSection', () => {
  it('renders Telegram block once on web', async () => {
    const result = render(
      <TravelEngagementSection travel={baseTravel} isMobile={false} />,
      { wrapper: Wrapper }
    );
    await waitFor(() => {
      expect(result.getAllByTestId('travel-details-telegram')).toHaveLength(1);
    });
  });

  it('renders ShareButtons only on desktop/web variant', async () => {
    const desktop = render(
      <TravelEngagementSection travel={baseTravel} isMobile={false} />,
      { wrapper: Wrapper }
    );
    await waitFor(() => {
      expect(desktop.getAllByTestId('travel-details-share')).toHaveLength(1);
    });

    const mobile = render(
      <TravelEngagementSection travel={baseTravel} isMobile />,
      { wrapper: Wrapper }
    );
    await waitFor(() => {
      expect(mobile.queryByTestId('travel-details-share')).toBeNull();
    });
  });
});
