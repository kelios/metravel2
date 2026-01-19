import { render, fireEvent, screen } from '@testing-library/react-native';
import { PointFilters } from '@/components/UserPoints/PointFilters';
import type { PointFilters as PointFiltersType } from '@/types/userPoints';
import { PointStatus } from '@/types/userPoints';

describe('PointFilters', () => {
  it('should render status filter chips from availableStatuses', () => {
    const mockOnChange = jest.fn();
    const filters: PointFiltersType = {};

    const availableStatuses = [PointStatus.VISITED, PointStatus.PLANNING];

    render(
      <PointFilters filters={filters} onChange={mockOnChange} availableStatuses={availableStatuses} />
    );

    expect(screen.getByText('Посещено')).toBeTruthy();
    expect(screen.getByText('Планирую')).toBeTruthy();
  });

  it('should call onChange when status chip is pressed', () => {
    const mockOnChange = jest.fn();
    const filters: PointFiltersType = {};

    const availableStatuses = [PointStatus.VISITED, PointStatus.PLANNING];

    render(
      <PointFilters filters={filters} onChange={mockOnChange} availableStatuses={availableStatuses} />
    );

    fireEvent.press(screen.getByText('Посещено'));

    expect(mockOnChange).toHaveBeenCalledWith({
      statuses: [PointStatus.VISITED],
    });
  });

  it('should add status to existing filters', () => {
    const mockOnChange = jest.fn();
    const filters: PointFiltersType = {
      statuses: [PointStatus.VISITED],
    };

    const availableStatuses = [PointStatus.VISITED, PointStatus.PLANNING];

    render(
      <PointFilters filters={filters} onChange={mockOnChange} availableStatuses={availableStatuses} />
    );

    fireEvent.press(screen.getByText('Планирую'));

    expect(mockOnChange).toHaveBeenCalledWith({
      statuses: [PointStatus.VISITED, PointStatus.PLANNING],
    });
  });

  it('should remove status when already selected', () => {
    const mockOnChange = jest.fn();
    const filters: PointFiltersType = {
      statuses: [PointStatus.VISITED, PointStatus.PLANNING],
    };

    const availableStatuses = [PointStatus.VISITED, PointStatus.PLANNING];

    render(
      <PointFilters filters={filters} onChange={mockOnChange} availableStatuses={availableStatuses} />
    );

    fireEvent.press(screen.getByText('Посещено'));

    expect(mockOnChange).toHaveBeenCalledWith({
      statuses: [PointStatus.PLANNING],
    });
  });

  it('should highlight selected status chips', () => {
    const mockOnChange = jest.fn();
    const filters: PointFiltersType = {
      statuses: [PointStatus.VISITED],
    };

    const availableStatuses = [PointStatus.VISITED, PointStatus.PLANNING];

    const { getByText } = render(
      <PointFilters filters={filters} onChange={mockOnChange} availableStatuses={availableStatuses} />
    );

    const visitedText = screen.getByText('Посещено');
    const planningText = getByText('Планирую');

    expect(visitedText.props.style).toContainEqual(expect.objectContaining({ fontWeight: '600' }));
    expect(planningText.props.style).not.toContainEqual(expect.objectContaining({ fontWeight: '600' }));
  });
});
