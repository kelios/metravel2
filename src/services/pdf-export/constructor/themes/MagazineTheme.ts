// src/services/pdf-export/constructor/themes/MagazineTheme.ts
// ✅ АРХИТЕКТУРА: Журнальная тема

import type { PdfTheme } from '@/src/types/pdf-constructor';

export const MagazineTheme: PdfTheme = {
  id: 'magazine',
  name: 'Magazine',
  description: 'Стиль журнала с выразительной типографикой',
  colors: {
    primary: '#dc2626',
    secondary: '#7c2d12',
    text: '#1a202c',
    textSecondary: '#4b5563',
    background: '#ffffff',
    surface: '#fef2f2',
    accent: '#dc2626',
    border: '#fecaca',
    tipBlock: {
      background: '#f0fdf4',
      border: '#16a34a',
      text: '#166534',
    },
    importantBlock: {
      background: '#eff6ff',
      border: '#2563eb',
      text: '#1e40af',
    },
    warningBlock: {
      background: '#fef3c7',
      border: '#d97706',
      text: '#92400e',
    },
  },
  typography: {
    headingFont: 'Georgia, serif',
    bodyFont: 'Georgia, serif',
    headingSizes: {
      h1: 36,
      h2: 28,
      h3: 22,
    },
    bodySize: 13,
    lineHeight: 1.8,
  },
  spacing: {
    pagePadding: 25,
    blockSpacing: 20,
    elementSpacing: 10,
  },
  blocks: {
    borderRadius: 4,
    borderWidth: 2,
    shadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
};

