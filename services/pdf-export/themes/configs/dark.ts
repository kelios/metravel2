import type { PdfThemeConfig } from '../types'
import { translate as i18nT } from '@/i18n'

/**
 * Темная тема - элегантное темное оформление
 */
export const darkTheme: PdfThemeConfig = {
  name: 'dark',
  get displayName() { return i18nT('export:services.pdfExport.theme.dark.displayName') },
  get description() { return i18nT('export:services.pdfExport.theme.dark.description') },
  
  colors: {
    text: '#f9fafb',
    textSecondary: '#d1d5db',
    textMuted: '#9ca3af',
    background: '#111827',
    surface: '#1f2937',
    surfaceAlt: '#374151',
    
    accent: '#d2b48c',
    accentStrong: '#b08f67',
    accentSoft: '#3f372f',
    accentLight: '#2b2622',
    
    border: '#374151',
    borderLight: '#4b5563',
    
    infoBlock: {
      background: '#1e3a8a',
      border: '#1e40af',
      text: '#bfdbfe',
      icon: '#60a5fa',
    },
    warningBlock: {
      background: '#78350f',
      border: '#92400e',
      text: '#fde68a',
      icon: '#fbbf24',
    },
    tipBlock: {
      background: '#064e3b',
      border: '#065f46',
      text: '#a7f3d0',
      icon: '#34d399',
    },
    dangerBlock: {
      background: '#7f1d1d',
      border: '#991b1b',
      text: '#fecaca',
      icon: '#f87171',
    },
    
    cover: {
      background: '#111827',
      backgroundGradient: ['#2d3748', '#4a5568'],
      text: '#f9fafb',
      textSecondary: '#d1d5db',
    },
  },
  
  typography: {
    headingFont: "'Montserrat', system-ui, sans-serif",
    bodyFont: "'Open Sans', system-ui, sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    
    h1: { size: '32pt', weight: 800, lineHeight: 1.2, marginBottom: '16pt' },
    h2: { size: '24pt', weight: 700, lineHeight: 1.3, marginBottom: '12pt' },
    h3: { size: '18pt', weight: 600, lineHeight: 1.4, marginBottom: '10pt' },
    h4: { size: '14pt', weight: 600, lineHeight: 1.4, marginBottom: '8pt' },
    
    body: { size: '12pt', lineHeight: 1.8, marginBottom: '12pt' },
    small: { size: '11pt', lineHeight: 1.7 },
    caption: { size: '10pt', lineHeight: 1.6 },
  },
  
  spacing: {
    pagePadding: '25mm',
    sectionSpacing: '24pt',
    blockSpacing: '16pt',
    elementSpacing: '12pt',
    contentMaxWidth: '100%',
    columnGap: '16pt',
  },
  
  blocks: {
    borderRadius: '8px',
    shadow: '0 4px 16px rgba(0,0,0,0.3)',
    borderWidth: '1px',
  },
};
