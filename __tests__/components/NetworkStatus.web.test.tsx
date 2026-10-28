import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { NetworkStatus } from '@/components/ui/NetworkStatus.web';
import { getBottomChromeReserve, getCriticalBottomChromeOwner, resetBottomChromeReserve, setBottomChromeReserve } from '@/utils/bottomChromeReserve';
import { i18n } from '@/i18n';

const mockPush = jest.fn();
const mockIsConnected = jest.fn(() => false);
const mockPreloadOfflineRoute = jest.fn(() => Promise.resolve());
let mockDockReserve = 56;

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isConnected: mockIsConnected() }),
}));

jest.mock('@/utils/offlineRoutePreload.web', () => ({
  preloadOfflineRoute: () => mockPreloadOfflineRoute(),
}));

jest.mock('@/components/layout/bottomChromeInset', () => ({
  ...jest.requireActual('@/components/layout/bottomChromeInset'),
  useFloatingAnchorPx: () => mockDockReserve,
}));

describe('NetworkStatus web offline banner', () => {
  const originalOS = Platform.OS;
  beforeAll(() => { Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' }); });
  afterAll(() => { Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS }); });
  beforeEach(async () => {
    await act(async () => { await i18n.changeLanguage('ru'); });
    mockPush.mockClear();
    mockIsConnected.mockReturnValue(false);
    mockPreloadOfflineRoute.mockClear();
    mockDockReserve = 56;
    resetBottomChromeReserve();
  });
  afterEach(async () => {
    resetBottomChromeReserve();
    document.body.removeAttribute('data-footer-more-open');
    jest.restoreAllMocks();
    jest.useRealTimers();
    await act(async () => { await i18n.changeLanguage('ru'); });
  });

  it('does not intercept loaded-shell controls outside its action', async () => {
    const { getByTestId, getByText } = await render(<NetworkStatus />);

    expect(getByTestId('network-status-banner').props.pointerEvents).toBe('box-none');
    expect(getByText('Нет подключения к интернету').props.numberOfLines).toBe(2);
    expect(getByText('Открыть сохранённое').props.numberOfLines).toBe(1);
  });

  it('preloads the library module while the loaded shell is online', async () => {
    mockIsConnected.mockReturnValue(true);
    await render(<NetworkStatus />);

    expect(mockPreloadOfflineRoute).toHaveBeenCalledTimes(1);
  });

  it('opens the prefetched library without propagating the mobile tap', async () => {
    mockIsConnected.mockReturnValue(true);
    const view = await render(<NetworkStatus />);

    await waitFor(() => expect(mockPreloadOfflineRoute).toHaveBeenCalledTimes(1));
    await act(async () => Promise.resolve());

    mockIsConnected.mockReturnValue(false);
    await view.rerender(<NetworkStatus />);

    const stopPropagation = jest.fn();
    const preventDefault = jest.fn();
    await fireEvent(view.getByText('Открыть сохранённое'), 'press', {
      stopPropagation,
      preventDefault,
    });
    await fireEvent(view.getByText('Открыть сохранённое'), 'press', {
      stopPropagation,
      preventDefault,
    });

    expect(stopPropagation).toHaveBeenCalledTimes(2);
    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenCalledWith('/offline');
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('immediately anchors above the dock despite stale optional extents, then measures wrapping and dock resize', async () => {
    setBottomChromeReserve('consent-banner', 240);
    setBottomChromeReserve('app-install-bar', 400);
    const view = await render(<NetworkStatus position="bottom" />);
    expect(getCriticalBottomChromeOwner()).toBe('network-status');
    expect(StyleSheet.flatten(view.getByTestId('network-status-banner').props.style).bottom).toBe('calc(max(var(--mt-dock-h, 0px), var(--mt-footer-h, 0px)) + 8px)');
    await fireEvent(view.getByTestId('network-status-banner'), 'layout', { nativeEvent: { layout: { height: 84 } } });
    expect(getBottomChromeReserve()).toBe(56 + 8 + 84 + 8);
    mockDockReserve = 0;
    await view.rerender(<NetworkStatus position="bottom" />);
    expect(getBottomChromeReserve()).toBe(8 + 84 + 8);
    await view.unmount();
    expect(getCriticalBottomChromeOwner()).toBeNull();
    expect(getBottomChromeReserve()).toBe(400); // The unmounted optional owners' stored extents were only masked.
  });

  it('removes the offline banner and reserve while More is open, then restores both if still offline', async () => {
    const view = await render(<NetworkStatus position="bottom" />);
    expect(getBottomChromeReserve()).toBeGreaterThan(56);
    await act(() => window.dispatchEvent(new CustomEvent('metravel:footer-more', { detail: { open: true } })));
    expect(view.queryByTestId('network-status-banner')).toBeNull();
    expect(getBottomChromeReserve()).toBe(0);
    expect(getCriticalBottomChromeOwner()).toBe('network-status');
    await act(() => window.dispatchEvent(new CustomEvent('metravel:footer-more', { detail: { open: false } })));
    expect(view.getByTestId('network-status-banner')).toBeTruthy();
    expect(getBottomChromeReserve()).toBeGreaterThan(56);
    await view.unmount();
  });

  it('exits downward beyond its entire height and bottom offset without retaining hit targets or reserve', async () => {
    jest.useFakeTimers();
    const view = await render(<NetworkStatus position="bottom" />);
    mockIsConnected.mockReturnValue(true);
    await view.rerender(<NetworkStatus position="bottom" />);
    expect(getBottomChromeReserve()).toBeGreaterThan(56);
    await act(async () => { jest.advanceTimersByTime(2000); });
    const exiting = view.getByTestId('network-status-banner', { includeHiddenElements: true });
    expect(StyleSheet.flatten(exiting.props.style).transform).toContain('translateY(calc(100% + calc(');
    expect(exiting.props.pointerEvents).toBe('none');
    expect(exiting.props['aria-hidden']).toBe(true);
    expect(getBottomChromeReserve()).toBe(0);
    expect(getCriticalBottomChromeOwner()).toBe('network-status');
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(view.queryByTestId('network-status-banner')).toBeNull();
    expect(getCriticalBottomChromeOwner()).toBeNull();
  });

  it('cancels reconnect dismissal when offline returns and clears both dismissal timers on unmount', async () => {
    jest.useFakeTimers();
    const schedule = jest.spyOn(global, 'setTimeout');
    const cancel = jest.spyOn(global, 'clearTimeout');
    try {
      const view = await render(<NetworkStatus position="bottom" />);
      mockIsConnected.mockReturnValue(true);
      await view.rerender(<NetworkStatus position="bottom" />);
      await act(async () => { jest.advanceTimersByTime(1000); });
      mockIsConnected.mockReturnValue(false);
      await view.rerender(<NetworkStatus position="bottom" />);
      await act(async () => { jest.advanceTimersByTime(3000); });
      expect(view.getByTestId('network-status-banner').props.pointerEvents).toBe('box-none');
      mockIsConnected.mockReturnValue(true);
      await view.rerender(<NetworkStatus position="bottom" />);
      await act(async () => { jest.advanceTimersByTime(2000); });
      const ownedTimers = schedule.mock.results.flatMap((result, index) =>
        schedule.mock.calls[index][1] === 2000 || schedule.mock.calls[index][1] === 300 ? [result.value] : [],
      );
      expect(ownedTimers).toHaveLength(3); // cancelled reconnect + current dismiss + exit
      await view.unmount();
      for (const timer of ownedTimers) expect(cancel).toHaveBeenCalledWith(timer);
      // React act queues microtasks too; drain those without running any timeout.
      jest.runAllTicks();
      expect(jest.getTimerCount()).toBe(0);
      expect(getBottomChromeReserve()).toBe(0);
      expect(getCriticalBottomChromeOwner()).toBeNull();
    } finally {
      // Clear Jest's spy registry before uninstalling its fake clock; restoring
      // a spy again afterwards would reinstall its captured fake timeout.
      jest.restoreAllMocks();
      // RNTL's captured setImmediate polyfill calls the current setTimeout.
      jest.useRealTimers();
    }
  });

  it('retains priority when connectivity is lost during the exit animation', async () => {
    jest.useFakeTimers();
    const view = await render(<NetworkStatus position="bottom" />);
    mockIsConnected.mockReturnValue(true);
    await view.rerender(<NetworkStatus position="bottom" />);
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(getCriticalBottomChromeOwner()).toBe('network-status');
    mockIsConnected.mockReturnValue(false);
    await view.rerender(<NetworkStatus position="bottom" />);
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(getCriticalBottomChromeOwner()).toBe('network-status');
    expect(view.getByTestId('network-status-banner').props.pointerEvents).toBe('box-none');
    expect(getBottomChromeReserve()).toBe(132);
    await view.unmount();
    expect(getCriticalBottomChromeOwner()).toBeNull();
  });

  it('updates a persistent offline notice through the project locale transform without a network rerender', async () => {
    const view = await render(<NetworkStatus position="bottom" />);
    const banner = view.getByTestId('network-status-banner');
    const russianMessage = i18n.t('shared:components.ui.NetworkStatus.net_podklyucheniya_k_internetu_71e8692e');
    for (const locale of ['en', 'pl', 'be', 'uk', 'ru']) {
      await act(async () => { await i18n.changeLanguage(locale); });
      const message = i18n.t('shared:components.ui.NetworkStatus.net_podklyucheniya_k_internetu_71e8692e');
      const action = i18n.t('offline:openSaved');
      expect(i18n.resolvedLanguage).toBe(locale);
      if (locale !== 'ru') expect(message).not.toBe(russianMessage);
      expect(view.getByTestId('network-status-banner')).toBe(banner);
      expect(view.getByText(message)).toBeTruthy();
      expect(view.getByText(action)).toBeTruthy();
      expect(view.getByRole('button', { name: action })).toBeTruthy();
      expect(mockIsConnected()).toBe(false);
    }
  });
});
