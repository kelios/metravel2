import React from 'react';
import { BackHandler, Platform, ToastAndroid } from 'react-native';
import { render } from '@testing-library/react-native';

const mockRouter = {
  canGoBack: jest.fn(() => true),
  back: jest.fn(),
  replace: jest.fn(),
  push: jest.fn(),
};
let mockPathname = '/profile';
const mockFocus = { focused: true };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname,
  // Mirrors expo-router: the effect runs while the screen is focused and its
  // cleanup runs on blur. Focus is toggled through `mockFocus` + rerender.
  useFocusEffect: (effect: () => undefined | (() => void)) => {
    const ReactLib = require('react');
    const focused = mockFocus.focused;
    ReactLib.useEffect(() => {
      if (!focused) return undefined;
      return effect();
    }, [effect, focused]);
  },
}));

import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';

type ScreenProps = { onDismiss?: () => boolean; resolveBack?: () => boolean };

function Screen({ onDismiss, resolveBack }: ScreenProps) {
  useAndroidBackHandler(onDismiss, resolveBack ? { resolveBack } : undefined);
  return null;
}

type BackPressHandler = () => boolean;

describe('useAndroidBackHandler (NAV-1: focus-scoped subscription)', () => {
  const originalPlatform = Platform.OS;
  const remove = jest.fn();
  let addListener: jest.SpyInstance;

  const lastHandler = (): BackPressHandler =>
    addListener.mock.calls[addListener.mock.calls.length - 1][1] as BackPressHandler;

  beforeEach(() => {
    (Platform as { OS: string }).OS = 'android';
    mockPathname = '/profile';
    mockFocus.focused = true;
    mockRouter.canGoBack.mockReturnValue(true);
    mockRouter.back.mockClear();
    remove.mockClear();
    addListener = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation(() => ({ remove }));
    jest.spyOn(ToastAndroid, 'show').mockImplementation(() => undefined);
  });

  afterEach(() => {
    (Platform as { OS: string }).OS = originalPlatform;
    jest.restoreAllMocks();
  });

  it('subscribes once while focused and does not re-subscribe when the route or callbacks change', () => {
    const { rerender } = render(<Screen onDismiss={() => false} />);
    expect(addListener).toHaveBeenCalledTimes(1);

    mockPathname = '/messages';
    rerender(<Screen onDismiss={() => false} />);
    rerender(<Screen onDismiss={() => false} />);

    expect(addListener).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
  });

  it('reads the latest route inside the long-lived handler', () => {
    const { rerender } = render(<Screen />);
    const handler = lastHandler();

    // Not home: delegate to the router.
    expect(handler()).toBe(true);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);

    // Navigated to home without re-subscribing: the first press shows the
    // "press again to exit" toast and is consumed, the second one exits.
    mockPathname = '/';
    rerender(<Screen />);
    expect(addListener).toHaveBeenCalledTimes(1);
    expect(handler()).toBe(true);
    expect(ToastAndroid.show).toHaveBeenCalledTimes(1);
    expect(handler()).toBe(false);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('does not listen while the screen is not focused and starts listening on focus', () => {
    mockFocus.focused = false;
    const { rerender } = render(<Screen />);
    expect(addListener).not.toHaveBeenCalled();

    mockFocus.focused = true;
    rerender(<Screen />);
    expect(addListener).toHaveBeenCalledTimes(1);

    mockFocus.focused = false;
    rerender(<Screen />);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('removes the subscription on unmount', () => {
    const { unmount } = render(<Screen />);
    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('prefers a dismissed sheet, then the explicit back target, then the router', () => {
    const onDismiss = jest.fn(() => true);
    const resolveBack = jest.fn(() => true);
    const { rerender } = render(<Screen onDismiss={onDismiss} resolveBack={resolveBack} />);
    const handler = lastHandler();

    expect(handler()).toBe(true);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(resolveBack).not.toHaveBeenCalled();

    onDismiss.mockReturnValue(false);
    rerender(<Screen onDismiss={onDismiss} resolveBack={resolveBack} />);
    expect(handler()).toBe(true);
    expect(resolveBack).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).not.toHaveBeenCalled();

    resolveBack.mockReturnValue(false);
    mockRouter.canGoBack.mockReturnValue(false);
    rerender(<Screen onDismiss={onDismiss} resolveBack={resolveBack} />);
    expect(handler()).toBe(false);
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('does nothing off Android', () => {
    (Platform as { OS: string }).OS = 'ios';
    render(<Screen />);
    expect(addListener).not.toHaveBeenCalled();
  });
});
