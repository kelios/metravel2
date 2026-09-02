import React from 'react';

const renderer = require('react-test-renderer');

const mockPlacePopupCard = jest.fn((props: any) =>
  React.createElement('mock-place-popup-card', props),
);
const mockUseSavedPointToggle = jest.fn();

jest.mock('@/components/MapPage/Map/PlacePopupCard', () => ({
  __esModule: true,
  default: (props: any) => mockPlacePopupCard(props),
}));

jest.mock('@/components/MapPage/Map/PlacePopupCard/usePlaceSourcePagerState', () => ({
  usePlaceSourcePagerState: () => ({
    sourceCount: 1,
    activeSourceIndex: 0,
    goPrev: jest.fn(),
    goNext: jest.fn(),
  }),
  resolvePlaceSourceCardFields: () => ({
    articleUrl: null,
    imageUrl: null,
    articleTitle: null,
  }),
}));

jest.mock('@/hooks/map/useSavedPointToggle', () => ({
  useSavedPointToggle: (...args: any[]) => mockUseSavedPointToggle(...args),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { isAuthenticated: boolean; authReady: boolean }) => unknown) =>
    selector({ isAuthenticated: true, authReady: true }),
}));

jest.mock('@/stores/routeStore', () => ({
  useRouteStore: {
    getState: () => ({
      clearRouteAndSetMode: jest.fn(),
      addPoint: jest.fn(),
    }),
  },
}));

jest.mock('@/hooks/useTheme', () => {
  const React = require('react');
  return { ThemeContext: React.createContext(null) };
});

jest.mock('@/components/MapPage/Map/userLocationSignal', () => ({
  useHasUserLocation: () => false,
}));

jest.mock('@/api/external/osrm', () => ({ osrmRoute: jest.fn() }));
jest.mock('@/utils/toast', () => ({ showToast: jest.fn() }));
jest.mock('@/utils/externalLinks', () => ({ openExternalUrlInNewTab: jest.fn() }));
jest.mock('@/utils/seo', () => ({ getSiteBaseUrl: () => 'https://metravel.by' }));
jest.mock('@/i18n', () => ({ translate: (key: string) => key }));
jest.mock('@/i18n/format', () => ({ formatInteger: (value: number) => String(value) }));

const { createMapPopupComponent } = require('@/components/MapPage/Map/createMapPopupComponent');

describe('createMapPopupComponent saved-points readiness', () => {
  const removeSaved = jest.fn();
  const createPoint = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks the save handler and shows loading until the collection becomes trusted', async () => {
    mockUseSavedPointToggle.mockReturnValue({
      isSaved: false,
      isReady: false,
      removeSaved,
      createPoint,
    });
    const Popup = createMapPopupComponent({
      userLocation: null,
      colors: {},
      themeContextValue: {},
    });

    let tree: any;
    renderer.act(() => {
      tree = renderer.create(
        <Popup point={{ id: 1, coord: '50.05924,19.93941', address: 'Test point' }} />,
      );
    });

    expect(mockPlacePopupCard).toHaveBeenLastCalledWith(
      expect.objectContaining({ addDisabled: true, isAdding: true, isSaved: false }),
    );
    await renderer.act(async () => {
      await mockPlacePopupCard.mock.calls.at(-1)?.[0].onAddPoint();
    });
    expect(createPoint).not.toHaveBeenCalled();

    mockUseSavedPointToggle.mockReturnValue({
      isSaved: false,
      isReady: true,
      removeSaved,
      createPoint,
    });
    renderer.act(() => {
      tree.update(
        <Popup point={{ id: 1, coord: '50.05924,19.93941', address: 'Test point' }} />,
      );
    });

    expect(mockPlacePopupCard).toHaveBeenLastCalledWith(
      expect.objectContaining({ addDisabled: false, isAdding: false, isSaved: false }),
    );
    await renderer.act(async () => {
      await mockPlacePopupCard.mock.calls.at(-1)?.[0].onAddPoint();
    });
    expect(createPoint).toHaveBeenCalledTimes(1);
  });
});
