import type { PdfThemeConfig } from '../types'

/**
 * Forest — насыщенные зелёные тона, лесная атмосфера
 */
export const forestTheme: PdfThemeConfig = {
  name: 'forest',
  displayName: 'Лес',
  description: 'Насыщенные зелёные тона и земляная палитра',

  colors: {
    text: '#1a2e1a',
    textSecondary: '#2d4a2d',
    textMuted: '#5a7a5a',
    background: '#f4f8f2',
    surface: '#ffffff',
    surfaceAlt: '#ecf3e8',

    accent: '#4a8c5c',
    accentStrong: '#2d6b3e',
    accentSoft: '#c8e0ce',
    accentLight: '#e8f3eb',

    border: '#c5d5c0',
    borderLight: '#dde8d9',

    infoBlock: {
      background: '#e8f5e9',
      border: '#a5d6a7',
      text: '#1b5e20',
      icon: '#43a047',
    },
    warningBlock: {
      background: '#fff8e1',
      border: '#ffcc80',
      text: '#e65100',
      icon: '#ff9800',
    },
    tipBlock: {
      background: '#e0f2f1',
      border: '#80cbc4',
      text: '#004d40',
      icon: '#009688',
    },
    dangerBlock: {
      background: '#fbe9e7',
      border: '#ef9a9a',
      text: '#bf360c',
      icon: '#e53935',
    },

    cover: {
      background: '#f4f8f2',
      backgroundGradient: ['#2d6b3e', '#1a3a22'],
      text: '#f0f8f0',
      textSecondary: '#a8d5b0',
    },
  },

  typography: {
    headingFont: "'Merriweather', Georgia, serif",
    bodyFont: "'Source Serif 4', Georgia, serif",
    monoFont: "'Courier New', monospace",

    h1: { size: '34pt', weight: 700, lineHeight: 1.25, marginBottom: '16pt' },
    h2: { size: '26pt', weight: 600, lineHeight: 1.35, marginBottom: '14pt' },
    h3: { size: '20pt', weight: 600, lineHeight: 1.4, marginBottom: '12pt' },
    h4: { size: '16pt', weight: 600, lineHeight: 1.45, marginBottom: '10pt' },

    body: { size: '12pt', lineHeight: 1.9, marginBottom: '14pt' },
    small: { size: '11pt', lineHeight: 1.8 },
    caption: { size: '10pt', lineHeight: 1.7 },
  },

  spacing: {
    pagePadding: '26mm',
    sectionSpacing: '26pt',
    blockSpacing: '18pt',
    elementSpacing: '14pt',
    contentMaxWidth: '100%',
    columnGap: '18pt',
  },

  blocks: {
    borderRadius: '10px',
    shadow: '0 3px 12px rgba(45,107,62,0.1)',
    borderWidth: '1px',
  },
};
