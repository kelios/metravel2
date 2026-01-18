import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { PointFilters } from '@/components/UserPoints/PointFilters';
import { PointColor } from '@/types/userPoints';
import type { PointFilters as PointFiltersType } from '@/types/userPoints';

describe('PointFilters', () => {
  it('should render all color filter chips', () => {
    const mockOnChange = jest.fn();
    const filters: PointFiltersType = {};

    render(<PointFilters filters={filters} onChange={mockOnChange} />);

    expect(screen.getByText('Посещено')).toBeTruthy();
    expect(screen.getByText('Мечта')).toBeTruthy();
    expect(screen.getByText('Интересное')).toBeTruthy();
    expect(screen.getByText('Планирую')).toBeTruthy();
    expect(screen.getByText('Избранное')).toBeTruthy();
    expect(screen.getByText('В работе')).toBeTruthy();
    expect(screen.getByText('Архив')).toBeTruthy();
  });

  it('should call onChange when color chip is pressed', () => {
    const mockOnChange = jest.fn();
    const filters: PointFiltersType = {};

    render(<PointFilters filters={filters} onChange={mockOnChange} />);

    const greenChip = screen.getByText('Посещено');
    fireEvent.press(greenChip);

    expect(mockOnChange).toHaveBeenCalledWith({
      colors: [PointColor.GREEN]
    });
  });

  it('should add color to existing filters', () => {
    const mockOnChange = jest.fn();
    const filters: PointFiltersType = {
      colors: [PointColor.GREEN]
    };

    render(<PointFilters filters={filters} onChange={mockOnChange} />);

    const purpleChip = screen.getByText('Мечта');
    fireEvent.press(purpleChip);

    expect(mockOnChange).toHaveBeenCalledWith({
      colors: [PointColor.GREEN, PointColor.PURPLE]
    });
  });

  it('should remove color when already selected', () => {
    const mockOnChange = jest.fn();
    const filters: PointFiltersType = {
      colors: [PointColor.GREEN, PointColor.PURPLE]
    };

    render(<PointFilters filters={filters} onChange={mockOnChange} />);

    const greenChip = screen.getByText('Посещено');
    fireEvent.press(greenChip);

    expect(mockOnChange).toHaveBeenCalledWith({
      colors: [PointColor.PURPLE]
    });
  });

  it('should highlight selected chips', () => {
    const mockOnChange = jest.fn();
    const filters: PointFiltersType = {
      colors: [PointColor.GREEN]
    };

    const { getByText } = render(<PointFilters filters={filters} onChange={mockOnChange} />);

    const greenText = getByText('Посещено');
    const purpleText = getByText('Мечта');

    expect(greenText.props.style).toContainEqual(expect.objectContaining({ fontWeight: '600' }));
    expect(purpleText.props.style).not.toContainEqual(expect.objectContaining({ fontWeight: '600' }));
  });
});
