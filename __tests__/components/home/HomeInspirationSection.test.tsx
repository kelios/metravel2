import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { useQuery } from '@tanstack/react-query';
import HomeInspirationSections from '@/components/home/HomeInspirationSection';
import { fetchTravelsPopular, fetchTravelsOfMonth, fetchTravelsRandom } from '@/api/map';

const mockPush = jest.fn();

jest.mock('@tanstack/react-query');
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/components/listTravel/RenderTravelItem', () => {
  return function MockRenderTravelItem() {
    return null;
  };
});

jest.mock('@/api/map');
jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: jest.fn() }));

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;
const mockFetchTravelsPopular = fetchTravelsPopular as jest.MockedFunction<typeof fetchTravelsPopular>;
const mockFetchTravelsOfMonth = fetchTravelsOfMonth as jest.MockedFunction<typeof fetchTravelsOfMonth>;
const mockFetchTravelsRandom = fetchTravelsRandom as jest.MockedFunction<typeof fetchTravelsRandom>;

describe('HomeInspirationSections', () => {
  beforeEach(() => {
    mockFetchTravelsPopular.mockResolvedValue({} as any);
    mockFetchTravelsOfMonth.mockResolvedValue({} as any);
    mockFetchTravelsRandom.mockResolvedValue([] as any);

    mockUseQuery.mockImplementation(({ queryKey, queryFn }: any) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;

      if (typeof queryFn === 'function') {
        void queryFn();
      }

      if (key === 'home-travels-of-month') {
        return { data: { 1: { id: 1, name: 'OfMonth', countryName: 'X' } }, isLoading: false } as any;
      }

      if (key === 'home-popular-travels') {
        return { data: { 2: { id: 2, name: 'Popular', countryName: 'Y' } }, isLoading: false } as any;
      }

      if (key === 'home-random-travels') {
        return { data: [{ id: 3, name: 'Random', countryName: 'Z' }], isLoading: false } as any;
      }

      return { data: {}, isLoading: false } as any;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders three inspiration sections (of-month, popular, random)', () => {
    const { getByText } = render(<HomeInspirationSections />);

    expect(getByText('Маршруты на ближайшие выходные')).toBeTruthy();
    expect(getByText('Что сейчас выбирают чаще всего')).toBeTruthy();
    expect(getByText('Не хотите выбирать долго?')).toBeTruthy();
  });

  it('calls useQuery with expected query keys', () => {
    render(<HomeInspirationSections />);

    const calls = mockUseQuery.mock.calls.map((c) => c[0]?.queryKey?.[0]).filter(Boolean);
    expect(calls).toEqual(
      expect.arrayContaining(['home-travels-of-month', 'home-popular-travels', 'home-random-travels'])
    );
  });

  it('uses the corresponding fetch functions', () => {
    render(<HomeInspirationSections />);

    expect(mockFetchTravelsOfMonth).toHaveBeenCalled();
    expect(mockFetchTravelsPopular).toHaveBeenCalled();
    expect(mockFetchTravelsRandom).toHaveBeenCalled();
  });

  describe('Quick filter chips — FILTER_GROUPS', () => {
    it('renders all four filter group titles', () => {
      const { getByText } = render(<HomeInspirationSections />);
      expect(getByText('Тип маршрута')).toBeTruthy();
      expect(getByText('Ночлег')).toBeTruthy();
      expect(getByText('Сезон')).toBeTruthy();
      expect(getByText('Расстояние на карте')).toBeTruthy();
    });

    it('renders chip labels for each group', () => {
      const { getByText } = render(<HomeInspirationSections />);
      expect(getByText('Поход / хайкинг')).toBeTruthy();
      expect(getByText('Велопоход')).toBeTruthy();
      expect(getByText('Без ночлега')).toBeTruthy();
      expect(getByText('Палатка')).toBeTruthy();
      expect(getByText('Лето')).toBeTruthy();
      expect(getByText('До 30 км')).toBeTruthy();
      expect(getByText('До 100 км')).toBeTruthy();
    });

    it.each([
      ['Поход / хайкинг', '/search?categories=2,21'],
      ['Город', '/search?categories=19,20'],
      ['Треккинг', '/search?categories=22'],
      ['Велопоход', '/search?categories=7'],
      ['Автопутешествие', '/search?categories=6'],
      ['Без ночлега', '/search?over_nights_stay=8'],
      ['Палатка', '/search?over_nights_stay=1'],
      ['Гостиница', '/search?over_nights_stay=2'],
      ['Квартира / дом', '/search?over_nights_stay=3,4'],
      ['Весна', '/search?month=3,4,5'],
      ['Лето', '/search?month=6,7,8'],
      ['Осень', '/search?month=9,10,11'],
      ['Зима', '/search?month=12,1,2'],
      ['До 30 км', '/map?radius=30'],
      ['До 60 км', '/map?radius=60'],
      ['До 100 км', '/map?radius=100'],
      ['До 200 км', '/map?radius=200'],
    ])('navigates to %s filter link', (label, expectedPath) => {
      const { getByLabelText } = render(<HomeInspirationSections />);
      fireEvent.press(getByLabelText(`Фильтр ${label}`));
      expect(mockPush).toHaveBeenCalledWith(expectedPath);
    });

    it('does not keep previous filter params when another chip is pressed', () => {
      const { getByLabelText } = render(<HomeInspirationSections />);

      fireEvent.press(getByLabelText('Фильтр Поход / хайкинг'));
      fireEvent.press(getByLabelText('Фильтр Палатка'));

      const lastPath = mockPush.mock.calls.at(-1)?.[0] as string;
      expect(lastPath).toBe('/search?over_nights_stay=1');
      expect(lastPath).not.toContain('categories=');
    });

    it('"Смотреть маршруты" button navigates to /search without filters', () => {
      const { getByLabelText } = render(<HomeInspirationSections />);
      fireEvent.press(getByLabelText('Смотреть маршруты'));
      expect(mockPush).toHaveBeenCalledWith('/search');
    });
  });
});
