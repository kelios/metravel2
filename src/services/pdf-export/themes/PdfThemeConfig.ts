// src/services/pdf-export/themes/PdfThemeConfig.ts
// ✅ АРХИТЕКТУРА: Конфигурация тем оформления PDF

/**
 * Тип темы оформления
 */
export type PdfThemeName = 'minimal' | 'light' | 'dark' | 'travel-magazine';

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
    background: '#ffffff',
    surface: '#ffffff',
    surfaceAlt: '#f9fafb',
    
    accent: '#10b981',
    accentStrong: '#059669',
    accentSoft: '#d1fae5',
    accentLight: '#ecfdf5',
    
    border: '#e5e7eb',
    borderLight: '#f3f4f6',
    
    infoBlock: {
      background: '#eff6ff',
      border: '#bfdbfe',
      text: '#1e40af',
      icon: '#3b82f6',
    },
    warningBlock: {
      background: '#fffbeb',
      border: '#fde68a',
      text: '#92400e',
      icon: '#f59e0b',
    },
    tipBlock: {
      background: '#f0fdf4',
      border: '#86efac',
      text: '#166534',
      icon: '#10b981',
    },
    dangerBlock: {
      background: '#fef2f2',
      border: '#fca5a5',
      text: '#991b1b',
      icon: '#ef4444',
    },
    
    cover: {
      background: '#ffffff',
      backgroundGradient: ['#f9fafb', '#e5e7eb'],
      text: '#111827',
      textSecondary: '#6b7280',
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
    borderRadius: '8px',
    shadow: '0 1px 3px rgba(0,0,0,0.1)',
    borderWidth: '1px',
  },
};

/**
 * Светлая тема - много воздуха, мягкие цвета
 */
export const lightTheme: PdfThemeConfig = {
  name: 'light',
  displayName: 'Светлая',
  description: 'Много воздуха, мягкие цвета, комфортное чтение',
  
  colors: {
    text: '#1f2937',
    textSecondary: '#4b5563',
    textMuted: '#9ca3af',
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceAlt: '#f1f5f9',
    
    accent: '#3b82f6',
    accentStrong: '#2563eb',
    accentSoft: '#dbeafe',
    accentLight: '#eff6ff',
    
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    
    infoBlock: {
      background: '#eff6ff',
      border: '#93c5fd',
      text: '#1e40af',
      icon: '#3b82f6',
    },
    warningBlock: {
      background: '#fffbeb',
      border: '#fcd34d',
      text: '#92400e',
      icon: '#f59e0b',
    },
    tipBlock: {
      background: '#f0fdf4',
      border: '#86efac',
      text: '#166534',
      icon: '#10b981',
    },
    dangerBlock: {
      background: '#fef2f2',
      border: '#fca5a5',
      text: '#991b1b',
      icon: '#ef4444',
    },
    
    cover: {
      background: '#ffffff',
      backgroundGradient: ['#e0f2fe', '#bae6fd'],
      text: '#0c4a6e',
      textSecondary: '#075985',
    },
  },
  
  typography: {
    headingFont: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Noto Sans', 'Arial', sans-serif",
    bodyFont: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Noto Sans', 'Arial', sans-serif",
    monoFont: "'JetBrains Mono', 'Courier New', monospace",
    
    h1: { size: '36pt', weight: 700, lineHeight: 1.2, marginBottom: '20pt' },
    h2: { size: '28pt', weight: 600, lineHeight: 1.3, marginBottom: '16pt' },
    h3: { size: '20pt', weight: 600, lineHeight: 1.4, marginBottom: '12pt' },
    h4: { size: '16pt', weight: 600, lineHeight: 1.4, marginBottom: '10pt' },
    
    body: { size: '12pt', lineHeight: 1.8, marginBottom: '14pt' },
    small: { size: '10.5pt', lineHeight: 1.7 },
    caption: { size: '9.5pt', lineHeight: 1.6 },
  },
  
  spacing: {
    pagePadding: '30mm',
    sectionSpacing: '32pt',
    blockSpacing: '20pt',
    elementSpacing: '16pt',
    contentMaxWidth: '100%',
    columnGap: '20pt',
  },
  
  blocks: {
    borderRadius: '12px',
    shadow: '0 2px 8px rgba(0,0,0,0.08)',
    borderWidth: '1px',
  },
};

/**
 * Темная тема - пригодная для печати и экрана
 */
export const darkTheme: PdfThemeConfig = {
  name: 'dark',
  displayName: 'Темная',
  description: 'Темное оформление, пригодное для печати и экрана',
  
  colors: {
    text: '#f9fafb',
    textSecondary: '#e5e7eb',
    textMuted: '#9ca3af',
    background: '#111827',
    surface: '#1f2937',
    surfaceAlt: '#374151',
    
    accent: '#8b5cf6',
    accentStrong: '#7c3aed',
    accentSoft: '#ede9fe',
    accentLight: '#f5f3ff',
    
    border: '#4b5563',
    borderLight: '#374151',
    
    infoBlock: {
      background: '#1e3a8a',
      border: '#3b82f6',
      text: '#dbeafe',
      icon: '#60a5fa',
    },
    warningBlock: {
      background: '#78350f',
      border: '#f59e0b',
      text: '#fde68a',
      icon: '#fbbf24',
    },
    tipBlock: {
      background: '#064e3b',
      border: '#10b981',
      text: '#d1fae5',
      icon: '#34d399',
    },
    dangerBlock: {
      background: '#7f1d1d',
      border: '#ef4444',
      text: '#fecaca',
      icon: '#f87171',
    },
    
    cover: {
      background: '#0f172a',
      backgroundGradient: ['#1e293b', '#334155'],
      text: '#f1f5f9',
      textSecondary: '#cbd5e1',
    },
  },
  
  typography: {
    headingFont: "'Inter', 'Segoe UI', sans-serif",
    bodyFont: "'Inter', 'Segoe UI', sans-serif",
    monoFont: "'JetBrains Mono', 'Courier New', monospace",
    
    h1: { size: '34pt', weight: 700, lineHeight: 1.2, marginBottom: '18pt' },
    h2: { size: '26pt', weight: 600, lineHeight: 1.3, marginBottom: '14pt' },
    h3: { size: '20pt', weight: 600, lineHeight: 1.4, marginBottom: '12pt' },
    h4: { size: '16pt', weight: 600, lineHeight: 1.4, marginBottom: '10pt' },
    
    body: { size: '11.5pt', lineHeight: 1.75, marginBottom: '13pt' },
    small: { size: '10pt', lineHeight: 1.65 },
    caption: { size: '9pt', lineHeight: 1.55 },
  },
  
  spacing: {
    pagePadding: '25mm',
    sectionSpacing: '28pt',
    blockSpacing: '18pt',
    elementSpacing: '14pt',
    contentMaxWidth: '100%',
    columnGap: '18pt',
  },
  
  blocks: {
    borderRadius: '10px',
    shadow: '0 4px 12px rgba(0,0,0,0.3)',
    borderWidth: '1px',
  },
};

/**
 * Travel Magazine тема - журнальная вёрстка
 */
export const travelMagazineTheme: PdfThemeConfig = {
  name: 'travel-magazine',
  displayName: 'Travel Magazine',
  description: 'Журнальная вёрстка с яркими акцентами',
  
  colors: {
    text: '#1a1a1a',
    textSecondary: '#4a4a4a',
    textMuted: '#8a8a8a',
    background: '#fafafa',
    surface: '#ffffff',
    surfaceAlt: '#f5f5f5',
    
    accent: '#ff6b35',
    accentStrong: '#e55a2b',
    accentSoft: '#ffe0d1',
    accentLight: '#fff4f0',
    
    border: '#e0e0e0',
    borderLight: '#f0f0f0',
    
    infoBlock: {
      background: '#e8f4f8',
      border: '#4fc3f7',
      text: '#01579b',
      icon: '#0288d1',
    },
    warningBlock: {
      background: '#fff3e0',
      border: '#ffb74d',
      text: '#e65100',
      icon: '#ff9800',
    },
    tipBlock: {
      background: '#e8f5e9',
      border: '#81c784',
      text: '#2e7d32',
      icon: '#4caf50',
    },
    dangerBlock: {
      background: '#ffebee',
      border: '#ef5350',
      text: '#c62828',
      icon: '#f44336',
    },
    
    cover: {
      background: '#ffffff',
      backgroundGradient: ['#ff6b35', '#f7931e'],
      text: '#ffffff',
      textSecondary: '#ffe0d1',
    },
  },
  
  typography: {
    headingFont: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Noto Sans', 'Arial', sans-serif",
    bodyFont: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Noto Sans', 'Arial', sans-serif",
    monoFont: "'Courier New', monospace",
    
    h1: { size: '42pt', weight: 800, lineHeight: 1.1, marginBottom: '24pt' },
    h2: { size: '32pt', weight: 700, lineHeight: 1.2, marginBottom: '18pt' },
    h3: { size: '24pt', weight: 700, lineHeight: 1.3, marginBottom: '14pt' },
    h4: { size: '18pt', weight: 600, lineHeight: 1.4, marginBottom: '12pt' },
    
    body: { size: '12pt', lineHeight: 1.75, marginBottom: '16pt' },
    small: { size: '10.5pt', lineHeight: 1.7 },
    caption: { size: '9.5pt', lineHeight: 1.6 },
  },
  
  spacing: {
    pagePadding: '20mm',
    sectionSpacing: '28pt',
    blockSpacing: '18pt',
    elementSpacing: '14pt',
    contentMaxWidth: '100%',
    columnGap: '18pt',
  },
  
  blocks: {
    borderRadius: '6px',
    shadow: '0 3px 10px rgba(0,0,0,0.15)',
    borderWidth: '2px',
  },
};

/**
 * Реестр всех тем
 */
export const PDF_THEMES: Record<PdfThemeName, PdfThemeConfig> = {
  minimal: minimalTheme,
  light: lightTheme,
  dark: darkTheme,
  'travel-magazine': travelMagazineTheme,
};

/**
 * Получить конфигурацию темы по имени
 */
export function getThemeConfig(themeName: PdfThemeName | string): PdfThemeConfig {
  const normalized = themeName.toLowerCase() as PdfThemeName;
  return PDF_THEMES[normalized] || minimalTheme;
}

/**
 * Получить список всех доступных тем
 */
export function getAllThemes(): PdfThemeConfig[] {
  return Object.values(PDF_THEMES);
}

