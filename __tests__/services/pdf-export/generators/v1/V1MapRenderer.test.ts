// __tests__/services/pdf-export/generators/v1/V1MapRenderer.test.ts

import { V1MapRenderer } from '@/services/pdf-export/generators/v1/V1MapRenderer';
import { minimalTheme } from '@/services/pdf-export/themes/PdfThemeConfig';

describe('V1MapRenderer', () => {
  let renderer: V1MapRenderer;

  beforeEach(() => {
    renderer = new V1MapRenderer({ theme: minimalTheme });
  });

  it('должен генерировать HTML страницы карты со снимком', () => {
    const html = renderer.render({
      travelName: 'Поездка в Париж',
      snapshotDataUrl: 'data:image/png;base64,ABC',
      mapSvg: '<svg></svg>',
      locationListHtml: '<div>Location 1</div>',
      pageNumber: 8,
    });

    expect(html).toContain('map-page');
    expect(html).toContain('Маршрут');
    expect(html).toContain('Поездка в Париж');
    expect(html).toContain('data:image/png;base64,ABC');
    expect(html).toContain('Location 1');
    expect(html).toContain('>8<');
  });

  it('должен использовать SVG когда снимок отсутствует', () => {
    const html = renderer.render({
      travelName: 'Тест',
      snapshotDataUrl: null,
      mapSvg: '<svg viewBox="0 0 100 60">test-svg</svg>',
      locationListHtml: '',
      pageNumber: 3,
    });

    expect(html).toContain('test-svg');
    expect(html).not.toContain('data:image');
  });

  it('должен экранировать HTML в названии', () => {
    const html = renderer.render({
      travelName: '<script>alert(1)</script>',
      snapshotDataUrl: null,
      mapSvg: '',
      locationListHtml: '',
      pageNumber: 1,
    });

    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('должен содержать running header', () => {
    const html = renderer.render({
      travelName: 'Путешествие',
      snapshotDataUrl: null,
      mapSvg: '',
      locationListHtml: '',
      pageNumber: 15,
    });

    // Running header contains travel name and page number
    expect(html).toContain('Путешествие');
    expect(html).toContain('>15<');
  });
});
