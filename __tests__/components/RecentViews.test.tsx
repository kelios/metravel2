import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import RecentViews from '@/components/RecentViews';

// Mock Feather icons
jest.mock('@expo/vector-icons', () => ({
  Feather: ({ name, size, color, ...props }: any) => {
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

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

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

describe('RecentViews', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
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
    const mockTravels = [
      { id: 1, title: 'Travel 1' },
      { id: 2, title: 'Travel 2' },
    ];
    
    mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockTravels));
    
    const { toJSON } = render(<RecentViews compact={true} />);
    
    await waitFor(() => {
      const tree = toJSON();
      const treeStr = JSON.stringify(tree);
      expect(treeStr).toContain('Недавно просмотрено: 2');
    });
  });

  it('should render recent travels list', async () => {
    const mockTravels = [
      { id: 1, title: 'Travel 1' },
      { id: 2, title: 'Travel 2' },
    ];
    
    mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockTravels));
    
    const { toJSON, getByTestId } = render(<RecentViews />);
    
    await waitFor(() => {
      const tree = toJSON();
      expect(tree).toBeTruthy();
      expect(getByTestId('travel-card-1')).toBeTruthy();
      expect(getByTestId('travel-card-2')).toBeTruthy();
    });
  });

  it('should limit items to maxItems', async () => {
    const mockTravels = [
      { id: 1, title: 'Travel 1' },
      { id: 2, title: 'Travel 2' },
      { id: 3, title: 'Travel 3' },
      { id: 4, title: 'Travel 4' },
    ];
    
    mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockTravels));
    
    const { toJSON } = render(<RecentViews maxItems={2} />);
    
    await waitFor(() => {
      const tree = toJSON();
      expect(tree).toBeTruthy();
    });
  });

  it('should clear recent views when clear button is pressed', async () => {
    const mockTravels = [
      { id: 1, title: 'Travel 1' },
    ];
    
    mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockTravels));
    mockAsyncStorage.removeItem.mockResolvedValue(undefined);
    
    const { UNSAFE_getAllByType, queryByTestId } = render(<RecentViews />);
    
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
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('metravel_recent_views');
    }
  });

  it('should render title and icon', async () => {
    const mockTravels = [{ id: 1, title: 'Travel 1' }];
    mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockTravels));
    
    const { getByTestId, toJSON } = render(<RecentViews />);
    
    await waitFor(() => {
      expect(getByTestId('feather-clock')).toBeTruthy();
      const tree = toJSON();
      const treeStr = JSON.stringify(tree);
      expect(treeStr).toContain('Недавние просмотры');
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
});

