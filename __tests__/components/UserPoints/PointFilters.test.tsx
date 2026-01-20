import { render, fireEvent, screen } from '@testing-library/react-native';
import { PointFilters } from '@/components/UserPoints/PointFilters';
import type { PointFilters as PointFiltersType } from '@/types/userPoints';

describe('PointFilters', () => {
  it('renders radius section', () => {
    const mockOnChange = jest.fn();
    const filters: PointFiltersType = {};

    render(<PointFilters filters={filters} onChange={mockOnChange} availableColors={[]} />);

    expect(screen.getByText('Радиус')).toBeTruthy();
  });
});
