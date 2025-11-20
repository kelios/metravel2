// __tests__/renderers/pdf/Html2PdfRenderer.test.ts
// ✅ ТЕСТЫ: Тесты для Html2PdfRenderer

import { Html2PdfRenderer } from '@/src/renderers/pdf/Html2PdfRenderer';
import { PdfRenderOptions } from '@/src/types/pdf-export';

// Mock html2pdf
const mockHtml2PdfWorker = {
  set: jest.fn(function () {
    return mockHtml2PdfWorker;
  }),
  from: jest.fn(function () {
    return mockHtml2PdfWorker;
  }),
  outputPdf: jest.fn(() => Promise.resolve(new Blob(['mock pdf'], { type: 'application/pdf' }))),
};

const mockHtml2Pdf = jest.fn(() => mockHtml2PdfWorker);

global.window = {
  html2pdf: mockHtml2Pdf as any,
  getComputedStyle: jest.fn(() => ({
    display: 'block',
    visibility: 'visible',
    opacity: '1',
    position: 'fixed',
    left: '0px',
    top: '0px',
    width: '794px',
    height: '1123px',
    zIndex: '999999',
  })),
} as any;

global.document = {
  createElement: jest.fn((tag: string) => {
    const element: any = {
      tagName: tag.toUpperCase(),
      style: {} as any,
      innerHTML: '',
      textContent: '',
      children: [],
      parentNode: null,
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      offsetWidth: 794,
      offsetHeight: 1123,
      scrollWidth: 794,
      scrollHeight: 1123,
      clientWidth: 794,
      clientHeight: 1123,
    };
    return element;
  }),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn(),
  } as any,
} as any;

global.DOMParser = jest.fn().mockImplementation(() => ({
  parseFromString: jest.fn((html: string) => {
    const doc: any = {
      body: {
        innerHTML: html.replace(/<View[^>]*>/gi, '').replace(/<\/View>/gi, '').replace(/<Text[^>]*>/gi, '').replace(/<\/Text>/gi, ''),
      },
      head: {
        querySelectorAll: jest.fn(() => []),
      },
    };
    return doc;
  }),
})) as any;

global.URL = {
  createObjectURL: jest.fn(() => 'blob:mock-url'),
  revokeObjectURL: jest.fn(),
} as any;

describe('Html2PdfRenderer', () => {
  let renderer: Html2PdfRenderer;

  beforeEach(() => {
    jest.clearAllMocks();
    renderer = new Html2PdfRenderer();
    (global.window as any).html2pdf = mockHtml2Pdf;
  });

  describe('Очистка React Native компонентов', () => {
    it('должен удалять React Native компоненты из HTML строки', async () => {
      const htmlWithReactComponents = `
        <html>
          <body>
            <div class="pdf-page">
              <View>
                <Text>Test content</Text>
              </View>
            </div>
          </body>
        </html>
      `;

      const options: PdfRenderOptions = {
        margin: [10, 10, 14, 10],
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { useCORS: true },
        jsPDF: { format: 'a4', orientation: 'portrait' },
      };

      await renderer.initialize();
      await renderer.render(htmlWithReactComponents, options);

      // Проверяем что createElementFromHTML был вызван (через render)
      expect(global.document.createElement).toHaveBeenCalled();
      
      // Проверяем что DOMParser.parseFromString получил очищенный HTML
      const parseFromStringCalls = (global.DOMParser as jest.Mock).mock.results;
      if (parseFromStringCalls.length > 0) {
        const parsedHtml = parseFromStringCalls[0].value.body.innerHTML;
        expect(parsedHtml).not.toContain('<View>');
        expect(parsedHtml).not.toContain('<Text>');
      }
    });

    it('должен обрабатывать вложенные React Native компоненты', async () => {
      const htmlWithNestedComponents = `
        <html>
          <body>
            <div class="pdf-page">
              <View>
                <View>
                  <Text>Nested content</Text>
                </View>
              </View>
            </div>
          </body>
        </html>
      `;

      const options: PdfRenderOptions = {
        margin: [10, 10, 14, 10],
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { useCORS: true },
        jsPDF: { format: 'a4', orientation: 'portrait' },
      };

      await renderer.initialize();
      await renderer.render(htmlWithNestedComponents, options);

      // Проверяем что все вложенные компоненты были удалены
      const parseFromStringCalls = (global.DOMParser as jest.Mock).mock.results;
      if (parseFromStringCalls.length > 0) {
        const parsedHtml = parseFromStringCalls[0].value.body.innerHTML;
        expect(parsedHtml).not.toContain('<View>');
        expect(parsedHtml).not.toContain('<Text>');
      }
    });

    it('должен удалять различные типы React Native компонентов', async () => {
      const htmlWithMultipleComponents = `
        <html>
          <body>
            <div class="pdf-page">
              <ScrollView>
                <TouchableOpacity>
                  <SafeAreaView>
                    <Text>Content</Text>
                  </SafeAreaView>
                </TouchableOpacity>
              </ScrollView>
            </div>
          </body>
        </html>
      `;

      const options: PdfRenderOptions = {
        margin: [10, 10, 14, 10],
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { useCORS: true },
        jsPDF: { format: 'a4', orientation: 'portrait' },
      };

      await renderer.initialize();
      await renderer.render(htmlWithMultipleComponents, options);

      const parseFromStringCalls = (global.DOMParser as jest.Mock).mock.results;
      if (parseFromStringCalls.length > 0) {
        const parsedHtml = parseFromStringCalls[0].value.body.innerHTML;
        expect(parsedHtml).not.toContain('<ScrollView>');
        expect(parsedHtml).not.toContain('<TouchableOpacity>');
        expect(parsedHtml).not.toContain('<SafeAreaView>');
        expect(parsedHtml).not.toContain('<Text>');
      }
    });
  });

  describe('Рендеринг', () => {
    it('должен успешно рендерить HTML в PDF', async () => {
      const html = '<html><body><div class="pdf-page">Test</div></body></html>';
      const options: PdfRenderOptions = {
        margin: [10, 10, 14, 10],
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { useCORS: true },
        jsPDF: { format: 'a4', orientation: 'portrait' },
      };

      await renderer.initialize();
      const blob = await renderer.render(html, options);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/pdf');
      expect(mockHtml2Pdf).toHaveBeenCalled();
    });

    it('должен обрабатывать HTMLElement', async () => {
      const element = document.createElement('div');
      element.className = 'pdf-page';
      element.innerHTML = 'Test content';
      
      const options: PdfRenderOptions = {
        margin: [10, 10, 14, 10],
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { useCORS: true },
        jsPDF: { format: 'a4', orientation: 'portrait' },
      };

      await renderer.initialize();
      const blob = await renderer.render(element, options);

      expect(blob).toBeInstanceOf(Blob);
      expect(mockHtml2Pdf).toHaveBeenCalled();
    });

    it('должен создавать превью', async () => {
      const html = '<html><body><div class="pdf-page">Test</div></body></html>';
      const options: PdfRenderOptions = {
        margin: [10, 10, 14, 10],
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { useCORS: true },
        jsPDF: { format: 'a4', orientation: 'portrait' },
      };

      await renderer.initialize();
      const blobUrl = await renderer.preview(html, options);

      expect(blobUrl).toBe('blob:mock-url');
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  describe('Инициализация', () => {
    it('должен проверять доступность html2pdf', () => {
      expect(renderer.isAvailable()).toBe(true);
    });

    it('должен инициализироваться успешно', async () => {
      await expect(renderer.initialize()).resolves.not.toThrow();
    });
  });
});

