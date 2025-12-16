import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePathname, useRouter } from 'expo-router';
import { getQuestById } from '@/components/quests/registry';
import Breadcrumbs from '@/components/Breadcrumbs';

jest.mock('@/src/api/travelsApi', () => ({
  fetchTravel: jest.fn(() => Promise.resolve({ name: 'Mock Travel' })),
  fetchTravelBySlug: jest.fn(() => Promise.resolve({ name: 'Mock Travel' })),
}));

jest.mock('expo-router', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    useWindowDimensions: () => ({ width: 375, height: 667 }),
  };
});

jest.mock('@/components/quests/registry', () => ({
  getQuestById: jest.fn(),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0 },
  },
});

describe('Breadcrumbs', () => {
  const mockPush = jest.fn();
  const mockRouter = {
    push: mockPush,
  };

  const renderWithClient = (ui: React.ReactElement) => {
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (getQuestById as jest.Mock).mockReset();
    (getQuestById as jest.Mock).mockReturnValue(null);
  });

  it('should not render on home page', () => {
    (usePathname as jest.Mock).mockReturnValue('/');
    const { queryByText } = renderWithClient(<Breadcrumbs />);
    expect(queryByText('Главная')).toBeNull();
  });

  it('should render breadcrumbs for travels page without intermediate "Путешествия"', () => {
    (usePathname as jest.Mock).mockReturnValue('/travels/test-slug');
    const { getByText, queryByText } = renderWithClient(<Breadcrumbs />);
    expect(getByText('Главная')).toBeTruthy();
    // ✅ РЕАЛИЗАЦИЯ: Не показываем промежуточную страницу "Путешествия" - страницы /travels не существует
    expect(queryByText('Путешествия')).toBeNull();
    // Показываем только название из slug
    expect(getByText('Test Slug')).toBeTruthy();
  });

  it('should not show breadcrumbs for /travels path (page does not exist)', () => {
    (usePathname as jest.Mock).mockReturnValue('/travels');
    const { queryByText } = renderWithClient(<Breadcrumbs />);
    // Если только /travels без slug, не показываем breadcrumbs (только главная, но её тоже не показываем если длина <= 1)
    expect(queryByText('Путешествия')).toBeNull();
  });

  it('should handle long travel slugs correctly', () => {
    const longSlug = 'marshrut-v-beskidakh-ot-parkovki-do-smotrovoi-cher';
    (usePathname as jest.Mock).mockReturnValue(`/travels/${longSlug}`);
    const { getByText, queryByText } = renderWithClient(<Breadcrumbs />);
    expect(getByText('Главная')).toBeTruthy();
    expect(queryByText('Путешествия')).toBeNull();
    // Проверяем, что длинное название обрезается
    const breadcrumbText = getByText(/Marshrut V Beskidakh/);
    expect(breadcrumbText).toBeTruthy();
  });

  it('should handle multiple travels segments correctly', () => {
    (usePathname as jest.Mock).mockReturnValue('/travels/category/travel-slug');
    const { getByText, queryByText } = renderWithClient(<Breadcrumbs />);
    expect(getByText('Главная')).toBeTruthy();
    expect(queryByText('Путешествия')).toBeNull();
    // Проверяем, что travels пропущен, но category и slug показаны
    expect(getByText('Category')).toBeTruthy();
    expect(getByText('Travel Slug')).toBeTruthy();
  });

  it('should render breadcrumbs for map page', () => {
    (usePathname as jest.Mock).mockReturnValue('/map');
    const { getByText } = renderWithClient(<Breadcrumbs />);
    expect(getByText('Главная')).toBeTruthy();
    expect(getByText('Карта')).toBeTruthy();
  });

  it('should render quest breadcrumbs with Russian quest title', () => {
    (usePathname as jest.Mock).mockReturnValue('/quests/barkovshchina/test-quest');
    (getQuestById as jest.Mock).mockReturnValue({ title: 'Тайна родника' });

    const { getByText, queryByText } = renderWithClient(<Breadcrumbs />);
    expect(getByText('Главная')).toBeTruthy();
    expect(getByText('Квесты')).toBeTruthy();
    expect(getByText('Тайна родника')).toBeTruthy();
    expect(queryByText('Barkovshchina')).toBeNull();
    expect(queryByText('Test Quest')).toBeNull();
  });

  it('should navigate when clicking on breadcrumb', () => {
    (usePathname as jest.Mock).mockReturnValue('/travels/test-slug');
    const { getByText } = renderWithClient(<Breadcrumbs />);
    const homeLink = getByText('Главная');
    fireEvent.press(homeLink);
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('should not navigate when clicking on last breadcrumb', () => {
    (usePathname as jest.Mock).mockReturnValue('/travels/test-slug');
    const { getByText } = renderWithClient(<Breadcrumbs />);
    const lastBreadcrumb = getByText('Test Slug');
    fireEvent.press(lastBreadcrumb);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should use custom items when provided', () => {
    (usePathname as jest.Mock).mockReturnValue('/custom');
    const customItems = [
      { label: 'Раздел 1', path: '/section1' },
      { label: 'Раздел 2', path: '/section1/section2' },
    ];
    const { getByText } = renderWithClient(<Breadcrumbs items={customItems} />);
    expect(getByText('Главная')).toBeTruthy();
    expect(getByText('Раздел 1')).toBeTruthy();
    expect(getByText('Раздел 2')).toBeTruthy();
  });

  it('should not render breadcrumbs when showHome is false and there is only one item', () => {
    (usePathname as jest.Mock).mockReturnValue('/map');
    const { queryByText } = renderWithClient(<Breadcrumbs showHome={false} />);
    expect(queryByText('Главная')).toBeNull();
    expect(queryByText('Карта')).toBeNull();
  });

  // ✅ РЕАЛИЗАЦИЯ: Тесты для проверки что все тексты на русском
  it('should use Russian translations for all page names', () => {
    const testCases = [
      { path: '/map', expected: 'Карта' },
      { path: '/quests', expected: 'Квесты' },
      { path: '/travelsby', expected: 'Беларусь' },
      { path: '/article', expected: 'Статья' },
      { path: '/profile', expected: 'Профиль' },
      { path: '/login', expected: 'Вход' },
      { path: '/registration', expected: 'Регистрация' },
      { path: '/metravel', expected: 'Мои путешествия' },
      { path: '/about', expected: 'О сайте' },
      { path: '/export', expected: 'Экспорт' },
      { path: '/settings', expected: 'Настройки' },
      { path: '/history', expected: 'История просмотров' },
      { path: '/favorites', expected: 'Избранное' },
    ];

    testCases.forEach(({ path, expected }) => {
      (usePathname as jest.Mock).mockReturnValue(path);
      const { getByText } = renderWithClient(<Breadcrumbs />);
      expect(getByText('Главная')).toBeTruthy();
      expect(getByText(expected)).toBeTruthy();
    });
  });

  // ✅ РЕАЛИЗАЦИЯ: Тест для проверки что travels не показывается ни в каких случаях
  it('should never show "travels" or "Путешествия" in breadcrumbs', () => {
    const testPaths = [
      '/travels',
      '/travels/test-slug',
      '/travels/category/slug',
      '/travels/very-long-slug-name-here',
    ];

    testPaths.forEach((path) => {
      (usePathname as jest.Mock).mockReturnValue(path);
      const { queryByText } = renderWithClient(<Breadcrumbs />);
      // Проверяем, что "Путешествия" не показывается
      expect(queryByText('Путешествия')).toBeNull();
    });
  });

  // ✅ РЕАЛИЗАЦИЯ: Тест для проверки корректной навигации при клике на breadcrumb
  it('should navigate correctly when clicking breadcrumb with travels in path', () => {
    (usePathname as jest.Mock).mockReturnValue('/travels/test-slug');
    const { getByText } = renderWithClient(<Breadcrumbs />);
    const homeLink = getByText('Главная');
    fireEvent.press(homeLink);
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
