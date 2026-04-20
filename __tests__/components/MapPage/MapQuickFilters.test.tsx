import React from 'react';
import * as RN from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { MapQuickFilters } from '@/components/MapPage/MapQuickFilters';

describe('MapQuickFilters', () => {
  beforeEach(() => {
    ;(RN.useWindowDimensions as jest.Mock).mockReturnValue({
      width: 360,
      height: 800,
      scale: 1,
      fontScale: 1,
    });
  });

  it('renders filters and categories selectors with current values', () => {
    const { getByText, getByLabelText } = render(
      <MapQuickFilters
        filtersValue="60 км"
        categoriesValue="2 выбрано"
        onPressFilters={jest.fn()}
        onPressCategories={jest.fn()}
      />
    );

    expect(getByText('Фильтры')).toBeTruthy();
    expect(getByText('Категории')).toBeTruthy();
    expect(getByText('60 км')).toBeTruthy();
    expect(getByText('2 выбрано')).toBeTruthy();
    expect(getByLabelText('Фильтры: 60 км')).toBeTruthy();
    expect(getByLabelText('Категории: 2 выбрано')).toBeTruthy();
  });

  it('uses fallback values when explicit selection is missing', () => {
    const { getAllByText, getByText } = render(
      <MapQuickFilters onPressFilters={jest.fn()} onPressCategories={jest.fn()} />
    );

    expect(getAllByText('Выбор')).toHaveLength(2);
    expect(getByText('Категории')).toBeTruthy();
  });

  it('fires both selector callbacks independently', () => {
    const onPressFilters = jest.fn();
    const onPressCategories = jest.fn();

    const { getByLabelText } = render(
      <MapQuickFilters
        filtersValue="Маршрут"
        categoriesValue="Все"
        onPressFilters={onPressFilters}
        onPressCategories={onPressCategories}
      />
    );

    fireEvent.press(getByLabelText('Фильтры: Маршрут'));
    fireEvent.press(getByLabelText('Категории: Все'));

    expect(onPressFilters).toHaveBeenCalledTimes(1);
    expect(onPressCategories).toHaveBeenCalledTimes(1);
  });

  it('hides a selector when its action is unavailable', () => {
    const { queryByText, getByText } = render(
      <MapQuickFilters filtersValue="60 км" onPressFilters={jest.fn()} />
    );

    expect(getByText('Фильтры')).toBeTruthy();
    expect(queryByText('Категории')).toBeNull();
  });
});
