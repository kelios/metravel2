import { act, renderHook } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockRemove = jest.fn();
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

const {
  normalizeIncomingAppLink,
  useIncomingAppLinks,
} = require('@/hooks/useIncomingAppLinks.native') as typeof import('@/hooks/useIncomingAppLinks.native');

describe('normalizeIncomingAppLink', () => {
  it.each([
    ['https://metravel.by/travels/test-slug', '/travels/test-slug'],
    ['metravel://travels/test-slug', '/travels/test-slug'],
    ['metravel:///travels/test-slug', '/travels/test-slug'],
    [
      'https://metravel.by/travels/test-slug?from=notification#reviews',
      '/travels/test-slug?from=notification',
    ],
  ])('normalizes %s', (url, expected) => {
    expect(normalizeIncomingAppLink(url)).toBe(expected);
  });

  it.each([
    'http://metravel.by/travels/test-slug',
    'https://example.com/travels/test-slug',
    'https://metravel.by.evil.example/travels/test-slug',
    'https://metravel.by',
    'metravel://',
    'mailto:test@metravel.by',
    'not a url',
    '',
  ])('rejects unsupported URL %s', (url) => {
    expect(normalizeIncomingAppLink(url)).toBeNull();
  });
});

describe('useIncomingAppLinks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRootNavigationState = { key: 'root' };
    urlListener = undefined;
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
