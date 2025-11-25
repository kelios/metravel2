// __tests__/components/listTravel/ListTravelExport.test.tsx
// Интеграционные тесты экспортной панели на странице списка путешествий (ListTravel)

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import ListTravel from '@/components/listTravel/ListTravel';

// Мокаем навигацию и роутер, чтобы ListTravel думал, что он на странице `export`
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ name: 'export' }),
}));

// Мокаем React Query
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn().mockReturnValue({ data: { countries: [] } }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

// Мокаем API фильтров/списка путешествий внутри useListTravelData
jest.mock('@/src/api/travels', () => ({
  fetchFilters: jest.fn(async () => ({})),
  fetchFiltersCountry: jest.fn(async () => ([])),
}));

// Мокаем useListTravelData так, чтобы он возвращал фиксированный список путешествий
jest.mock('@/components/listTravel/hooks/useListTravelData', () => ({
  useListTravelData: () => ({
    data: [
      { id: 1, name: 'Travel 1' },
      { id: 2, name: 'Travel 2' },
      { id: 3, name: 'Travel 3' },
    ],
    total: 3,
    hasMore: false,
    isLoading: false,
    isFetching: false,
    isError: false,
    status: 'success',
    isInitialLoading: false,
    isNextPageLoading: false,
    isEmpty: false,
    refetch: jest.fn(),
    handleEndReached: jest.fn(),
    handleRefresh: jest.fn(),
    isRefreshing: false,
  }),
}));

// Мокаем useListTravelExport, чтобы контролировать выбор и вызовы экспорта
const mockToggleSelect = jest.fn();
const mockToggleSelectAll = jest.fn();
const mockClearSelection = jest.fn();
const mockHandleSaveWithSettings = jest.fn();
const mockHandlePreviewWithSettings = jest.fn();

jest.mock('@/components/listTravel/hooks/useListTravelExport', () => ({
  useListTravelExport: () => ({
    selected: [],
    toggleSelect: mockToggleSelect,
    toggleSelectAll: mockToggleSelectAll,
    clearSelection: mockClearSelection,
    isSelected: jest.fn().mockReturnValue(false),
    hasSelection: true,
    selectionCount: 2,
    pdfExport: {
      isGenerating: false,
      progress: 0,
    },
    baseSettings: {
      title: 'Путешествия Julia',
      template: 'minimal',
      format: 'A4',
      orientation: 'portrait',
      margins: 'standard',
      imageQuality: 'high',
      sortOrder: 'date-desc',
      includeToc: true,
      includeGallery: true,
      includeMap: true,
      colorTheme: 'blue',
      fontFamily: 'sans',
      photoMode: 'gallery',
      mapMode: 'full-page',
      includeChecklists: false,
      checklistSections: ['clothing', 'food', 'electronics'],
    },
    lastSettings: {
      title: 'Путешествия Julia',
      template: 'minimal',
      format: 'A4',
      orientation: 'portrait',
      margins: 'standard',
      imageQuality: 'high',
      sortOrder: 'date-desc',
      includeToc: true,
      includeGallery: true,
      includeMap: true,
      colorTheme: 'blue',
      fontFamily: 'sans',
      photoMode: 'gallery',
      mapMode: 'full-page',
      includeChecklists: false,
      checklistSections: ['clothing', 'food', 'electronics'],
    },
    setLastSettings: jest.fn(),
    settingsSummary: 'A4 • Книжная • minimal',
    handleSaveWithSettings: mockHandleSaveWithSettings,
    handlePreviewWithSettings: mockHandlePreviewWithSettings,
  }),
}));

const originalPlatformOS = Platform.OS;

describe('ListTravel export bar', () => {
  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatformOS,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('отображает экспортную панель и счётчик выбранных путешествий', async () => {
    const { getByText } = render(<ListTravel />);

    await waitFor(() => {
      expect(getByText(/Выбрано 2 /)).toBeTruthy();
      expect(getByText('Сохранить PDF')).toBeTruthy();
      expect(getByText(/Превью \(2\)/)).toBeTruthy();
    });
  });

  it('открывает модальное окно настроек при нажатии на "Превью" и "Сохранить PDF"', async () => {
    const { getByText, findByText } = render(<ListTravel />);

    const previewButton = await findByText(/Превью \(2\)/);
    fireEvent.press(previewButton);

    // После нажатия должна появиться модалка с заголовком
    await findByText('Настройки фотоальбома');
  });

  it('вызывает handleSaveWithSettings при выборе "Сохранить PDF" в модалке', async () => {
    const { getByText, findByText, getByDisplayValue } = render(<ListTravel />);

    const saveButtonInBar = await findByText('Сохранить PDF');
    fireEvent.press(saveButtonInBar);

    const modalTitle = await findByText('Настройки фотоальбома');
    expect(modalTitle).toBeTruthy();

    // Меняем название книги, чтобы убедиться, что настройки реально проходят через onSave
    const titleInput = getByDisplayValue('Путешествия Julia');
    fireEvent.changeText(titleInput, 'Путешествия для экспорта');

    const modalSaveButton = getByText('Сохранить PDF');
    fireEvent.press(modalSaveButton);

    expect(mockHandleSaveWithSettings).toHaveBeenCalledTimes(1);
    const passedSettings = mockHandleSaveWithSettings.mock.calls[0][0];
    expect(passedSettings.title).toBe('Путешествия для экспорта');
  });

  it('вызывает handlePreviewWithSettings при выборе "Превью" в модалке', async () => {
    const { getByText, findByText } = render(<ListTravel />);

    const previewButtonInBar = await findByText(/Превью \(2\)/);
    fireEvent.press(previewButtonInBar);

    await findByText('Настройки фотоальбома');

    const modalPreviewButton = getByText('Превью');
    fireEvent.press(modalPreviewButton);

    expect(mockHandlePreviewWithSettings).toHaveBeenCalledTimes(1);
  });
});
