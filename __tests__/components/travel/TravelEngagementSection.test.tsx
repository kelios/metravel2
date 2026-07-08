/**
 * @jest-environment jsdom
 */

import React, { Suspense } from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { TravelDetailsFooterSection } from '@/components/travel/details/sections/TravelDetailsFooterSection';

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

describe('TravelDetailsFooterSection', () => {
  it('renders Telegram block once on web', async () => {
    const result = render(
      <TravelDetailsFooterSection travel={baseTravel} isMobile={false} />,
      { wrapper: Wrapper }
    );
    await waitFor(() => {
      expect(result.getAllByTestId('travel-details-telegram')).toHaveLength(1);
    });
  });

  it('renders ShareButtons only on desktop/web variant', async () => {
    const desktop = render(
      <TravelDetailsFooterSection travel={baseTravel} isMobile={false} />,
      { wrapper: Wrapper }
    );
    await waitFor(() => {
      expect(desktop.getAllByTestId('travel-details-share')).toHaveLength(1);
    });

    const mobile = render(
      <TravelDetailsFooterSection travel={baseTravel} isMobile />,
      { wrapper: Wrapper }
    );
    await waitFor(() => {
      expect(mobile.queryByTestId('travel-details-share')).toBeNull();
    });
  });
});
