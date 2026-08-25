import { act, fireEvent, render } from '@testing-library/react-native';
import { AppState, Platform } from 'react-native';

import UpsertTravelRoute from '@/components/travel/upsert/UpsertTravelRoute';

// #1511 — physical Pixel 10 Pro release build repro (board ticket #1511,
// "Приёмка board-reviewer — 2026-08-22, Android lifecycle recheck"): the
// author taps Save, immediately sends the app to background, and returns a
// few seconds later. Instead of the editor they land on
// TravelFormErrorBoundary's fallback ("Что-то пошло не так" / "Попробовать
// снова") even though the server already confirmed the save.
//
// Root cause: Hermes on the Android release build does not provide
// Intl.RelativeTimeFormat. A successful save flips `autosave.phase` to
// 'saved' and sets `lastSaved`; `getAutosaveBadge`/`formatAutosaveLastSaved`
// in useUpsertTravelController.ts used to build
// `new Intl.RelativeTimeFormat(...)` unconditionally for that render - a
// synchronous throw during render, caught by the nearest error boundary
// (TravelFormErrorBoundary). The success response is typically only observed
// once the JS thread resumes on foreground, but the crash itself is a pure
// function of rendering with phase 'saved' while the constructor is missing -
// it does not matter whether that render happens while still backgrounded or
// right after resuming.
//
// This test drives the real TravelFormErrorBoundary (via the real
// UpsertTravelRoute) and the real getAutosaveBadge/formatAutosaveLastSaved
// from useUpsertTravelController.ts - neither is reimplemented or mocked
// here. Only the heavy wizard subtree (@/components/travel/UpsertTravel) is
// replaced by a narrow harness exposing a marker, an explicit-save trigger
// and the real badge computation, mirroring the mocking style already used
// by UpsertTravelRoute.native.test.tsx.

const mockDescriptionMarker = 'lifecycle-marker-1511-in-flight-save';

jest.mock('@/components/travel/UpsertTravel', () => {
  const React = require('react');
  const { Text, View, AppState: RNAppState } = require('react-native');
  const {
    getAutosaveBadge,
  } = require('@/components/travel/upsert/useUpsertTravelController');

  return {
    __esModule: true,
    default: function MockUpsertTravel() {
      const [appState, setAppState] = React.useState('active');
      const [autosave, setAutosave] = React.useState({
        phase: 'idle',
        isOnline: true,
        hasUnsavedChanges: false,
        lastSaved: null,
      });

      React.useEffect(() => {
        const subscription = RNAppState.addEventListener('change', (next: string) => {
          setAppState(next);
        });
        return () => subscription.remove();
      }, []);

      const handleExplicitSave = React.useCallback(() => {
        setAutosave((prev: typeof autosave) => ({ ...prev, phase: 'saving', hasUnsavedChanges: true }));
        // The server confirmation can be delivered while Android has the app
        // backgrounded - the pending JS callback still runs, it is simply not
        // observed by the author until the screen is foregrounded again.
        setTimeout(() => {
          setAutosave({
            phase: 'saved',
            isOnline: true,
            hasUnsavedChanges: false,
            lastSaved: new Date(),
          });
        }, 0);
      }, []);

      // Same call site shape as useUpsertTravelController.ts:305 -
      // `getAutosaveBadge(form.autosave, autosaveClock)` - invoked directly in
      // the render body, so a throw here is a render-phase error the nearest
      // TravelFormErrorBoundary has to catch.
      const badge = getAutosaveBadge(autosave);

      return (
        <View>
          <Text>{mockDescriptionMarker}</Text>
          <Text testID="app-state-probe">{appState}</Text>
          <Text testID="upsert-travel-save" onPress={handleExplicitSave}>
            {'Save'}
          </Text>
          <Text testID="autosave-badge-probe">{badge}</Text>
        </View>
      );
    },
  };
});

describe('UpsertTravelRoute - Android explicit save / background / foreground (#1511)', () => {
  const originalPlatformOs = Platform.OS;

  const setPlatformOs = (os: string) => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  };

  afterEach(() => {
    setPlatformOs(originalPlatformOs);
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('keeps the editor visible with the marker and no error screen after a save confirms while backgrounded', () => {
    setPlatformOs('android');
    jest.useFakeTimers();

    const originalRelativeTimeFormat = Intl.RelativeTimeFormat;
    // Hermes on the Android release build does not provide
    // Intl.RelativeTimeFormat - reproduce that runtime here.
    Object.defineProperty(Intl, 'RelativeTimeFormat', {
      configurable: true,
      value: undefined,
    });

    let appStateListener: ((state: string) => void) | undefined;
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener: any) => {
      if (event === 'change') appStateListener = listener;
      return { remove } as any;
    });

    try {
      const { getByText, getByTestId, queryByText } = render(<UpsertTravelRoute />);

      // Editor visible with the marker before anything else happens.
      expect(getByText(mockDescriptionMarker)).toBeTruthy();

      // Explicit save.
      fireEvent.press(getByTestId('upsert-travel-save'));

      // The author immediately sends the app to background.
      act(() => {
        appStateListener?.('background');
      });
      expect(getByTestId('app-state-probe').props.children).toBe('background');

      // The successful response lands while the app is still backgrounded -
      // this is the render that used to throw building the missing
      // Intl.RelativeTimeFormat constructor.
      act(() => {
        jest.advanceTimersByTime(0);
      });

      // The author returns to the foreground.
      act(() => {
        appStateListener?.('active');
      });

      // Error screen absent.
      expect(queryByText('Что-то пошло не так')).toBeNull();
      expect(queryByText('Попробовать снова')).toBeNull();
      // Editor visible, marker present.
      expect(getByText(mockDescriptionMarker)).toBeTruthy();
      // Badge renders a meaningful localized string, not a crash. Since #1528
      // that string is the CLDR text the web already shows ("сейчас"): the
      // guard moved into the canonical `formatRelativeTime`, so this build no
      // longer falls into a second, Android-only wording ("только что").
      expect(getByText('Сохранено сейчас')).toBeTruthy();
    } finally {
      Object.defineProperty(Intl, 'RelativeTimeFormat', {
        configurable: true,
        value: originalRelativeTimeFormat,
      });
    }
  });
});
