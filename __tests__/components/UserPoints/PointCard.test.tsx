import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PointCard } from '@/components/UserPoints/PointCard';
import { PointColor, PointCategory, PointStatus } from '@/types/userPoints';
import type { ImportedPoint } from '@/types/userPoints';

describe('PointCard', () => {
  const mockPoint: ImportedPoint = {
    id: '1',
    name: 'Test Restaurant',
    latitude: 50.4501,
    longitude: 30.5234,
    color: PointColor.GREEN,
    category: PointCategory.RESTAURANT,
    categoryTravelAddress: ['1'],
    status: PointStatus.VISITED,
    description: 'A great place to eat',
    address: 'Main Street 123, Kyiv',
    rating: 4.5,
    source: 'google_maps',
    importedAt: '2024-01-15T10:00:00Z'
  };

  const siteCategoryLookup = new Map<string, string>([['1', 'Ресторан']]);

  it('should render point name', () => {
    render(<PointCard point={mockPoint} />);
    expect(screen.getByText('Test Restaurant')).toBeTruthy();
  });

  it('should render description', () => {
    render(<PointCard point={mockPoint} />);
    expect(screen.getByText('A great place to eat')).toBeTruthy();
  });

  it('should render address', () => {
    render(<PointCard point={mockPoint} />);
    expect(screen.getByText('Main Street 123, Kyiv')).toBeTruthy();
  });

  it('should render category label', () => {
    render(<PointCard point={mockPoint} siteCategoryLookup={siteCategoryLookup} />);
    expect(screen.getByText('Ресторан')).toBeTruthy();
  });

  it('should render status label', () => {
    render(<PointCard point={mockPoint} />);
    expect(screen.getByText('Посещено')).toBeTruthy();
  });

  it('should render rating when provided', () => {
    render(<PointCard point={mockPoint} />);
    expect(screen.getByText('4.5')).toBeTruthy();
  });

  it('should not render rating when not provided', () => {
    const pointWithoutRating = { ...mockPoint, rating: undefined };
    render(<PointCard point={pointWithoutRating} />);
    expect(screen.queryByText('4.5')).toBeNull();
  });

  it('should render without description', () => {
    const pointWithoutDescription = { ...mockPoint, description: undefined };
    render(<PointCard point={pointWithoutDescription} />);
    expect(screen.getByText('Test Restaurant')).toBeTruthy();
  });

  it('should render without address', () => {
    const pointWithoutAddress = { ...mockPoint, address: undefined };
    render(<PointCard point={pointWithoutAddress} />);
    expect(screen.getByText('Test Restaurant')).toBeTruthy();
  });

  it('should display correct color indicator', () => {
    const { getByTestId } = render(<PointCard point={mockPoint} />);
    const colorIndicator = getByTestId('color-indicator');
    expect(colorIndicator.props.style).toContainEqual(
      expect.objectContaining({ backgroundColor: expect.any(String) })
    );
  });
});
