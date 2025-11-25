// __tests__/services/book/BookHtmlExportService.test.ts
// ✅ ТЕСТЫ: Тесты для BookHtmlExportService (HTML-книга для печати)

import { BookHtmlExportService } from '@/src/services/book/BookHtmlExportService';
import type { Travel } from '@/src/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import { Platform } from 'react-native';
import { JSDOM } from 'jsdom';

describe('BookHtmlExportService', () => {
  let service: BookHtmlExportService;
  let mockTravels: Travel[];

  const baseSettings: BookSettings = {
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
    (Platform as any).OS = 'web';
    service = new BookHtmlExportService();

    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
    (global as any).window = dom.window as any;
    (global as any).document = dom.window.document;
    (global as any).DOMParser = dom.window.DOMParser;
    (global as any).Node = (dom.window as any).Node;

    mockTravels = [
      {
        id: 1,
        name: 'Test Travel',
        slug: 'test-travel',
        url: 'https://metravel.by/travels/test-travel',
        youtube_link: '',
        userName: 'Tester',
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
      } as unknown as Travel,
    ];
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('должен сгенерировать непустой HTML с pdf-page и панелью печати', async () => {
    const html = await service.generateTravelsHtml(mockTravels, baseSettings);

    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('class="pdf-page');
    expect(html).toContain('print-toolbar');
    expect(html).toContain('window.print');
  });

  it('должен бросать ошибку для пустого списка путешествий', async () => {
    await expect(service.generateTravelsHtml([], baseSettings)).rejects.toThrow();
  });
});
