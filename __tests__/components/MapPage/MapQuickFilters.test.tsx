import React from 'react';
import * as RN from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

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

  it('renders a compact overflow filters chip on narrow screens and opens full filters', () => {
    const onOpenFilters = jest.fn();

    const { getByText, getByLabelText, getByText: getText } = render(
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
    expect(getByLabelText(/Открыть все фильтры, скрыто ещё \d+/)).toBeTruthy();
    expect(getText(/^\+\d+$/)).toBeTruthy();

    fireEvent.press(getByLabelText(/Открыть все фильтры, скрыто ещё \d+/));
    expect(onOpenFilters).toHaveBeenCalledTimes(1);
  });

  it('keeps the compact filters chip visible when categories are selected', () => {
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

    expect(getByLabelText(/Открыть все фильтры, выбрано 1/)).toBeTruthy();
    expect(getByText('1')).toBeTruthy();

    fireEvent.press(getByLabelText(/Открыть все фильтры, выбрано 1/));
    expect(onOpenFilters).toHaveBeenCalledTimes(1);
  });

  it('keeps the overflow action chip compact on 393px mobile widths', () => {
    ;(RN.useWindowDimensions as jest.Mock).mockReturnValue({
      width: 393,
      height: 852,
      scale: 1,
      fontScale: 1,
    });

    const { getByText, getByLabelText, queryByText } = render(
      <MapQuickFilters
        categories={[
          { id: 1, name: 'Парковка' },
          { id: 2, name: 'Пещера' },
          { id: 3, name: 'Костёл' },
          { id: 4, name: 'Родник' },
        ]}
        selectedCategories={[]}
        onToggleCategory={jest.fn()}
        maxVisible={3}
        onOpenFilters={jest.fn()}
      />
    );

    expect(getByText('Парковка')).toBeTruthy();
    expect(getByText('Пещера')).toBeTruthy();
    expect(queryByText('Костёл')).toBeNull();
    expect(getByLabelText(/Открыть все фильтры, скрыто ещё \d+/)).toBeTruthy();
  });

  it('skips categories with empty names so blank chips are not rendered', () => {
    const { getByText, queryByText } = render(
      <MapQuickFilters
        categories={[
          { id: 1, name: 'Парковка' },
          { id: 2, name: '   ' },
          { id: 3, name: 'Пещера' },
        ]}
        selectedCategories={[]}
        onToggleCategory={jest.fn()}
        maxVisible={5}
        onOpenFilters={jest.fn()}
      />
    );

    expect(getByText('Парковка')).toBeTruthy();
    expect(getByText('Пещера')).toBeTruthy();
    expect(queryByText('   ')).toBeNull();
  });
});
