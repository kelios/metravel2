import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text, View } from 'react-native';

import { PointCard } from '@/components/UserPoints/PointCard';
import { PointStatus } from '@/types/userPoints';
import type { ImportedPoint } from '@/types/userPoints';

const mockPlaceListCard = jest.fn((props: any) => {
  const React = require('react');
  return (
    <View testID={props.testID ?? 'mock-place-list-card'}>
      <Text>{props.title}</Text>
      {props.categoryLabel ? <Text>{props.categoryLabel}</Text> : null}
      {props.coord ? <Text>{props.coord}</Text> : null}
      <Text testID="image-height">{String(props.imageHeight)}</Text>
      <Text testID="image-url">{String(props.imageUrl ?? '')}</Text>
      {(props.badges ?? []).map((badge: string) => <Text key={badge}>{badge}</Text>)}
      {props.onCopyCoord ? (
        <Text accessibilityRole="button" accessibilityLabel="Копировать координаты" onPress={props.onCopyCoord}>
          copy
        </Text>
      ) : null}
      {(props.mapActions ?? []).map((action: any) => (
        <Text key={action.key} onPress={action.onPress}>{action.label}</Text>
      ))}
      {(props.inlineActions ?? []).map((action: any) => (
        <Text key={action.key} accessibilityLabel={action.accessibilityLabel} onPress={action.onPress}>
          {action.label}
        </Text>
      ))}
    </View>
  );
});

jest.mock('@/components/places/PlaceListCard', () => ({
  __esModule: true,
  default: (props: any) => mockPlaceListCard(props),
}));

jest.mock('expo-clipboard', () => ({
  __esModule: true,
  setStringAsync: jest.fn(async () => true),
}));

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrlInNewTab: jest.fn(async () => true),
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
    updated_at: '2024-01-15T10:00:00Z',
  };

  beforeEach(() => {
    mockPlaceListCard.mockClear();
  });

  it('renders user point through the shared PlaceListCard template', () => {
    render(<PointCard point={mockPoint} />);

    expect(mockPlaceListCard).toHaveBeenCalled();
    const props = mockPlaceListCard.mock.calls[0]?.[0];
    expect(props.popupAligned).toBe(true);
    expect(props.titleLayout).toBe('content');
    expect(props.compact).toBe(true);
    expect(props.showAddButton).toBe(false);
    expect(screen.getByText('Test Restaurant')).toBeTruthy();
  });

  it('passes point metadata as content props and badges', () => {
    render(<PointCard point={mockPoint} />);

    const props = mockPlaceListCard.mock.calls[0]?.[0];
    expect(props.categoryLabel).toBe('Ресторан');
    expect(props.coord).toBe('50.450100, 30.523400');
    expect(props.badges).toEqual([
      'Main Street 123, Kyiv',
      'A great place to eat',
      '4.5',
    ]);
    expect(screen.getByText('Ресторан')).toBeTruthy();
    expect(screen.getByText('Main Street 123, Kyiv')).toBeTruthy();
  });

  it('shows a clean title when name is a raw reverse-geocode address', () => {
    const geocoded = {
      ...mockPoint,
      name: '3, Рыночная площадь, Old Town, Краков, Малопольское воеводство, Польша',
      address: '3, Рыночная площадь, Old Town, Краков, Малопольское воеводство, Польша',
      description: null,
    };
    render(<PointCard point={geocoded} />);

    expect(screen.getByText('3, Рыночная площадь')).toBeTruthy();
    expect(
      screen.getByText('3, Рыночная площадь, Old Town, Краков, Малопольское воеводство, Польша')
    ).toBeTruthy();
  });

  it('does not render status label', () => {
    render(<PointCard point={mockPoint} />);
    expect(screen.queryByText('Посещено')).toBeNull();
  });

  it('does not pass coordinates when coordinates are missing', () => {
    const pointWithoutCoords = { ...mockPoint, latitude: Number.NaN, longitude: Number.NaN };
    render(<PointCard point={pointWithoutCoords} />);

    const props = mockPlaceListCard.mock.calls[0]?.[0];
    expect(props.coord).toBeUndefined();
    expect(props.mapActions).toEqual([]);
    expect(screen.queryByText('50.450100, 30.523400')).toBeNull();
  });

  it('copies coordinates to clipboard on native', async () => {
    const Clipboard = require('expo-clipboard');
    render(<PointCard point={mockPoint} />);

    fireEvent.press(screen.getByLabelText('Копировать координаты'));

    await waitFor(() => {
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('50.450100, 30.523400');
    });
  });

  it('copies coordinates via navigator.clipboard on web when available', async () => {
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

  it('passes navigation actions into the shared card overflow model', () => {
    render(<PointCard point={mockPoint} />);

    const props = mockPlaceListCard.mock.calls[0]?.[0];
    expect(props.mapActions.map((action: any) => action.key)).toEqual([
      'google',
      'apple',
      'organic',
      'waze',
      'yandex-maps',
      'yandex',
      'osm',
    ]);
  });

  it('passes edit and delete as shared card inline actions', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    render(<PointCard point={mockPoint} onEdit={onEdit} onDelete={onDelete} />);

    fireEvent.press(screen.getByLabelText('Редактировать'));
    fireEvent.press(screen.getByLabelText('Удалить'));

    expect(onEdit).toHaveBeenCalledWith(mockPoint);
    expect(onDelete).toHaveBeenCalledWith(mockPoint);
  });

  it('passes selection action in selection mode', () => {
    const onToggleSelect = jest.fn();
    render(<PointCard point={mockPoint} selectionMode selected onToggleSelect={onToggleSelect} />);

    fireEvent.press(screen.getByLabelText('Точка выбрана'));
    expect(onToggleSelect).toHaveBeenCalledWith(mockPoint);
  });

  it('renders without description or address', () => {
    const pointWithoutDetails = { ...mockPoint, description: undefined, address: undefined };
    render(<PointCard point={pointWithoutDetails} />);
    expect(screen.getByText('Test Restaurant')).toBeTruthy();
  });

  it('uses the shared card media area for points without and with photos', () => {
    render(<PointCard point={mockPoint} />);
    expect(Number(screen.getByTestId('image-height').props.children)).toBeGreaterThan(0);

    mockPlaceListCard.mockClear();
    const pointWithPhoto = { ...mockPoint, photo: 'https://example.com/p.jpg' } as any;
    render(<PointCard point={pointWithPhoto} />);

    expect(screen.getByTestId('image-url').props.children).toBe('https://example.com/p.jpg');
  });
});
