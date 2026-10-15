import type React from 'react';
import type { Root } from 'react-dom/client';

// Exercise real ReactDOM portals and RNW stacking ancestors, rather than a mocked portal.
let act: typeof import('react').act;
let createElement: typeof import('react').createElement;
let createPortal: typeof import('react-dom').createPortal;
let createRoot: typeof import('react-dom/client').createRoot;
let View: typeof import('react-native').View;
let ToastHost: React.ComponentType;
let eventName: string;

beforeAll(() => {
  jest.resetModules();
  jest.doMock('react-native', () => jest.requireActual('react-native-web'));
  jest.doMock('@expo/vector-icons/Feather', () => ({ __esModule: true, default: () => null }));
  ({ act, createElement } = require('react'));
  ({ createPortal } = require('react-dom'));
  ({ createRoot } = require('react-dom/client'));
  ({ View } = require('react-native'));
  ToastHost = require('@/components/ui/ToastHost.web').default;
  eventName = require('@/utils/toast.web').WEB_TOAST_EVENT_NAME;
});

describe('ToastHost web retained-modal DOM regression (#2440)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let unmounted: boolean;

  const status = () => document.body.querySelector<HTMLElement>('[role="status"]');
  const show = (text1: string, visibilityTime = 2000) => {
    act(() => {
      window.dispatchEvent(new CustomEvent(eventName, { detail: { text1, visibilityTime } }));
      jest.advanceTimersByTime(20);
    });
  };

  const renderLayers = (retained: boolean, reportSheet: boolean) => {
    act(() => {
      root.render(createElement(
        View,
        { testID: 'isolating-app-view', style: { zIndex: 0, transform: [{ translateX: 0 }] } },
        createElement(ToastHost),
        retained ? createPortal(createElement('div', {
          'data-testid': 'retained-gallery', style: { position: 'fixed', zIndex: 1000 },
        }), document.body) : null,
        reportSheet ? createPortal(createElement('div', {
          'data-testid': 'temporary-report-sheet', style: { position: 'fixed', zIndex: 9999 },
        }), document.body) : null,
      ));
    });
  };

  beforeEach(() => {
    jest.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    unmounted = false;
  });

  afterEach(() => {
    if (!unmounted) act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('keeps one acknowledgement outside the app stacking context after the report sheet closes', () => {
    const listener = jest.spyOn(window, 'addEventListener');
    renderLayers(true, true);
    renderLayers(true, false);
    show('Already reported. Reviewed within 24 hours.');

    const host = status();
    expect(host?.textContent).toContain('24 hours');
    // An inline host fails this boundary even with z-index: 99999. JSDOM does not prove pixels.
    expect(host?.parentElement).toBe(document.body);
    expect(container.contains(host)).toBe(false);
    expect(host?.style.zIndex).toBe('99999');
    expect(host?.style.pointerEvents).toBe('auto');
    expect(document.body.querySelector('[data-testid="retained-gallery"]')).not.toBeNull();
    expect(document.body.querySelector('[data-testid="temporary-report-sheet"]')).toBeNull();
    expect(document.body.querySelectorAll('[role="status"]')).toHaveLength(1);

    renderLayers(false, false);
    show('Root feedback');
    renderLayers(true, false);
    show('Reopened gallery feedback');
    expect(status()?.textContent).toBe('Reopened gallery feedback');
    expect(document.body.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(listener.mock.calls.filter(([name]) => name === eventName)).toHaveLength(1);
  });

  it('replaces the old expiry and removes the body portal and event listener on unmount', () => {
    const removeListener = jest.spyOn(window, 'removeEventListener');
    renderLayers(true, false);
    show('First report');
    act(() => jest.advanceTimersByTime(1000));
    show('Replacement report');
    act(() => jest.advanceTimersByTime(1000));
    expect(status()?.textContent).toBe('Replacement report');
    expect(status()?.style.opacity).toBe('1');
    act(() => jest.advanceTimersByTime(1000));
    expect(status()?.style.opacity).toBe('0');
    act(() => jest.advanceTimersByTime(250));
    expect(status()).toBeNull();

    show('Pending report');
    act(() => root.unmount());
    unmounted = true;
    expect(status()).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
    expect(removeListener.mock.calls.filter(([name]) => name === eventName)).toHaveLength(1);
    show('After unmount');
    expect(status()).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });
});
