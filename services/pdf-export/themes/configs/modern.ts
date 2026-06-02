import type { PdfThemeConfig } from '../types'

/**
 * Modern - современная тема с геометрическими формами
 */
export const modernTheme: PdfThemeConfig = {
  name: 'modern',
  displayName: 'Современная',
  description: 'Геометрические формы, яркие градиенты',
  
  colors: {
    text: '#0f172a',
    textSecondary: '#334155',
    textMuted: '#64748b',
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceAlt: '#f1f5f9',
    
    accent: '#9d8fbd',
    accentStrong: '#7f729f',
    accentSoft: '#e6e0f0',
    accentLight: '#f6f3fa',
    
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    
    infoBlock: {
      background: '#e0e7ff',
      border: '#c7d2fe',
      text: '#3730a3',
      icon: '#6366f1',
    },
    warningBlock: {
      background: '#fef3c7',
      border: '#fde047',
      text: '#854d0e',
      icon: '#eab308',
    },
    tipBlock: {
      background: '#ccfbf1',
      border: '#99f6e4',
      text: '#134e4a',
      icon: '#14b8a6',
    },
    dangerBlock: {
      background: '#ffe4e6',
      border: '#fecdd3',
      text: '#881337',
      icon: '#f43f5e',
    },
    
    cover: {
      background: '#f8fafc',
      backgroundGradient: ['#a79abf', '#c8a8b8'],
      text: '#ffffff',
      textSecondary: '#ddd6fe',
    },
  },
  
  typography: {
    headingFont: "'Poppins', system-ui, -apple-system, sans-serif",
    bodyFont: "'Inter', system-ui, -apple-system, sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    
    h1: { size: '34pt', weight: 800, lineHeight: 1.1, marginBottom: '16pt' },
    h2: { size: '26pt', weight: 700, lineHeight: 1.2, marginBottom: '14pt' },
    h3: { size: '20pt', weight: 600, lineHeight: 1.3, marginBottom: '12pt' },
    h4: { size: '16pt', weight: 600, lineHeight: 1.4, marginBottom: '10pt' },
    
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
    borderRadius: '16px',
    shadow: '0 10px 30px rgba(139,92,246,0.15)',
    borderWidth: '2px',
  },
};
