import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import RecentViews from '@/components/RecentViews';
import { Platform } from 'react-native';

// Mock Feather icons
jest.mock('@expo/vector-icons', () => ({
  Feather: ({ name, size: _size, color: _color, ...props }: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: `feather-${name}`, ...props });
  },
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock design system
jest.mock('@/constants/designSystem', () => ({
  DESIGN_TOKENS: {
    colors: {
      primary: '#6b8e7f',
      text: '#1f2937',
      textMuted: '#6b7280',
      surfaceMuted: '#f3f4f6',
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
    },
  },
}));

// Mock AsyncStorage
const mockAsyncStorage = {
  getItem: jest.fn(),
  removeItem: jest.fn(),
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
}));

// Mock TravelCardCompact
jest.mock('@/components/TravelCardCompact', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return ({ travel }: any) =>
    React.createElement(View, { testID: `travel-card-${travel.id}` }, 
      React.createElement(Text, null, travel.title)
    );
});

// Mock safeJsonParse
jest.mock('@/src/utils/safeJsonParse', () => ({
  safeJsonParseString: jest.fn((str, defaultValue) => {
    try {
      return JSON.parse(str);
    } catch {
      return defaultValue;
    }
  }),
}));

// Mock logger
jest.mock('@/src/utils/logger', () => ({
  devError: jest.fn(),
}));

// Mock __DEV__
(global as any).__DEV__ = true;

const createTravel = (overrides: Partial<any> = {}) =>
  ({
    id: overrides.id ?? 1,
    title: overrides.title ?? 'Travel 1',
    name: overrides.title ?? 'Travel 1',
    slug: `travel-${overrides.id ?? 1}`,
    travel_image_thumb_url: '',
    travel_image_thumb_small_url: '',
    url: 'https://metravel.by/travels/test',
    ...overrides,
  } as any);

describe('RecentViews', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
  });

  afterEach(() => {
    (Platform.OS as any) = originalPlatform;
  });

  it('should not render when loading', async () => {
    mockAsyncStorage.getItem.mockImplementation(() => new Promise(() => {}));
    
    const { toJSON } = render(<RecentViews />);
    const tree = toJSON();
    
    // Должен вернуть null пока загружается
    expect(tree).toBeNull();
  });

  it('should not render when no recent views', async () => {
    mockAsyncStorage.getItem.mockResolvedValue(null);
    
    const { toJSON } = render(<RecentViews />);
    
    await waitFor(() => {
      const tree = toJSON();
      expect(tree).toBeNull();
    });
  });

  it('should render compact version', async () => {
    const mockTravels = [createTravel({ id: 1 }), createTravel({ id: 2, title: 'Travel 2' })];
    const { getByText } = render(<RecentViews compact initialTravels={mockTravels} />);

    await waitFor(() => {
      expect(getByText('Недавно просмотрено: 2')).toBeTruthy();
    });
  });

  it('should render recent travels list', async () => {
    const mockTravels = [createTravel({ id: 1 }), createTravel({ id: 2, title: 'Travel 2' })];
    const { getByTestId } = render(<RecentViews initialTravels={mockTravels} />);

    await waitFor(() => {
      expect(getByTestId('travel-card-1')).toBeTruthy();
      expect(getByTestId('travel-card-2')).toBeTruthy();
    });
  });

  it('should limit items to maxItems', async () => {
    const mockTravels = [
      createTravel({ id: 1 }),
      createTravel({ id: 2 }),
      createTravel({ id: 3 }),
      createTravel({ id: 4 }),
    ];

    const { queryByTestId } = render(<RecentViews maxItems={2} initialTravels={mockTravels} />);

    await waitFor(() => {
      expect(queryByTestId('travel-card-1')).toBeTruthy();
      expect(queryByTestId('travel-card-2')).toBeTruthy();
      expect(queryByTestId('travel-card-3')).toBeNull();
    });
  });

  it('should clear recent views when clear button is pressed', async () => {
    const mockTravels = [createTravel({ id: 1 })];
    mockAsyncStorage.removeItem.mockResolvedValue(undefined);
    
    const { UNSAFE_getAllByType, queryByTestId } = render(
      <RecentViews initialTravels={mockTravels} />
    );
    
    await waitFor(() => {
      expect(queryByTestId('travel-card-1')).toBeTruthy();
    });

    const { Pressable } = require('react-native');
    const pressables = UNSAFE_getAllByType(Pressable);
    
    // Находим кнопку очистки
    const clearButton = pressables.find((p: any) => {
      const children = p.props.children;
      if (Array.isArray(children)) {
        return children.some((child: any) =>
          child?.props?.children === 'Очистить'
        );
      }
      return false;
    });

    if (clearButton) {
      fireEvent.press(clearButton);
      await waitFor(() => {
        expect(queryByTestId('travel-card-1')).toBeNull();
      });
    }
  });

  it('should render title and icon', async () => {
    const mockTravels = [createTravel({ id: 1 })];
    const { getByTestId, getByText } = render(<RecentViews initialTravels={mockTravels} />);

    await waitFor(() => {
      expect(getByTestId('feather-clock')).toBeTruthy();
      expect(getByText('Недавние просмотры')).toBeTruthy();
    });
  });

  it('should handle error when loading recent views', async () => {
    mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));
    
    const { toJSON } = render(<RecentViews />);
    
    await waitFor(() => {
      const tree = toJSON();
      // Должен вернуть null при ошибке
      expect(tree).toBeNull();
    });
  });

  it('should attach onWheel handler on web for horizontal list', async () => {
    (Platform.OS as any) = 'web';

    const mockTravels = [createTravel({ id: 1 }), createTravel({ id: 2, title: 'Travel 2' })];
    const { getByTestId } = render(<RecentViews initialTravels={mockTravels} />);

    const list = getByTestId('recent-views-list');
    expect(list.props.horizontal).toBe(true);
    expect(typeof list.props.onWheel).toBe('function');
  });
});
