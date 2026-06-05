import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { useQuery } from '@tanstack/react-query';
import HomeInspirationSections from '@/components/home/HomeInspirationSections';

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

jest.mock('@/components/home/AdventureChaptersSection', () => {
  const { View, Text } = require('react-native');
  return function MockAdventureChaptersSection() {
    return (
      <View>
        <Text>{'Главы путешествий, которые выбирают чаще всего'}</Text>
      </View>
    );
  };
});

jest.mock('@/api/map');
jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: jest.fn() }));

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;

describe('HomeInspirationSections', () => {
  beforeEach(() => {
    mockUseQuery.mockImplementation(({ queryFn }: any) => {
      if (typeof queryFn === 'function') {
        void queryFn();
      }
      return { data: {}, isLoading: false } as any;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders inspiration sections (chapters)', () => {
    const { getByText } = render(<HomeInspirationSections />);

    expect(getByText('Главы путешествий, которые выбирают чаще всего')).toBeTruthy();
  });

  it('renders quick filter section', () => {
    const { getByText } = render(<HomeInspirationSections />);

    expect(getByText('Найдите маршрут под свой день')).toBeTruthy();
  });

  describe('Quick filter chips — FILTER_GROUPS', () => {
    it('renders all quick filter group titles', () => {
      const { getByText } = render(<HomeInspirationSections />);
      expect(getByText('На выходные')).toBeTruthy();
      expect(getByText('Рядом на карте')).toBeTruthy();
      expect(getByText('Природа')).toBeTruthy();
      expect(getByText('Город и квесты')).toBeTruthy();
    });

    it('renders chip labels for each group', () => {
      const { getByText } = render(<HomeInspirationSections />);
      expect(getByText('Без ночлега')).toBeTruthy();
      expect(getByText('Лето')).toBeTruthy();
      expect(getByText('До 60 км')).toBeTruthy();
      expect(getByText('Озеро')).toBeTruthy();
      expect(getByText('Водопад')).toBeTruthy();
      expect(getByText('Квесты')).toBeTruthy();
      expect(getByText('Замок')).toBeTruthy();
    });

    it.each([
      ['Без ночлега', '/search?over_nights_stay=8'],
      ['До 100 км', '/map?radius=100'],
      ['Лето', '/search?month=6,7,8'],
      ['До 30 км', '/map?radius=30'],
      ['До 60 км', '/map?radius=60'],
      ['Озеро', '/search?categoryTravelAddress=84'],
      ['Гора', '/search?categoryTravelAddress=26'],
      ['Водопад', '/search?categoryTravelAddress=20'],
      ['Город', '/search?categories=19,20'],
      ['Квесты', '/quests'],
      ['Замок', '/search?categoryTravelAddress=43'],
    ])('navigates to %s filter link', (label, expectedPath) => {
      const { getByLabelText } = render(<HomeInspirationSections />);
      fireEvent.press(getByLabelText(`Подбор ${label}`));
      expect(mockPush).toHaveBeenCalledWith(expectedPath);
    });

    it('does not keep previous filter params when another chip is pressed', () => {
      const { getByLabelText } = render(<HomeInspirationSections />);

      fireEvent.press(getByLabelText('Подбор Город'));
      fireEvent.press(getByLabelText('Подбор Без ночлега'));

      const lastPath = mockPush.mock.calls.at(-1)?.[0] as string;
      expect(lastPath).toBe('/search?over_nights_stay=8');
      expect(lastPath).not.toContain('categories=');
    });

    it('"Все маршруты" button navigates to /search without filters', () => {
      const { getByLabelText } = render(<HomeInspirationSections />);
      fireEvent.press(getByLabelText('Все маршруты'));
      expect(mockPush).toHaveBeenCalledWith('/search');
    });
  });
});
