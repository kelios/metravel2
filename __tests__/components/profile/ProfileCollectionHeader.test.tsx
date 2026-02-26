import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import ProfileCollectionHeader from '@/components/profile/ProfileCollectionHeader';

describe('ProfileCollectionHeader', () => {
  it('renders title and handles back press', () => {
    const onBackPress = jest.fn();
    const { getByText, getByLabelText } = render(
      <ProfileCollectionHeader title="Избранное" onBackPress={onBackPress} />
    );

    expect(getByText('Избранное')).toBeTruthy();
    fireEvent.press(getByLabelText('Перейти в профиль'));
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
});
