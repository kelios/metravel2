// Профиль с 365 маршрутами показывал «Опубл. 15» и «Черновики 5» — это разбивка
// первой страницы (perPage=20), а не всего профиля. Счётчики вкладок обязаны
// приходить с сервера; локальный подсчёт допустим только на догруженном списке.

import { renderHook } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

import { useProfileTravelSections } from '@/components/screens/profile/useProfileTravelSections';

const travels = (count: number, publicationStatus: string) =>
  Array.from({ length: count }, (_, index) => ({
    id: `${publicationStatus}-${index}`,
    name: `Travel ${index}`,
    publication_status: publicationStatus,
  }));

const firstPage = [...travels(15, 'published'), ...travels(5, 'draft')];

const renderSections = (overrides: Record<string, unknown>) =>
  renderHook(() =>
    useProfileTravelSections({
      activeTab: 'travels',
      setActiveTab: jest.fn(),
      activeTravelMetric: null,
      setActiveTravelMetric: jest.fn(),
      favorites: [],
      viewHistory: [],
      myTravels: firstPage,
      engagementSummary: null,
      publicationCounts: null,
      travelsCount: 365,
      travelsLoading: false,
      travelsLoadingMore: false,
      travelsHasMore: true,
      travelsError: null,
      onRetryTravels: jest.fn(),
      loadMoreTravels: jest.fn(),
      personalTravelStatusEntries: [],
      ...overrides,
    } as any)
  );

describe('useProfileTravelSections — счётчики вкладок «Опубл.» и «Черновики»', () => {
  it('показывает серверную разбивку по всему профилю, а не по первой странице', () => {
    const { result } = renderSections({
      publicationCounts: { published: 300, drafts: 65 },
    });

    expect(result.current.publishedTravelsCount).toBe(300);
    expect(result.current.draftTravelsCount).toBe(65);
  });

  it('на недогруженном списке без серверной разбивки не показывает цифру вовсе', () => {
    const { result } = renderSections({ publicationCounts: null });

    expect(result.current.publishedTravelsCount).toBeUndefined();
    expect(result.current.draftTravelsCount).toBeUndefined();
  });

  it('когда список догружен целиком, считает локально — это те же данные', () => {
    const { result } = renderSections({
      publicationCounts: null,
      travelsCount: firstPage.length,
      travelsHasMore: false,
    });

    expect(result.current.publishedTravelsCount).toBe(15);
    expect(result.current.draftTravelsCount).toBe(5);
  });
});
