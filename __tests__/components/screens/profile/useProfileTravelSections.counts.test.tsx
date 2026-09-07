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
      publicationCountsUnavailable: false,
      travelsCount: 365,
      travelsLoading: false,
      travelsLoadingMore: false,
      travelsHasMore: true,
      travelsError: null,
      travelCountsError: null,
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

  // #1871: сбой запроса за разбивкой давал тот же `publicationCounts === null`,
  // что и «ещё не загружено», и вкладка молча оставалась без цифры вместо «—».
  it('на недогруженном списке показывает «—», когда запрос за разбивкой упал', () => {
    const { result } = renderSections({
      publicationCounts: null,
      publicationCountsUnavailable: true,
    });

    expect(result.current.publishedTravelsCount).toBeNull();
    expect(result.current.draftTravelsCount).toBeNull();
  });

  it('упавшая разбивка не мешает точному локальному подсчёту по догруженному списку', () => {
    const { result } = renderSections({
      publicationCounts: null,
      publicationCountsUnavailable: true,
      travelsCount: firstPage.length,
      travelsHasMore: false,
    });

    expect(result.current.publishedTravelsCount).toBe(15);
    expect(result.current.draftTravelsCount).toBe(5);
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

  // #1865: сбой общего списка обнуляет travelsCount и publicationCounts, и
  // ветка «список догружен целиком» вырождалась в 0 >= 0 — счётчики врали нулём.
  it('при сбое общего списка помечает счётчики недоступными, а не нулём', () => {
    const { result } = renderSections({
      myTravels: [],
      publicationCounts: null,
      travelsCount: 0,
      travelsHasMore: false,
      travelCountsError: 'Не удалось загрузить маршруты',
    });

    expect(result.current.publishedTravelsCount).toBeNull();
    expect(result.current.draftTravelsCount).toBeNull();
  });

  it('потерянный общий счётчик (`travelsCount === null`) сам по себе даёт «—», а не ноль', () => {
    const { result } = renderSections({
      myTravels: [],
      publicationCounts: null,
      travelsCount: null,
      travelsHasMore: false,
    });

    expect(result.current.publishedTravelsCount).toBeNull();
    expect(result.current.draftTravelsCount).toBeNull();
  });

  it('успешный срез вкладки продолжает рисовать свой список при сбое общего', () => {
    const statusTabTravels = travels(3, 'draft');
    const { result } = renderSections({
      activeTab: 'draftTravels',
      myTravels: [],
      statusTabTravels,
      publicationCounts: null,
      travelsCount: 0,
      travelsHasMore: false,
      travelCountsError: 'Не удалось загрузить маршруты',
    });

    expect(result.current.currentData).toHaveLength(3);
    expect(result.current.publishedTravelsCount).toBeNull();
    expect(result.current.draftTravelsCount).toBeNull();
  });
});
