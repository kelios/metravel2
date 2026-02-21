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

    it('navigates to /search?categories=2,21 when "Поход / хайкинг" chip is pressed', () => {
      const { getByLabelText } = render(<HomeInspirationSections />);
      fireEvent.press(getByLabelText('Фильтр Поход / хайкинг'));
      expect(mockPush).toHaveBeenCalledWith('/search?categories=2,21');
    });

    it('navigates to /search?categories=19,20 when "Город" chip is pressed', () => {
      const { getByLabelText } = render(<HomeInspirationSections />);
      fireEvent.press(getByLabelText('Фильтр Город'));
      expect(mockPush).toHaveBeenCalledWith('/search?categories=19,20');
    });

    it('navigates to /search?categories=22 when "Треккинг" chip is pressed', () => {
      const { getByLabelText } = render(<HomeInspirationSections />);
      fireEvent.press(getByLabelText('Фильтр Треккинг'));
      expect(mockPush).toHaveBeenCalledWith('/search?categories=22');
    });

    it('navigates to /search?over_nights_stay=8 when "Без ночлега" chip is pressed', () => {
      const { getByLabelText } = render(<HomeInspirationSections />);
      fireEvent.press(getByLabelText('Фильтр Без ночлега'));
      expect(mockPush).toHaveBeenCalledWith('/search?over_nights_stay=8');
    });

    it('navigates to /search?over_nights_stay=1 when "Палатка" chip is pressed', () => {
      const { getByLabelText } = render(<HomeInspirationSections />);
      fireEvent.press(getByLabelText('Фильтр Палатка'));
      expect(mockPush).toHaveBeenCalledWith('/search?over_nights_stay=1');
    });

    it('navigates to /search?month=6,7,8 when "Лето" chip is pressed', () => {
      const { getByLabelText } = render(<HomeInspirationSections />);
      fireEvent.press(getByLabelText('Фильтр Лето'));
      expect(mockPush).toHaveBeenCalledWith('/search?month=6,7,8');
    });

    it('navigates to /search?month=3,4,5 when "Весна" chip is pressed', () => {
      const { getByLabelText } = render(<HomeInspirationSections />);
      fireEvent.press(getByLabelText('Фильтр Весна'));
      expect(mockPush).toHaveBeenCalledWith('/search?month=3,4,5');
    });

    it('navigates to /map?radius=30 when "До 30 км" chip is pressed', () => {
      const { getByLabelText } = render(<HomeInspirationSections />);
      fireEvent.press(getByLabelText('Фильтр До 30 км'));
      expect(mockPush).toHaveBeenCalledWith('/map?radius=30');
    });

    it('navigates to /map?radius=100 when "До 100 км" chip is pressed', () => {
      const { getByLabelText } = render(<HomeInspirationSections />);
      fireEvent.press(getByLabelText('Фильтр До 100 км'));
      expect(mockPush).toHaveBeenCalledWith('/map?radius=100');
    });

    it('navigates to /map?radius=200 when "До 200 км" chip is pressed', () => {
      const { getByLabelText } = render(<HomeInspirationSections />);
      fireEvent.press(getByLabelText('Фильтр До 200 км'));
      expect(mockPush).toHaveBeenCalledWith('/map?radius=200');
    });

    it('"Смотреть маршруты" button navigates to /search without filters', () => {
      const { getByLabelText } = render(<HomeInspirationSections />);
      fireEvent.press(getByLabelText('Смотреть маршруты'));
      expect(mockPush).toHaveBeenCalledWith('/search');
    });
  });
});
