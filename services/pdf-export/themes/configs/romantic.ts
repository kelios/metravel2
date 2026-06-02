import type { PdfThemeConfig } from '../types'

/**
 * Romantic - романтическая тема с пастельными цветами
 */
export const romanticTheme: PdfThemeConfig = {
  name: 'romantic',
  displayName: 'Романтическая',
  description: 'Пастельные цвета, мягкие формы',
  
  colors: {
    text: '#4a4a4a',
    textSecondary: '#6b6b6b',
    textMuted: '#9b9b9b',
    background: '#fef9f3',
    surface: '#ffffff',
    surfaceAlt: '#fdf5ed',
    
    accent: '#c995a9',
    accentStrong: '#a97288',
    accentSoft: '#f2dbe3',
    accentLight: '#fbf0f4',
    
    border: '#f3e5d8',
    borderLight: '#f9f0e7',
    
    infoBlock: {
      background: '#e3f2fd',
      border: '#bbdefb',
      text: '#1565c0',
      icon: '#42a5f5',
    },
    warningBlock: {
      background: '#fff3e0',
      border: '#ffe0b2',
      text: '#e65100',
      icon: '#ff9800',
    },
    tipBlock: {
      background: '#f1f8e9',
      border: '#dcedc8',
      text: '#558b2f',
      icon: '#8bc34a',
    },
    dangerBlock: {
      background: '#fce4ec',
      border: '#f8bbd0',
      text: '#880e4f',
      icon: '#e91e63',
    },
    
    cover: {
      background: '#fef9f3',
      backgroundGradient: ['#d7b0be', '#b98da0'],
      text: '#ffffff',
      textSecondary: '#fce4ec',
    },
  },
  
  typography: {
    headingFont: "'Cormorant Garamond', Georgia, serif",
    bodyFont: "'Lora', Georgia, serif",
    monoFont: "'Courier New', monospace",
    
    h1: { size: '36pt', weight: 600, lineHeight: 1.3, marginBottom: '18pt' },
    h2: { size: '28pt', weight: 500, lineHeight: 1.4, marginBottom: '14pt' },
    h3: { size: '22pt', weight: 500, lineHeight: 1.4, marginBottom: '12pt' },
    h4: { size: '18pt', weight: 500, lineHeight: 1.5, marginBottom: '10pt' },
    
    body: { size: '12pt', lineHeight: 2.0, marginBottom: '14pt' },
    small: { size: '11pt', lineHeight: 1.8 },
    caption: { size: '10pt', lineHeight: 1.7 },
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
    borderRadius: '20px',
    shadow: '0 4px 16px rgba(233,30,99,0.1)',
    borderWidth: '1px',
  },
};
