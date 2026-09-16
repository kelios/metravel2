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

  it('keeps the raw geocoder chain in the save payload and shortens the popup title (#1750)', async () => {
    const raw = '332 · Soblówka · Силезское воеводство · Живецкий повят · Польша';
    mockUseSavedPointToggle.mockReturnValue({
      isSaved: false,
      isReady: true,
      removeSaved,
      createPoint,
    });
    const Popup = createMapPopupComponent({
      userLocation: null,
      colors: {},
      themeContextValue: {},
    });

    renderer.act(() => {
      renderer.create(<Popup point={{ id: 7, coord: '49.416,19.027', address: raw }} />);
    });

    expect(mockPlacePopupCard).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Soblówka' }),
    );

    await renderer.act(async () => {
      await mockPlacePopupCard.mock.calls.at(-1)?.[0].onAddPoint();
    });
    expect(createPoint).toHaveBeenCalledWith(
      expect.objectContaining({ address: raw, name: raw }),
    );
  });
});

describe('createMapPopupComponent related travel id (#1960)', () => {
  const primarySource = (travelId: number | null) => ({
    sourceId: 'travel-address:14029',
    pointId: 14029,
    travelId,
    articleTitle: 'Из Мозыря в Микашевичи через Минск',
    articleUrl: '/travels/iz-mozyrya-v-mikashevichi',
    thumbnailUrl: null,
    thumbnailWidth: null,
    thumbnailHeight: null,
  });

  const renderPopup = (point: Record<string, unknown>) => {
    const Popup = createMapPopupComponent({
      userLocation: null,
      colors: {},
      themeContextValue: {},
    });
    renderer.act(() => {
      renderer.create(<Popup point={point} />);
    });
    return mockPlacePopupCard.mock.calls.at(-1)?.[0];
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSavedPointToggle.mockReturnValue({
      isSaved: false,
      isReady: true,
      removeSaved: jest.fn(),
      createPoint: jest.fn(),
    });
  });

  it('passes the primary source id of the same article as the flat urlTravel', () => {
    // Кластеры, radius и near-route: `urlTravel` без `?id=`, id — в primary_source.
    const props = renderPopup({
      id: 14029,
      coord: '53.93129,27.6459',
      address: 'Национальная библиотека Беларуси',
      urlTravel: 'https://metravel.by/travels/iz-mozyrya-v-mikashevichi',
      primarySource: primarySource(389),
    });

    expect(props).toEqual(
      expect.objectContaining({
        relatedTravelUrl: 'https://metravel.by/travels/iz-mozyrya-v-mikashevichi',
        relatedTravelId: 389,
      }),
    );
  });

  it('uses the flat travelId for points without a primary source (nearby map, deep link)', () => {
    const props = renderPopup({
      id: '11',
      coord: '50.061,19.938',
      address: 'Nearby route',
      urlTravel: '/travels/nearby-route',
      travelId: 301,
    });

    expect(props).toEqual(
      expect.objectContaining({ relatedTravelUrl: '/travels/nearby-route', relatedTravelId: 301 }),
    );
  });

  it('keeps quest points without related travel actions', () => {
    const props = renderPopup({
      id: 'quest-1',
      coord: '53.9,27.56',
      address: 'Квест',
      urlTravel: '/travels/should-not-leak',
      travelId: 301,
      questMeta: { id: 'q1', title: 'Квест', cityId: 'minsk' },
    });

    expect(props).toEqual(
      expect.objectContaining({ relatedTravelUrl: null, relatedTravelId: null }),
    );
  });
});
