import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PointCard } from '@/components/UserPoints/PointCard';
import { PointStatus } from '@/types/userPoints';
import type { ImportedPoint } from '@/types/userPoints';

jest.mock('expo-clipboard', () => ({
  __esModule: true,
  setStringAsync: jest.fn(async () => true),
}));

describe('PointCard', () => {
  const mockPoint: ImportedPoint = {
    id: 1,
    name: 'Test Restaurant',
    latitude: 50.4501,
    longitude: 30.5234,
    color: '#4CAF50',
    category: 'Ресторан',
    status: PointStatus.VISITED,
    description: 'A great place to eat',
    address: 'Main Street 123, Kyiv',
    rating: 4.5,
    source: 'google_maps',
    imported_at: '2024-01-15T10:00:00Z',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z'
  };

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

  it('should render coordinates under address', () => {
    render(<PointCard point={mockPoint} />);
    expect(screen.getByText('50.450100, 30.523400')).toBeTruthy();
  });

  it('should not render status label', () => {
    render(<PointCard point={mockPoint} />);
    expect(screen.queryByText('Посещено')).toBeNull();
  });

  it('should render category when coordinates are present', () => {
    render(<PointCard point={mockPoint} />);
    expect(screen.getByText('Ресторан')).toBeTruthy();
  });

  it('should not render category when coordinates are missing', () => {
    const pointWithoutCoords = { ...mockPoint, latitude: Number.NaN, longitude: Number.NaN };
    render(<PointCard point={pointWithoutCoords} />);
    expect(screen.queryByText('Ресторан')).toBeNull();
  });

  it('should not render coordinates when coordinates are missing', () => {
    const pointWithoutCoords = { ...mockPoint, latitude: Number.NaN, longitude: Number.NaN };
    render(<PointCard point={pointWithoutCoords} />);
    expect(screen.queryByText('50.450100, 30.523400')).toBeNull();
  });

  it('should copy coordinates to clipboard on native', async () => {
    const Clipboard = require('expo-clipboard');
    render(<PointCard point={mockPoint} />);

    fireEvent.press(screen.getByLabelText('Копировать координаты'));

    await waitFor(() => {
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('50.450100, 30.523400');
    });
  });

  it('should copy coordinates via navigator.clipboard on web when available', async () => {
    const originalPlatform = require('react-native').Platform.OS;
    (require('react-native').Platform as any).OS = 'web';

    const writeText = jest.fn(async () => true);
    (global as any).window = {
      navigator: {
        clipboard: {
          writeText,
        },
      },
    };

    render(<PointCard point={mockPoint} />);
    fireEvent.press(screen.getByLabelText('Копировать координаты'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('50.450100, 30.523400');
    });

    (require('react-native').Platform as any).OS = originalPlatform;
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
