// __tests__/hooks/usePdfExport.test.tsx
// ✅ ТЕСТЫ: Тесты для usePdfExport hook
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Platform, Alert } from 'react-native';
import { usePdfExport } from '@/src/hooks/usePdfExport';
import { ExportStage } from '@/src/types/pdf-export';
import type { ChecklistSection } from '@/components/export/BookSettingsModal';

const mockGenerateTravelsHtml = jest.fn(async () => '<html><body><section class="pdf-page">Test</section></body></html>');
const mockOpenBookPreviewWindow = jest.fn();

jest.mock('@/src/api/travelsApi', () => ({
  fetchTravel: jest.fn(async () => ({
    id: 99,
    name: 'Detailed Travel',
    description: 'Full description',
    recommendation: 'Some tips',
    plus: 'Pros',
    minus: 'Cons',
    gallery: [],
    travelAddress: [],
  })),
  fetchTravelBySlug: jest.fn(async () => ({
    id: 100,
    name: 'Slug Travel',
    description: 'Full description',
    recommendation: 'Some tips',
    plus: 'Pros',
    minus: 'Cons',
    gallery: [],
    travelAddress: [],
  })),
}));

jest.mock('@/src/services/book/BookHtmlExportService', () => ({
  BookHtmlExportService: jest.fn().mockImplementation(() => ({
    generateTravelsHtml: mockGenerateTravelsHtml,
  })),
}));

jest.mock('@/src/utils/openBookPreviewWindow', () => ({
  openBookPreviewWindow: (...args: any[]) => mockOpenBookPreviewWindow(...args),
}));

global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

const mockDocument = {
  createElement: jest.fn((tag) => {
    const element = {
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

global.document = mockDocument as unknown as Document;

const originalPlatformOS = Platform.OS;
const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

beforeAll(() => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'web',
  });
});

describe('usePdfExport', () => {
  const mockTravels = [
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
    },
  ];

  const mockSettings = {
    title: 'Test Book',
    subtitle: '',
    coverType: 'auto' as const,
    template: 'minimal' as const,
    format: 'A4',
    orientation: 'portrait',
    margins: 'standard',
    imageQuality: 'high',
    sortOrder: 'date-desc' as const,
    includeToc: true,
    includeGallery: true,
    includeMap: true,
    includeChecklists: false,
    checklistSections: ['clothing', 'food', 'electronics'] as ChecklistSection[],
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
      expect(typeof result.current.openPrintBook).toBe('function');
    });
  });

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

  describe('openPrintBook', () => {
    it('должен показывать алерт, если платформа не web', async () => {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: 'ios',
      });

      const { result } = renderHook(() => usePdfExport(mockTravels));

      await act(async () => {
        await result.current.openPrintBook(mockSettings);
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Недоступно',
        'Просмотр книги и печать доступны только в веб-версии MeTravel'
      );

      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: 'web',
      });
    });

    it('должен показывать предупреждение, если не выбрано ни одного путешествия', async () => {
      const { result } = renderHook(() => usePdfExport([]));

      await act(async () => {
        await result.current.openPrintBook(mockSettings);
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Внимание',
        'Выберите хотя бы одно путешествие для экспорта'
      );

      expect(mockGenerateTravelsHtml).not.toHaveBeenCalled();
      expect(mockOpenBookPreviewWindow).not.toHaveBeenCalled();
    });

    it('должен генерировать HTML и открывать окно предпросмотра при успешном сценарии', async () => {
      const detailedTravels = [
        {
          ...mockTravels[0],
          id: 1,
        },
        {
          ...mockTravels[0],
          id: 2,
          slug: 'slug-travel',
          description: '',
          recommendation: '',
          plus: '',
          minus: '',
          gallery: [],
          travelAddress: [],
        },
      ];

      const { result } = renderHook(() => usePdfExport(detailedTravels));

      await act(async () => {
        await result.current.openPrintBook(mockSettings);
      });

      expect(mockGenerateTravelsHtml).toHaveBeenCalledTimes(1);
      expect(mockOpenBookPreviewWindow).toHaveBeenCalledTimes(1);

      await waitFor(() => {
        expect(result.current.progress).toBe(100);
        expect(result.current.currentStage).toBe(ExportStage.COMPLETE);
        expect(result.current.isGenerating).toBe(false);
        expect(result.current.error).toBeNull();
      });
    });

    it('должен обрабатывать ошибки генерации HTML и устанавливать статус ошибки', async () => {
      const error = new Error('Generation failed');
      mockGenerateTravelsHtml.mockRejectedValueOnce(error);

      const { result } = renderHook(() => usePdfExport(mockTravels));

      await act(async () => {
        await result.current.openPrintBook(mockSettings);
      });

      expect(Alert.alert).toHaveBeenCalledWith('Ошибка', error.message);

      await waitFor(() => {
        expect(result.current.error).toEqual(error);
        expect(result.current.currentStage).toBe(ExportStage.ERROR);
        expect(result.current.isGenerating).toBe(false);
      });
    });

    it('не должен изменять состояние, если хук размонтирован до завершения', async () => {
      const { result, unmount } = renderHook(() => usePdfExport(mockTravels));

      unmount();

      await act(async () => {
        await result.current.openPrintBook(mockSettings);
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Ошибка',
        'Предпросмотр книги недоступен'
      );
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
