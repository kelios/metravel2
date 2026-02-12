import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Platform } from 'react-native';
import ShareButtons from '@/components/travel/ShareButtons';
import * as Clipboard from 'expo-clipboard';
import type { Travel } from '@/types/types';
import { openExternalUrl } from '@/utils/externalLinks';

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/travels/test-travel',
}));

// Mock expo-clipboard
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/utils/externalLinks', () => ({
  normalizeExternalUrl: jest.fn((url: string) => url),
  openExternalUrl: jest.fn(() => Promise.resolve(true)),
}));

// Mock showToast
const mockShowToast = jest.fn(() => Promise.resolve());
jest.mock('@/utils/toast', () => ({
  showToast: (...args: any[]) => mockShowToast(...args),
}));

// Mock window for web platform
const mockWindow = {
  location: { href: 'https://metravel.by/travels/test-travel' },
  open: jest.fn(),
};

describe('ShareButtons', () => {
  const mockTravel = {
    id: 1,
    slug: 'test-travel',
    name: 'Test Travel',
    title: 'Test Travel',
  } as unknown as Travel;

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform.OS as any) = 'web';
    if (typeof window !== 'undefined') {
      (window as any).location = mockWindow.location;
      (window as any).open = mockWindow.open;
      (window as any).navigator = {
        clipboard: {
          writeText: jest.fn(() => Promise.resolve()),
        },
      };
      (global as any).document = {
        getElementById: jest.fn(),
        createElement: jest.fn(() => ({
            appendChild: jest.fn(),
            style: {},
        })),
        createTextNode: jest.fn(() => ({})),
        body: {
            appendChild: jest.fn(),
            removeChild: jest.fn(),
        },
        head: {
            appendChild: jest.fn(),
        }
      };
    }
  });

  it('should render share buttons', () => {
    const { getByText } = render(<ShareButtons travel={mockTravel} />);

    expect(getByText('Поделиться')).toBeTruthy();
  });

  it('should copy link to clipboard on web', async () => {
    (Platform.OS as any) = 'web';
    const { getByLabelText } = render(<ShareButtons travel={mockTravel} />);

    const copyButton = getByLabelText('Копировать ссылку');
    fireEvent.press(copyButton);

    await waitFor(() => {
      if (typeof window !== 'undefined' && (window as any).navigator?.clipboard) {
        expect((window as any).navigator.clipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining('test-travel')
        );
      }
    });
  });

  it('should copy link to clipboard on mobile', async () => {
    (Platform.OS as any) = 'ios';
    const { getByLabelText } = render(<ShareButtons travel={mockTravel} />);

    const copyButton = getByLabelText('Копировать ссылку');
    fireEvent.press(copyButton);

    await waitFor(() => {
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('test-travel')
      );
    });
  });

  it('should show toast after copying', async () => {
    (Platform.OS as any) = 'ios';
    const { getByLabelText } = render(<ShareButtons travel={mockTravel} />);

    const copyButton = getByLabelText('Копировать ссылку');
    fireEvent.press(copyButton);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success', text1: 'Ссылка скопирована' })
      );
    });
  });

  it('should open Telegram share on button press', async () => {
    const { getByLabelText } = render(<ShareButtons travel={mockTravel} />);

    const telegramButton = getByLabelText('Telegram');
    fireEvent.press(telegramButton);

    await waitFor(() => {
      expect(openExternalUrl).toHaveBeenCalledWith(expect.stringContaining('t.me/share/url'));
    });
  });

  it('should use custom URL when provided', () => {
    (Platform.OS as any) = 'ios';
    const customUrl = 'https://custom-url.com/travel';
    const { getByLabelText } = render(<ShareButtons travel={mockTravel} url={customUrl} />);

    const copyButton = getByLabelText('Копировать ссылку');
    fireEvent.press(copyButton);

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(customUrl);
  });

  it('should handle share errors gracefully', async () => {
    (Clipboard.setStringAsync as jest.Mock).mockRejectedValueOnce(new Error('Copy failed'));
    (Platform.OS as any) = 'ios';

    const { getByLabelText } = render(<ShareButtons travel={mockTravel} />);

    const copyButton = getByLabelText('Копировать ссылку');
    fireEvent.press(copyButton);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', text1: 'Не удалось скопировать' })
      );
    });
  });

  it('should show copied state temporarily', async () => {
    (Platform.OS as any) = 'web';

    jest.useFakeTimers();

    const { getByLabelText, queryByText, getByText } = render(<ShareButtons travel={mockTravel} />);

    const copyButton = getByLabelText('Копировать ссылку');

    await act(async () => {
      fireEvent.press(copyButton);
    });

    expect(getByText('✓')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(2100);
    });

    expect(queryByText('✓')).toBeNull();

    jest.useRealTimers();
  });
});
