// __tests__/hooks/usePdfExport.test.tsx
// ✅ ТЕСТЫ: Тесты для usePdfExport hook
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Platform, Alert } from 'react-native';
import { showToast } from '@/utils/toast';
import { downloadBookExportArtifact, requestServerBookExport } from '@/api/bookExportApi';
import { setAuthSessionProbe } from '@/api/authInvalidation';
import * as printBoundary from '@/utils/printHtml';
import { usePdfExport } from '@/hooks/usePdfExport';
import { ExportStage } from '@/types/pdf-export';
import type { ChecklistSection } from '@/components/export/BookSettingsModal';
import { fetchTravel, fetchTravelBySlug } from '@/api/travelDetailsQueries';

const mockGenerateTravelsHtml = jest.fn(async () => '<html><body><section class="pdf-page">Test</section></body></html>');
const mockOpenBookPreviewWindow = jest.fn();
const mockOpenPendingBookPreviewWindow = jest.fn((..._args: unknown[]): unknown => ({ closed: false }));
const mockDiscardPendingBookPreviewWindow = jest.fn();

jest.mock('@/utils/toast', () => ({ showToast: jest.fn(async () => undefined) }));

jest.mock('@/api/bookExportApi', () => ({
  requestServerBookExport: jest.fn(async () => null),
  downloadBookExportArtifact: jest.fn(),
}));

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

// Jest резолвит printHtml в native-адаптер; окно браузера — web-адаптер.
jest.mock('@/utils/printHtml', () => jest.requireActual('@/utils/printHtml.web'));

jest.mock('@/utils/openBookPreviewWindow', () => ({
  openPendingBookPreviewWindow: (...args: any[]) => mockOpenPendingBookPreviewWindow(...args),
  openBookPreviewWindow: (...args: any[]) => mockOpenBookPreviewWindow(...args),
  discardPendingBookPreviewWindow: (...args: any[]) => mockDiscardPendingBookPreviewWindow(...args),
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
      remove: jest.fn(),
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
const mockShowToast = showToast as jest.MockedFunction<typeof showToast>;
const mockRequestServerBookExport = requestServerBookExport as jest.MockedFunction<typeof requestServerBookExport>;
const mockDownloadBookExportArtifact = downloadBookExportArtifact as jest.MockedFunction<typeof downloadBookExportArtifact>;

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
    // #2369: серверный путь книги — только вошедшему; по умолчанию сценарии ниже
    // идут под сессией, гостевой случай выставляет пробу сам.
    setAuthSessionProbe(() => true);
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
    it('ограничивает повторы загрузки деталей через maxRetries', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      mockFetchTravel.mockRejectedValue(new Error('details unavailable'));

      const { result } = renderHook(() => usePdfExport(mockTravels, { maxRetries: 0 }));

      await act(async () => {
        await result.current.openPrintBook(mockSettings);
      });

      expect(mockFetchTravel).toHaveBeenCalledTimes(1);
      expect(mockGenerateTravelsHtml).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });
  });

  describe('openPrintBook', () => {
    it('без DOMParser книга собирается и уходит в печать — гейта «только в веб-версии» больше нет (#2119)', async () => {
      const originalDomParser = (global as any).DOMParser;
      delete (global as any).DOMParser;

      try {
        const { result } = renderHook(() => usePdfExport(mockTravels));

        await act(async () => {
          await result.current.openPrintBook(mockSettings);
        });

        expect(mockGenerateTravelsHtml).toHaveBeenCalledTimes(1);
        expect(mockShowToast).not.toHaveBeenCalledWith(expect.objectContaining({ text1: 'Недоступно' }));
        expect(mockDiscardPendingBookPreviewWindow).not.toHaveBeenCalled();
      } finally {
        (global as any).DOMParser = originalDomParser;
      }
    });

    it('должен показывать предупреждение, если не выбрано ни одного путешествия', async () => {
      const { result } = renderHook(() => usePdfExport([]));

      // Wait for the dynamic import() in useEffect to resolve
      await act(async () => { await Promise.resolve(); });

      await act(async () => {
        await result.current.openPrintBook(mockSettings);
      });

      expect(mockShowToast).toHaveBeenCalledWith({
        type: 'info',
        text1: 'Внимание',
        text2: 'Выберите хотя бы одно путешествие для экспорта',
        position: 'bottom',
      });
      // #2125: нечего печатать — окно-заглушка закрыто, а не брошено.
      expect(mockDiscardPendingBookPreviewWindow).toHaveBeenCalledTimes(1);

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
        }),
        expect.objectContaining({ isPremium: true }),
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
        expect.objectContaining({ isPremium: true }),
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

      expect(mockShowToast).toHaveBeenCalledWith({
        type: 'error',
        text1: 'Ошибка',
        text2: error.message,
        position: 'bottom',
      });
      // #2125: книга не собралась — окно-заглушка закрыто.
      expect(mockDiscardPendingBookPreviewWindow).toHaveBeenCalledTimes(1);
      expect(mockOpenBookPreviewWindow).not.toHaveBeenCalled();

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

      expect(mockShowToast).toHaveBeenCalledWith({
        type: 'error',
        text1: 'Ошибка',
        text2: 'Предпросмотр книги недоступен',
        position: 'bottom',
      });
      expect(mockDiscardPendingBookPreviewWindow).toHaveBeenCalledTimes(1);
    });
  });

  describe('#2125: окно печати резервируется в клике', () => {
    it('окно открывается синхронно, до первого await', () => {
      const { result } = renderHook(() => usePdfExport(mockTravels));

      const pending = result.current.openPrintBook(mockSettings);
      expect(mockOpenPendingBookPreviewWindow).toHaveBeenCalledTimes(1);
      return act(async () => {
        await pending;
      });
    });

    it('окно заблокировано — тост «Печать недоступна…», сервер, детали и генерация не запускаются', async () => {
      mockOpenPendingBookPreviewWindow.mockReturnValueOnce(null);
      const { result } = renderHook(() => usePdfExport(mockTravels.map((t) => ({ ...t, description: undefined as any }))));

      await act(async () => {
        await result.current.openPrintBook(mockSettings);
      });

      expect(mockShowToast).toHaveBeenCalledTimes(1);
      expect(mockShowToast).toHaveBeenCalledWith({
        type: 'error',
        text1: 'Печать недоступна. Разрешите всплывающие окна в браузере или обновите приложение.',
        position: 'bottom',
      });
      expect(mockRequestServerBookExport).not.toHaveBeenCalled();
      expect(mockFetchTravel).not.toHaveBeenCalled();
      expect(mockGenerateTravelsHtml).not.toHaveBeenCalled();
      expect(result.current.isGenerating).toBe(false);
    });

    it('книга пишется в окно, открытое в клике', async () => {
      const reserved = { closed: false };
      mockOpenPendingBookPreviewWindow.mockReturnValueOnce(reserved);
      const { result } = renderHook(() => usePdfExport(mockTravels));

      await act(async () => {
        await result.current.openPrintBook(mockSettings);
      });

      expect(mockOpenBookPreviewWindow).toHaveBeenCalledTimes(1);
      expect(mockOpenBookPreviewWindow.mock.calls[0][1]).toBe(reserved);
      expect(mockDiscardPendingBookPreviewWindow).not.toHaveBeenCalled();
      expect(mockShowToast).not.toHaveBeenCalled();
    });

    it('сервер отдал готовый файл — он скачивается, окно-заглушка закрывается', async () => {
      mockRequestServerBookExport.mockResolvedValueOnce({ job_id: 'job-1' } as any);
      mockDownloadBookExportArtifact.mockResolvedValueOnce({
        blob: new Blob(['%PDF'], { type: 'application/pdf' }),
        contentType: 'application/pdf',
        filename: 'book.pdf',
      } as any);
      const { result } = renderHook(() => usePdfExport(mockTravels));

      await act(async () => {
        await result.current.openPrintBook(mockSettings);
      });

      expect(mockDiscardPendingBookPreviewWindow).toHaveBeenCalledTimes(1);
      expect(mockOpenBookPreviewWindow).not.toHaveBeenCalled();
      expect(mockGenerateTravelsHtml).not.toHaveBeenCalled();
    });

    it('сервер отдал HTML — он печатается в зарезервированное окно', async () => {
      const reserved = { closed: false };
      mockOpenPendingBookPreviewWindow.mockReturnValueOnce(reserved);
      mockRequestServerBookExport.mockResolvedValueOnce({ job_id: 'job-2' } as any);
      mockDownloadBookExportArtifact.mockResolvedValueOnce({
        blob: { text: async () => '<html><body>server book</body></html>' },
        contentType: 'text/html; charset=utf-8',
        filename: 'book.html',
      } as any);
      const { result } = renderHook(() => usePdfExport(mockTravels));

      await act(async () => {
        await result.current.openPrintBook(mockSettings);
      });

      expect(mockOpenBookPreviewWindow).toHaveBeenCalledTimes(1);
      const [written, target] = mockOpenBookPreviewWindow.mock.calls[0];
      expect(written).toContain('server book');
      expect(target).toBe(reserved);
      expect(mockGenerateTravelsHtml).not.toHaveBeenCalled();
    });

    it('сервер отдал HTML, а окно закрыто пользователем — без «Готово» и без тоста (P3 ревью #2125)', async () => {
      const reserved = { closed: true };
      mockOpenPendingBookPreviewWindow.mockReturnValueOnce(reserved);
      mockRequestServerBookExport.mockResolvedValueOnce({ job_id: 'job-3' } as any);
      mockDownloadBookExportArtifact.mockResolvedValueOnce({
        blob: { text: async () => '<html><body>server book</body></html>' },
        contentType: 'text/html',
        filename: 'book.html',
      } as any);
      const { result } = renderHook(() => usePdfExport(mockTravels));

      await act(async () => {
        await result.current.openPrintBook(mockSettings);
      });

      expect(mockOpenBookPreviewWindow).not.toHaveBeenCalled();
      expect(mockShowToast).not.toHaveBeenCalled();
      expect(result.current.currentStage).not.toBe(ExportStage.COMPLETE);
      expect(mockGenerateTravelsHtml).not.toHaveBeenCalled();
    });

    it('окно закрыто пользователем во время сборки — тихий выход без тоста', async () => {
      const reserved = { closed: false };
      mockOpenPendingBookPreviewWindow.mockReturnValueOnce(reserved);
      mockGenerateTravelsHtml.mockImplementationOnce(async () => {
        reserved.closed = true;
        return '<html></html>';
      });
      const { result } = renderHook(() => usePdfExport(mockTravels));

      await act(async () => {
        await result.current.openPrintBook(mockSettings);
      });

      expect(mockOpenBookPreviewWindow).not.toHaveBeenCalled();
      expect(mockShowToast).not.toHaveBeenCalled();
      expect(result.current.currentStage).not.toBe(ExportStage.ERROR);
    });
  });

  describe('#2274: «Отмена» на время сборки', () => {
    it('сбрасывает прогресс сразу; документ не печатается позже, ни ошибки, ни тоста', async () => {
      let finishGeneration: (html: string) => void = () => {};
      mockGenerateTravelsHtml.mockImplementationOnce(
        () => new Promise<string>((resolve) => { finishGeneration = resolve; }),
      );
      const { result } = renderHook(() => usePdfExport(mockTravels as any));

      let exportPromise: Promise<void> = Promise.resolve();
      act(() => {
        exportPromise = result.current.openPrintBook(mockSettings);
      });
      await waitFor(() => expect(result.current.progress).toBeGreaterThanOrEqual(15));
      expect(result.current.isGenerating).toBe(true);

      act(() => {
        result.current.cancel();
      });
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.progress).toBe(0);
      expect(mockDiscardPendingBookPreviewWindow).toHaveBeenCalledTimes(1);

      await act(async () => {
        finishGeneration('<html><body><section class="pdf-page">Late</section></body></html>');
        await exportPromise;
      });

      expect(mockOpenBookPreviewWindow).not.toHaveBeenCalled();
      expect(mockShowToast).not.toHaveBeenCalled();
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.progress).toBe(0);
      expect(result.current.error).toBeNull();
      expect(result.current.currentStage).not.toBe(ExportStage.ERROR);
    });

    it('cancel during server artifact download never creates a late download or print', async () => {
      mockRequestServerBookExport.mockResolvedValueOnce({ job_id: 'late-job' } as Awaited<ReturnType<typeof requestServerBookExport>>);
      let finish: (artifact: Awaited<ReturnType<typeof downloadBookExportArtifact>>) => void = () => {};
      mockDownloadBookExportArtifact.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
      const { result } = renderHook(() => usePdfExport(mockTravels));
      let pending: Promise<void> = Promise.resolve();
      act(() => { pending = result.current.openPrintBook(mockSettings); });
      await waitFor(() => expect(mockDownloadBookExportArtifact).toHaveBeenCalledTimes(1));
      act(() => result.current.cancel());
      await act(async () => { await pending; });
      await act(async () => {
        finish({ blob: new Blob(['%PDF']), contentType: 'application/pdf', filename: 'late.pdf' });
        await Promise.resolve();
      });
      expect(URL.createObjectURL).not.toHaveBeenCalled();
      expect(mockOpenBookPreviewWindow).not.toHaveBeenCalled();
      expect(mockShowToast).not.toHaveBeenCalled();
    });

    it('native preparation timeout settles the caller while generation is pending; late HTML never prints', async () => {
      const preparation = new AbortController();
      let preparationError: Error | undefined;
      const print = jest.fn(async () => 'printed' as const);
      const cancelSession = jest.fn();
      const reserve = jest.spyOn(printBoundary, 'beginPrint').mockReturnValue({
        available: true, preparationSignal: preparation.signal, getPreparationError: () => preparationError, print, cancel: cancelSession,
      });
      let finishGeneration: (html: string) => void = () => {};
      mockGenerateTravelsHtml.mockImplementationOnce(() => new Promise((resolve) => { finishGeneration = resolve; }));
      try {
        const { result } = renderHook(() => usePdfExport(mockTravels));
        let pending: Promise<void> = Promise.resolve();
        act(() => { pending = result.current.openPrintBook(mockSettings); });
        await waitFor(() => expect(result.current.progress).toBeGreaterThanOrEqual(15));
        await act(async () => {
          preparationError = new Error('Preparation exceeded 120 seconds');
          preparation.abort();
          await pending;
        });
        expect(result.current.isGenerating).toBe(false);
        expect(result.current.currentStage).toBe(ExportStage.ERROR);
        expect(result.current.error?.message).toContain('120');
        expect(mockShowToast).toHaveBeenCalledTimes(1);
        await act(async () => { finishGeneration('<p>late</p>'); await Promise.resolve(); });
        expect(print).not.toHaveBeenCalled();
        expect(cancelSession).toHaveBeenCalledTimes(1);
      } finally { reserve.mockRestore(); }
    });

    it('без идущей сборки ничего не делает', () => {
      const { result } = renderHook(() => usePdfExport(mockTravels as any));
      act(() => {
        result.current.cancel();
      });
      expect(result.current.isGenerating).toBe(false);
      expect(mockDiscardPendingBookPreviewWindow).not.toHaveBeenCalled();
    });
  });

  // #2369: `/exports/books/` отвечает гостю 401 и тянет пробу сессии — гость в
  // серверный путь не ходит вовсе, книга собирается клиентским рантаймом.
  describe('#2369: гость не вызывает серверный экспорт', () => {
    it('гость — 0 вызовов requestServerBookExport, книга напечатана в зарезервированное окно', async () => {
      setAuthSessionProbe(() => false);
      const reserved = { closed: false };
      mockOpenPendingBookPreviewWindow.mockReturnValueOnce(reserved);
      const { result } = renderHook(() => usePdfExport(mockTravels));

      await act(async () => {
        await result.current.openPrintBook(mockSettings);
      });

      expect(mockRequestServerBookExport).not.toHaveBeenCalled();
      expect(mockDownloadBookExportArtifact).not.toHaveBeenCalled();
      expect(mockGenerateTravelsHtml).toHaveBeenCalledTimes(1);
      expect(mockOpenBookPreviewWindow).toHaveBeenCalledTimes(1);
      expect(mockOpenBookPreviewWindow.mock.calls[0][1]).toBe(reserved);
      expect(mockShowToast).not.toHaveBeenCalled();
      await waitFor(() => expect(result.current.currentStage).toBe(ExportStage.COMPLETE));
    });

    it('без зарегистрированной пробы сессии пользователь считается гостем', async () => {
      setAuthSessionProbe(null);
      const { result } = renderHook(() => usePdfExport(mockTravels));

      await act(async () => {
        await result.current.openPrintBook(mockSettings);
      });

      expect(mockRequestServerBookExport).not.toHaveBeenCalled();
      expect(mockOpenBookPreviewWindow).toHaveBeenCalledTimes(1);
    });

    it('вошедший пользователь — прежний серверный путь: POST /exports/books/ уходит', async () => {
      setAuthSessionProbe(() => true);
      const { result } = renderHook(() => usePdfExport(mockTravels));

      await act(async () => {
        await result.current.openPrintBook(mockSettings);
      });

      expect(mockRequestServerBookExport).toHaveBeenCalledTimes(1);
      // `null` от сервера (capability недоступна) — штатный фолбэк в клиентский рантайм.
      expect(mockOpenBookPreviewWindow).toHaveBeenCalledTimes(1);
    });
  });
});

afterAll(() => {
  setAuthSessionProbe(null);
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: originalPlatformOS,
  });
  if (typeof window !== 'undefined') {
    (window as any).open = originalWindowOpen;
  }
  alertSpy.mockRestore();
});
