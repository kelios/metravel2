// src/services/pdf-export/constructor/themes/LightTheme.ts
// ✅ АРХИТЕКТУРА: Светлая тема

import type { PdfTheme } from '@/src/types/pdf-constructor';

export const LightTheme: PdfTheme = {
  id: 'light',
  name: 'Light',
  description: 'Светлая тема с мягкими цветами',
  colors: {
    primary: '#ff9f5a',
    secondary: '#6b7280',
    text: '#1a202c',
    textSecondary: '#6b7280',
    background: '#ffffff',
    surface: '#f9fafb',
    accent: '#ff9f5a',
    border: '#e5e7eb',
    tipBlock: {
      background: '#f0fdf4',
      border: '#22c55e',
      text: '#166534',
    },
    importantBlock: {
      background: '#eff6ff',
      border: '#3b82f6',
      text: '#1e40af',
    },
    warningBlock: {
      background: '#fef3c7',
      border: '#f59e0b',
      text: '#92400e',
    },
  },
  typography: {
    headingFont: 'Inter, system-ui, sans-serif',
    bodyFont: 'Inter, system-ui, sans-serif',
    headingSizes: {
      h1: 32,
      h2: 24,
      h3: 20,
    },
    bodySize: 14,
    lineHeight: 1.6,
  },
  spacing: {
    pagePadding: 20,
    blockSpacing: 16,
    elementSpacing: 8,
  },
  blocks: {
    borderRadius: 8,
    borderWidth: 1,
    shadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
};

