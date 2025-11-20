// src/services/pdf-export/constructor/themes/SimpleTheme.ts
// ✅ АРХИТЕКТУРА: Простая тема

import type { PdfTheme } from '@/src/types/pdf-constructor';

export const SimpleTheme: PdfTheme = {
  id: 'simple',
  name: 'Simple',
  description: 'Минималистичная тема с чистым дизайном',
  colors: {
    primary: '#000000',
    secondary: '#666666',
    text: '#000000',
    textSecondary: '#666666',
    background: '#ffffff',
    surface: '#ffffff',
    accent: '#000000',
    border: '#e0e0e0',
    tipBlock: {
      background: '#f5f5f5',
      border: '#cccccc',
      text: '#333333',
    },
    importantBlock: {
      background: '#f5f5f5',
      border: '#cccccc',
      text: '#333333',
    },
    warningBlock: {
      background: '#f5f5f5',
      border: '#cccccc',
      text: '#333333',
    },
  },
  typography: {
    headingFont: 'Arial, sans-serif',
    bodyFont: 'Arial, sans-serif',
    headingSizes: {
      h1: 28,
      h2: 22,
      h3: 18,
    },
    bodySize: 12,
    lineHeight: 1.5,
  },
  spacing: {
    pagePadding: 20,
    blockSpacing: 12,
    elementSpacing: 8,
  },
  blocks: {
    borderRadius: 0,
    borderWidth: 1,
    shadow: 'none',
  },
};

