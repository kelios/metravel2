// Контракт редизайна контрола «Сохранить офлайн»: одна пилюля-чип держит все
// состояния (idle → busy → saved / failed), прогресс закрашивает фон, отмена стоит
// рядом в том же ряду, а сохранённая копия перестала быть тупиком — её можно удалить
// со страницы. Тач-таргет на mobile/native ≥44 (48 на Android) проверяем здесь,
// потому что headless-превью не переключает RN Web на мобильный брейкпоинт.
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockCancelOperation = jest.fn();
const mockRetryOperation = jest.fn(() => Promise.resolve());
const mockRemove = jest.fn(() => Promise.resolve());
const mockUseOfflineCatalog = jest.fn();
const mockUseResponsive = jest.fn(() => ({ isHydrated: true, isMobile: true }));
const mockConfirmAction = jest.fn(() => Promise.resolve(true));

jest.mock('@expo/vector-icons/Feather', () => {
  const MockFeather = () => null;
  return { __esModule: true, default: MockFeather };
});

jest.mock('@/components/ui/ActionListSheet', () => {
  const { Pressable, Text, View } = require('react-native');
  const MockSheet = ({
    visible,
    title,
    actions,
  }: {
    visible: boolean;
    title: string;
    actions: { key: string; label: string; onPress: () => void }[];
  }) => {
    if (!visible) return null;
    return (
      <View testID="action-sheet">
        <Text>{title}</Text>
        {actions.map((action) => (
          <Pressable key={action.key} accessibilityRole="button" onPress={action.onPress}>
            <Text>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    );
  };
  return { __esModule: true, default: MockSheet };
});

jest.mock('@/hooks/useOfflineCatalog', () => ({
  useOfflineCatalog: (...args: unknown[]) => mockUseOfflineCatalog(...args),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockUseResponsive(),
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    backgroundSecondary: '#f9f8f6',
    borderLight: 'rgba(0,0,0,0.03)',
    danger: '#9a6363',
    dangerDark: '#8a5353',
    dangerLight: '#f5f0f0',
    dangerSoft: 'rgba(154,99,99,0.08)',
    primary: '#7a9d8f',
    primaryAlpha30: '#7a9d8f30',
    primaryLight: '#f0f5f3',
    primaryText: '#547769',
    success: '#527d66',
    successDark: '#426d56',
    successLight: '#f0f5f2',
    successSoft: 'rgba(82,125,102,0.08)',
    textMuted: '#666',
  }),
}));

jest.mock('@/i18n/LocaleProvider', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => (
      key === 'offline:progress'
        ? `${String(values?.done)}/${String(values?.total)}`
        : key
    ),
  }),
}));

jest.mock('@/utils/confirmAction', () => ({
  confirmAction: (...args: unknown[]) => mockConfirmAction(...args),
}));

jest.mock('@/utils/toast', () => ({
  showToast: jest.fn(),
}));

import OfflineSaveControl from '@/components/offline/OfflineSaveControl';

const baseCatalogState = {
  items: [],
  summary: { packageCount: 0, pinnedCount: 0, recentCount: 0, bytes: 0 },
  operations: [],
  isLoading: false,
  refresh: jest.fn(),
  remove: mockRemove,
  setPinned: jest.fn(),
  cancelOperation: mockCancelOperation,
  retryOperation: mockRetryOperation,
  clearOperation: jest.fn(),
};

const savedManifest = {
  key: 'travel:42',
  type: 'travel',
  sourceId: '42',
  route: '/travels/42',
  title: 'Гродно за 1 день',
  status: 'ready',
  pinned: true,
  includePhotos: false,
  bytes: 2048,
};

const downloadingOperation = {
  key: 'travel:42',
  type: 'travel',
  sourceId: '42',
  route: '/travels/42',
  title: 'Гродно за 1 день',
  status: 'downloading',
  done: 3,
  total: 10,
  errorCode: null,
  startedAt: 1,
};

const renderControl = (onSave = jest.fn(() => Promise.resolve())) => {
  const view = render(<OfflineSaveControl type="travel" sourceId={42} onSave={onSave} />);
  return { ...view, onSave };
};

const chipHeight = () => {
  const flattened = require('react-native').StyleSheet.flatten(
    screen.getByTestId('offline-save-chip').props.style,
  );
  return flattened.minHeight as number;
};

describe('OfflineSaveControl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseOfflineCatalog.mockReturnValue(baseCatalogState);
    mockUseResponsive.mockReturnValue({ isHydrated: true, isMobile: true });
    mockConfirmAction.mockResolvedValue(true);
  });

  it('предлагает сохранить и передаёт выбор «с фото» наружу', async () => {
    const { onSave } = renderControl();

    expect(screen.getByText('offline:saveOffline')).toBeTruthy();
    expect(screen.queryByTestId('action-sheet')).toBeNull();

    fireEvent.press(screen.getByTestId('offline-save-chip'));
    expect(screen.getByText('offline:saveTitle')).toBeTruthy();

    fireEvent.press(screen.getByText('offline:withPhotos'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(true);
    });
  });

  it('сохраняет только текст и маршрут, когда фото не нужны', async () => {
    const { onSave } = renderControl();

    fireEvent.press(screen.getByTestId('offline-save-chip'));
    fireEvent.press(screen.getByText('offline:textAndRoute'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(false);
    });
  });

  it('показывает прогресс закраской и отменяет загрузку соседней кнопкой', () => {
    mockUseOfflineCatalog.mockReturnValue({
      ...baseCatalogState,
      operations: [downloadingOperation],
    });

    renderControl();

    expect(screen.getByText('offline:saving · 3/10')).toBeTruthy();
    const fill = require('react-native').StyleSheet.flatten(
      screen.getByTestId('offline-save-progress').props.style,
    );
    expect(fill.width).toBe('30%');

    // Во время загрузки чип не открывает лист выбора — только отмена.
    fireEvent.press(screen.getByTestId('offline-save-chip'));
    expect(screen.queryByTestId('action-sheet')).toBeNull();

    fireEvent.press(screen.getByTestId('offline-save-cancel'));
    expect(mockCancelOperation).toHaveBeenCalledWith('travel:42');
  });

  it('объясняет нехватку места и повторяет загрузку по нажатию', () => {
    mockUseOfflineCatalog.mockReturnValue({
      ...baseCatalogState,
      operations: [{
        ...downloadingOperation,
        status: 'failed',
        errorCode: 'OFFLINE_STORAGE_FULL',
      }],
    });

    renderControl();

    expect(screen.getByText('offline:retry')).toBeTruthy();
    expect(screen.getByTestId('offline-save-error')).toHaveTextContent('offline:storageFull');
    expect(screen.queryByTestId('offline-save-cancel')).toBeNull();

    fireEvent.press(screen.getByTestId('offline-save-chip'));
    expect(mockRetryOperation).toHaveBeenCalledWith('travel:42');
  });

  it('даёт удалить сохранённую копию со страницы, а не только из библиотеки', async () => {
    mockUseOfflineCatalog.mockReturnValue({
      ...baseCatalogState,
      items: [savedManifest],
    });

    renderControl();

    expect(screen.getByText('offline:savedOffline')).toBeTruthy();

    fireEvent.press(screen.getByTestId('offline-save-chip'));
    expect(screen.getByText('offline:manageTitle')).toBeTruthy();

    fireEvent.press(screen.getByText('offline:remove'));
    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalledWith('travel:42');
    });
    expect(mockConfirmAction).toHaveBeenCalled();
  });

  it('оставляет копию, если удаление не подтвердили', async () => {
    mockUseOfflineCatalog.mockReturnValue({
      ...baseCatalogState,
      items: [savedManifest],
    });
    mockConfirmAction.mockResolvedValue(false);

    renderControl();

    fireEvent.press(screen.getByTestId('offline-save-chip'));
    fireEvent.press(screen.getByText('offline:remove'));

    await waitFor(() => {
      expect(mockConfirmAction).toHaveBeenCalled();
    });
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('держит тач-таргет ≥44 на мобильном и на планшетной ширине native', () => {
    renderControl();
    expect(chipHeight()).toBeGreaterThanOrEqual(44);

    screen.unmount();
    mockUseResponsive.mockReturnValue({ isHydrated: true, isMobile: false });
    renderControl();
    expect(chipHeight()).toBeGreaterThanOrEqual(44);
  });
});
