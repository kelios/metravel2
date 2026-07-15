import type { PdfThemeConfig } from '../types'
import { translate as i18nT } from '@/i18n'

/**
 * Nordic — холодный скандинавский минимализм, приглушённые голубые и серые
 */
export const nordicTheme: PdfThemeConfig = {
  name: 'nordic',
  get displayName() { return i18nT('export:services.pdfExport.theme.nordic.displayName') },
  get description() { return i18nT('export:services.pdfExport.theme.nordic.description') },

  colors: {
    text: '#1c2533',
    textSecondary: '#3b4a5c',
    textMuted: '#7a8a9e',
    background: '#f5f7fa',
    surface: '#ffffff',
    surfaceAlt: '#edf0f5',

    accent: '#6b8aad',
    accentStrong: '#4a6d8c',
    accentSoft: '#d0dde8',
    accentLight: '#eaf0f5',

    border: '#d5dce5',
    borderLight: '#e8ecf1',

    infoBlock: {
      background: '#e8f0fe',
      border: '#a8c6e8',
      text: '#1a4b7a',
      icon: '#4a8ac7',
    },
    warningBlock: {
      background: '#fef6e7',
      border: '#f0d78c',
      text: '#7a5c12',
      icon: '#c7a232',
    },
    tipBlock: {
      background: '#e5f5ec',
      border: '#8ec9a5',
      text: '#1a5a35',
      icon: '#3ea86e',
    },
    dangerBlock: {
      background: '#fce8e8',
      border: '#e5a0a0',
      text: '#7a1a1a',
      icon: '#c74a4a',
    },

    cover: {
      background: '#f5f7fa',
      backgroundGradient: ['#4a6d8c', '#2c3e50'],
      text: '#f5f7fa',
      textSecondary: '#b0c4d8',
    },
  },

  typography: {
    headingFont: "'Inter', system-ui, -apple-system, sans-serif",
    bodyFont: "'Inter', system-ui, -apple-system, sans-serif",
    monoFont: "'JetBrains Mono', monospace",

    h1: { size: '32pt', weight: 600, lineHeight: 1.2, marginBottom: '16pt' },
    h2: { size: '24pt', weight: 600, lineHeight: 1.3, marginBottom: '12pt' },
    h3: { size: '18pt', weight: 600, lineHeight: 1.4, marginBottom: '10pt' },
    h4: { size: '14pt', weight: 600, lineHeight: 1.4, marginBottom: '8pt' },

    body: { size: '12pt', lineHeight: 1.8, marginBottom: '12pt' },
    small: { size: '11pt', lineHeight: 1.7 },
    caption: { size: '10pt', lineHeight: 1.6 },
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
    borderRadius: '8px',
    shadow: '0 2px 8px rgba(28,37,51,0.06)',
    borderWidth: '1px',
  },
};
