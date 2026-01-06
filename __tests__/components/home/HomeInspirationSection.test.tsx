import React from 'react';
import { render } from '@testing-library/react-native';
import { useQuery } from '@tanstack/react-query';
import HomeInspirationSections from '@/components/home/HomeInspirationSection';
import { fetchTravelsPopular, fetchTravelsOfMonth, fetchTravelsRandom } from '@/src/api/map';

jest.mock('@tanstack/react-query');
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/components/listTravel/RenderTravelItem', () => {
  return function MockRenderTravelItem() {
    return null;
  };
});

jest.mock('@/src/api/map');

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

    expect(getByText('Куда отправиться в этом месяце')).toBeTruthy();
    expect(getByText('Популярные направления')).toBeTruthy();
    expect(getByText('Случайный маршрут')).toBeTruthy();
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
});
