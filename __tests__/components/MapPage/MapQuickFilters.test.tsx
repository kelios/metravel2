import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    useWindowDimensions: jest.fn(() => ({ width: 360, height: 800 })),
  };
});

import { MapQuickFilters } from '@/components/MapPage/MapQuickFilters';

describe('MapQuickFilters', () => {
  it('renders an overflow filters chip on narrow screens and opens full filters', () => {
    const onOpenFilters = jest.fn();

    const { getByText, getByLabelText } = render(
      <MapQuickFilters
        categories={[
          { id: 1, name: 'Горы' },
          { id: 2, name: 'Пляжи' },
          { id: 3, name: 'Города' },
          { id: 4, name: 'Природа' },
        ]}
        selectedCategories={[]}
        onToggleCategory={jest.fn()}
        maxVisible={3}
        onOpenFilters={onOpenFilters}
      />
    );

    expect(getByText('Горы')).toBeTruthy();
    expect(getByText('Пляжи')).toBeTruthy();
    expect(getByText('Все фильтры')).toBeTruthy();
    expect(getByText('+1')).toBeTruthy();

    fireEvent.press(getByLabelText('Открыть все фильтры, скрыто ещё 1'));
    expect(onOpenFilters).toHaveBeenCalledTimes(1);
  });

  it('keeps the full filters chip visible when categories are selected', () => {
    const onOpenFilters = jest.fn();

    const { getByText, getByLabelText } = render(
      <MapQuickFilters
        categories={[
          { id: 1, name: 'Горы' },
          { id: 2, name: 'Пляжи' },
        ]}
        selectedCategories={['Горы']}
        onToggleCategory={jest.fn()}
        maxVisible={3}
        onOpenFilters={onOpenFilters}
      />
    );

    expect(getByText('Все фильтры')).toBeTruthy();
    expect(getByText('1')).toBeTruthy();

    fireEvent.press(getByLabelText('Открыть все фильтры, выбрано 1'));
    expect(onOpenFilters).toHaveBeenCalledTimes(1);
  });
});
