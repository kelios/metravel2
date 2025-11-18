import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import SearchAndFilterBar from '@/components/listTravel/SearchAndFilterBar';

describe('SearchAndFilterBar', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('debounces search input before calling setSearch', () => {
    const setSearch = jest.fn();

    const { getByA11yLabel } = render(
      <SearchAndFilterBar
        search=""
        setSearch={setSearch}
        onToggleFilters={jest.fn()}
      />
    );

    const input = getByA11yLabel('Поле поиска путешествий');
    fireEvent.changeText(input, 'Минск');

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(setSearch).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(setSearch).toHaveBeenCalledWith('Минск');
  });

  it('fires toggle handler for recommendations', () => {
    const toggleRecommendations = jest.fn();

    const { getByTestId } = render(
      <SearchAndFilterBar
        search=""
        setSearch={jest.fn()}
        onToggleRecommendations={toggleRecommendations}
        isRecommendationsVisible={true}
      />
    );

    fireEvent.press(getByTestId('toggle-recommendations'));
    expect(toggleRecommendations).toHaveBeenCalled();
  });

  it('shows recommendations button as active when visible', () => {
    const { getByTestId } = render(
      <SearchAndFilterBar
        search=""
        setSearch={jest.fn()}
        onToggleRecommendations={jest.fn()}
        isRecommendationsVisible={true}
      />
    );

    const button = getByTestId('toggle-recommendations');
    expect(button).toBeTruthy();
  });

  it('hides recommendations button when not provided', () => {
    const { queryByTestId } = render(
      <SearchAndFilterBar
        search=""
        setSearch={jest.fn()}
      />
    );

    expect(queryByTestId('toggle-recommendations')).toBeNull();
  });
});

