import type { PdfThemeConfig } from '../types'

/**
 * Editorial Luxe - журнальная «люкс»-эстетика: глубокий нейтральный фон,
 * кремовый лист, тонкая засечная типографика и золото/латунь акцент.
 */
export const editorialLuxeTheme: PdfThemeConfig = {
  name: 'editorial-luxe',
  displayName: 'Editorial Luxe',
  description: 'Журнальный люкс: засечная типографика и золотой акцент',

  colors: {
    text: '#211d18',
    textSecondary: '#4a443c',
    textMuted: '#857c6f',
    background: '#f6f1e7',
    surface: '#fffdf8',
    surfaceAlt: '#efe8da',

    accent: '#b08d57',
    accentStrong: '#8c6c3d',
    accentSoft: '#e7d6b8',
    accentLight: '#f5ecd9',

    border: '#ddd1bb',
    borderLight: '#ece3d2',

    infoBlock: {
      background: '#ecefed',
      border: '#cdd6d1',
      text: '#3a4a44',
      icon: '#6f8a7f',
    },
    warningBlock: {
      background: '#f6ecd6',
      border: '#e6cf9f',
      text: '#7a5a18',
      icon: '#c39b46',
    },
    tipBlock: {
      background: '#eef0e6',
      border: '#d3d8bf',
      text: '#525c33',
      icon: '#8a955c',
    },
    dangerBlock: {
      background: '#f4e3dc',
      border: '#e0bdae',
      text: '#7a3a28',
      icon: '#b56a52',
    },

    cover: {
      background: '#1f1b16',
      backgroundGradient: ['#2a241c', '#15110c'],
      text: '#f6f1e7',
      textSecondary: '#d9c39a',
    },
  },

  typography: {
    headingFont: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
    bodyFont: "'Source Serif 4', Georgia, 'Times New Roman', serif",
    monoFont: "'Courier New', monospace",

    h1: { size: '40pt', weight: 600, lineHeight: 1.15, marginBottom: '20pt' },
    h2: { size: '28pt', weight: 600, lineHeight: 1.25, marginBottom: '14pt' },
    h3: { size: '21pt', weight: 600, lineHeight: 1.35, marginBottom: '12pt' },
    h4: { size: '17pt', weight: 600, lineHeight: 1.4, marginBottom: '10pt' },

    body: { size: '12pt', lineHeight: 1.95, marginBottom: '14pt' },
    small: { size: '11pt', lineHeight: 1.8 },
    caption: { size: '10pt', lineHeight: 1.6 },
  },

  spacing: {
    pagePadding: '32mm',
    sectionSpacing: '30pt',
    blockSpacing: '20pt',
    elementSpacing: '14pt',
    contentMaxWidth: '100%',
    columnGap: '22pt',
  },

  blocks: {
    borderRadius: '2px',
    shadow: '0 6px 20px rgba(33,29,24,0.10)',
    borderWidth: '1px',
  },
};
