// Пустой список и недоступный сервер — разные состояния. Раньше на 5xx профиль
// показывал inspire-заглушку «Ваши маршруты появятся здесь» с кнопкой «Создать
// маршрут», то есть предлагал создать заново то, что просто не загрузилось.

import { renderHook } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

import { useProfileTravelSections } from '@/components/screens/profile/useProfileTravelSections';

const baseInput = {
  setActiveTab: jest.fn(),
  activeTravelMetric: null,
  setActiveTravelMetric: jest.fn(),
  favorites: [],
  viewHistory: [],
  myTravels: [],
  engagementSummary: null,
  travelsCount: 0,
  travelsLoading: false,
  travelsLoadingMore: false,
  travelsHasMore: false,
  loadMoreTravels: jest.fn(),
  personalTravelStatusEntries: [],
} as const;

const renderSections = (overrides: Record<string, unknown>) =>
  renderHook(() =>
    useProfileTravelSections({
      ...baseInput,
      travelsError: null,
      onRetryTravels: jest.fn(),
      ...overrides,
    } as any)
  );

describe('useProfileTravelSections — empty state при сбое загрузки', () => {
  it.each(['travels', 'publishedTravels', 'draftTravels'])(
    'на вкладке %s показывает ошибку с причиной и кнопкой повтора',
    (activeTab) => {
      const onRetryTravels = jest.fn();
      const { result } = renderSections({
        activeTab,
        travelsError: 'Не удалось загрузить ваши маршруты: 502 Bad Gateway',
        onRetryTravels,
      });

      const { emptyStateProps } = result.current;
      expect(emptyStateProps.variant).toBe('error');
      expect(emptyStateProps.title).toBe('Не удалось загрузить маршруты');
      expect(emptyStateProps.description).toBe('Не удалось загрузить ваши маршруты: 502 Bad Gateway');
      expect(emptyStateProps.action?.label).toBe('Повторить');

      emptyStateProps.action?.onPress();
      expect(onRetryTravels).toHaveBeenCalledTimes(1);
    }
  );

  it('без ошибки оставляет обычную inspire-заглушку вкладки travels', () => {
    const { result } = renderSections({ activeTab: 'travels' });

    expect(result.current.emptyStateProps.variant).toBe('inspire');
    expect(result.current.emptyStateProps.title).toBe('Ваши маршруты появятся здесь');
  });

  it.each(['favorites', 'history'])(
    'не подменяет заглушку вкладки %s — она живёт на других данных',
    (activeTab) => {
      const { result } = renderSections({
        activeTab,
        travelsError: 'Не удалось загрузить ваши маршруты: 502 Bad Gateway',
      });

      expect(result.current.emptyStateProps.variant).toBe('empty');
      expect(result.current.emptyStateProps.title).not.toBe('Не удалось загрузить маршруты');
    }
  );
});
