# Стратегия тестирования

## 🎯 Цели тестирования

1. **Покрытие** - минимум 80% кода покрыто тестами
2. **Качество** - тесты находят реальные баги
3. **Скорость** - тесты выполняются быстро
4. **Поддерживаемость** - тесты легко обновлять
5. **Документация** - тесты документируют API

## 📊 Пирамида тестирования

```
        /\
       /  \       E2E Tests (5%)
      /    \      - Полный flow генерации PDF
     /------\     - Интеграция с браузером
    /        \    
   /          \   Integration Tests (20%)
  /            \  - Взаимодействие компонентов
 /--------------\ - Реальные зависимости
/                \
/                 \ Unit Tests (75%)
/                  \ - Отдельные компоненты
--------------------  - Моки зависимостей
```

## 🧪 Unit тесты

### Структура unit тестов:

```
__tests__/
├── services/
│   └── pdf-export/
│       ├── generators/
│       │   ├── EnhancedPdfGenerator.test.ts
│       │   └── pages/
│       │       ├── CoverPageGenerator.test.ts
│       │       ├── TocPageGenerator.test.ts
│       │       ├── TravelPageGenerator.test.ts
│       │       ├── GalleryPageGenerator.test.ts
│       │       ├── MapPageGenerator.test.ts
│       │       └── FinalPageGenerator.test.ts
│       ├── processors/
│       │   ├── ImageProcessor.test.ts
│       │   └── QRGenerator.test.ts
│       ├── builders/
│       │   ├── HtmlBuilder.test.ts
│       │   └── StyleGenerator.test.ts
│       └── parsers/
│           ├── ContentParser.test.ts
│           └── BlockRenderer.test.ts
```

### Примеры unit тестов:

#### 1. PageGenerator тесты

```typescript
describe('CoverPageGenerator', () => {
  let generator: CoverPageGenerator;
  let mockStyleGenerator: jest.Mocked<StyleGenerator>;
  let mockImageProcessor: jest.Mocked<ImageProcessor>;
  
  beforeEach(() => {
    mockStyleGenerator = {
      page: jest.fn(() => 'style="..."'),
      heading: jest.fn(() => 'style="..."'),
    } as any;
    
    mockImageProcessor = {
      process: jest.fn((url) => Promise.resolve(`processed-${url}`)),
    } as any;
    
    generator = new CoverPageGenerator(
      mockStyleGenerator,
      mockImageProcessor
    );
  });
  
  describe('generate', () => {
    it('generates cover with image', async () => {
      const context = {
        settings: {
          title: 'My Travels',
          subtitle: 'Adventures 2024',
          coverImage: 'http://example.com/cover.jpg'
        },
        theme: minimalTheme
      };
      
      const html = await generator.generate(context);
      
      expect(html).toContain('My Travels');
      expect(html).toContain('Adventures 2024');
      expect(html).toContain('processed-http://example.com/cover.jpg');
      expect(mockImageProcessor.process).toHaveBeenCalledWith(
        'http://example.com/cover.jpg'
      );
    });
    
    it('generates cover with gradient when no image', async () => {
      const context = {
        settings: {
          title: 'My Travels',
          coverType: 'gradient'
        },
        theme: minimalTheme
      };
      
      const html = await generator.generate(context);
      
      expect(html).toContain('linear-gradient');
      expect(mockImageProcessor.process).not.toHaveBeenCalled();
    });
    
    it('handles missing data gracefully', async () => {
      const context = {
        settings: { title: 'Title' },
        theme: minimalTheme
      };
      
      const html = await generator.generate(context);
      
      expect(html).toContain('Title');
      expect(html).not.toContain('undefined');
      expect(html).not.toContain('null');
    });
    
    it('applies theme correctly', async () => {
      const context = {
        settings: { title: 'Title' },
        theme: darkTheme
      };
      
      const html = await generator.generate(context);
      
      expect(mockStyleGenerator.page).toHaveBeenCalledWith('cover');
      expect(html).toContain(darkTheme.colors.cover.text);
    });
  });
  
  describe('estimatePageCount', () => {
    it('always returns 1', () => {
      expect(generator.estimatePageCount({} as any)).toBe(1);
    });
  });
  
  describe('shouldRender', () => {
    it('always returns true', () => {
      expect(generator.shouldRender({} as any)).toBe(true);
    });
  });
});
```

#### 2. ImageProcessor тесты

```typescript
describe('ImageProcessor', () => {
  let processor: ImageProcessor;
  let mockCache: jest.Mocked<ImageCache>;
  
  beforeEach(() => {
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      clear: jest.fn(),
    } as any;
    
    processor = new ImageProcessor({ cache: mockCache });
  });
  
  describe('process', () => {
    it('returns cached URL if available', async () => {
      mockCache.get.mockResolvedValue('cached-url');
      
      const result = await processor.process('http://example.com/image.jpg');
      
      expect(result).toBe('cached-url');
      expect(mockCache.get).toHaveBeenCalledWith('http://example.com/image.jpg');
    });
    
    it('processes and caches new URL', async () => {
      mockCache.get.mockResolvedValue(null);
      
      const result = await processor.process('http://example.com/image.jpg');
      
      expect(result).toContain('images.weserv.nl');
      expect(mockCache.set).toHaveBeenCalled();
    });
    
    it('handles data URLs without processing', async () => {
      const dataUrl = 'data:image/png;base64,abc123';
      
      const result = await processor.process(dataUrl);
      
      expect(result).toBe(dataUrl);
      expect(mockCache.set).not.toHaveBeenCalled();
    });
    
    it('handles blob URLs without processing', async () => {
      const blobUrl = 'blob:http://localhost/123';
      
      const result = await processor.process(blobUrl);
      
      expect(result).toBe(blobUrl);
    });
    
    it('proxies remote URLs through weserv', async () => {
      mockCache.get.mockResolvedValue(null);
      
      const result = await processor.process('http://cdn.example.com/photo.jpg');
      
      expect(result).toContain('images.weserv.nl');
      expect(result).toContain('cdn.example.com');
    });
    
    it('handles local URLs correctly', async () => {
      const result = await processor.process('/images/photo.jpg');
      
      expect(result).toContain('metravel.by/images/photo.jpg');
    });
  });
  
  describe('buildSafeUrl', () => {
    it('escapes special characters', () => {
      const result = processor.buildSafeUrl('http://example.com/image with spaces.jpg');
      
      expect(result).not.toContain(' ');
    });
    
    it('handles protocol-relative URLs', () => {
      const result = processor.buildSafeUrl('//cdn.example.com/image.jpg');
      
      expect(result).toStartWith('https://');
    });
  });
  
  describe('preloadImages', () => {
    it('preloads multiple images in parallel', async () => {
      const urls = ['url1', 'url2', 'url3'];
      
      await processor.preloadImages(urls);
      
      expect(mockCache.set).toHaveBeenCalledTimes(3);
    });
  });
});
```

#### 3. HtmlBuilder тесты

```typescript
describe('HtmlBuilder', () => {
  let builder: HtmlBuilder;
  
  beforeEach(() => {
    builder = new HtmlBuilder();
  });
  
  describe('fluent API', () => {
    it('chains method calls', () => {
      const result = builder
        .setHead('<meta charset="utf-8">')
        .setStyles('body { margin: 0; }')
        .addPage('<div>Page 1</div>')
        .addPage('<div>Page 2</div>');
      
      expect(result).toBe(builder); // Возвращает this
    });
  });
  
  describe('build', () => {
    it('generates valid HTML document', () => {
      const html = builder
        .setHead('<meta charset="utf-8">')
        .setStyles('body { margin: 0; }')
        .addPage('<div>Page 1</div>')
        .build();
      
      expect(html).toContain('<!doctype html>');
      expect(html).toContain('<html');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('<meta charset="utf-8">');
      expect(html).toContain('body { margin: 0; }');
      expect(html).toContain('<div>Page 1</div>');
    });
    
    it('inserts page breaks between pages', () => {
      const html = builder
        .addPage('<div>Page 1</div>')
        .addPage('<div>Page 2</div>')
        .build();
      
      expect(html).toContain('page-break-before: always');
    });
    
    it('handles empty pages', () => {
      const html = builder.build();
      
      expect(html).toContain('<!doctype html>');
      expect(html).not.toContain('<div>');
    });
  });
  
  describe('reset', () => {
    it('clears builder state', () => {
      builder
        .addPage('<div>Page 1</div>')
        .reset();
      
      const html = builder.build();
      
      expect(html).not.toContain('<div>Page 1</div>');
    });
  });
});
```

### Запуск unit тестов:

```bash
# Все unit тесты
npm run test:unit

# Конкретный файл
npm run test:unit -- CoverPageGenerator.test.ts

# С coverage
npm run test:unit -- --coverage

# Watch mode
npm run test:unit -- --watch
```

## 🔗 Integration тесты

### Примеры integration тестов:

```typescript
describe('EnhancedPdfGenerator Integration', () => {
  let generator: EnhancedPdfGenerator;
  
  beforeEach(() => {
    // Используем реальные зависимости
    const contentParser = new ContentParser();
    const blockRenderer = new BlockRenderer(minimalTheme);
    const imageProcessor = new ImageProcessor({
      cache: new ImageCache()
    });
    const qrGenerator = new QRGenerator();
    const htmlBuilder = new HtmlBuilder();
    
    generator = new EnhancedPdfGenerator(
      contentParser,
      blockRenderer,
      imageProcessor,
      qrGenerator,
      htmlBuilder
    );
  });
  
  it('generates complete PDF for single travel', async () => {
    const travel = {
      id: 1,
      name: 'Paris Adventure',
      countryName: 'France',
      year: '2024',
      description: '<p>Amazing trip to Paris</p>',
      gallery: ['photo1.jpg', 'photo2.jpg']
    };
    
    const settings = {
      title: 'My Travels',
      template: 'minimal',
      includeToc: false,
      includeGallery: true
    };
    
    const html = await generator.generate([travel], settings);
    
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Paris Adventure');
    expect(html).toContain('France');
    expect(html).toContain('Amazing trip to Paris');
    expect(html).toContain('photo1.jpg');
  }, 10000); // Увеличенный таймаут
  
  it('generates PDF with all page types', async () => {
    const travel = {
      id: 1,
      name: 'Trip',
      description: '<p>Description</p>',
      gallery: ['p1.jpg', 'p2.jpg', 'p3.jpg', 'p4.jpg', 'p5.jpg'],
      travelAddress: [
        { id: '1', address: 'Place 1', coord: '50.0,30.0' }
      ]
    };
    
    const settings = {
      title: 'Book',
      template: 'minimal',
      includeToc: true,
      includeGallery: true,
      includeMap: true,
      includeChecklists: true,
      checklistSections: ['clothing', 'food']
    };
    
    const html = await generator.generate([travel], settings);
    
    expect(html).toContain('cover-page');
    expect(html).toContain('toc-page');
    expect(html).toContain('travel-photo-page');
    expect(html).toContain('travel-content-page');
    expect(html).toContain('gallery-page');
    expect(html).toContain('map-page');
    expect(html).toContain('checklist-page');
    expect(html).toContain('final-page');
  }, 15000);
  
  it('handles multiple travels correctly', async () => {
    const travels = [
      { id: 1, name: 'Travel 1', year: '2024' },
      { id: 2, name: 'Travel 2', year: '2023' },
      { id: 3, name: 'Travel 3', year: '2022' }
    ];
    
    const settings = {
      title: 'Book',
      template: 'minimal',
      sortOrder: 'date-desc' as const
    };
    
    const html = await generator.generate(travels, settings);
    
    const travel1Index = html.indexOf('Travel 1');
    const travel2Index = html.indexOf('Travel 2');
    const travel3Index = html.indexOf('Travel 3');
    
    // Проверяем порядок (по убыванию года)
    expect(travel1Index).toBeLessThan(travel2Index);
    expect(travel2Index).toBeLessThan(travel3Index);
  });
});
```

### Запуск integration тестов:

```bash
# Integration тесты
npm run test:integration

# С coverage
npm run test:integration -- --coverage
```

## 🌐 E2E тесты

### Примеры E2E тестов (Playwright):

```typescript
import { test, expect } from '@playwright/test';

test.describe('PDF Export E2E', () => {
  test('exports single travel as PDF', async ({ page }) => {
    // 1. Открываем страницу путешествия
    await page.goto('/travels/paris-2024');
    
    // 2. Нажимаем кнопку экспорта
    await page.click('[data-testid="export-pdf-button"]');
    
    // 3. Ждем модалку настроек
    await expect(page.locator('[data-testid="book-settings-modal"]')).toBeVisible();
    
    // 4. Выбираем настройки
    await page.selectOption('[data-testid="theme-select"]', 'minimal');
    await page.check('[data-testid="include-gallery"]');
    
    // 5. Генерируем PDF
    const [newPage] = await Promise.all([
      page.waitForEvent('popup'),
      page.click('[data-testid="generate-pdf-button"]')
    ]);
    
    // 6. Проверяем что открылась новая вкладка с PDF
    await newPage.waitForLoadState();
    expect(newPage.url()).toContain('blob:');
    
    // 7. Проверяем содержимое
    const content = await newPage.content();
    expect(content).toContain('Paris Adventure');
    expect(content).toContain('France');
  });
  
  test('exports multiple travels with TOC', async ({ page }) => {
    await page.goto('/travels');
    
    // Выбираем несколько путешествий
    await page.check('[data-testid="travel-checkbox-1"]');
    await page.check('[data-testid="travel-checkbox-2"]');
    await page.check('[data-testid="travel-checkbox-3"]');
    
    // Экспортируем
    await page.click('[data-testid="export-selected-button"]');
    
    // Настройки
    await page.check('[data-testid="include-toc"]');
    
    // Генерация
    const [newPage] = await Promise.all([
      page.waitForEvent('popup'),
      page.click('[data-testid="generate-pdf-button"]')
    ]);
    
    await newPage.waitForLoadState();
    
    // Проверяем TOC
    const content = await newPage.content();
    expect(content).toContain('Содержание');
    expect(content).toContain('toc-page');
  });
  
  test('shows progress during generation', async ({ page }) => {
    await page.goto('/travels/long-travel');
    await page.click('[data-testid="export-pdf-button"]');
    await page.click('[data-testid="generate-pdf-button"]');
    
    // Проверяем прогресс
    await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();
    await expect(page.locator('[data-testid="progress-text"]')).toContainText('Генерация');
    
    // Ждем завершения
    await expect(page.locator('[data-testid="progress-bar"]')).toBeHidden({ timeout: 30000 });
  });
});
```

### Запуск E2E тестов:

```bash
# E2E тесты
npm run test:e2e

# Конкретный браузер
npm run test:e2e -- --project=chromium

# Headed mode
npm run test:e2e -- --headed

# Debug mode
npm run test:e2e -- --debug
```

## 📊 Performance тесты

### Примеры performance тестов:

```typescript
describe('Performance', () => {
  let generator: EnhancedPdfGenerator;
  
  beforeEach(() => {
    generator = createGenerator();
  });
  
  it('generates PDF for 1 travel in < 500ms', async () => {
    const travel = createMockTravel();
    const settings = createMockSettings();
    
    const start = performance.now();
    await generator.generate([travel], settings);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(500);
  });
  
  it('generates PDF for 10 travels in < 2s', async () => {
    const travels = Array.from({ length: 10 }, (_, i) => 
      createMockTravel({ id: i + 1 })
    );
    const settings = createMockSettings();
    
    const start = performance.now();
    await generator.generate(travels, settings);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(2000);
  });
  
  it('cache improves performance by 50%+', async () => {
    const travel = createMockTravel({ gallery: Array(20).fill('image.jpg') });
    const settings = createMockSettings();
    
    // Первая генерация (без кэша)
    const start1 = performance.now();
    await generator.generate([travel], settings);
    const duration1 = performance.now() - start1;
    
    // Вторая генерация (с кэшем)
    const start2 = performance.now();
    await generator.generate([travel], settings);
    const duration2 = performance.now() - start2;
    
    const improvement = (duration1 - duration2) / duration1;
    expect(improvement).toBeGreaterThan(0.5); // 50%+ улучшение
  });
  
  it('handles 50 images efficiently', async () => {
    const travel = createMockTravel({ 
      gallery: Array(50).fill('image.jpg').map((_, i) => `image${i}.jpg`)
    });
    const settings = createMockSettings({ includeGallery: true });
    
    const start = performance.now();
    await generator.generate([travel], settings);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(5000); // < 5s для 50 изображений
  });
});
```

### Benchmarking:

```typescript
// benchmark.ts
import Benchmark from 'benchmark';

const suite = new Benchmark.Suite;

suite
  .add('Generate single travel', async () => {
    await generator.generate([travel], settings);
  })
  .add('Generate 10 travels', async () => {
    await generator.generate(travels10, settings);
  })
  .add('Process 50 images', async () => {
    await imageProcessor.processImages(images50);
  })
  .on('cycle', (event) => {
    console.log(String(event.target));
  })
  .on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
  })
  .run({ async: true });
```

### Запуск performance тестов:

```bash
# Performance тесты
npm run test:performance

# Benchmark
npm run benchmark:pdf
```

## 📸 Visual Regression тесты

### Примеры visual тестов:

```typescript
import { test } from '@playwright/test';
import { percySnapshot } from '@percy/playwright';

test.describe('Visual Regression', () => {
  test('cover page looks correct', async ({ page }) => {
    await page.goto('/pdf-preview/cover');
    await percySnapshot(page, 'Cover Page - Minimal Theme');
  });
  
  test('gallery grid layout', async ({ page }) => {
    await page.goto('/pdf-preview/gallery?layout=grid');
    await percySnapshot(page, 'Gallery - Grid Layout');
  });
  
  test('all themes', async ({ page }) => {
    const themes = ['minimal', 'light', 'dark', 'travel-magazine'];
    
    for (const theme of themes) {
      await page.goto(`/pdf-preview?theme=${theme}`);
      await percySnapshot(page, `Full PDF - ${theme}`);
    }
  });
});
```

## 🎯 Coverage целей

| Тип | Минимум | Цель | Отлично |
|-----|---------|------|---------|
| Statements | 70% | 80% | 90%+ |
| Branches | 65% | 75% | 85%+ |
| Functions | 70% | 80% | 90%+ |
| Lines | 70% | 80% | 90%+ |

### Проверка coverage:

```bash
# Генерация отчета
npm run test:coverage

# Просмотр HTML отчета
open coverage/index.html

# CI проверка
npm run test:coverage -- --coverageThreshold='{"global":{"statements":80,"branches":75,"functions":80,"lines":80}}'
```

## 🔄 CI/CD Integration

### GitHub Actions:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit -- --coverage
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

## ✅ Pre-commit hooks

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Запускаем линтер
npm run lint

# Запускаем unit тесты для измененных файлов
npm run test:unit -- --findRelatedTests --bail

# Проверяем типы
npm run type-check
```

## 📝 Test Utilities

### Создать helper'ы для тестов:

```typescript
// __tests__/helpers/generators.ts
export function createMockTravel(overrides?: Partial<TravelForBook>): TravelForBook {
  return {
    id: 1,
    name: 'Test Travel',
    countryName: 'Test Country',
    year: '2024',
    ...overrides
  };
}

export function createMockSettings(overrides?: Partial<BookSettings>): BookSettings {
  return {
    title: 'Test Book',
    template: 'minimal',
    sortOrder: 'date-desc',
    includeToc: true,
    includeGallery: true,
    includeMap: true,
    ...overrides
  };
}

export function createGenerator(overrides?: Partial<Dependencies>): EnhancedPdfGenerator {
  return new EnhancedPdfGenerator(
    overrides?.contentParser || createMockContentParser(),
    overrides?.blockRenderer || createMockBlockRenderer(),
    // ...
  );
}
```

## 🎓 Best Practices

1. **Arrange-Act-Assert** - структурируйте тесты
2. **One assertion per test** - фокус на одной вещи
3. **Descriptive names** - понятные имена тестов
4. **Test behavior, not implementation** - тестируйте что, не как
5. **Avoid test interdependence** - независимые тесты
6. **Mock external dependencies** - изолируйте unit под тестом
7. **Use factories** - переиспользуемые моки
8. **Keep tests DRY** - но не переусложняйте

