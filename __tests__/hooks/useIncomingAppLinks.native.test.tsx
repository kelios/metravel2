import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { redirectSystemPath } from '@/app/+native-intent';
import { mapIncomingAppLinkToHref } from '@/utils/incomingAppLinks';

const mockPush = jest.fn();
const mockRemove = jest.fn();
const originalPlatformOS = Platform.OS;
let mockRootNavigationState: { key?: string } | undefined = { key: 'root' };
let urlListener: ((event: unknown) => void) | undefined;

const mockAddListener = jest.fn(
  (_eventName: string, listener: (event: unknown) => void) => {
    urlListener = listener;
    return { remove: mockRemove };
  },
);

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRootNavigationState: () => mockRootNavigationState,
}));

const expoGlobal = globalThis as typeof globalThis & {
  expo?: { modules?: Record<string, unknown> };
};
expoGlobal.expo = {
  ...expoGlobal.expo,
  modules: {
    ...expoGlobal.expo?.modules,
    ExpoLinking: { addListener: mockAddListener },
  },
};

const { useIncomingAppLinks } =
  require('@/hooks/useIncomingAppLinks.native') as typeof import('@/hooks/useIncomingAppLinks.native');

describe('mapIncomingAppLinkToHref', () => {
  it.each([
    ['https://metravel.by/travels/test-slug', '/travels/test-slug'],
    [
      'https://metravel.by/travels/test-slug?from=hello%20world',
      '/travels/test-slug?from=hello%20world',
    ],
    [
      'https://metravel.by/article/42?from=email&campaign=summer#comments',
      '/article/42?from=email&campaign=summer',
    ],
    [
      'https://metravel.by/quests/krakow/krakow-dragon?step=2#clue',
      '/quests/krakow/krakow-dragon?step=2',
    ],
    ['https://metravel.by/map?lat=50.06&lng=19.94', '/map?lat=50.06&lng=19.94'],
    ['https://metravel.by/user/17?tab=travels', '/user/17?tab=travels'],
    ['metravel://travels/test-slug', '/travels/test-slug'],
    ['metravel:///article/42?from=share#comments', '/article/42?from=share'],
    ['metravel://quests/krakow/krakow-dragon', '/quests/krakow/krakow-dragon'],
    ['metravel://map?lat=50.06', '/map?lat=50.06'],
    ['metravel://user/17', '/user/17'],
    ['metravel:///trips/plan/31?edit=1', '/trips/plan/31?edit=1'],
    ['metravel:///search', '/search'],
    ['metravel:///favorites', '/favorites'],
  ])('normalizes %s', (url, expected) => {
    expect(mapIncomingAppLinkToHref(url)).toBe(expected);
  });

  it.each([
    'http://metravel.by/travels/test-slug',
    'https://example.com/travels/test-slug',
    'https://metravel.by.evil.example/travels/test-slug',
    'https://user@metravel.by/travels/test-slug',
    'https://metravel.by:443/travels/test-slug',
    'https://metravel.by',
    'https://metravel.by/profile',
    'https://metravel.by/search',
    'https://metravel.by/favorites',
    'https://metravel.by/trips/plan/31',
    'https://metravel.by/travels/test-slug/extra',
    'https://metravel.by/article/42/extra',
    'https://metravel.by/quests/krakow/krakow-dragon/extra',
    'https://metravel.by/map/extra',
    'https://metravel.by/user/17/extra',
    'https://metravel.by/travels/../map',
    'https://metravel.by/travels/%2e%2e/map',
    'https://metravel.by/travels/test%2fslug',
    'https://metravel.by/travels/%ZZ',
    'https://metravel.by/travels/test-slug?from=%ZZ',
    'https://metravel.by/travels/test-slug?from=%25ZZ',
    'metravel://travels/test-slug?from=%00',
    'metravel://',
    'metravel:/travels/test-slug',
    'metravel://travels/test-slug/extra',
    'metravel:///trips/plan/0',
    'metravel:///trips/plan/not-an-id',
    'metravel:///trips/plan/31/extra',
    'mailto:test@metravel.by',
    'not a url',
    ' https://metravel.by/travels/test-slug',
    '',
  ])('rejects unsupported URL %s', (url) => {
    expect(mapIncomingAppLinkToHref(url)).toBeNull();
  });

  it('is the Expo Router mapper for both initial and warm iOS lifecycle paths', () => {
    const url = 'https://metravel.by/quests/krakow/krakow-dragon?step=2#clue';

    expect(redirectSystemPath({ path: url, initial: true })).toBe(
      '/quests/krakow/krakow-dragon?step=2',
    );
    expect(redirectSystemPath({ path: url, initial: false })).toBe(
      '/quests/krakow/krakow-dragon?step=2',
    );
    expect(
      redirectSystemPath({
        path: 'https://example.com/travels/test-slug',
        initial: false,
      }),
    ).toBeNull();
  });

  it.each([
    ['metravel:///search', '/search'],
    ['metravel:///map', '/map'],
    ['metravel:///favorites', '/favorites'],
    ['metravel:///trips/plan/31', '/trips/plan/31'],
  ])(
    'preserves tracked custom-scheme fallback %s on cold and warm entry',
    (url, expected) => {
      expect(redirectSystemPath({ path: url, initial: true })).toBe(expected);
      expect(redirectSystemPath({ path: url, initial: false })).toBe(expected);
    },
  );
});

describe('useIncomingAppLinks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    mockRootNavigationState = { key: 'root' };
    urlListener = undefined;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatformOS,
    });
  });

  it('leaves iOS lifecycle ownership to Expo Router without a second listener', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });

    renderHook(() => useIncomingAppLinks());

    expect(mockAddListener).not.toHaveBeenCalled();
  });

  it('reads the native event payload and suppresses an immediate duplicate delivery', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    renderHook(() => useIncomingAppLinks());

    act(() => {
      urlListener?.({ url: 'https://metravel.by/travels/first' });
      urlListener?.({ url: 'https://metravel.by/travels/first' });
    });

    expect(mockAddListener).toHaveBeenCalledWith(
      'onURLReceived',
      expect.any(Function),
    );
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/travels/first');

    nowSpy.mockReturnValue(2_001);
    act(() => {
      urlListener?.({ url: 'https://metravel.by/travels/first' });
    });
    expect(mockPush).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });

  it('keeps the latest warm link pending until root navigation is ready', () => {
    mockRootNavigationState = undefined;
    const { rerender } = renderHook(() => useIncomingAppLinks());

    act(() => {
      urlListener?.({ url: 'metravel://travels/first' });
      urlListener?.({ url: 'metravel://travels/latest' });
    });
    expect(mockPush).not.toHaveBeenCalled();

    mockRootNavigationState = { key: 'root' };
    rerender({});

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/travels/latest');
  });

  it('ignores malformed or external events and removes the native listener', () => {
    const { unmount } = renderHook(() => useIncomingAppLinks());

    act(() => {
      urlListener?.({ url: 'https://example.com/travels/test' });
      urlListener?.({ url: 'https://metravel.by' });
      urlListener?.(null);
    });
    expect(mockPush).not.toHaveBeenCalled();

    unmount();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });
});
