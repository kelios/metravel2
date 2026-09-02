/**
 * @jest-environment jsdom
 */

import React, { Suspense } from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TravelDetailsFooterSection } from '@/components/travel/details/sections/TravelDetailsFooterSection';
import { FooterSectionSkeleton } from '@/components/travel/TravelDetailSkeletons';
import { DESIGN_TOKENS } from '@/constants/designSystem';

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

jest.mock('@/components/common/EmailSubscriptionForm', () => {
  const { View } = jest.requireActual('react-native');
  return () => <View testID="mock-email-subscription" />;
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
      expect(result.getAllByTestId('travel-details-email-subscribe')).toHaveLength(1);
      expect(result.getAllByTestId('mock-email-subscription')).toHaveLength(1);
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

  // #1698: секция комментариев над футером не имеет нижнего отступа, поэтому
  // блок обсуждения прилипал к ней вплотную. Отступ обязан жить на самом блоке,
  // иначе зазор снова начнёт зависеть от соседа сверху.
  it('keeps its own top spacing on the leading Telegram block', async () => {
    const result = render(
      <TravelDetailsFooterSection travel={baseTravel} isMobile={false} />,
      { wrapper: Wrapper }
    );

    const telegram = await result.findByTestId('travel-details-telegram');
    const telegramStyle = StyleSheet.flatten(telegram.props.style);

    expect(telegramStyle.marginTop).toBe(DESIGN_TOKENS.spacing.xl);
  });

  // Скелетон футера подменяется реальным футером поверх той же строки раскладки:
  // разошедшийся верхний отступ двигает страницу в момент подмены (CLS).
  it('matches the footer skeleton top spacing so the swap does not shift the page', async () => {
    const result = render(
      <TravelDetailsFooterSection travel={baseTravel} isMobile={false} />,
      { wrapper: Wrapper }
    );
    const telegram = await result.findByTestId('travel-details-telegram');
    const runtimeMarginTop = StyleSheet.flatten(telegram.props.style).marginTop;

    const skeleton = render(<FooterSectionSkeleton isMobile={false} />);
    const skeletonRoot = skeleton.toJSON() as { props: { style?: unknown } };
    const skeletonMarginTop = StyleSheet.flatten(skeletonRoot.props.style as never)?.marginTop;

    expect(skeletonMarginTop).toBe(runtimeMarginTop);
  });
});
