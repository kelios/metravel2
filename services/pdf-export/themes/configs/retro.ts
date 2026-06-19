import type { PdfThemeConfig } from '../types'

/**
 * Retro — ретро-стиль 70-х: горчичный, бургунди, тёплый беж
 */
export const retroTheme: PdfThemeConfig = {
  name: 'retro',
  displayName: 'Ретро',
  description: 'Стиль 70-х — горчичный, бургунди, тёплый беж',

  colors: {
    text: '#2a1f14',
    textSecondary: '#5c4330',
    textMuted: '#8a7260',
    background: '#f8f3ec',
    surface: '#fffdf8',
    surfaceAlt: '#f0e8db',

    accent: '#c4843c',
    accentStrong: '#9e5b2a',
    accentSoft: '#edd5b8',
    accentLight: '#faf1e4',

    border: '#d9c7ae',
    borderLight: '#ebe0d0',

    infoBlock: {
      background: '#e8ebe0',
      border: '#a8b090',
      text: '#3a4028',
      icon: '#6b7a4a',
    },
    warningBlock: {
      background: '#fdf2d0',
      border: '#e0c060',
      text: '#7a5a0a',
      icon: '#c4963c',
    },
    tipBlock: {
      background: '#e0ede0',
      border: '#90b890',
      text: '#2a4a2a',
      icon: '#5a8a5a',
    },
    dangerBlock: {
      background: '#f5e0d8',
      border: '#c8887a',
      text: '#7a2a1a',
      icon: '#a04a3a',
    },

    cover: {
      background: '#f8f3ec',
      backgroundGradient: ['#8a3a3a', '#5c2828'],
      text: '#faf0e0',
      textSecondary: '#e0c0a0',
    },
  },

  typography: {
    headingFont: "'Playfair Display', Georgia, serif",
    bodyFont: "'PT Serif', Georgia, serif",
    monoFont: "'Courier New', monospace",

    h1: { size: '36pt', weight: 800, lineHeight: 1.15, marginBottom: '18pt' },
    h2: { size: '28pt', weight: 700, lineHeight: 1.25, marginBottom: '14pt' },
    h3: { size: '22pt', weight: 600, lineHeight: 1.35, marginBottom: '12pt' },
    h4: { size: '17pt', weight: 600, lineHeight: 1.4, marginBottom: '10pt' },

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
    borderRadius: '6px',
    shadow: '0 4px 14px rgba(158,91,42,0.12)',
    borderWidth: '2px',
  },
};
