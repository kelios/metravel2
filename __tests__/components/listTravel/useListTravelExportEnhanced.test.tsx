// __tests__/components/listTravel/useListTravelExportEnhanced.test.tsx
// Юнит-тесты нового HTML-потока экспорта списка путешествий (useListTravelExportEnhanced)

import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';
import type { Travel } from '@/src/types/types';
import { useListTravelExportEnhanced } from '@/components/listTravel/hooks/useListTravelExportEnhanced';

const originalPlatformOS = Platform.OS;
const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

const mockGenerateTravelsHtml = jest.fn(async () => '<html><body><section class="pdf-page">Test</section></body></html>');
const mockOpenBookPreviewWindow = jest.fn();

jest.mock('@/src/services/book/BookHtmlExportService', () => ({
  BookHtmlExportService: jest.fn().mockImplementation(() => ({
    generateTravelsHtml: (...args: any[]) => mockGenerateTravelsHtml(...args),
  })),
}));

jest.mock('@/src/utils/openBookPreviewWindow', () => ({
  openBookPreviewWindow: (...args: any[]) => mockOpenBookPreviewWindow(...args),
}));

const makeTravel = (id: number): Travel => ({
  id,
  name: `Travel ${id}`,
  slug: `travel-${id}`,
  url: `https://example.com/travel-${id}`,
  youtube_link: '',
  userName: 'user',
  description: '',
  recommendation: '',
  plus: '',
  minus: '',
  cityName: 'City',
  countryName: 'Country',
  countUnicIpView: '',
  gallery: [],
  travelAddress: [],
  userIds: '',
  year: '2024',
  monthName: 'January',
  number_days: 5,
  companions: [],
  countryCode: '',
  travel_image_thumb_url: '',
  travel_image_thumb_small_url: '',
} as unknown as Travel);

const baseSettings = {
  title: 'Путешествия Julia',
  subtitle: '',
  coverType: 'auto' as const,
  template: 'minimal' as const,
  format: 'A4' as const,
  orientation: 'portrait' as const,
  margins: 'standard' as const,
  imageQuality: 'high' as const,
  sortOrder: 'date-desc' as const,
  includeToc: true,
  includeGallery: true,
  includeMap: true,
  colorTheme: 'blue' as const,
  fontFamily: 'sans' as const,
  photoMode: 'gallery' as const,
  mapMode: 'full-page' as const,
  includeChecklists: false,
  checklistSections: ['clothing', 'food', 'electronics'] as const,
};

describe('useListTravelExportEnhanced', () => {
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
    alertSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('openPrintBook: успешно генерирует HTML и открывает окно предпросмотра', async () => {
    const selected: Travel[] = [makeTravel(1), makeTravel(2)];
    const { result } = renderHook(() => useListTravelExportEnhanced({ selected, userName: 'Julia' }));

    await act(async () => {
      await result.current.handlePreview(baseSettings);
    });

    expect(mockGenerateTravelsHtml).toHaveBeenCalledTimes(1);
    expect(mockOpenBookPreviewWindow).toHaveBeenCalledTimes(1);
    expect(mockOpenBookPreviewWindow).toHaveBeenCalledWith(expect.stringContaining('pdf-page'));
  });

  it('openPrintBook: показывает предупреждение, если ничего не выбрано', async () => {
    const { result } = renderHook(() => useListTravelExportEnhanced({ selected: [], userName: 'Julia' }));

    await act(async () => {
      await result.current.handlePreview(baseSettings);
    });

    expect(mockGenerateTravelsHtml).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Внимание', 'Пожалуйста, выберите хотя бы одно путешествие');
  });

  it('openPrintBook: показывает ошибку, если generateTravelsHtml кидает исключение', async () => {
    mockGenerateTravelsHtml.mockRejectedValueOnce(new Error('Test error'));
    const selected: Travel[] = [makeTravel(1)];
    const { result } = renderHook(() => useListTravelExportEnhanced({ selected, userName: 'Julia' }));

    await act(async () => {
      await result.current.handlePreview(baseSettings);
    });

    expect(alertSpy).toHaveBeenCalledWith('Ошибка', expect.stringContaining('Test error'));
  });

  it('openPrintBook: на не-web платформах показывает сообщение "Недоступно"', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'ios',
    });

    const selected: Travel[] = [makeTravel(1)];
    const { result } = renderHook(() => useListTravelExportEnhanced({ selected, userName: 'Julia' }));

    await act(async () => {
      await result.current.handlePreview(baseSettings);
    });

    expect(alertSpy).toHaveBeenCalledWith('Недоступно', 'Просмотр книги и печать доступны только в веб-версии');

    // возвращаем web для остальных тестов
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });
  });
});
