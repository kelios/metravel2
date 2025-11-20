// src/services/pdf-export/constructor/themes/DarkTheme.ts
// ✅ АРХИТЕКТУРА: Темная тема

import type { PdfTheme } from '@/src/types/pdf-constructor';

export const DarkTheme: PdfTheme = {
  id: 'dark',
  name: 'Dark',
  description: 'Темная тема для комфортного чтения',
  colors: {
    primary: '#ff9f5a',
    secondary: '#9ca3af',
    text: '#f9fafb',
    textSecondary: '#d1d5db',
    background: '#1a202c',
    surface: '#2d3748',
    accent: '#ff9f5a',
    border: '#4a5568',
    tipBlock: {
      background: '#1e3a1e',
      border: '#22c55e',
      text: '#86efac',
    },
    importantBlock: {
      background: '#1e293b',
      border: '#3b82f6',
      text: '#93c5fd',
    },
    warningBlock: {
      background: '#3e2a0f',
      border: '#f59e0b',
      text: '#fcd34d',
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
    shadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
};

