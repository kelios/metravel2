import type { PdfThemeConfig } from '../types'
import { translate as i18nT } from '@/i18n'

/**
 * Sepia Newspaper - газета в стиле сепия
 * Винтажная газетная вёрстка с теплыми коричневыми тонами
 */
export const sepiaTheme: PdfThemeConfig = {
  name: 'sepia',
  get displayName() { return i18nT('export:services.pdfExport.theme.sepia.displayName') },
  get description() { return i18nT('export:services.pdfExport.theme.sepia.description') },

  colors: {
    text: '#3e2723',
    textSecondary: '#4e342e',
    textMuted: '#6d4c41',
    background: '#f5f1e8',
    surface: '#faf6ed',
    surfaceAlt: '#f0ebe0',

    // Коричневый акцент для винтажного газетного стиля
    accent: '#8d6e63',
    accentStrong: '#6d4c41',
    accentSoft: '#a1887f',
    accentLight: '#d7ccc8',

    border: '#bcaaa4',
    borderLight: '#d7ccc8',

    infoBlock: {
      background: '#f0ebe0',
      border: '#8d6e63',
      text: '#3e2723',
      icon: '#6d4c41',
    },
    warningBlock: {
      background: '#fff3e0',
      border: '#d84315',
      text: '#bf360c',
      icon: '#ff6f00',
    },
    tipBlock: {
      background: '#f1f8e9',
      border: '#689f38',
      text: '#33691e',
      icon: '#558b2f',
    },
    dangerBlock: {
      background: '#f3e5f5',
      border: '#8d6e63',
      text: '#4a148c',
      icon: '#6d4c41',
    },

    cover: {
      background: '#f5f1e8',
      backgroundGradient: ['#6d4c41', '#3e2723'],
      text: '#f5f1e8',
      textSecondary: '#d7ccc8',
    },
  },

  typography: {
    // Те же газетные шрифты для единообразия
    headingFont: "'Merriweather', 'Georgia', serif",
    bodyFont: "'PT Serif', 'Georgia', 'Times New Roman', serif",
    monoFont: "'Courier New', monospace",

    // Идентичная газетная типографика
    h1: { size: '44pt', weight: 900, lineHeight: 1.05, marginBottom: '10pt' },
    h2: { size: '32pt', weight: 800, lineHeight: 1.15, marginBottom: '8pt' },
    h3: { size: '24pt', weight: 700, lineHeight: 1.25, marginBottom: '8pt' },
    h4: { size: '18pt', weight: 700, lineHeight: 1.3, marginBottom: '6pt' },

    body: { size: '11pt', lineHeight: 1.65, marginBottom: '9pt' },
    small: { size: '10pt', lineHeight: 1.6 },
    caption: { size: '9pt', lineHeight: 1.5 },
  },

  spacing: {
    // Идентичная газетная верстка
    pagePadding: '18mm',
    sectionSpacing: '18pt',
    blockSpacing: '12pt',
    elementSpacing: '8pt',
    contentMaxWidth: '100%',
    columnGap: '12pt',
  },

  blocks: {
    borderRadius: '8px',
    shadow: 'none',
    borderWidth: '1.5px',
  },

  // Полная сепия для изображений
  imageFilter: 'sepia(100%)',
};
