import React from 'react';
import { act, render } from '@testing-library/react-native';

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: {
      ...RN.Platform,
      OS: 'web',
      select: (obj: any) => obj.web ?? obj.default,
    },
  };
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    primary: '#6f9488',
    primaryLight: '#eef5f2',
    surface: '#ffffff',
    text: '#222222',
    textMuted: '#666666',
    border: '#d9d9d9',
    boxShadows: { heavy: '0 8px 24px rgba(0,0,0,0.14)' },
    shadows: { heavy: {} },
  }),
}));

jest.mock('@expo/vector-icons/Feather', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return ({ name }: { name: string }) => React.createElement(Text, null, name);
});

jest.mock('@/components/ui/Button', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return function MockButton({ label, onPress, testID }: { label: string; onPress?: () => void; testID?: string }) {
    return React.createElement(
      Pressable,
      { onPress, testID },
      React.createElement(Text, null, label),
    );
  };
});

import {
  MapOnboarding,
  measureInFrame,
  restartMapOnboarding,
  tooltipPosition,
} from '@/components/MapPage/MapOnboarding';

describe('MapOnboarding', () => {
  const setViewportWidth = (width: number) => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: width,
    });
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      writable: true,
      value: width,
    });
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: /max-width:\s*767px/.test(query) ? width <= 767 : false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
  };

  beforeEach(() => {
    jest.useFakeTimers();
    setViewportWidth(1280);
    localStorage.clear();
    document.body.removeAttribute('data-consent-banner-open');
    document.documentElement.removeAttribute('data-consent-banner-open');
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('does not auto-open on desktop web', async () => {
    const { queryByText, queryByTestId } = render(<MapOnboarding mobileWebCoachmark={false} />);

    await act(async () => {
      jest.advanceTimersByTime(1200);
    });

    expect(queryByText('Карта путешествий')).toBeNull();
    expect(queryByTestId('onboarding-next')).toBeNull();
  });

  it('auto-opens a lightweight coachmark on mobile web', async () => {
    setViewportWidth(390);

    const { getByText, getByTestId } = render(<MapOnboarding mobileWebCoachmark />);

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      jest.advanceTimersByTime(1200);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText('С чего начать')).toBeTruthy();
    expect(getByText(/Нажмите «Найти места рядом»/)).toBeTruthy();
    expect(getByTestId('onboarding-next')).toBeTruthy();
  });

  it('defers mobile web coachmark while the consent banner is open', async () => {
    setViewportWidth(390);

    const { getByText, queryByTestId, rerender } = render(
      <MapOnboarding mobileWebCoachmark suspendAutoOpen />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      jest.advanceTimersByTime(1200);
    });

    expect(queryByTestId('onboarding-next')).toBeNull();

    await act(async () => {
      rerender(<MapOnboarding mobileWebCoachmark suspendAutoOpen={false} />);
      await Promise.resolve();
    });

    act(() => {
      jest.advanceTimersByTime(1200);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText('С чего начать')).toBeTruthy();
  });

  it('still opens when restarted manually', async () => {
    const { getByText, getByTestId } = render(<MapOnboarding mobileWebCoachmark={false} />);

    await act(async () => {
      restartMapOnboarding();
    });

    expect(getByText('Карта путешествий')).toBeTruthy();
    expect(getByTestId('onboarding-next')).toBeTruthy();
  });

  // #2251 — the tour mounts late (`shouldLoadOnboarding`): a «Подсказки» press
  // before that is replayed on mount instead of being dropped.
  it('a restart pressed before the tour mounts opens it on mount', async () => {
    restartMapOnboarding();

    const { getByText } = render(<MapOnboarding mobileWebCoachmark={false} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText('Карта путешествий')).toBeTruthy();
  });

  it('a restart pressed before the tour mounts under the cookie banner shows once it closes', async () => {
    setViewportWidth(390);
    restartMapOnboarding();

    const { queryByTestId, getByTestId, rerender } = render(
      <MapOnboarding mobileWebCoachmark suspendAutoOpen />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(queryByTestId('onboarding-next')).toBeNull();

    await act(async () => {
      rerender(<MapOnboarding mobileWebCoachmark suspendAutoOpen={false} />);
      await Promise.resolve();
    });

    expect(getByTestId('onboarding-next')).toBeTruthy();
  });

  // #2251 — overlays show one at a time (#607, #1008): a manual restart while
  // the cookie banner is open waits for the banner to close.
  it('a manual restart while the cookie banner is open shows once the banner closes', async () => {
    setViewportWidth(390);

    const { queryByTestId, getByTestId, rerender } = render(
      <MapOnboarding mobileWebCoachmark suspendAutoOpen />,
    );
    await act(async () => {
      restartMapOnboarding();
    });

    expect(queryByTestId('onboarding-next')).toBeNull();

    await act(async () => {
      rerender(<MapOnboarding mobileWebCoachmark suspendAutoOpen={false} />);
      await Promise.resolve();
    });

    expect(getByTestId('onboarding-next')).toBeTruthy();
  });

  // #2263 — the tour overlay is not the viewport: on desktop web it starts under
  // the 64 px site header. Prod probe (1180×820): tab bottom 191 in the viewport,
  // card `top` 203 inside an overlay at y=64 → card at 267, 76 under the tab.
  // The target is measured in the overlay's coordinates, so the card stands
  // TOOLTIP_GAP_PX (12) under it wherever the overlay starts.
  it.each([0, 64])('the card stands 12 under its target with the overlay at y=%i', (frameTop) => {
    const tab = { top: 147, left: 40, width: 102, height: 44 };
    const frame = { top: frameTop, left: 0, width: 1180, height: 820 - frameTop };

    const local = measureInFrame(tab, frame);
    const pos = tooltipPosition(local, 'bottom');
    const cardTopInViewport = frame.top + (pos.top as number);
    const spotlightTopInViewport = frame.top + local.top;

    expect(cardTopInViewport - (tab.top + tab.height)).toBe(12);
    expect(spotlightTopInViewport).toBe(tab.top);
    expect(pos.left).toBe(tab.left);
  });
});
