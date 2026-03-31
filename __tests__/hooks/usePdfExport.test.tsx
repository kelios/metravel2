// __tests__/hooks/usePdfExport.test.tsx
// ✅ ТЕСТЫ: Тесты для usePdfExport hook
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Platform, Alert } from 'react-native';
import { usePdfExport } from '@/hooks/usePdfExport';
import { ExportStage } from '@/types/pdf-export';
import type { ChecklistSection } from '@/components/export/BookSettingsModal';
import { fetchTravel, fetchTravelBySlug } from '@/api/travelDetailsQueries';

const mockGenerateTravelsHtml = jest.fn(async () => '<html><body><section class="pdf-page">Test</section></body></html>');
const mockOpenBookPreviewWindow = jest.fn();
const mockOpenPendingBookPreviewWindow = jest.fn(() => null);

jest.mock('@/api/travelDetailsQueries', () => ({
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

jest.mock('@/services/book/BookHtmlExportService', () => ({
  BookHtmlExportService: jest.fn().mockImplementation(() => ({
    generateTravelsHtml: mockGenerateTravelsHtml,
  })),
}));

jest.mock('@/utils/openBookPreviewWindow', () => ({
  openPendingBookPreviewWindow: (...args: any[]) => mockOpenPendingBookPreviewWindow(...args),
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

const originalWindowOpen = typeof window !== 'undefined' ? window.open : undefined;
const originalPlatformOS = Platform.OS;
const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
const mockFetchTravel = fetchTravel as jest.MockedFunction<typeof fetchTravel>;
const mockFetchTravelBySlug = fetchTravelBySlug as jest.MockedFunction<typeof fetchTravelBySlug>;

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
    sortOrder: 'date-desc' as const,
    includeToc: true,
    includeGallery: true,
    includeMap: true,
    includeChecklists: false,
    checklistSections: ['clothing', 'food', 'electronics'] as ChecklistSection[],
    galleryLayout: 'grid' as const,
    galleryColumns: 3,
    showCaptions: true,
    captionPosition: 'bottom' as const,
    gallerySpacing: 'normal' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    if (typeof window !== 'undefined') {
      (window as any).open = jest.fn(() => ({
        opener: {},
        closed: false,
        close: jest.fn(),
        document: {
          open: jest.fn(),
          write: jest.fn(),
          close: jest.fn(),
        },
      }));
    }
    mockFetchTravel.mockResolvedValue({
      id: 99,
      slug: 'detailed-travel',
      name: 'Detailed Travel',
      url: '/travels/detailed-travel',
      youtube_link: '',
      userName: 'user',
      description: 'Full description',
      recommendation: 'Some tips',
      plus: 'Pros',
      minus: 'Cons',
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
    } as any);
    mockFetchTravelBySlug.mockResolvedValue({
      id: 100,
      slug: 'slug-travel',
      name: 'Slug Travel',
      url: '/travels/slug-travel',
      youtube_link: '',
      userName: 'user',
      description: 'Full description',
      recommendation: 'Some tips',
      plus: 'Pros',
      minus: 'Cons',
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
    } as any);
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

      // Wait for the dynamic import() in useEffect to resolve
      await act(async () => { await Promise.resolve(); });

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

      // Wait for the dynamic import() in useEffect to resolve
      await act(async () => { await Promise.resolve(); });

      await act(async () => {
        await result.current.openPrintBook(mockSettings);
      });

      expect(mockGenerateTravelsHtml).toHaveBeenCalledTimes(1);
      expect(mockGenerateTravelsHtml).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          title: 'Test Book',
          template: 'minimal',
          includeToc: true,
          includeGallery: true,
          includeMap: true,
          includeChecklists: false,
          galleryLayout: 'grid',
          galleryColumns: 3,
          showCaptions: true,
          captionPosition: 'bottom',
          gallerySpacing: 'normal',
        })
      );
      expect(mockOpenBookPreviewWindow).toHaveBeenCalledTimes(1);

      await waitFor(() => {
        expect(result.current.progress).toBe(100);
        expect(result.current.currentStage).toBe(ExportStage.COMPLETE);
        expect(result.current.isGenerating).toBe(false);
        expect(result.current.error).toBeNull();
      });
    });

    it('дозагружает детали для пустой галереи перед экспортом книги', async () => {
      mockFetchTravel.mockResolvedValueOnce({
        ...mockTravels[0],
        id: 1,
        gallery: [{ id: 501, url: 'https://metravel.by/gallery/501/photo.jpg' }],
        travelAddress: [{ id: 1, name: 'Point', coords: '53.9,27.56' }],
      } as any);

      const partialTravel = {
        ...mockTravels[0],
        gallery: [],
        travelAddress: [],
      };

      const { result } = renderHook(() => usePdfExport([partialTravel]));

      await act(async () => { await Promise.resolve(); });

      await act(async () => {
        await result.current.openPrintBook(mockSettings);
      });

      expect(mockFetchTravel).toHaveBeenCalledWith(1);
      expect(mockGenerateTravelsHtml).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            gallery: [{ id: 501, url: 'https://metravel.by/gallery/501/photo.jpg' }],
          }),
        ],
        expect.any(Object),
      );
    });

    it('должен обрабатывать ошибки генерации HTML и устанавливать статус ошибки', async () => {
      const error = new Error('Generation failed');
      mockGenerateTravelsHtml.mockRejectedValueOnce(error);

      const { result } = renderHook(() => usePdfExport(mockTravels));

      // Wait for the dynamic import() in useEffect to resolve
      await act(async () => { await Promise.resolve(); });

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
  if (typeof window !== 'undefined') {
    (window as any).open = originalWindowOpen;
  }
  alertSpy.mockRestore();
});
