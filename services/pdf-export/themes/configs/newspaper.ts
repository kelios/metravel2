import type { PdfThemeConfig } from '../types'

/**
 * Color Newspaper - цветная газета
 * Современная яркая газетная вёрстка с цветными акцентами
 */
export const newspaperTheme: PdfThemeConfig = {
  name: 'newspaper',
  displayName: 'Цветная газета',
  description: 'Яркая современная газетная вёрстка с цветными акцентами',

  colors: {
    text: '#1a1a1a',
    textSecondary: '#2d2d2d',
    textMuted: '#4a4a4a',
    background: '#fafaf7',
    surface: '#ffffff',
    surfaceAlt: '#f5f5f2',

    // Яркий красный акцент как в современных газетах
    accent: '#b97a7a',
    accentStrong: '#945f5f',
    accentSoft: '#edd9d9',
    accentLight: '#f8efef',

    border: '#bdbdbd',
    borderLight: '#e0e0e0',

    infoBlock: {
      background: '#e3f2fd',
      border: '#1976d2',
      text: '#0d47a1',
      icon: '#1565c0',
    },
    warningBlock: {
      background: '#fff9c4',
      border: '#f57f17',
      text: '#f57f17',
      icon: '#fbc02d',
    },
    tipBlock: {
      background: '#e8f5e9',
      border: '#43a047',
      text: '#1b5e20',
      icon: '#2e7d32',
    },
    dangerBlock: {
      background: '#ffebee',
      border: '#d32f2f',
      text: '#b71c1c',
      icon: '#c62828',
    },

    cover: {
      background: '#fafaf7',
      backgroundGradient: ['#b98c8c', '#8d6f6f'],
      text: '#ffffff',
      textSecondary: '#ffcdd2',
    },
  },

  typography: {
    // Единая газетная типографика
    headingFont: "'Libre Franklin', 'Arial Black', 'Arial', sans-serif",
    bodyFont: "'PT Serif', Georgia, 'Times New Roman', serif",
    monoFont: "'Courier New', monospace",

    // Крупные жирные заголовки
    h1: { size: '42pt', weight: 900, lineHeight: 1.05, marginBottom: '10pt' },
    h2: { size: '32pt', weight: 800, lineHeight: 1.15, marginBottom: '8pt' },
    h3: { size: '24pt', weight: 700, lineHeight: 1.25, marginBottom: '8pt' },
    h4: { size: '18pt', weight: 700, lineHeight: 1.3, marginBottom: '6pt' },

    body: { size: '11pt', lineHeight: 1.65, marginBottom: '9pt' },
    small: { size: '10pt', lineHeight: 1.6 },
    caption: { size: '9pt', lineHeight: 1.5 },
  },

  spacing: {
    // Компактная газетная верстка
    pagePadding: '20mm',
    sectionSpacing: '18pt',
    blockSpacing: '12pt',
    elementSpacing: '8pt',
    contentMaxWidth: '100%',
    columnGap: '14pt',
  },

  blocks: {
    borderRadius: '2px',
    shadow: 'none',
    borderWidth: '2px',
  },
};
