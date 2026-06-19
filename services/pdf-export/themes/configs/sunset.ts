import type { PdfThemeConfig } from '../types'

/**
 * Sunset — тёплые закатные тона: коралл, золото, мягкий персик
 */
export const sunsetTheme: PdfThemeConfig = {
  name: 'sunset',
  displayName: 'Закат',
  description: 'Тёплые закатные тона — коралл, золото, персик',

  colors: {
    text: '#2d1b14',
    textSecondary: '#5c3a2e',
    textMuted: '#8c6b5e',
    background: '#fef7f0',
    surface: '#ffffff',
    surfaceAlt: '#fdf0e6',

    accent: '#e07840',
    accentStrong: '#c45e2a',
    accentSoft: '#fad5bf',
    accentLight: '#fef0e6',

    border: '#edcdb8',
    borderLight: '#f5e3d4',

    infoBlock: {
      background: '#fff4e6',
      border: '#ffc078',
      text: '#854d0e',
      icon: '#f59e0b',
    },
    warningBlock: {
      background: '#fef3c7',
      border: '#fde68a',
      text: '#92400e',
      icon: '#d97706',
    },
    tipBlock: {
      background: '#ecfdf5',
      border: '#a7f3d0',
      text: '#065f46',
      icon: '#10b981',
    },
    dangerBlock: {
      background: '#fef2f2',
      border: '#fecaca',
      text: '#991b1b',
      icon: '#ef4444',
    },

    cover: {
      background: '#fef7f0',
      backgroundGradient: ['#e07840', '#c94a6e'],
      text: '#ffffff',
      textSecondary: '#ffd4b8',
    },
  },

  typography: {
    headingFont: "'Jost', system-ui, -apple-system, sans-serif",
    bodyFont: "'Nunito', system-ui, -apple-system, sans-serif",
    monoFont: "'JetBrains Mono', monospace",

    h1: { size: '36pt', weight: 800, lineHeight: 1.1, marginBottom: '16pt' },
    h2: { size: '26pt', weight: 700, lineHeight: 1.2, marginBottom: '14pt' },
    h3: { size: '20pt', weight: 600, lineHeight: 1.3, marginBottom: '12pt' },
    h4: { size: '16pt', weight: 600, lineHeight: 1.4, marginBottom: '10pt' },

    body: { size: '12pt', lineHeight: 1.85, marginBottom: '12pt' },
    small: { size: '11pt', lineHeight: 1.7 },
    caption: { size: '10pt', lineHeight: 1.6 },
  },

  spacing: {
    pagePadding: '24mm',
    sectionSpacing: '24pt',
    blockSpacing: '16pt',
    elementSpacing: '12pt',
    contentMaxWidth: '100%',
    columnGap: '16pt',
  },

  blocks: {
    borderRadius: '16px',
    shadow: '0 6px 20px rgba(224,120,64,0.12)',
    borderWidth: '1px',
  },
};
