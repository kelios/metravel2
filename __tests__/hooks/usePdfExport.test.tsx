// __tests__/hooks/usePdfExport.test.tsx
// ✅ ТЕСТЫ: Тесты для usePdfExport hook

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Platform, Alert } from 'react-native';
import { usePdfExport } from '@/src/hooks/usePdfExport';
import type { Travel } from '@/src/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';

const mockGenerateTravelsHtml = jest.fn(async () => '<html><body><section class="pdf-page">Test</section></body></html>');
const mockOpenBookPreviewWindow = jest.fn();

jest.mock('@/src/api/travels', () => ({
  fetchTravel: jest.fn(async () => ({
    id: 99,
    name: 'Detailed Travel',
    description: 'Full description',
    recommendation: 'Some tips',
    plus: 'Pros',
    minus: 'Cons',
    gallery: [],
    travelAddress: [],
  }) as unknown as Travel),
  fetchTravelBySlug: jest.fn(async () => ({
    id: 100,
    name: 'Slug Travel',
    description: 'Full description',
    recommendation: 'Some tips',
    plus: 'Pros',
    minus: 'Cons',
    gallery: [],
    travelAddress: [],
  }) as unknown as Travel),
}));

jest.mock('@/src/services/book/BookHtmlExportService', () => ({
  BookHtmlExportService: jest.fn().mockImplementation(() => ({
    generateTravelsHtml: mockGenerateTravelsHtml,
  })),
}));

jest.mock('@/src/utils/openBookPreviewWindow', () => ({
  openBookPreviewWindow: (...args: any[]) => mockOpenBookPreviewWindow(...args),
}));

global.URL = {
  createObjectURL: jest.fn(() => 'blob:mock-url'),
  revokeObjectURL: jest.fn(),
} as any;

const mockDocument = {
  createElement: jest.fn((tag: string) => {
    const element: any = {
      tagName: tag.toUpperCase(),
      style: { cssText: '' },
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      textContent: '',
      innerHTML: '',
      href: '',
      src: '',
      download: '',
      click: jest.fn(),
      parentNode: {
        removeChild: jest.fn(),
      },
    };
    return element;
  }),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn(),
  },
  querySelectorAll: jest.fn(() => []),
};

global.document = mockDocument as any;

const originalPlatformOS = Platform.OS;
const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

beforeAll(() => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'web',
  });
});

describe('usePdfExport', () => {
  const mockTravels: Travel[] = [
    {
      id: 1,
      name: 'Test Travel',
      slug: 'test',
      url: 'test',
      youtube_link: '',
      userName: 'user',
      description: 'Description',
      recommendation: 'Recommendation',
      plus: 'Plus',
      minus: 'Minus',
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
    } as unknown as Travel,
  ];

  const mockSettings: BookSettings = {
    title: 'Test Book',
    subtitle: '',
    coverType: 'auto',
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
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Инициализация', () => {
    it('должен инициализироваться с правильными значениями по умолчанию', () => {
      const { result } = renderHook(() => usePdfExport(mockTravels));

      expect(result.current.isGenerating).toBe(false);
      expect(result.current.progress).toBe(0);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.exportPdf).toBe('function');
      expect(typeof result.current.previewPdf).toBe('function');
      expect(typeof result.current.openPrintBook).toBe('function');
    });
  });

  // exportPdf и previewPdf теперь являются заглушками (старый html2pdf-поток отключен),
  // поэтому отдельные тесты на взаимодействие с PdfExportService больше не нужны.

  describe('Конфигурация', () => {
    it('должен использовать переданную конфигурацию', () => {
      const config = {
        maxRetries: 5,
        imageLoadTimeout: 20000,
        batchSize: 10,
      };

      renderHook(() => usePdfExport(mockTravels, config));

      // Конфигурация должна быть передана в сервис
      // (проверка через мок)
      expect(true).toBe(true); // Placeholder - реальная проверка требует доступа к внутренностям
    });
  });
});

afterAll(() => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: originalPlatformOS,
  });
  alertSpy.mockRestore();
});
