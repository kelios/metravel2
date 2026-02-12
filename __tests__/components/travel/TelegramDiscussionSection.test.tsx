import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import TelegramDiscussionSection from '@/components/travel/TelegramDiscussionSection';
import { openExternalUrlInNewTab } from '@/utils/externalLinks';

jest.mock('@/utils/externalLinks', () => ({
  normalizeExternalUrl: jest.fn((url: string) => url),
  openExternalUrlInNewTab: jest.fn(() => Promise.resolve(true)),
}));

describe('TelegramDiscussionSection', () => {
  const originalEnv = process.env.EXPO_PUBLIC_TELEGRAM_DISCUSSION_URL;

  afterEach(() => {
    process.env.EXPO_PUBLIC_TELEGRAM_DISCUSSION_URL = originalEnv;
    jest.clearAllMocks();
  });

  it('opens telegram discussion link via external helper', () => {
    process.env.EXPO_PUBLIC_TELEGRAM_DISCUSSION_URL = 'https://t.me/metravel_discussion';

    const { getByLabelText } = render(
      <TelegramDiscussionSection travel={{ name: 'Test Travel' } as any} />
    );

    fireEvent.press(getByLabelText('Открыть обсуждение в Telegram'));

    expect(openExternalUrlInNewTab).toHaveBeenCalledWith(
      'https://t.me/metravel_discussion',
      expect.any(Object)
    );
  });
});
