# Рекомендации по рефакторингу

## 🎯 Общие принципы

### 1. SOLID Principles

#### Single Responsibility Principle (SRP)
Каждый класс должен иметь одну причину для изменения.

**Плохо:**
```typescript
class EnhancedPdfGenerator {
  // Делает ВСЁ: генерация, обработка изображений, QR-коды, стили...
}
```

**Хорошо:**
```typescript
class CoverPageGenerator {
  // Отвечает ТОЛЬКО за генерацию обложки
}

class ImageProcessor {
  // Отвечает ТОЛЬКО за обработку изображений
}

class StyleGenerator {
  // Отвечает ТОЛЬКО за генерацию стилей
}
```

#### Open/Closed Principle (OCP)
Открыт для расширения, закрыт для модификации.

**Плохо:**
```typescript
class GalleryPageGenerator {
  render(layout: string) {
    if (layout === 'grid') { /* ... */ }
    else if (layout === 'masonry') { /* ... */ }
    else if (layout === 'polaroid') { /* ... */ }
    // Нужно менять код для добавления нового layout
  }
}
```

**Хорошо:**
```typescript
interface GalleryLayout {
  render(photos: Photo[]): string;
}

class GridLayout implements GalleryLayout { /* ... */ }
class MasonryLayout implements GalleryLayout { /* ... */ }

// Добавление нового layout не требует изменения существующего кода
class NewLayout implements GalleryLayout { /* ... */ }
```

#### Liskov Substitution Principle (LSP)
Подтипы должны быть заменяемы своими базовыми типами.

**Хорошо:**
```typescript
interface PageGenerator {
  generate(context: PageContext): Promise<string>;
}

// Все генераторы взаимозаменяемы
const generators: PageGenerator[] = [
  new CoverPageGenerator(),
  new TocPageGenerator(),
  new TravelPageGenerator()
];
```

#### Interface Segregation Principle (ISP)
Клиенты не должны зависеть от интерфейсов, которые они не используют.

**Плохо:**
```typescript
interface PageGenerator {
  generate(): string;
  generatePreview(): string;
  generateThumbnail(): string;
  exportToJson(): string;
  // Не все генераторы используют все методы
}
```

**Хорошо:**
```typescript
interface PageGenerator {
  generate(context: PageContext): string;
}

interface Previewable {
  generatePreview(): string;
}

interface Exportable {
  exportToJson(): string;
}

// Класс реализует только нужные интерфейсы
class CoverPageGenerator implements PageGenerator, Previewable {
  // ...
}
```

#### Dependency Inversion Principle (DIP)
Зависьте от абстракций, а не от конкретных реализаций.

**Плохо:**
```typescript
class EnhancedPdfGenerator {
  constructor() {
    this.imageProcessor = new ImageProcessor(); // Зависимость от конкретного класса
  }
}
```

**Хорошо:**
```typescript
interface IImageProcessor {
  process(url: string): Promise<string>;
}

class EnhancedPdfGenerator {
  constructor(private imageProcessor: IImageProcessor) {
    // Зависимость от интерфейса
  }
}
```

### 2. Clean Code

#### Meaningful Names

**Плохо:**
```typescript
function bld(t, s) { /* ... */ }
const x = 42;
```

**Хорошо:**
```typescript
function buildSafeImageUrl(url: string, options: ImageOptions): string { /* ... */ }
const DEFAULT_IMAGE_WIDTH = 1600;
```

#### Small Functions

**Плохо:**
```typescript
async renderTravelContentPage(travel, qrCode, pageNumber) {
  // 200+ строк кода...
}
```

**Хорошо:**
```typescript
async renderTravelContentPage(travel, qrCode, pageNumber) {
  return `
    ${this.renderHeader()}
    ${this.renderDescription(travel.description)}
    ${this.renderRecommendations(travel.recommendation)}
    ${this.renderProsAndCons(travel.plus, travel.minus)}
    ${this.renderFooter(qrCode, pageNumber)}
  `;
}

private renderDescription(description: string): string {
  // 10-20 строк
}
```

#### Comments vs Self-Documenting Code

**Плохо:**
```typescript
// Проверяем что URL не пустой и не null
if (url && url.length > 0) {
  // Обрабатываем URL
  const processed = /* сложная логика */;
}
```

**Хорошо:**
```typescript
if (this.isValidUrl(url)) {
  const processed = this.processUrl(url);
}

private isValidUrl(url: string | null | undefined): boolean {
  return url != null && url.length > 0;
}
```

### 3. DRY (Don't Repeat Yourself)

**Плохо:**
```typescript
renderCoverPage() {
  return `<div style="font-size: 12pt; color: #333; margin: 10px;">...</div>`;
}

renderTocPage() {
  return `<div style="font-size: 12pt; color: #333; margin: 10px;">...</div>`;
}
```

**Хорошо:**
```typescript
class StyleGenerator {
  paragraph(): string {
    return `font-size: ${this.theme.typography.body.size}; color: ${this.theme.colors.text}; margin: ${this.theme.spacing.elementSpacing};`;
  }
}

renderCoverPage() {
  return `<div style="${this.styleGen.paragraph()}">...</div>`;
}
```

### 4. YAGNI (You Aren't Gonna Need It)

Не добавляйте функциональность "на будущее".

**Плохо:**
```typescript
class ImageProcessor {
  // Добавляем методы которые "может когда-нибудь понадобятся"
  convertToWebP() { /* ... */ }
  applyWatermark() { /* ... */ }
  generateThumbnails() { /* ... */ }
}
```

**Хорошо:**
```typescript
class ImageProcessor {
  // Только то что действительно используется
  process(url: string): Promise<string> { /* ... */ }
}

// Добавим остальное когда понадобится
```

## 🏗️ Архитектурные паттерны

### Strategy Pattern

Для разных вариантов поведения:

```typescript
interface GalleryLayoutStrategy {
  render(photos: Photo[], options: Options): string;
}

class GalleryRenderer {
  constructor(private strategy: GalleryLayoutStrategy) {}
  
  render(photos: Photo[], options: Options): string {
    return this.strategy.render(photos, options);
  }
  
  setStrategy(strategy: GalleryLayoutStrategy): void {
    this.strategy = strategy;
  }
}
```

### Factory Pattern

Для создания объектов:

```typescript
class PageGeneratorFactory {
  static create(type: PageType, dependencies: Dependencies): PageGenerator {
    switch (type) {
      case 'cover':
        return new CoverPageGenerator(
          dependencies.styleGenerator,
          dependencies.imageProcessor
        );
      case 'toc':
        return new TocPageGenerator(dependencies.styleGenerator);
      // ...
    }
  }
}
```

### Builder Pattern

Для сложной конфигурации:

```typescript
class PdfGeneratorBuilder {
  private contentParser?: ContentParser;
  private blockRenderer?: BlockRenderer;
  // ...
  
  withTheme(theme: string): this {
    this.theme = getThemeConfig(theme);
    return this;
  }
  
  withImageProcessor(processor: ImageProcessor): this {
    this.imageProcessor = processor;
    return this;
  }
  
  build(): EnhancedPdfGenerator {
    return new EnhancedPdfGenerator(
      this.contentParser ?? new ContentParser(),
      this.blockRenderer ?? new BlockRenderer(this.theme),
      // ...
    );
  }
}

// Использование
const generator = new PdfGeneratorBuilder()
  .withTheme('minimal')
  .withImageProcessor(new ImageProcessor({ cache: true }))
  .build();
```

### Decorator Pattern

Для добавления функциональности:

```typescript
interface PageGenerator {
  generate(context: PageContext): Promise<string>;
}

class WatermarkDecorator implements PageGenerator {
  constructor(private wrapped: PageGenerator) {}
  
  async generate(context: PageContext): Promise<string> {
    const html = await this.wrapped.generate(context);
    return this.addWatermark(html);
  }
  
  private addWatermark(html: string): string {
    // Добавляем водяной знак
  }
}

// Использование
const generator = new WatermarkDecorator(
  new CoverPageGenerator()
);
```

## 💡 Практические советы

### 1. Начните с малого

Не пытайтесь рефакторить всё сразу. Начните с:
- Одного небольшого компонента
- Самого проблемного места
- Того что принесет максимальную пользу

### 2. Тестируйте перед рефакторингом

```bash
# 1. Убедитесь что все тесты проходят
npm test

# 2. Добавьте тесты если их нет
npm run test:coverage

# 3. Зафиксируйте baseline
npm run benchmark

# 4. Рефакторите

# 5. Проверьте что ничего не сломалось
npm test
npm run benchmark
```

### 3. Используйте Git эффективно

```bash
# Создайте отдельную ветку
git checkout -b refactor/enhance-pdf-generator

# Делайте частые коммиты
git commit -m "Extract ImageProcessor"
git commit -m "Create CoverPageGenerator"
git commit -m "Add tests for ImageProcessor"

# Можно откатиться если что-то пошло не так
git revert HEAD
```

### 4. Code Review

Каждое изменение должно проходить code review:

**Checklist для reviewer:**
- [ ] Код следует принципам SOLID
- [ ] Нет дублирования
- [ ] Понятные имена
- [ ] Есть тесты
- [ ] Документация обновлена
- [ ] Производительность не ухудшилась
- [ ] Нет breaking changes (или они задокументированы)

### 5. Документируйте изменения

```typescript
/**
 * Генератор страницы обложки PDF
 * 
 * @example
 * ```typescript
 * const generator = new CoverPageGenerator(styleGen, imageProc);
 * const html = await generator.generate({
 *   settings: { title: 'My Book', subtitle: '2024' },
 *   theme: minimalTheme
 * });
 * ```
 * 
 * @see {@link PageGenerator} базовый интерфейс
 * @see {@link StyleGenerator} для генерации стилей
 */
export class CoverPageGenerator implements PageGenerator {
  // ...
}
```

### 6. Избегайте преждевременной оптимизации

Сначала сделайте код правильным, потом быстрым:

1. **Работающий код** - сначала заставьте работать
2. **Чистый код** - потом сделайте правильно
3. **Быстрый код** - только если есть проблемы с производительностью

### 7. Мониторьте метрики

Отслеживайте:
- Время генерации PDF
- Использование памяти
- Количество ошибок
- Размер bundle
- Test coverage
- Code complexity

### 8. Постепенное внедрение

```typescript
// Поддерживайте обе версии одновременно
import { features } from '@/config/features';

const Generator = features.useNewPdfGenerator
  ? EnhancedPdfGeneratorV2
  : EnhancedPdfGeneratorV1;

// Постепенно переводите пользователей на новую версию
```

## 🚫 Антипаттерны

### 1. God Object

**Избегайте:**
```typescript
class EnhancedPdfGenerator {
  // 50+ методов
  // 2000+ строк
  // Делает всё
}
```

### 2. Magic Numbers

**Избегайте:**
```typescript
if (photos.length > 4) {
  // Почему 4?
}
```

**Используйте:**
```typescript
const MAX_INLINE_GALLERY_PHOTOS = 4;

if (photos.length > MAX_INLINE_GALLERY_PHOTOS) {
  // Понятно
}
```

### 3. Deep Nesting

**Избегайте:**
```typescript
if (condition1) {
  if (condition2) {
    if (condition3) {
      if (condition4) {
        // Код глубоко внутри
      }
    }
  }
}
```

**Используйте Guard Clauses:**
```typescript
if (!condition1) return;
if (!condition2) return;
if (!condition3) return;
if (!condition4) return;

// Код на верхнем уровне
```

### 4. Shotgun Surgery

Изменение в одном месте требует изменений во многих местах.

**Решение:** Централизуйте общую логику.

### 5. Feature Envy

Метод больше использует другой класс чем свой.

**Решение:** Переместите метод в нужный класс.

## ✅ Checklist перед релизом

### Code Quality
- [ ] Все принципы SOLID соблюдены
- [ ] Нет дублирования кода
- [ ] Понятные имена переменных и функций
- [ ] Функции < 50 строк
- [ ] Классы < 500 строк
- [ ] Cyclomatic complexity < 10

### Testing
- [ ] Test coverage >= 80%
- [ ] Все тесты проходят
- [ ] Нет flaky тестов
- [ ] Performance тесты прошли
- [ ] E2E тесты прошли

### Documentation
- [ ] README обновлен
- [ ] API документация актуальна
- [ ] Примеры работают
- [ ] Migration guide создан
- [ ] CHANGELOG обновлен

### Performance
- [ ] Не медленнее baseline
- [ ] Нет memory leaks
- [ ] Bundle size не увеличился
- [ ] Lighthouse score не ухудшился

### Security
- [ ] Нет SQL injection
- [ ] Нет XSS уязвимостей
- [ ] Нет exposed secrets
- [ ] Dependencies актуальны

### Deployment
- [ ] CI/CD настроен
- [ ] Rollback план готов
- [ ] Monitoring настроен
- [ ] Alerts настроены
- [ ] Команда готова к поддержке

## 📚 Рекомендуемое чтение

### Книги
1. **Clean Code** - Robert Martin
2. **Refactoring** - Martin Fowler
3. **Design Patterns** - Gang of Four
4. **Clean Architecture** - Robert Martin

### Статьи
1. [SOLID Principles](https://www.digitalocean.com/community/conceptual_articles/s-o-l-i-d-the-first-five-principles-of-object-oriented-design)
2. [Refactoring Guru](https://refactoring.guru/)
3. [The Twelve-Factor App](https://12factor.net/)

### Видео
1. [Clean Code - Uncle Bob](https://www.youtube.com/watch?v=7EmboKQH8lM)
2. [Refactoring Patterns](https://www.youtube.com/results?search_query=refactoring+patterns)

## 🤝 Получите помощь

Если застряли:
1. Спросите в команде
2. Code review сессия
3. Pair programming
4. Консультация с ментором
5. Stack Overflow / GitHub Issues

## 🎉 Празднуйте успехи

После каждого milestone:
- ✅ Компонент извлечен
- ✅ Тесты написаны
- ✅ Performance улучшена
- ✅ Deployment успешен

Отмечайте прогресс и делитесь достижениями с командой!

