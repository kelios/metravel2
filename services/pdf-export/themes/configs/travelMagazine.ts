import type { PdfThemeConfig } from '../types'
import { translate as i18nT } from '@/i18n'

/**
 * Travel Magazine - журнальная вёрстка с яркими акцентами
 */
export const travelMagazineTheme: PdfThemeConfig = {
  name: 'travel-magazine',
  get displayName() { return i18nT('export:services.pdfExport.theme.travelMagazine.displayName') },
  get description() { return i18nT('export:services.pdfExport.theme.travelMagazine.description') },
  
  colors: {
    text: '#0a0a0a',
    textSecondary: '#3a3a3a',
    textMuted: '#6a6a6a',
    background: '#fafaf9',
    surface: '#ffffff',
    surfaceAlt: '#f5f5f4',
    
    accent: '#c98d72',
    accentStrong: '#a96f59',
    accentSoft: '#f2ded3',
    accentLight: '#faf1eb',
    
    border: '#e7e5e4',
    borderLight: '#f5f5f4',
    
    infoBlock: {
      background: '#dbeafe',
      border: '#93c5fd',
      text: '#1e40af',
      icon: '#3b82f6',
    },
    warningBlock: {
      background: '#fef3c7',
      border: '#fde047',
      text: '#854d0e',
      icon: '#eab308',
    },
    tipBlock: {
      background: '#d1fae5',
      border: '#6ee7b7',
      text: '#065f46',
      icon: '#10b981',
    },
    dangerBlock: {
      background: '#fee2e2',
      border: '#fca5a5',
      text: '#991b1b',
      icon: '#ef4444',
    },
    
    cover: {
      background: '#fafaf9',
      backgroundGradient: ['#cf9b86', '#9b786f'],
      text: '#ffffff',
      textSecondary: '#fed7aa',
    },
  },
  
  typography: {
    headingFont: "'Playfair Display', Georgia, serif",
    bodyFont: "'Open Sans', system-ui, sans-serif",
    monoFont: "'Courier New', monospace",
    
    h1: { size: '36pt', weight: 800, lineHeight: 1.1, marginBottom: '18pt' },
    h2: { size: '26pt', weight: 700, lineHeight: 1.2, marginBottom: '14pt' },
    h3: { size: '20pt', weight: 600, lineHeight: 1.3, marginBottom: '12pt' },
    h4: { size: '16pt', weight: 600, lineHeight: 1.4, marginBottom: '10pt' },
    
    body: { size: '12pt', lineHeight: 1.9, marginBottom: '14pt' },
    small: { size: '11pt', lineHeight: 1.7 },
    caption: { size: '10pt', lineHeight: 1.6 },
  },
  
  spacing: {
    pagePadding: '20mm',
    sectionSpacing: '28pt',
    blockSpacing: '18pt',
    elementSpacing: '14pt',
    contentMaxWidth: '100%',
    columnGap: '20pt',
  },
  
  blocks: {
    borderRadius: '4px',
    shadow: '0 8px 24px rgba(0,0,0,0.12)',
    borderWidth: '2px',
  },
};
