import { fireEvent, render } from '@testing-library/react-native';

import ProfileCollectionHeader from '@/components/profile/ProfileCollectionHeader';

const mockResponsive = { current: { width: 1200, isPhone: false, isLargePhone: false } as Record<string, unknown> };
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockResponsive.current,
}));

describe('ProfileCollectionHeader', () => {
  afterEach(() => {
    mockResponsive.current = { width: 1200, isPhone: false, isLargePhone: false };
  });

  // #2099: на телефоне «←» и заголовок рисует HeaderContextBar, здесь — ничего.
  it('renders nothing on a phone (the context bar owns back and title)', () => {
    mockResponsive.current = { width: 390, isPhone: true, isLargePhone: false };
    const { queryByText, queryByLabelText } = render(
      <ProfileCollectionHeader title="Избранное" onBackPress={() => {}} showClearButton onClearPress={() => {}} />
    );

    expect(queryByText('Избранное')).toBeNull();
    expect(queryByLabelText('Назад')).toBeNull();
    expect(queryByLabelText('Очистить')).toBeNull();
  });

  it('renders title and handles back press', () => {
    const onBackPress = jest.fn();
    const { getByText, getByLabelText } = render(
      <ProfileCollectionHeader title="Избранное" onBackPress={onBackPress} />
    );

    expect(getByText('Избранное')).toBeTruthy();
    fireEvent.press(getByLabelText('Назад'));
    expect(onBackPress).toHaveBeenCalledTimes(1);
  });

  it('renders clear button only when enabled', () => {
    const onClearPress = jest.fn();
    const { queryByLabelText, rerender, getByLabelText } = render(
      <ProfileCollectionHeader title="История" onBackPress={() => {}} />
    );

    expect(queryByLabelText('Очистить историю просмотров')).toBeNull();

    rerender(
      <ProfileCollectionHeader
        title="История"
        onBackPress={() => {}}
        showClearButton
        onClearPress={onClearPress}
        clearAccessibilityLabel="Очистить историю просмотров"
      />
    );

    fireEvent.press(getByLabelText('Очистить историю просмотров'));
    expect(onClearPress).toHaveBeenCalledTimes(1);
  });

  it('renders profile breadcrumbs and navigates through non-current crumbs', () => {
    const onBreadcrumbPress = jest.fn();
    const { getAllByText, getByLabelText, getByText } = render(
      <ProfileCollectionHeader
        title="Мой календарь"
        onBackPress={() => {}}
        breadcrumbs={[
          { label: 'Главная', path: '/', icon: 'home' },
          { label: 'Профиль', path: '/profile' },
          { label: 'Мой календарь', path: '/calendar' },
        ]}
        onBreadcrumbPress={onBreadcrumbPress}
        dense
      />
    );

    expect(getByText('Главная')).toBeTruthy();
    expect(getByText('Профиль')).toBeTruthy();
    expect(getAllByText('Мой календарь').length).toBeGreaterThanOrEqual(2);

    fireEvent.press(getByLabelText('Перейти на Профиль'));
    expect(onBreadcrumbPress).toHaveBeenCalledWith('/profile');

    fireEvent.press(getByLabelText('Текущая страница: Мой календарь'));
    expect(onBreadcrumbPress).toHaveBeenCalledTimes(1);
  });
});
