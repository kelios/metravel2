import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

const mockPush = jest.fn();
const mockCancelOperation = jest.fn();
const mockRetryOperation = jest.fn(() => Promise.resolve());
const mockClearOperation = jest.fn();
const mockUseOfflineCatalog = jest.fn();
const mockPrepareTravelOfflineOpen = jest.fn();
jest.mock('@/components/offline/prepareTravelOfflineOpen', () => ({
  prepareTravelOfflineOpen: () => mockPrepareTravelOfflineOpen(),
}));

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
  const MockButton = ({ label, onPress, loading }: { label: string; onPress: () => void; loading?: boolean }) => (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={loading}>
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

  it('waits for the web content and route modules before opening a saved travel', async () => {
    const originalOS = Platform.OS;
    (Platform.OS as string) = 'web';
    let resolvePreparation!: () => void;
    mockPrepareTravelOfflineOpen.mockReturnValue(new Promise<void>((resolve) => { resolvePreparation = resolve; }));
    mockUseOfflineCatalog.mockReturnValue({
      ...baseCatalogState,
      items: [{ key: 'travel:42', sourceId: '42', type: 'travel', route: '/travels/saved', title: 'Saved', status: 'ready', pinned: true, bytes: 1, savedAt: 1 }],
    });
    try {
      await render(<OfflineLibraryScreen />);
      const open = screen.getByRole('button', { name: 'offline:open' });
      await fireEvent.press(open);
      expect(mockPush).not.toHaveBeenCalled();
      await act(async () => { resolvePreparation(); });
      await fireEvent.press(open);
      expect(mockPush).toHaveBeenCalledWith('/travels/saved');
    } finally { (Platform.OS as string) = originalOS; }
  });

  it('retries failed web preparation before allowing travel navigation', async () => {
    const originalOS = Platform.OS;
    (Platform.OS as string) = 'web';
    mockPrepareTravelOfflineOpen.mockRejectedValueOnce(new Error('chunk unavailable')).mockResolvedValueOnce(undefined);
    mockUseOfflineCatalog.mockReturnValue({
      ...baseCatalogState,
      items: [{ key: 'travel:42', sourceId: '42', type: 'travel', route: '/travels/saved', title: 'Saved', status: 'ready', pinned: true, bytes: 1, savedAt: 1 }],
    });
    try {
      await render(<OfflineLibraryScreen />);
      await fireEvent.press(await screen.findByRole('button', { name: 'offline:retry' }));
      expect(mockPush).not.toHaveBeenCalled();
      await fireEvent.press(await screen.findByRole('button', { name: 'offline:open' }));
      expect(mockPrepareTravelOfflineOpen).toHaveBeenCalledTimes(2);
      expect(mockPush).toHaveBeenCalledWith('/travels/saved');
    } finally { (Platform.OS as string) = originalOS; }
  });

  it('renders truthful download progress and cancels the active operation', async () => {
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

    await render(<OfflineLibraryScreen />);

    expect(screen.getByText('offline:progress:2/5')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'offline:cancel' }));
    expect(mockCancelOperation).toHaveBeenCalledWith('travel:42');
  });

  it('renders storage-full as retryable and allows clearing the failed operation', async () => {
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

    await render(<OfflineLibraryScreen />);

    expect(screen.getByText('offline:storageFull')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'offline:retry' }));
    expect(mockRetryOperation).toHaveBeenCalledWith('article:7');
    await fireEvent.press(screen.getByRole('button', { name: 'offline:remove' }));
    expect(mockClearOperation).toHaveBeenCalledWith('article:7');
  });
});
