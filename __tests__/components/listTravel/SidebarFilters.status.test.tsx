import React from 'react';
import { render } from '@testing-library/react-native';

import SidebarFilters from '@/components/listTravel/SidebarFilters';

const modernFiltersProps: Record<string, any>[] = [];

jest.mock('@/components/listTravel/ModernFilters', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, any>) => {
      modernFiltersProps.push(props);
      return <Text testID="modern-filters">filters</Text>;
    },
  };
});

const baseProps = {
  isMobile: false,
  filterGroups: [],
  total: 0,
  isSuper: false,
  setSearch: jest.fn(),
  resetFilters: jest.fn(),
};

const lastProps = () => modernFiltersProps[modernFiltersProps.length - 1];

describe('SidebarFilters publication-status rows', () => {
  beforeEach(() => {
    modernFiltersProps.length = 0;
  });

  it('hides both status rows outside "Мои путешествия"', () => {
    render(<SidebarFilters {...baseProps} filter={{}} onSelect={jest.fn()} />);

    expect(lastProps().showPublishedOnly).toBe(false);
    expect(lastProps().showDraftsOnly).toBe(false);
  });

  it('turns the published-only row on and off through the shared filter key', () => {
    const onSelect = jest.fn();
    const screen = render(
      <SidebarFilters {...baseProps} isMeTravel filter={{}} onSelect={onSelect} />
    );

    expect(lastProps().showPublishedOnly).toBe(true);
    expect(lastProps().publishedOnlyValue).toBe(false);

    lastProps().onTogglePublishedOnly();
    expect(onSelect).toHaveBeenCalledWith('publishedOnly', true);

    // Повторное нажатие снимает фильтр, а не переключает его на другое значение:
    // buildTravelQueryParams различает только `true` и отсутствие ключа.
    onSelect.mockClear();
    screen.rerender(
      <SidebarFilters
        {...baseProps}
        isMeTravel
        filter={{ publishedOnly: true }}
        onSelect={onSelect}
      />
    );

    expect(lastProps().publishedOnlyValue).toBe(true);
    lastProps().onTogglePublishedOnly();
    expect(onSelect).toHaveBeenCalledWith('publishedOnly', undefined);
  });

  it('keeps the drafts row on its own filter key', () => {
    const onSelect = jest.fn();
    render(
      <SidebarFilters
        {...baseProps}
        isMeTravel
        filter={{ draftsOnly: true }}
        onSelect={onSelect}
      />
    );

    expect(lastProps().draftsOnlyValue).toBe(true);
    expect(lastProps().publishedOnlyValue).toBe(false);

    lastProps().onToggleDraftsOnly();
    expect(onSelect).toHaveBeenCalledWith('draftsOnly', undefined);
  });
});
