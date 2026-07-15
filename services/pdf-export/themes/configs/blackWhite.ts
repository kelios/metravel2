import type { PdfThemeConfig } from '../types'
import { translate as i18nT } from '@/i18n'

/**
 * Black & White Newspaper - черно-белая газетная тема
 * Классическая газетная вёрстка в монохромной палитре
 */
export const blackWhiteTheme: PdfThemeConfig = {
  name: 'black-white',
  get displayName() { return i18nT('export:services.pdfExport.theme.blackWhite.displayName') },
  get description() { return i18nT('export:services.pdfExport.theme.blackWhite.description') },

  colors: {
    text: '#000000',
    textSecondary: '#1a1a1a',
    textMuted: '#4a4a4a',
    background: '#ffffff',
    surface: '#fafafa',
    surfaceAlt: '#f5f5f5',

    // Черный акцент для газетного стиля
    accent: '#000000',
    accentStrong: '#0a0a0a',
    accentSoft: '#666666',
    accentLight: '#cccccc',

    border: '#d0d0d0',
    borderLight: '#e5e5e5',

    infoBlock: {
      background: '#f5f5f5',
      border: '#000000',
      text: '#1a1a1a',
      icon: '#333333',
    },
    warningBlock: {
      background: '#e8e8e8',
      border: '#4a4a4a',
      text: '#1a1a1a',
      icon: '#333333',
    },
    tipBlock: {
      background: '#f0f0f0',
      border: '#666666',
      text: '#0a0a0a',
      icon: '#2a2a2a',
    },
    dangerBlock: {
      background: '#e0e0e0',
      border: '#000000',
      text: '#000000',
      icon: '#1a1a1a',
    },

    cover: {
      background: '#ffffff',
      backgroundGradient: ['#000000', '#2a2a2a'],
      text: '#ffffff',
      textSecondary: '#d0d0d0',
    },
  },

  typography: {
    // Газетные шрифты - жирные заголовки
    headingFont: "'Helvetica', 'Arial', sans-serif",
    bodyFont: "'PT Serif', Georgia, 'Times New Roman', serif",
    monoFont: "'Courier New', monospace",

    // Крупные жирные заголовки как в газетах
    h1: { size: '44pt', weight: 900, lineHeight: 1.05, marginBottom: '10pt' },
    h2: { size: '32pt', weight: 800, lineHeight: 1.15, marginBottom: '8pt' },
    h3: { size: '24pt', weight: 700, lineHeight: 1.25, marginBottom: '8pt' },
    h4: { size: '18pt', weight: 700, lineHeight: 1.3, marginBottom: '6pt' },

    // Компактный текст для колонок
    body: { size: '11pt', lineHeight: 1.65, marginBottom: '9pt' },
    small: { size: '10pt', lineHeight: 1.6 },
    caption: { size: '9pt', lineHeight: 1.5 },
  },

  spacing: {
    // Компактная газетная верстка
    pagePadding: '18mm',
    sectionSpacing: '18pt',
    blockSpacing: '12pt',
    elementSpacing: '8pt',
    contentMaxWidth: '100%',
    columnGap: '12pt',
  },

  blocks: {
    borderRadius: '4px',
    shadow: 'none',
    borderWidth: '2px',
  },

  // Полный черно-белый фильтр для изображений
  imageFilter: 'grayscale(100%)',
};
