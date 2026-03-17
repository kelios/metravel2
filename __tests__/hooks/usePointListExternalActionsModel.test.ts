import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { usePointListExternalActionsModel } from '@/components/travel/hooks/usePointListExternalActionsModel';

const mockOpenExternal = jest.fn();
const mockOpenExternalUrl = jest.fn();
const mockClipboardSetStringAsync = jest.fn();

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrl: (...args: any[]) => mockOpenExternalUrl(...args),
}));

jest.mock('expo-clipboard', () => ({
  __esModule: true,
  setStringAsync: (...args: any[]) => mockClipboardSetStringAsync(...args),
}));

describe('usePointListExternalActionsModel', () => {
  const originalPlatformOS = Platform.OS;
  const originalNavigator = global.navigator;

  beforeEach(() => {
    mockOpenExternal.mockReset();
    mockOpenExternalUrl.mockReset();
    mockClipboardSetStringAsync.mockReset();
    (Platform as any).OS = originalPlatformOS;
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  afterAll(() => {
    (Platform as any).OS = originalPlatformOS;
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it('copies coords with navigator clipboard on web', async () => {
    (Platform as any).OS = 'web';
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(global, 'navigator', {
      value: { clipboard: { writeText } },
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() =>
      usePointListExternalActionsModel({
        baseUrl: 'https://example.com/travel',
        buildMapUrl: (coord: string) => `map:${coord}`,
        openExternal: mockOpenExternal,
      })
    );

    await act(async () => {
      await result.current.onCopy('53.9,27.56');
    });

    expect(writeText).toHaveBeenCalledWith('53.9,27.56');
    expect(mockClipboardSetStringAsync).not.toHaveBeenCalled();
  });

  it('falls back to web telegram share url on web', async () => {
    (Platform as any).OS = 'web';

    const { result } = renderHook(() =>
      usePointListExternalActionsModel({
        baseUrl: 'https://example.com/travel',
        buildMapUrl: (coord: string) => `https://maps.example/?q=${encodeURIComponent(coord)}`,
        openExternal: mockOpenExternal,
      })
    );

    await act(async () => {
      await result.current.onShare('53.9,27.56');
    });

    await waitFor(() => {
      expect(mockOpenExternal).toHaveBeenCalledWith(
        'https://t.me/share/url?url=https%3A%2F%2Fmaps.example%2F%3Fq%3D53.9%252C27.56&text=%D0%9A%D0%BE%D0%BE%D1%80%D0%B4%D0%B8%D0%BD%D0%B0%D1%82%D1%8B%3A%2053.9%2C27.56'
      );
    });
    expect(mockOpenExternalUrl).not.toHaveBeenCalled();
  });

  it('opens map and article urls through openExternal', () => {
    const { result } = renderHook(() =>
      usePointListExternalActionsModel({
        baseUrl: 'https://example.com/travel',
        buildMapUrl: (coord: string) => `map:${coord}`,
        openExternal: mockOpenExternal,
      })
    );

    act(() => {
      result.current.onOpenMap('53.9,27.56');
      result.current.onOpenArticle({ articleUrl: 'https://example.com/article' });
    });

    expect(mockOpenExternal).toHaveBeenNthCalledWith(1, 'map:53.9,27.56');
    expect(mockOpenExternal).toHaveBeenNthCalledWith(2, 'https://example.com/article');
  });
});
