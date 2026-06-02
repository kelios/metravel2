import type { PdfThemeConfig } from '../types'

/**
 * Adventure - приключенческая тема с динамичными акцентами
 */
export const adventureTheme: PdfThemeConfig = {
  name: 'adventure',
  displayName: 'Приключенческая',
  description: 'Насыщенные цвета, динамичная типографика',
  
  colors: {
    text: '#1a1a1a',
    textSecondary: '#3d3d3d',
    textMuted: '#6b6b6b',
    background: '#fafaf8',
    surface: '#ffffff',
    surfaceAlt: '#f5f5f3',
    
    accent: '#c88f74',
    accentStrong: '#a86f57',
    accentSoft: '#f2ddd2',
    accentLight: '#faf1eb',
    
    border: '#d9d9d7',
    borderLight: '#e8e8e6',
    
    infoBlock: {
      background: '#e1f5fe',
      border: '#b3e5fc',
      text: '#01579b',
      icon: '#0288d1',
    },
    warningBlock: {
      background: '#fff8e1',
      border: '#ffecb3',
      text: '#f57f17',
      icon: '#fbc02d',
    },
    tipBlock: {
      background: '#e8f5e9',
      border: '#c8e6c9',
      text: '#2e7d32',
      icon: '#66bb6a',
    },
    dangerBlock: {
      background: '#ffebee',
      border: '#ffcdd2',
      text: '#c62828',
      icon: '#ef5350',
    },
    
    cover: {
      background: '#fafaf8',
      backgroundGradient: ['#c69b84', '#70879c'],
      text: '#ffffff',
      textSecondary: '#ffb399',
    },
  },
  
  typography: {
    headingFont: "'Oswald', 'Impact', system-ui, sans-serif",
    bodyFont: "'Roboto', system-ui, -apple-system, sans-serif",
    monoFont: "'Courier New', monospace",
    
    h1: { size: '38pt', weight: 800, lineHeight: 1.1, marginBottom: '18pt' },
    h2: { size: '28pt', weight: 700, lineHeight: 1.2, marginBottom: '14pt' },
    h3: { size: '22pt', weight: 700, lineHeight: 1.3, marginBottom: '12pt' },
    h4: { size: '18pt', weight: 700, lineHeight: 1.4, marginBottom: '10pt' },
    
    body: { size: '12pt', lineHeight: 1.8, marginBottom: '12pt' },
    small: { size: '11pt', lineHeight: 1.7 },
    caption: { size: '10pt', lineHeight: 1.6 },
  },
  
  spacing: {
    pagePadding: '22mm',
    sectionSpacing: '24pt',
    blockSpacing: '16pt',
    elementSpacing: '12pt',
    contentMaxWidth: '100%',
    columnGap: '16pt',
  },
  
  blocks: {
    borderRadius: '8px',
    shadow: '0 6px 20px rgba(255,107,53,0.2)',
    borderWidth: '2px',
  },
};
