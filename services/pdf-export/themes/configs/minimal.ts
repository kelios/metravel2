import type { PdfThemeConfig } from '../types'

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
    accent: '#c7866a',
    accentStrong: '#ab6e57',
    accentSoft: '#f3dfd6',
    accentLight: '#fbf1eb',
    
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
      backgroundGradient: ['#8b6b5d', '#5c4f4d'],
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
