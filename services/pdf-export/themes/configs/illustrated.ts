import type { PdfThemeConfig } from '../types'
import { translate as i18nT } from '@/i18n'

/**
 * Illustrated Journey - уникальная иллюстрированная тема
 * Вдохновлена современными travel-журналами с иллюстрациями
 */
export const illustratedTheme: PdfThemeConfig = {
  name: 'illustrated',
  get displayName() { return i18nT('export:services.pdfExport.theme.illustrated.displayName') },
  get description() { return i18nT('export:services.pdfExport.theme.illustrated.description') },
  
  colors: {
    text: '#2d2d2d',
    textSecondary: '#5a5a5a',
    textMuted: '#8a8a8a',
    background: '#fffef9',
    surface: '#ffffff',
    surfaceAlt: '#fff8f0',
    
    accent: '#d4a574',
    accentStrong: '#b8874e',
    accentSoft: '#f5e6d3',
    accentLight: '#fef9f3',
    
    border: '#e8dcc8',
    borderLight: '#f5ede0',
    
    infoBlock: {
      background: '#fff4e6',
      border: '#ffd699',
      text: '#8b5a00',
      icon: '#d4a574',
    },
    warningBlock: {
      background: '#fff0e6',
      border: '#ffccb3',
      text: '#994d00',
      icon: '#ff8533',
    },
    tipBlock: {
      background: '#f0f9f4',
      border: '#b3e6cc',
      text: '#1a5c37',
      icon: '#52c788',
    },
    dangerBlock: {
      background: '#ffe6e6',
      border: '#ffb3b3',
      text: '#8b0000',
      icon: '#e63946',
    },
    
    cover: {
      background: '#fffef9',
      backgroundGradient: ['#f5e6d3', '#d4a574'],
      text: '#2d2d2d',
      textSecondary: '#5a5a5a',
    },
  },
  
  typography: {
    headingFont: "'Comfortaa', 'Quicksand', system-ui, sans-serif",
    bodyFont: "'Nunito', 'Open Sans', system-ui, sans-serif",
    monoFont: "'Courier New', monospace",
    
    h1: { size: '38pt', weight: 700, lineHeight: 1.2, marginBottom: '20pt' },
    h2: { size: '28pt', weight: 600, lineHeight: 1.3, marginBottom: '16pt' },
    h3: { size: '22pt', weight: 600, lineHeight: 1.4, marginBottom: '14pt' },
    h4: { size: '18pt', weight: 600, lineHeight: 1.4, marginBottom: '12pt' },
    
    body: { size: '12pt', lineHeight: 1.9, marginBottom: '14pt' },
    small: { size: '11pt', lineHeight: 1.8 },
    caption: { size: '10pt', lineHeight: 1.7 },
  },
  
  spacing: {
    pagePadding: '28mm',
    sectionSpacing: '28pt',
    blockSpacing: '20pt',
    elementSpacing: '16pt',
    contentMaxWidth: '100%',
    columnGap: '20pt',
  },
  
  blocks: {
    borderRadius: '24px',
    shadow: '0 6px 20px rgba(212,165,116,0.15)',
    borderWidth: '2px',
  },
};
