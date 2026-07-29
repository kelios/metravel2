import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockCancelOperation = jest.fn();
const mockRetryOperation = jest.fn(() => Promise.resolve());
const mockClearOperation = jest.fn();
const mockUseOfflineCatalog = jest.fn();

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@expo/vector-icons/Feather', () => {
  const MockFeather = () => null;
  return { __esModule: true, default: MockFeather };
});

jest.mock('@/components/ui/Button', () => {
  const { Pressable, Text } = require('react-native');
  const MockButton = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Text>{label}</Text>
    </Pressable>
  );
  return { __esModule: true, default: MockButton };
});

jest.mock('@/components/ui/Chip', () => {
  const { Pressable, Text } = require('react-native');
  const MockChip = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Text>{label}</Text>
    </Pressable>
  );
  return { __esModule: true, default: MockChip };
});

jest.mock('@/components/ui/EmptyState', () => {
  const { Text } = require('react-native');
  const MockEmptyState = ({ title }: { title: string }) => <Text>{title}</Text>;
  return { __esModule: true, default: MockEmptyState };
});

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ userId: null }),
}));

jest.mock('@/hooks/useOfflineCatalog', () => ({
  useOfflineCatalog: (...args: unknown[]) => mockUseOfflineCatalog(...args),
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    background: '#fff',
    surface: '#fff',
    primaryDark: '#123',
    text: '#111',
    textMuted: '#666',
    border: '#ddd',
    danger: '#c00',
  }),
}));

jest.mock('@/i18n/LocaleProvider', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => (
      key === 'offline:progress'
        ? `${key}:${String(values?.done)}/${String(values?.total)}`
        : key
    ),
  }),
}));

jest.mock('@/i18n/format', () => ({
  formatDate: () => 'Jul 29',
  formatInteger: (value: number) => String(value),
  formatNumber: (value: number) => String(value),
  selectPlural: (_value: number, options: { other: string }) => options.other,
}));

jest.mock('@/services/offline/mapOfflineAdapter', () => ({
  deleteMapRegionOffline: jest.fn(),
}));

jest.mock('@/utils/confirmAction', () => ({
  confirmAction: jest.fn(() => Promise.resolve(true)),
}));

import OfflineLibraryScreen from '@/app/(tabs)/offline';

const baseCatalogState = {
  items: [],
  summary: { packageCount: 0, bytes: 0 },
  operations: [],
  isLoading: false,
  remove: jest.fn(),
  setPinned: jest.fn(),
  cancelOperation: mockCancelOperation,
  retryOperation: mockRetryOperation,
  clearOperation: mockClearOperation,
};

describe('OfflineLibraryScreen operation states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseOfflineCatalog.mockReturnValue(baseCatalogState);
  });

  it('renders truthful download progress and cancels the active operation', () => {
    mockUseOfflineCatalog.mockReturnValue({
      ...baseCatalogState,
      operations: [{
        key: 'travel:42',
        type: 'travel',
        sourceId: '42',
        route: '/travels/42',
        title: 'Saved route',
        status: 'downloading',
        done: 2,
        total: 5,
        errorCode: null,
        startedAt: 1,
      }],
    });

    render(<OfflineLibraryScreen />);

    expect(screen.getByText('offline:progress:2/5')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'offline:cancel' }));
    expect(mockCancelOperation).toHaveBeenCalledWith('travel:42');
  });

  it('renders storage-full as retryable and allows clearing the failed operation', () => {
    mockUseOfflineCatalog.mockReturnValue({
      ...baseCatalogState,
      operations: [{
        key: 'article:7',
        type: 'article',
        sourceId: '7',
        route: '/articles/7',
        title: 'Saved article',
        status: 'failed',
        done: 1,
        total: 3,
        errorCode: 'OFFLINE_STORAGE_FULL',
        startedAt: 2,
      }],
    });

    render(<OfflineLibraryScreen />);

    expect(screen.getByText('offline:storageFull')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'offline:retry' }));
    expect(mockRetryOperation).toHaveBeenCalledWith('article:7');
    fireEvent.press(screen.getByRole('button', { name: 'offline:remove' }));
    expect(mockClearOperation).toHaveBeenCalledWith('article:7');
  });
});
