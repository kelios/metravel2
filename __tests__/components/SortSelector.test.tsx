import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SortSelector from '@/components/SortSelector';

describe('SortSelector', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all sort options', () => {
    const { getByText } = render(
      <SortSelector value="date" onChange={mockOnChange} />
    );
    expect(getByText('По дате')).toBeTruthy();
    expect(getByText('По популярности')).toBeTruthy();
    expect(getByText('По названию')).toBeTruthy();
  });

  it('should show distance option when showDistance is true', () => {
    const { getByText } = render(
      <SortSelector value="date" onChange={mockOnChange} showDistance />
    );
    expect(getByText('По расстоянию')).toBeTruthy();
  });

  it('should call onChange when option is pressed', () => {
    const { getByText } = render(
      <SortSelector value="date" onChange={mockOnChange} />
    );
    const popularityOption = getByText('По популярности');
    fireEvent.press(popularityOption);
    expect(mockOnChange).toHaveBeenCalledWith('popularity');
  });

  it('should highlight active option', () => {
    const { getByText } = render(
      <SortSelector value="popularity" onChange={mockOnChange} />
    );
    const popularityOption = getByText('По популярности').parent;
    expect(popularityOption).toBeTruthy();
  });

  it('should not show distance option by default', () => {
    const { queryByText } = render(
      <SortSelector value="date" onChange={mockOnChange} />
    );
    expect(queryByText('По расстоянию')).toBeNull();
  });
});

