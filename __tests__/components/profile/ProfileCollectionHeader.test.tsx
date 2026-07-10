import { fireEvent, render } from '@testing-library/react-native';

import ProfileCollectionHeader from '@/components/profile/ProfileCollectionHeader';

describe('ProfileCollectionHeader', () => {
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
