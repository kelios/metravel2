import { render, fireEvent, screen } from '@testing-library/react-native';
import { PointFilters } from '@/components/UserPoints/PointFilters';
import type { PointFilters as PointFiltersType } from '@/types/userPoints';

describe('PointFilters', () => {
  it('should render all color filter chips', () => {
    const mockOnChange = jest.fn();
    const filters: PointFiltersType = {};

    const availableColors = ['#4CAF50', '#9C27B0', '#2196F3'];

    render(<PointFilters filters={filters} onChange={mockOnChange} availableColors={availableColors} />);

    expect(screen.getByText('#4CAF50')).toBeTruthy();
    expect(screen.getByText('#9C27B0')).toBeTruthy();
    expect(screen.getByText('#2196F3')).toBeTruthy();
  });

  it('should call onChange when color chip is pressed', () => {
    const mockOnChange = jest.fn();
    const filters: PointFiltersType = {};

    const availableColors = ['#4CAF50', '#9C27B0'];

    render(<PointFilters filters={filters} onChange={mockOnChange} availableColors={availableColors} />);

    fireEvent.press(screen.getByText('#4CAF50'));

    expect(mockOnChange).toHaveBeenCalledWith({
      colors: ['#4CAF50'],
    });
  });

  it('should add color to existing filters', () => {
    const mockOnChange = jest.fn();
    const filters: PointFiltersType = {
      colors: ['#4CAF50'],
    };

    const availableColors = ['#4CAF50', '#9C27B0'];

    render(<PointFilters filters={filters} onChange={mockOnChange} availableColors={availableColors} />);

    fireEvent.press(screen.getByText('#9C27B0'));

    expect(mockOnChange).toHaveBeenCalledWith({
      colors: ['#4CAF50', '#9C27B0'],
    });
  });

  it('should remove color when already selected', () => {
    const mockOnChange = jest.fn();
    const filters: PointFiltersType = {
      colors: ['#4CAF50', '#9C27B0'],
    };

    const availableColors = ['#4CAF50', '#9C27B0'];

    render(<PointFilters filters={filters} onChange={mockOnChange} availableColors={availableColors} />);

    fireEvent.press(screen.getByText('#4CAF50'));

    expect(mockOnChange).toHaveBeenCalledWith({
      colors: ['#9C27B0'],
    });
  });

  it('should highlight selected chips', () => {
    const mockOnChange = jest.fn();
    const filters: PointFiltersType = {
      colors: ['#4CAF50'],
    };

    const availableColors = ['#4CAF50', '#9C27B0'];

    const { getByText } = render(
      <PointFilters filters={filters} onChange={mockOnChange} availableColors={availableColors} />
    );

    const greenText = screen.getByText('#4CAF50');
    const purpleText = getByText('#9C27B0');

    expect(greenText.props.style).toContainEqual(expect.objectContaining({ fontWeight: '600' }));
    expect(purpleText.props.style).not.toContainEqual(expect.objectContaining({ fontWeight: '600' }));
  });
});
