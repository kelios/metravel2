import type { PdfThemeConfig } from '../types'
import { translate as i18nT } from '@/i18n'

/**
 * Светлая тема - много воздуха и мягкие цвета
 */
export const lightTheme: PdfThemeConfig = {
  name: 'light',
  get displayName() { return i18nT('export:services.pdfExport.theme.light.displayName') },
  get description() { return i18nT('export:services.pdfExport.theme.light.description') },
  
  colors: {
    text: '#0f172a',
    textSecondary: '#334155',
    textMuted: '#64748b',
    background: '#ffffff',
    surface: '#f9fafb',
    surfaceAlt: '#f3f4f6',
    
    accent: '#7ea6c7',
    accentStrong: '#5f86a6',
    accentSoft: '#dde9f1',
    accentLight: '#f2f7fb',
    
    border: '#e5e7eb',
    borderLight: '#f3f4f6',
    
    infoBlock: {
      background: '#eff6ff',
      border: '#bfdbfe',
      text: '#1e40af',
      icon: '#3b82f6',
    },
    warningBlock: {
      background: '#fef3c7',
      border: '#fde68a',
      text: '#92400e',
      icon: '#f59e0b',
    },
    tipBlock: {
      background: '#d1fae5',
      border: '#a7f3d0',
      text: '#065f46',
      icon: '#10b981',
    },
    dangerBlock: {
      background: '#fee2e2',
      border: '#fecaca',
      text: '#991b1b',
      icon: '#ef4444',
    },
    
    cover: {
      background: '#f9fafb',
      backgroundGradient: ['#8baec7', '#6889a3'],
      text: '#ffffff',
      textSecondary: '#e0e7ff',
    },
  },
  
  typography: {
    headingFont: "'Inter', system-ui, -apple-system, sans-serif",
    bodyFont: "'Inter', system-ui, -apple-system, sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    
    h1: { size: '32pt', weight: 700, lineHeight: 1.2, marginBottom: '16pt' },
    h2: { size: '24pt', weight: 600, lineHeight: 1.3, marginBottom: '12pt' },
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
    borderRadius: '12px',
    shadow: '0 2px 8px rgba(0,0,0,0.05)',
    borderWidth: '1px',
  },
};
