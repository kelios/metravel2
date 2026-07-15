import type { PdfThemeConfig } from '../types'
import { translate as i18nT } from '@/i18n'

/**
 * Tropical — яркие тропические цвета: изумруд, горячий розовый, бирюза
 */
export const tropicalTheme: PdfThemeConfig = {
  name: 'tropical',
  get displayName() { return i18nT('export:services.pdfExport.theme.tropical.displayName') },
  get description() { return i18nT('export:services.pdfExport.theme.tropical.description') },

  colors: {
    text: '#1a2a24',
    textSecondary: '#2d4a3e',
    textMuted: '#5a7a6e',
    background: '#f2faf6',
    surface: '#ffffff',
    surfaceAlt: '#e6f5ee',

    accent: '#e8577a',
    accentStrong: '#c93d60',
    accentSoft: '#fad0dc',
    accentLight: '#fef0f4',

    border: '#c0ddd0',
    borderLight: '#daeee4',

    infoBlock: {
      background: '#e0f7fa',
      border: '#80deea',
      text: '#006064',
      icon: '#00bcd4',
    },
    warningBlock: {
      background: '#fff9c4',
      border: '#fff176',
      text: '#f57f17',
      icon: '#ffeb3b',
    },
    tipBlock: {
      background: '#e8f5e9',
      border: '#81c784',
      text: '#1b5e20',
      icon: '#4caf50',
    },
    dangerBlock: {
      background: '#fce4ec',
      border: '#f48fb1',
      text: '#880e4f',
      icon: '#e91e63',
    },

    cover: {
      background: '#f2faf6',
      backgroundGradient: ['#00897b', '#e8577a'],
      text: '#ffffff',
      textSecondary: '#b2dfdb',
    },
  },

  typography: {
    headingFont: "'Manrope', system-ui, -apple-system, sans-serif",
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
    borderRadius: '18px',
    shadow: '0 6px 22px rgba(0,137,123,0.12)',
    borderWidth: '1px',
  },
};
