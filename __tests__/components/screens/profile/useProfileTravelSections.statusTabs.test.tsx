// #1833: вкладки «Опубл.» и «Черновики» фильтровали на клиенте общий список и
// ради полноты фильтра догружали весь каталог автора. Список им теперь отдаёт
// сервер, а принудительная догрузка остаётся только «Странам» и «Карте».

import { renderHook } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

import { useProfileTravelSections } from '@/components/screens/profile/useProfileTravelSections';

const travels = (ids: string[], publicationStatus: string) =>
  ids.map((id) => ({
    id,
    name: `Travel ${id}`,
    publication_status: publicationStatus,
  }));

// Первая страница общего списка: 15 опубликованных и 5 черновиков при 365 всего.
const firstPage = [
  ...travels(['p-1', 'p-2'], 'published'),
  ...travels(['d-1'], 'draft'),
];

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
      publicationCounts: { published: 300, drafts: 65 },
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

describe('useProfileTravelSections — вкладки-срезы по статусу публикации', () => {
  it('«Черновики» показывают серверный срез, а не клиентский фильтр первой страницы', () => {
    const loadMoreTravels = jest.fn();
    const serverDrafts = travels(['d-40', 'd-41'], 'draft');

    const { result } = renderSections({
      activeTab: 'draftTravels',
      statusTabTravels: serverDrafts,
      loadMoreTravels,
    });

    expect(result.current.currentData.map((travel) => travel.id)).toEqual(['d-40', 'd-41']);
    // Догрузка всего каталога ради клиентской фильтрации больше не нужна.
    expect(loadMoreTravels).not.toHaveBeenCalled();
  });

  it('«Опубл.» тоже читает свой срез и не запускает цепочку страниц общего списка', () => {
    const loadMoreTravels = jest.fn();
    const serverPublished = travels(['p-90'], 'published');

    const { result } = renderSections({
      activeTab: 'publishedTravels',
      statusTabTravels: serverPublished,
      loadMoreTravels,
    });

    expect(result.current.currentData.map((travel) => travel.id)).toEqual(['p-90']);
    expect(loadMoreTravels).not.toHaveBeenCalled();
  });

  it('«Страны» по-прежнему догружают весь список автора — им нужен полный каталог', () => {
    const loadMoreTravels = jest.fn();

    renderSections({ activeTab: 'countries', loadMoreTravels });

    expect(loadMoreTravels).toHaveBeenCalled();
  });
});
