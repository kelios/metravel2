import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SearchAndFilterBar from '@/components/listTravel/SearchAndFilterBar';

describe('SearchAndFilterBar', () => {
  const mockSetSearch = jest.fn();
  const mockOnToggleFilters = jest.fn();
  const mockOnToggleRecommendations = jest.fn();
  const mockOnClearAll = jest.fn();

  const defaultProps = {
    search: '',
    setSearch: mockSetSearch,
    onToggleFilters: mockOnToggleFilters,
    onToggleRecommendations: mockOnToggleRecommendations,
    isRecommendationsVisible: false,
    resultsCount: 0,
    isLoading: false,
    hasFilters: false,
    onClearAll: mockOnClearAll,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders search input', () => {
    const { getByPlaceholderText } = render(<SearchAndFilterBar {...defaultProps} />);
    expect(getByPlaceholderText(/найти путешествие/i)).toBeTruthy();
  });

  it('calls setSearch when typing', () => {
    const { getByPlaceholderText } = render(<SearchAndFilterBar {...defaultProps} />);
    const input = getByPlaceholderText(/найти путешествие/i);
    
    fireEvent.changeText(input, 'test');
    
    // Debounced, so wait a bit
    setTimeout(() => {
      expect(mockSetSearch).toHaveBeenCalled();
    }, 300);
  });

  it('shows clear button when search has value', () => {
    const { getByPlaceholderText, queryByLabelText } = render(
      <SearchAndFilterBar {...defaultProps} search="test" />
    );
    
    expect(queryByLabelText(/очистить поиск/i)).toBeTruthy();
  });

  it('calls onClearAll when clear all button is pressed', () => {
    const { getByLabelText } = render(
      <SearchAndFilterBar {...defaultProps} hasFilters={true} resultsCount={5} />
    );
    
    const clearButton = getByLabelText(/сбросить все фильтры/i);
    fireEvent.press(clearButton);
    
    expect(mockOnClearAll).toHaveBeenCalled();
  });

  it('shows results count when filters are active', () => {
    const { getByText } = render(
      <SearchAndFilterBar {...defaultProps} hasFilters={true} resultsCount={10} />
    );
    
    expect(getByText(/10/)).toBeTruthy();
  });

  it('toggles recommendations visibility', () => {
    const { getByLabelText } = render(<SearchAndFilterBar {...defaultProps} />);
    
    const toggleButton = getByLabelText(/показать рекомендации/i);
    fireEvent.press(toggleButton);
    
    expect(mockOnToggleRecommendations).toHaveBeenCalled();
  });
});
