# 🚀 Быстрый старт: Новые темы PDF

## Как использовать новые темы

### 1. Импорт темы

```typescript
import { getThemeConfig } from '@/services/pdf-export/themes/PdfThemeConfig';

// Получить конфигурацию темы
const theme = getThemeConfig('black-white'); // или 'sepia', 'newspaper'
```

### 2. Применение в генераторе PDF

```typescript
import { EnhancedPdfGenerator } from '@/services/pdf-export/generators/EnhancedPdfGenerator';

const generator = new EnhancedPdfGenerator();

const pdfBuffer = await generator.generate(
  travels,
  {
    theme: 'newspaper', // Выбор темы
    format: 'A4',
    orientation: 'portrait',
    // ...другие настройки
  }
);
```

### 3. Все доступные темы

```typescript
// Существующие темы (9 штук)
'minimal'          // Минималистичная
'light'            // Светлая
'dark'             // Темная
'travel-magazine'  // Travel Magazine
'classic'          // Классическая
'modern'           // Современная
'romantic'         // Романтическая
'adventure'        // Приключенческая
'illustrated'      // Illustrated Journey

// Новые темы (3 штуки) ✨
'black-white'      // Черно-белая
'sepia'            // Сепия
'newspaper'        // Цветная газета
```

## Примеры применения

### Черно-белая тема для официального отчета

```typescript
const report = await generator.generate(travels, {
  theme: 'black-white',
  format: 'A4',
  includeTableOfContents: true,
  includePageNumbers: true,
});
```

### Винтажный альбом с темой Сепия

```typescript
const album = await generator.generate(travels, {
  theme: 'sepia',
  format: 'A4',
  orientation: 'landscape',
  galleryLayout: 'polaroid', // Сочетается с винтажным стилем
});
```

### Газетный репортаж

```typescript
const article = await generator.generate(travels, {
  theme: 'newspaper',
  format: 'A4',
  includeTableOfContents: false, // Газетный стиль без оглавления
  columns: 2, // Двухколоночная верстка (если поддерживается)
});
```

## Характеристики тем

### 🖤 Черно-белая (black-white)

**Когда использовать:**
- Официальные документы
- Печать на ч/б принтере
- Минималистичный стиль

**Особенности:**
- Монохромная палитра
- Четкие контрасты
- Классическая типографика

### 📜 Сепия (sepia)

**Когда использовать:**
- Истории о путешествиях
- Ностальгический контент
- Винтажные альбомы

**Особенности:**
- Теплые коричневые тона
- Serif шрифты
- Эффект старой бумаги

### 📰 Газета (newspaper)

**Когда использовать:**
- Новостные материалы
- Репортажи
- Информационные буклеты

**Особенности:**
- Крупные заголовки (42pt)
- Красный акцент
- Компактная верстка

## Проверка доступности темы

```typescript
import { PDF_THEMES } from '@/services/pdf-export/themes/PdfThemeConfig';

// Проверить, существует ли тема
const themeExists = 'newspaper' in PDF_THEMES;

// Получить все доступные темы
const allThemes = Object.keys(PDF_THEMES);
console.log(allThemes); 
// ['minimal', 'light', 'dark', ..., 'black-white', 'sepia', 'newspaper']

// Получить информацию о теме
const newspaperInfo = PDF_THEMES.newspaper;
console.log(newspaperInfo.displayName); // 'Цветная газета'
console.log(newspaperInfo.description); // 'Стиль современной цветной газеты...'
```

## Настройка под свои нужды

### Получить конфигурацию и изменить

```typescript
const baseTheme = getThemeConfig('newspaper');

// Создать кастомный вариант (если поддерживается)
const customTheme = {
  ...baseTheme,
  colors: {
    ...baseTheme.colors,
    accent: '#ff6b35', // Изменить цвет акцента
  }
};
```

## Комбинирование с другими настройками

```typescript
const pdf = await generator.generate(travels, {
  // Тема
  theme: 'sepia',
  
  // Формат и ориентация
  format: 'A4',
  orientation: 'portrait',
  
  // Содержимое
  includeTableOfContents: true,
  includePageNumbers: true,
  includeCover: true,
  
  // Галерея
  galleryLayout: 'masonry',
  imagesPerPage: 6,
  
  // Карты
  includeMap: true,
  mapStyle: 'vintage', // Сочетается с темой сепия
});
```

## Советы по выбору темы

| Тип документа | Рекомендуемая тема |
|--------------|-------------------|
| Личный дневник путешествий | `sepia` или `romantic` |
| Отчет о командировке | `black-white` или `minimal` |
| Новостная статья | `newspaper` или `travel-magazine` |
| Фотоальбом | `illustrated` или `sepia` |
| Технический отчет | `black-white` или `classic` |
| Приключенческий рассказ | `adventure` или `newspaper` |

## Поддержка и обратная связь

- 📖 Полная документация: `/docs/pdf-export/NEW_THEMES.md`
- 🧪 Тесты: `__tests__/services/pdf-export/themes/PdfThemeConfig.test.ts`
- 📝 Конфигурация: `src/services/pdf-export/themes/PdfThemeConfig.ts`

---

**Дата создания**: 30.12.2025  
**Версия**: 1.0.0

