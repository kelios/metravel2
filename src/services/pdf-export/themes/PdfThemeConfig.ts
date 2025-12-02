// src/services/pdf-export/themes/PdfThemeConfig.ts
// ✅ АРХИТЕКТУРА: Конфигурация тем оформления PDF

/**
 * Тип темы оформления
 *
 * После упрощения дизайна оставляем одну актуальную тему `minimal`.
 * Все остальные значения template будут мапиться на неё.
 */
export type PdfThemeName = 'minimal';

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
}

/**
 * Минималистичная тема - чистая и простая
 */
export const minimalTheme: PdfThemeConfig = {
  name: 'minimal',
  displayName: 'Минималистичная',
  description: 'Чистое и простое оформление с акцентом на контент',
  
  colors: {
    text: '#111827',
    textSecondary: '#374151',
    textMuted: '#6b7280',
    // Мягкий «бумажный» фон и светлые поверхности
    background: '#f5f5f7',
    surface: '#ffffff',
    surfaceAlt: '#f3f4f6',
    
    // Спокойный терракотовый акцент
    accent: '#d97355',
    accentStrong: '#c25b3d',
    accentSoft: '#fde6dd',
    accentLight: '#fff3ec',
    
    border: '#e5e7eb',
    borderLight: '#f3f4f6',
    
    infoBlock: {
      background: '#f3f4f6',
      border: '#e5e7eb',
      text: '#374151',
      icon: '#9ca3af',
    },
    warningBlock: {
      background: '#fef3c7',
      border: '#fde68a',
      text: '#92400e',
      icon: '#d97706',
    },
    tipBlock: {
      background: '#ecfdf3',
      border: '#bbf7d0',
      text: '#166534',
      icon: '#22c55e',
    },
    dangerBlock: {
      background: '#fef2f2',
      border: '#fecaca',
      text: '#7f1d1d',
      icon: '#ef4444',
    },
    
    cover: {
      background: '#f3f4f6',
      backgroundGradient: ['#111827', '#4b5563'],
      text: '#f9fafb',
      textSecondary: '#e5e7eb',
    },
  },
  
  typography: {
    headingFont: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Noto Sans', 'Arial', sans-serif",
    bodyFont: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Noto Sans', 'Arial', sans-serif",
    monoFont: "'JetBrains Mono', 'Courier New', monospace",
    
    h1: { size: '32pt', weight: 700, lineHeight: 1.2, marginBottom: '16pt' },
    h2: { size: '24pt', weight: 600, lineHeight: 1.3, marginBottom: '12pt' },
    h3: { size: '18pt', weight: 600, lineHeight: 1.4, marginBottom: '10pt' },
    h4: { size: '14pt', weight: 600, lineHeight: 1.4, marginBottom: '8pt' },
    
    body: { size: '11pt', lineHeight: 1.7, marginBottom: '12pt' },
    small: { size: '10pt', lineHeight: 1.6 },
    caption: { size: '9pt', lineHeight: 1.5 },
  },
  
  spacing: {
    pagePadding: '25mm',
    sectionSpacing: '24pt',
    blockSpacing: '16pt',
    elementSpacing: '12pt',
    contentMaxWidth: '100%',
    columnGap: '16pt',
  },
  
  blocks: {
    borderRadius: '12px',
    shadow: '0 4px 12px rgba(15,23,42,0.08)',
    borderWidth: '1px',
  },
};

/**
 * Реестр тем
 *
 * Сейчас в системе используется одна тема `minimal`.
 */
export const PDF_THEMES: Record<PdfThemeName, PdfThemeConfig> = {
  minimal: minimalTheme,
};

/**
 * Получить конфигурацию темы по имени
 *
 * Любое входящее значение (включая старые template) мапится на `minimal`.
 */
export function getThemeConfig(_themeName: PdfThemeName | string): PdfThemeConfig {
  return minimalTheme;
}

/**
 * Получить список всех доступных тем
 */
export function getAllThemes(): PdfThemeConfig[] {
  return [minimalTheme];
}

