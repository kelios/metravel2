// src/services/pdf-export/themes/PdfThemeConfig.ts
// ✅ АРХИТЕКТУРА: Конфигурация тем оформления PDF

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
  | 'illustrated';

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
    text: '#0f172a',
    textSecondary: '#334155',
    textMuted: '#64748b',
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
      text: '#334155',
      icon: '#64748b',
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
      backgroundGradient: ['#0f172a', '#334155'],
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
    
    body: { size: '12pt', lineHeight: 1.8, marginBottom: '12pt' },
    small: { size: '11pt', lineHeight: 1.7 },
    caption: { size: '10pt', lineHeight: 1.6 },
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
 * Светлая тема - много воздуха и мягкие цвета
 */
export const lightTheme: PdfThemeConfig = {
  name: 'light',
  displayName: 'Светлая',
  description: 'Много воздуха, мягкие цвета, комфортное чтение',
  
  colors: {
    text: '#0f172a',
    textSecondary: '#334155',
    textMuted: '#64748b',
    background: '#ffffff',
    surface: '#f9fafb',
    surfaceAlt: '#f3f4f6',
    
    accent: '#3b82f6',
    accentStrong: '#2563eb',
    accentSoft: '#dbeafe',
    accentLight: '#eff6ff',
    
    border: '#e5e7eb',
    borderLight: '#f3f4f6',
    
    infoBlock: {
      background: '#eff6ff',
      border: '#bfdbfe',
      text: '#1e40af',
      icon: '#3b82f6',
    },
    warningBlock: {
      background: '#fef3c7',
      border: '#fde68a',
      text: '#92400e',
      icon: '#f59e0b',
    },
    tipBlock: {
      background: '#d1fae5',
      border: '#a7f3d0',
      text: '#065f46',
      icon: '#10b981',
    },
    dangerBlock: {
      background: '#fee2e2',
      border: '#fecaca',
      text: '#991b1b',
      icon: '#ef4444',
    },
    
    cover: {
      background: '#f9fafb',
      backgroundGradient: ['#3b82f6', '#1d4ed8'],
      text: '#ffffff',
      textSecondary: '#e0e7ff',
    },
  },
  
  typography: {
    headingFont: "'Inter', system-ui, -apple-system, sans-serif",
    bodyFont: "'Inter', system-ui, -apple-system, sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    
    h1: { size: '32pt', weight: 700, lineHeight: 1.2, marginBottom: '16pt' },
    h2: { size: '24pt', weight: 600, lineHeight: 1.3, marginBottom: '12pt' },
    h3: { size: '18pt', weight: 600, lineHeight: 1.4, marginBottom: '10pt' },
    h4: { size: '14pt', weight: 600, lineHeight: 1.4, marginBottom: '8pt' },
    
    body: { size: '12pt', lineHeight: 1.8, marginBottom: '12pt' },
    small: { size: '11pt', lineHeight: 1.7 },
    caption: { size: '10pt', lineHeight: 1.6 },
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
    shadow: '0 2px 8px rgba(0,0,0,0.05)',
    borderWidth: '1px',
  },
};

/**
 * Темная тема - элегантное темное оформление
 */
export const darkTheme: PdfThemeConfig = {
  name: 'dark',
  displayName: 'Темная',
  description: 'Элегантное темное оформление',
  
  colors: {
    text: '#f9fafb',
    textSecondary: '#d1d5db',
    textMuted: '#9ca3af',
    background: '#111827',
    surface: '#1f2937',
    surfaceAlt: '#374151',
    
    accent: '#f59e0b',
    accentStrong: '#d97706',
    accentSoft: '#451a03',
    accentLight: '#292524',
    
    border: '#374151',
    borderLight: '#4b5563',
    
    infoBlock: {
      background: '#1e3a8a',
      border: '#1e40af',
      text: '#bfdbfe',
      icon: '#60a5fa',
    },
    warningBlock: {
      background: '#78350f',
      border: '#92400e',
      text: '#fde68a',
      icon: '#fbbf24',
    },
    tipBlock: {
      background: '#064e3b',
      border: '#065f46',
      text: '#a7f3d0',
      icon: '#34d399',
    },
    dangerBlock: {
      background: '#7f1d1d',
      border: '#991b1b',
      text: '#fecaca',
      icon: '#f87171',
    },
    
    cover: {
      background: '#111827',
      backgroundGradient: ['#0f172a', '#1e293b'],
      text: '#f9fafb',
      textSecondary: '#d1d5db',
    },
  },
  
  typography: {
    headingFont: "'Montserrat', system-ui, sans-serif",
    bodyFont: "'Open Sans', system-ui, sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    
    h1: { size: '32pt', weight: 800, lineHeight: 1.2, marginBottom: '16pt' },
    h2: { size: '24pt', weight: 700, lineHeight: 1.3, marginBottom: '12pt' },
    h3: { size: '18pt', weight: 600, lineHeight: 1.4, marginBottom: '10pt' },
    h4: { size: '14pt', weight: 600, lineHeight: 1.4, marginBottom: '8pt' },
    
    body: { size: '12pt', lineHeight: 1.8, marginBottom: '12pt' },
    small: { size: '11pt', lineHeight: 1.7 },
    caption: { size: '10pt', lineHeight: 1.6 },
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
    shadow: '0 4px 16px rgba(0,0,0,0.3)',
    borderWidth: '1px',
  },
};

/**
 * Travel Magazine - журнальная вёрстка с яркими акцентами
 */
export const travelMagazineTheme: PdfThemeConfig = {
  name: 'travel-magazine',
  displayName: 'Travel Magazine',
  description: 'Журнальная вёрстка с яркими акцентами',
  
  colors: {
    text: '#0a0a0a',
    textSecondary: '#3a3a3a',
    textMuted: '#6a6a6a',
    background: '#fafaf9',
    surface: '#ffffff',
    surfaceAlt: '#f5f5f4',
    
    accent: '#ea580c',
    accentStrong: '#c2410c',
    accentSoft: '#fed7aa',
    accentLight: '#ffedd5',
    
    border: '#e7e5e4',
    borderLight: '#f5f5f4',
    
    infoBlock: {
      background: '#dbeafe',
      border: '#93c5fd',
      text: '#1e40af',
      icon: '#3b82f6',
    },
    warningBlock: {
      background: '#fef3c7',
      border: '#fde047',
      text: '#854d0e',
      icon: '#eab308',
    },
    tipBlock: {
      background: '#d1fae5',
      border: '#6ee7b7',
      text: '#065f46',
      icon: '#10b981',
    },
    dangerBlock: {
      background: '#fee2e2',
      border: '#fca5a5',
      text: '#991b1b',
      icon: '#ef4444',
    },
    
    cover: {
      background: '#fafaf9',
      backgroundGradient: ['#ea580c', '#c2410c'],
      text: '#ffffff',
      textSecondary: '#fed7aa',
    },
  },
  
  typography: {
    headingFont: "'Playfair Display', Georgia, serif",
    bodyFont: "'Lato', system-ui, sans-serif",
    monoFont: "'Courier New', monospace",
    
    h1: { size: '36pt', weight: 800, lineHeight: 1.1, marginBottom: '18pt' },
    h2: { size: '26pt', weight: 700, lineHeight: 1.2, marginBottom: '14pt' },
    h3: { size: '20pt', weight: 600, lineHeight: 1.3, marginBottom: '12pt' },
    h4: { size: '16pt', weight: 600, lineHeight: 1.4, marginBottom: '10pt' },
    
    body: { size: '12pt', lineHeight: 1.9, marginBottom: '14pt' },
    small: { size: '11pt', lineHeight: 1.7 },
    caption: { size: '10pt', lineHeight: 1.6 },
  },
  
  spacing: {
    pagePadding: '20mm',
    sectionSpacing: '28pt',
    blockSpacing: '18pt',
    elementSpacing: '14pt',
    contentMaxWidth: '100%',
    columnGap: '20pt',
  },
  
  blocks: {
    borderRadius: '4px',
    shadow: '0 8px 24px rgba(0,0,0,0.12)',
    borderWidth: '2px',
  },
};

/**
 * Classic - классическая тема с традиционной типографикой
 */
export const classicTheme: PdfThemeConfig = {
  name: 'classic',
  displayName: 'Классическая',
  description: 'Традиционная типографика, сдержанные цвета',
  
  colors: {
    text: '#1a1a1a',
    textSecondary: '#4a4a4a',
    textMuted: '#737373',
    background: '#fdfcfb',
    surface: '#ffffff',
    surfaceAlt: '#f7f6f5',
    
    accent: '#8b4513',
    accentStrong: '#6b3410',
    accentSoft: '#d4a574',
    accentLight: '#f5e6d3',
    
    border: '#d4d4d4',
    borderLight: '#e5e5e5',
    
    infoBlock: {
      background: '#e8f4f8',
      border: '#b8dce8',
      text: '#1e5a6e',
      icon: '#4a90a4',
    },
    warningBlock: {
      background: '#fef5e7',
      border: '#f9e79f',
      text: '#7d6608',
      icon: '#d4ac0d',
    },
    tipBlock: {
      background: '#e8f8f5',
      border: '#a9dfbf',
      text: '#145a32',
      icon: '#27ae60',
    },
    dangerBlock: {
      background: '#fadbd8',
      border: '#f1948a',
      text: '#78281f',
      icon: '#cb4335',
    },
    
    cover: {
      background: '#fdfcfb',
      backgroundGradient: ['#5d4e37', '#3e2f1f'],
      text: '#fdfcfb',
      textSecondary: '#d4a574',
    },
  },
  
  typography: {
    headingFont: "'Crimson Text', Georgia, 'Times New Roman', serif",
    bodyFont: "'Crimson Text', Georgia, 'Times New Roman', serif",
    monoFont: "'Courier New', monospace",
    
    h1: { size: '34pt', weight: 700, lineHeight: 1.3, marginBottom: '18pt' },
    h2: { size: '26pt', weight: 600, lineHeight: 1.4, marginBottom: '14pt' },
    h3: { size: '20pt', weight: 600, lineHeight: 1.4, marginBottom: '12pt' },
    h4: { size: '16pt', weight: 600, lineHeight: 1.5, marginBottom: '10pt' },
    
    body: { size: '12pt', lineHeight: 1.9, marginBottom: '14pt' },
    small: { size: '11pt', lineHeight: 1.8 },
    caption: { size: '10pt', lineHeight: 1.7 },
  },
  
  spacing: {
    pagePadding: '30mm',
    sectionSpacing: '26pt',
    blockSpacing: '18pt',
    elementSpacing: '14pt',
    contentMaxWidth: '100%',
    columnGap: '18pt',
  },
  
  blocks: {
    borderRadius: '4px',
    shadow: '0 2px 6px rgba(0,0,0,0.08)',
    borderWidth: '1px',
  },
};

/**
 * Modern - современная тема с геометрическими формами
 */
export const modernTheme: PdfThemeConfig = {
  name: 'modern',
  displayName: 'Современная',
  description: 'Геометрические формы, яркие градиенты',
  
  colors: {
    text: '#0f172a',
    textSecondary: '#334155',
    textMuted: '#64748b',
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceAlt: '#f1f5f9',
    
    accent: '#8b5cf6',
    accentStrong: '#7c3aed',
    accentSoft: '#ddd6fe',
    accentLight: '#f5f3ff',
    
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    
    infoBlock: {
      background: '#e0e7ff',
      border: '#c7d2fe',
      text: '#3730a3',
      icon: '#6366f1',
    },
    warningBlock: {
      background: '#fef3c7',
      border: '#fde047',
      text: '#854d0e',
      icon: '#eab308',
    },
    tipBlock: {
      background: '#ccfbf1',
      border: '#99f6e4',
      text: '#134e4a',
      icon: '#14b8a6',
    },
    dangerBlock: {
      background: '#ffe4e6',
      border: '#fecdd3',
      text: '#881337',
      icon: '#f43f5e',
    },
    
    cover: {
      background: '#f8fafc',
      backgroundGradient: ['#8b5cf6', '#ec4899'],
      text: '#ffffff',
      textSecondary: '#ddd6fe',
    },
  },
  
  typography: {
    headingFont: "'Poppins', system-ui, -apple-system, sans-serif",
    bodyFont: "'Inter', system-ui, -apple-system, sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    
    h1: { size: '34pt', weight: 800, lineHeight: 1.1, marginBottom: '16pt' },
    h2: { size: '26pt', weight: 700, lineHeight: 1.2, marginBottom: '14pt' },
    h3: { size: '20pt', weight: 600, lineHeight: 1.3, marginBottom: '12pt' },
    h4: { size: '16pt', weight: 600, lineHeight: 1.4, marginBottom: '10pt' },
    
    body: { size: '12pt', lineHeight: 1.8, marginBottom: '12pt' },
    small: { size: '11pt', lineHeight: 1.7 },
    caption: { size: '10pt', lineHeight: 1.6 },
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
    borderRadius: '16px',
    shadow: '0 10px 30px rgba(139,92,246,0.15)',
    borderWidth: '2px',
  },
};

/**
 * Romantic - романтическая тема с пастельными цветами
 */
export const romanticTheme: PdfThemeConfig = {
  name: 'romantic',
  displayName: 'Романтическая',
  description: 'Пастельные цвета, мягкие формы',
  
  colors: {
    text: '#4a4a4a',
    textSecondary: '#6b6b6b',
    textMuted: '#9b9b9b',
    background: '#fef9f3',
    surface: '#ffffff',
    surfaceAlt: '#fdf5ed',
    
    accent: '#e91e63',
    accentStrong: '#c2185b',
    accentSoft: '#f8bbd0',
    accentLight: '#fce4ec',
    
    border: '#f3e5d8',
    borderLight: '#f9f0e7',
    
    infoBlock: {
      background: '#e3f2fd',
      border: '#bbdefb',
      text: '#1565c0',
      icon: '#42a5f5',
    },
    warningBlock: {
      background: '#fff3e0',
      border: '#ffe0b2',
      text: '#e65100',
      icon: '#ff9800',
    },
    tipBlock: {
      background: '#f1f8e9',
      border: '#dcedc8',
      text: '#558b2f',
      icon: '#8bc34a',
    },
    dangerBlock: {
      background: '#fce4ec',
      border: '#f8bbd0',
      text: '#880e4f',
      icon: '#e91e63',
    },
    
    cover: {
      background: '#fef9f3',
      backgroundGradient: ['#f48fb1', '#f06292'],
      text: '#ffffff',
      textSecondary: '#fce4ec',
    },
  },
  
  typography: {
    headingFont: "'Cormorant Garamond', Georgia, serif",
    bodyFont: "'Lora', Georgia, serif",
    monoFont: "'Courier New', monospace",
    
    h1: { size: '36pt', weight: 600, lineHeight: 1.3, marginBottom: '18pt' },
    h2: { size: '28pt', weight: 500, lineHeight: 1.4, marginBottom: '14pt' },
    h3: { size: '22pt', weight: 500, lineHeight: 1.4, marginBottom: '12pt' },
    h4: { size: '18pt', weight: 500, lineHeight: 1.5, marginBottom: '10pt' },
    
    body: { size: '12pt', lineHeight: 2.0, marginBottom: '14pt' },
    small: { size: '11pt', lineHeight: 1.8 },
    caption: { size: '10pt', lineHeight: 1.7 },
  },
  
  spacing: {
    pagePadding: '28mm',
    sectionSpacing: '26pt',
    blockSpacing: '18pt',
    elementSpacing: '14pt',
    contentMaxWidth: '100%',
    columnGap: '18pt',
  },
  
  blocks: {
    borderRadius: '20px',
    shadow: '0 4px 16px rgba(233,30,99,0.1)',
    borderWidth: '1px',
  },
};

/**
 * Adventure - приключенческая тема с динамичными акцентами
 */
export const adventureTheme: PdfThemeConfig = {
  name: 'adventure',
  displayName: 'Приключенческая',
  description: 'Насыщенные цвета, динамичная типографика',
  
  colors: {
    text: '#1a1a1a',
    textSecondary: '#3d3d3d',
    textMuted: '#6b6b6b',
    background: '#fafaf8',
    surface: '#ffffff',
    surfaceAlt: '#f5f5f3',
    
    accent: '#ff6b35',
    accentStrong: '#e85d2a',
    accentSoft: '#ffb399',
    accentLight: '#ffe6dc',
    
    border: '#d9d9d7',
    borderLight: '#e8e8e6',
    
    infoBlock: {
      background: '#e1f5fe',
      border: '#b3e5fc',
      text: '#01579b',
      icon: '#0288d1',
    },
    warningBlock: {
      background: '#fff8e1',
      border: '#ffecb3',
      text: '#f57f17',
      icon: '#fbc02d',
    },
    tipBlock: {
      background: '#e8f5e9',
      border: '#c8e6c9',
      text: '#2e7d32',
      icon: '#66bb6a',
    },
    dangerBlock: {
      background: '#ffebee',
      border: '#ffcdd2',
      text: '#c62828',
      icon: '#ef5350',
    },
    
    cover: {
      background: '#fafaf8',
      backgroundGradient: ['#ff6b35', '#004e89'],
      text: '#ffffff',
      textSecondary: '#ffb399',
    },
  },
  
  typography: {
    headingFont: "'Oswald', 'Impact', system-ui, sans-serif",
    bodyFont: "'Roboto', system-ui, -apple-system, sans-serif",
    monoFont: "'Courier New', monospace",
    
    h1: { size: '38pt', weight: 800, lineHeight: 1.1, marginBottom: '18pt' },
    h2: { size: '28pt', weight: 700, lineHeight: 1.2, marginBottom: '14pt' },
    h3: { size: '22pt', weight: 700, lineHeight: 1.3, marginBottom: '12pt' },
    h4: { size: '18pt', weight: 700, lineHeight: 1.4, marginBottom: '10pt' },
    
    body: { size: '12pt', lineHeight: 1.8, marginBottom: '12pt' },
    small: { size: '11pt', lineHeight: 1.7 },
    caption: { size: '10pt', lineHeight: 1.6 },
  },
  
  spacing: {
    pagePadding: '22mm',
    sectionSpacing: '24pt',
    blockSpacing: '16pt',
    elementSpacing: '12pt',
    contentMaxWidth: '100%',
    columnGap: '16pt',
  },
  
  blocks: {
    borderRadius: '8px',
    shadow: '0 6px 20px rgba(255,107,53,0.2)',
    borderWidth: '2px',
  },
};

/**
 * Illustrated Journey - уникальная иллюстрированная тема
 * Вдохновлена современными travel-журналами с иллюстрациями
 */
export const illustratedTheme: PdfThemeConfig = {
  name: 'illustrated',
  displayName: 'Illustrated Journey',
  description: 'Уникальная иллюстрированная тема с декоративными элементами',
  
  colors: {
    text: '#2d2d2d',
    textSecondary: '#5a5a5a',
    textMuted: '#8a8a8a',
    background: '#fffef9',
    surface: '#ffffff',
    surfaceAlt: '#fff8f0',
    
    accent: '#d4a574',
    accentStrong: '#b8874e',
    accentSoft: '#f5e6d3',
    accentLight: '#fef9f3',
    
    border: '#e8dcc8',
    borderLight: '#f5ede0',
    
    infoBlock: {
      background: '#fff4e6',
      border: '#ffd699',
      text: '#8b5a00',
      icon: '#d4a574',
    },
    warningBlock: {
      background: '#fff0e6',
      border: '#ffccb3',
      text: '#994d00',
      icon: '#ff8533',
    },
    tipBlock: {
      background: '#f0f9f4',
      border: '#b3e6cc',
      text: '#1a5c37',
      icon: '#52c788',
    },
    dangerBlock: {
      background: '#ffe6e6',
      border: '#ffb3b3',
      text: '#8b0000',
      icon: '#e63946',
    },
    
    cover: {
      background: '#fffef9',
      backgroundGradient: ['#f5e6d3', '#d4a574'],
      text: '#2d2d2d',
      textSecondary: '#5a5a5a',
    },
  },
  
  typography: {
    headingFont: "'Quicksand', 'Comfortaa', system-ui, sans-serif",
    bodyFont: "'Nunito', 'Open Sans', system-ui, sans-serif",
    monoFont: "'Courier New', monospace",
    
    h1: { size: '38pt', weight: 700, lineHeight: 1.2, marginBottom: '20pt' },
    h2: { size: '28pt', weight: 600, lineHeight: 1.3, marginBottom: '16pt' },
    h3: { size: '22pt', weight: 600, lineHeight: 1.4, marginBottom: '14pt' },
    h4: { size: '18pt', weight: 600, lineHeight: 1.4, marginBottom: '12pt' },
    
    body: { size: '12pt', lineHeight: 1.9, marginBottom: '14pt' },
    small: { size: '11pt', lineHeight: 1.8 },
    caption: { size: '10pt', lineHeight: 1.7 },
  },
  
  spacing: {
    pagePadding: '28mm',
    sectionSpacing: '28pt',
    blockSpacing: '20pt',
    elementSpacing: '16pt',
    contentMaxWidth: '100%',
    columnGap: '20pt',
  },
  
  blocks: {
    borderRadius: '24px',
    shadow: '0 6px 20px rgba(212,165,116,0.15)',
    borderWidth: '2px',
  },
};

/**
 * Реестр тем
 */
export const PDF_THEMES: Record<PdfThemeName, PdfThemeConfig> = {
  minimal: minimalTheme,
  light: lightTheme,
  dark: darkTheme,
  'travel-magazine': travelMagazineTheme,
  classic: classicTheme,
  modern: modernTheme,
  romantic: romanticTheme,
  adventure: adventureTheme,
  illustrated: illustratedTheme,
};

/**
 * Получить конфигурацию темы по имени
 */
export function getThemeConfig(themeName: PdfThemeName | string): PdfThemeConfig {
  return PDF_THEMES[themeName as PdfThemeName] || minimalTheme;
}

/**
 * Получить список всех доступных тем
 */
export function getAllThemes(): PdfThemeConfig[] {
  return [
    minimalTheme,
    lightTheme,
    darkTheme,
    travelMagazineTheme,
    classicTheme,
    modernTheme,
    romanticTheme,
    adventureTheme,
    illustratedTheme,
  ];
}

