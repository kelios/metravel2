// src/services/pdf-export/constructor/themes/TravelBookTheme.ts
// ✅ АРХИТЕКТУРА: Тема для travel book

import type { PdfTheme } from '@/src/types/pdf-constructor';

export const TravelBookTheme: PdfTheme = {
  id: 'travel-book',
  name: 'Travel Book',
  description: 'Тема для путеводителей и travel-блогов',
  colors: {
    primary: '#059669',
    secondary: '#047857',
    text: '#1f2937',
    textSecondary: '#6b7280',
    background: '#ffffff',
    surface: '#f0fdf4',
    accent: '#10b981',
    border: '#d1fae5',
    tipBlock: {
      background: '#ecfdf5',
      border: '#10b981',
      text: '#065f46',
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
      h1: 30,
      h2: 24,
      h3: 20,
    },
    bodySize: 14,
    lineHeight: 1.7,
  },
  spacing: {
    pagePadding: 20,
    blockSpacing: 18,
    elementSpacing: 10,
  },
  blocks: {
    borderRadius: 12,
    borderWidth: 1,
    shadow: '0 2px 10px rgba(5, 150, 105, 0.1)',
  },
};

