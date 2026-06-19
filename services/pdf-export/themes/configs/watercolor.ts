import type { PdfThemeConfig } from '../types'

/**
 * Watercolor - мягкая акварель: светлый бумажный фон, пастельные сине-зелёные
 * и терракотовые акценты, дружелюбные заголовки и мягкие границы.
 */
export const watercolorTheme: PdfThemeConfig = {
  name: 'watercolor',
  displayName: 'Акварель',
  description: 'Мягкая акварель: пастельные тона и дружелюбные заголовки',

  colors: {
    text: '#3a4046',
    textSecondary: '#5c656d',
    textMuted: '#909aa1',
    background: '#fbf9f4',
    surface: '#ffffff',
    surfaceAlt: '#f2f5f3',

    accent: '#5a9aa0',
    accentStrong: '#3f787e',
    accentSoft: '#cfe4e3',
    accentLight: '#eaf4f3',

    border: '#dde7e4',
    borderLight: '#ebf1ef',

    infoBlock: {
      background: '#e4f1f2',
      border: '#bcdcdd',
      text: '#2f6469',
      icon: '#5a9aa0',
    },
    warningBlock: {
      background: '#fbeede',
      border: '#f0d3ab',
      text: '#8a5a26',
      icon: '#d39a55',
    },
    tipBlock: {
      background: '#e7f1e6',
      border: '#c2dabf',
      text: '#41663c',
      icon: '#7aa470',
    },
    dangerBlock: {
      background: '#f8e3dc',
      border: '#eebfae',
      text: '#9c4f37',
      icon: '#cc7a5c',
    },

    cover: {
      background: '#fbf9f4',
      backgroundGradient: ['#8cc0c2', '#cf9b86'],
      text: '#ffffff',
      textSecondary: '#f3e9df',
    },
  },

  typography: {
    headingFont: "'Caveat', 'Comfortaa', 'Quicksand', cursive",
    bodyFont: "'Nunito', 'Source Sans 3', system-ui, sans-serif",
    monoFont: "'Courier New', monospace",

    h1: { size: '38pt', weight: 700, lineHeight: 1.2, marginBottom: '18pt' },
    h2: { size: '28pt', weight: 700, lineHeight: 1.3, marginBottom: '14pt' },
    h3: { size: '21pt', weight: 600, lineHeight: 1.35, marginBottom: '12pt' },
    h4: { size: '17pt', weight: 600, lineHeight: 1.4, marginBottom: '10pt' },

    body: { size: '12pt', lineHeight: 1.9, marginBottom: '14pt' },
    small: { size: '11pt', lineHeight: 1.75 },
    caption: { size: '10pt', lineHeight: 1.6 },
  },

  spacing: {
    pagePadding: '26mm',
    sectionSpacing: '26pt',
    blockSpacing: '18pt',
    elementSpacing: '14pt',
    contentMaxWidth: '100%',
    columnGap: '20pt',
  },

  blocks: {
    borderRadius: '18px',
    shadow: '0 4px 18px rgba(90,154,160,0.12)',
    borderWidth: '1px',
  },
};
