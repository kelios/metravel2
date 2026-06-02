import type { PdfThemeConfig } from '../types'

/**
 * Classic - классическая тема с традиционной типографикой
 */
export const classicTheme: PdfThemeConfig = {
  name: 'classic',
  displayName: 'Классическая',
  description: 'Традиционная типографика, сдержанные цвета',
  
  colors: {
    text: '#1a1a1a',
    textSecondary: '#4a4a4a',
    textMuted: '#737373',
    background: '#fdfcfb',
    surface: '#ffffff',
    surfaceAlt: '#f7f6f5',
    
    accent: '#8b4513',
    accentStrong: '#6b3410',
    accentSoft: '#d4a574',
    accentLight: '#f5e6d3',
    
    border: '#d4d4d4',
    borderLight: '#e5e5e5',
    
    infoBlock: {
      background: '#e8f4f8',
      border: '#b8dce8',
      text: '#1e5a6e',
      icon: '#4a90a4',
    },
    warningBlock: {
      background: '#fef5e7',
      border: '#f9e79f',
      text: '#7d6608',
      icon: '#d4ac0d',
    },
    tipBlock: {
      background: '#e8f8f5',
      border: '#a9dfbf',
      text: '#145a32',
      icon: '#27ae60',
    },
    dangerBlock: {
      background: '#fadbd8',
      border: '#f1948a',
      text: '#78281f',
      icon: '#cb4335',
    },
    
    cover: {
      background: '#fdfcfb',
      backgroundGradient: ['#5d4e37', '#3e2f1f'],
      text: '#fdfcfb',
      textSecondary: '#d4a574',
    },
  },
  
  typography: {
    headingFont: "'Crimson Text', Georgia, 'Times New Roman', serif",
    bodyFont: "'Crimson Text', Georgia, 'Times New Roman', serif",
    monoFont: "'Courier New', monospace",
    
    h1: { size: '34pt', weight: 700, lineHeight: 1.3, marginBottom: '18pt' },
    h2: { size: '26pt', weight: 600, lineHeight: 1.4, marginBottom: '14pt' },
    h3: { size: '20pt', weight: 600, lineHeight: 1.4, marginBottom: '12pt' },
    h4: { size: '16pt', weight: 600, lineHeight: 1.5, marginBottom: '10pt' },
    
    body: { size: '12pt', lineHeight: 1.9, marginBottom: '14pt' },
    small: { size: '11pt', lineHeight: 1.8 },
    caption: { size: '10pt', lineHeight: 1.7 },
  },
  
  spacing: {
    pagePadding: '30mm',
    sectionSpacing: '26pt',
    blockSpacing: '18pt',
    elementSpacing: '14pt',
    contentMaxWidth: '100%',
    columnGap: '18pt',
  },
  
  blocks: {
    borderRadius: '4px',
    shadow: '0 2px 6px rgba(0,0,0,0.08)',
    borderWidth: '1px',
  },
};
