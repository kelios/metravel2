import { fireEvent, render } from '@testing-library/react-native';

import type { AuthorEngagementItem } from '@/api/authorEngagement';
import { ProfileEngagementDetailList } from '@/components/profile/ProfileEngagementDetailList';

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false, width: 1280, isHydrated: true }),
}));

const buildItem = (overrides: Partial<AuthorEngagementItem> = {}): AuthorEngagementItem => ({
  id: 'favorites:11',
  metric: 'favorites',
  occurredAt: '2026-07-30T10:00:00Z',
  identityHidden: false,
  user: { id: 7, firstName: 'Иван', lastName: 'Петров', avatar: null },
  travel: {
    id: 682,
    name: 'Гарц за три дня',
    slug: 'garz',
    url: '/travels/garz',
    imageUrl: '',
  },
  ...overrides,
});

const renderList = async (props: Partial<React.ComponentProps<typeof ProfileEngagementDetailList>> = {}) =>
  await render(
    <ProfileEngagementDetailList
      metric="favorites"
      items={[buildItem()]}
      total={1}
      isLoading={false}
      isError={false}
      hasNextPage={false}
      isFetchingNextPage={false}
      onLoadMore={jest.fn()}
      onRetry={jest.fn()}
      onOpenProfile={jest.fn()}
      onOpenTravel={jest.fn()}
      {...props}
    />,
  );

describe('ProfileEngagementDetailList', () => {
  it('shows who reacted, on which route and when', async () => {
    const { getByText } = await renderList();

    expect(getByText('Кто сохранил ваши маршруты')).toBeTruthy();
    expect(getByText('Иван Петров')).toBeTruthy();
    expect(getByText('Гарц за три дня')).toBeTruthy();
    expect(getByText('30 июля 2026 г.')).toBeTruthy();
    expect(getByText('Всего отметок: 1')).toBeTruthy();
  });

  it('uses the metric-specific title', async () => {
    const { getByText } = await renderList({
      metric: 'planned',
      items: [buildItem({ metric: 'planned' })],
    });

    expect(getByText('Кто планирует поездку')).toBeTruthy();
  });

  it('navigates internally to the user profile and to the route', async () => {
    const onOpenProfile = jest.fn();
    const onOpenTravel = jest.fn();
    const { getByLabelText } = await renderList({ onOpenProfile, onOpenTravel });

    await fireEvent.press(getByLabelText('Открыть профиль: Иван Петров'));
    expect(onOpenProfile).toHaveBeenCalledWith(7);

    await fireEvent.press(getByLabelText('Открыть маршрут: Гарц за три дня'));
    expect(onOpenTravel).toHaveBeenCalledWith('/travels/garz');
  });

  it('never routes to an absolute url coming from the API', async () => {
    const onOpenTravel = jest.fn();
    const { getByLabelText } = await renderList({
      onOpenTravel,
      items: [
        buildItem({
          travel: {
            id: 682,
            name: 'Гарц за три дня',
            slug: 'garz',
            url: 'https://evil.example/phish',
            imageUrl: '',
          },
        }),
      ],
    });

    await fireEvent.press(getByLabelText('Открыть маршрут: Гарц за три дня'));
    expect(onOpenTravel).toHaveBeenCalledWith('/travels/garz');
  });

  it('renders a hidden row without identity and without a profile link', async () => {
    const onOpenProfile = jest.fn();
    const { getByText, queryByLabelText } = await renderList({
      onOpenProfile,
      items: [
        buildItem({
          identityHidden: true,
          user: { id: null, firstName: '', lastName: '', avatar: null },
        }),
      ],
    });

    expect(getByText('Скрытый пользователь')).toBeTruthy();
    expect(getByText('Профиль недоступен из-за блокировки')).toBeTruthy();
    expect(queryByLabelText('Открыть профиль: Скрытый пользователь')).toBeNull();
  });

  it('shows the loading skeleton instead of an empty state while fetching', async () => {
    const { getByTestId, queryByTestId } = await renderList({ isLoading: true, items: [], total: 0 });

    expect(getByTestId('engagement-detail-loading')).toBeTruthy();
    expect(queryByTestId('engagement-detail-empty')).toBeNull();
  });

  it('shows an explicit empty state when nobody reacted yet', async () => {
    const { getByTestId, getByText } = await renderList({ items: [], total: 0 });

    expect(getByTestId('engagement-detail-empty')).toBeTruthy();
    expect(getByText('Пока никто не отметил')).toBeTruthy();
  });

  it('offers a retry on error', async () => {
    const onRetry = jest.fn();
    const { getByTestId, getByText } = await renderList({
      isError: true,
      items: [],
      total: 0,
      onRetry,
    });

    expect(getByTestId('engagement-detail-error')).toBeTruthy();
    await fireEvent.press(getByText('Повторить'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('paginates through "показать ещё" and blocks a double request', async () => {
    const onLoadMore = jest.fn();
    const { getByTestId, rerender } = await renderList({ hasNextPage: true, onLoadMore });

    await fireEvent.press(getByTestId('engagement-detail-load-more'));
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    await rerender(
      <ProfileEngagementDetailList
        metric="favorites"
        items={[buildItem()]}
        total={1}
        isLoading={false}
        isError={false}
        hasNextPage
        isFetchingNextPage
        onLoadMore={onLoadMore}
        onRetry={jest.fn()}
        onOpenProfile={jest.fn()}
        onOpenTravel={jest.fn()}
      />,
    );

    await fireEvent.press(getByTestId('engagement-detail-load-more'));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('hides the pagination control on the last page', async () => {
    const { queryByTestId } = await renderList({ hasNextPage: false });

    expect(queryByTestId('engagement-detail-load-more')).toBeNull();
  });
});
