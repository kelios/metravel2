// src/services/pdf-export/themes/types.ts
// ✅ АРХИТЕКТУРА: Типы конфигурации тем оформления PDF

/**
 * Тип темы оформления
 */
export type PdfThemeName =
  | 'minimal'
  | 'light'
  | 'dark'
  | 'travel-magazine'
  | 'classic'
  | 'modern'
  | 'romantic'
  | 'adventure'
  | 'illustrated'
  | 'black-white'
  | 'sepia'
  | 'newspaper'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'nordic'
  | 'retro'
  | 'tropical'
  | 'editorial-luxe'
  | 'watercolor';

/**
 * Конфигурация темы оформления PDF
 */
export interface PdfThemeConfig {
  name: PdfThemeName;
  displayName: string;
  description: string;

  // Цветовая палитра
  colors: {
    // Основные цвета
    text: string;
    textSecondary: string;
    textMuted: string;
    background: string;
    surface: string;
    surfaceAlt: string;

    // Акцентные цвета
    accent: string;
    accentStrong: string;
    accentSoft: string;
    accentLight: string;

    // Границы и разделители
    border: string;
    borderLight: string;

    // Специальные блоки
    infoBlock: {
      background: string;
      border: string;
      text: string;
      icon: string;
    };
    warningBlock: {
      background: string;
      border: string;
      text: string;
      icon: string;
    };
    tipBlock: {
      background: string;
      border: string;
      text: string;
      icon: string;
    };
    dangerBlock: {
      background: string;
      border: string;
      text: string;
      icon: string;
    };

    // Обложка
    cover: {
      background: string;
      backgroundGradient: [string, string];
      text: string;
      textSecondary: string;
    };
  };

  // Типографика
  typography: {
    headingFont: string;
    bodyFont: string;
    monoFont: string;

    // Размеры заголовков
    h1: { size: string; weight: number; lineHeight: number; marginBottom: string };
    h2: { size: string; weight: number; lineHeight: number; marginBottom: string };
    h3: { size: string; weight: number; lineHeight: number; marginBottom: string };
    h4: { size: string; weight: number; lineHeight: number; marginBottom: string };

    // Размеры текста
    body: { size: string; lineHeight: number; marginBottom: string };
    small: { size: string; lineHeight: number };
    caption: { size: string; lineHeight: number };
  };

  // Отступы и сетка
  spacing: {
    pagePadding: string;
    sectionSpacing: string;
    blockSpacing: string;
    elementSpacing: string;
    contentMaxWidth: string;
    columnGap: string;
  };

  // Стили блоков
  blocks: {
    borderRadius: string;
    shadow: string;
    borderWidth: string;
  };

  // Фильтры для изображений
  imageFilter?: string;
}
