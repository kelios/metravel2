import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Platform, Share } from 'react-native';
import ShareButtons from '@/components/travel/ShareButtons';
import * as Clipboard from 'expo-clipboard';
import type { Travel } from '@/types/types';
import { openExternalUrlInNewTab } from '@/utils/externalLinks';

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
  openExternalUrlInNewTab: jest.fn(() => Promise.resolve(true)),
}));

// Mock showToast
const mockShowToast = jest.fn(() => Promise.resolve());
jest.mock('@/utils/toast', () => ({
  showToast: (arg: unknown) => mockShowToast(arg),
}));

// #2119: в приложении кнопка книги зависит от модуля печати (expo-print).
let mockPrintAvailable = true;
jest.mock('@/utils/printAvailability', () => ({
  isPrintAvailable: () => mockPrintAvailable,
}));

// #2274: мост экспорта отдаёт состояние «идёт сборка» с отменой.
const mockCancelPdfExport = jest.fn();
jest.mock('@/components/travel/ShareButtonsPdfExportBridge', () => {
  const React = require('react');
  function MockPdfExportBridge({ onStateChange }: { onStateChange: (state: unknown) => void }) {
    React.useEffect(() => {
      onStateChange({
        isGenerating: true,
        progress: 85,
        currentStage: 'rendering',
        lastSettings: {},
        cancel: mockCancelPdfExport,
      });
    }, [onStateChange]);
    return null;
  }
  return { __esModule: true, default: MockPdfExportBridge };
});

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
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('кнопка «PDF / книга» (#2119)', () => {
    afterEach(() => {
      mockPrintAvailable = true;
    });

    it('на сайте кнопка есть', () => {
      (Platform.OS as any) = 'web';
      expect(render(<ShareButtons travel={mockTravel} />).queryByText('PDF / книга')).not.toBeNull();
    });

    it.each(['ios', 'android'])('в приложении %s кнопка есть, когда в сборке есть модуль печати', (os) => {
      (Platform.OS as any) = os;
      expect(render(<ShareButtons travel={mockTravel} />).queryByText('PDF / книга')).not.toBeNull();
    });

    it.each(['ios', 'android'])('в сборке приложения %s без модуля печати кнопки нет', (os) => {
      (Platform.OS as any) = os;
      mockPrintAvailable = false;
      expect(render(<ShareButtons travel={mockTravel} />).queryByText('PDF / книга')).toBeNull();
    });

    it.each(['ios', 'web'])('#2274 %s: на время сборки кнопка отменяет её, а не заблокирована', async (os) => {
      (Platform.OS as any) = os;
      const view = render(<ShareButtons travel={mockTravel} />);
      fireEvent.press(view.getByText('PDF / книга'));

      const progressButton = await view.findByText('PDF 85%');
      fireEvent.press(progressButton);

      expect(mockCancelPdfExport).toHaveBeenCalledTimes(1);
      expect(view.getByLabelText(/Отменить/)).toBeTruthy();
    });
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

  it('should render native share action and use Share API on mobile', async () => {
    (Platform.OS as any) = 'ios';
    const { getByLabelText } = render(<ShareButtons travel={mockTravel} />);

    const nativeShareButton = getByLabelText('Открыть системное меню Поделиться');
    fireEvent.press(nativeShareButton);

    await waitFor(() => {
      expect(Share.share).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Travel',
          message: expect.stringContaining('https://'),
        })
      );
    });
  });

  it('should open Telegram share on button press', async () => {
    const { getByLabelText } = render(<ShareButtons travel={mockTravel} />);

    const telegramButton = getByLabelText('Поделиться в Telegram');
    fireEvent.press(telegramButton);

    await waitFor(() => {
      expect(openExternalUrlInNewTab).toHaveBeenCalledWith(expect.stringContaining('t.me/share/url'));
    });
  });

  it('should render grouped share sections on default variant', () => {
    const { getByText } = render(<ShareButtons travel={mockTravel} />);

    expect(getByText('Быстрые действия')).toBeTruthy();
    expect(getByText('Соцсети')).toBeTruthy();
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

    const { getByLabelText } = render(<ShareButtons travel={mockTravel} />);

    const copyButton = getByLabelText('Копировать ссылку');

    await act(async () => {
      fireEvent.press(copyButton);
    });

    expect(getByLabelText('Копировать ссылку')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(2100);
    });


    jest.useRealTimers();
  });
});
