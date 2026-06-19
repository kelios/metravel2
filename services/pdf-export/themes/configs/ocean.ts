import type { PdfThemeConfig } from '../types'

/**
 * Ocean — глубокий синий с бирюзовыми акцентами, свежий прибрежный стиль
 */
export const oceanTheme: PdfThemeConfig = {
  name: 'ocean',
  displayName: 'Океан',
  description: 'Глубокий синий с бирюзовыми акцентами',

  colors: {
    text: '#0c1b2a',
    textSecondary: '#1e3a5f',
    textMuted: '#5b7a95',
    background: '#f0f7fa',
    surface: '#ffffff',
    surfaceAlt: '#e8f4f8',

    accent: '#2e8b9e',
    accentStrong: '#1a6b7d',
    accentSoft: '#c5e8ef',
    accentLight: '#e8f6f9',

    border: '#c1d9e3',
    borderLight: '#dfeef3',

    infoBlock: {
      background: '#e0f2fe',
      border: '#7dd3fc',
      text: '#075985',
      icon: '#0ea5e9',
    },
    warningBlock: {
      background: '#fef9c3',
      border: '#fde047',
      text: '#854d0e',
      icon: '#eab308',
    },
    tipBlock: {
      background: '#ccfbf1',
      border: '#5eead4',
      text: '#115e59',
      icon: '#14b8a6',
    },
    dangerBlock: {
      background: '#fee2e2',
      border: '#fca5a5',
      text: '#991b1b',
      icon: '#ef4444',
    },

    cover: {
      background: '#f0f7fa',
      backgroundGradient: ['#1a6b7d', '#0c3547'],
      text: '#f0f9ff',
      textSecondary: '#a5d8e8',
    },
  },

  typography: {
    headingFont: "'Manrope', system-ui, -apple-system, sans-serif",
    bodyFont: "'Source Sans 3', system-ui, -apple-system, sans-serif",
    monoFont: "'JetBrains Mono', monospace",

    h1: { size: '34pt', weight: 700, lineHeight: 1.15, marginBottom: '16pt' },
    h2: { size: '26pt', weight: 600, lineHeight: 1.25, marginBottom: '14pt' },
    h3: { size: '20pt', weight: 600, lineHeight: 1.35, marginBottom: '12pt' },
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
    borderRadius: '14px',
    shadow: '0 4px 16px rgba(14,107,125,0.1)',
    borderWidth: '1px',
  },
};
