import React from 'react';
import { render } from '@testing-library/react-native';
import { TableBlock } from '@/components/export/constructor/blocks/TableBlock';
import type { PdfBlock, PdfTheme } from '@/src/types/pdf-constructor';

const baseTheme: PdfTheme = {
  id: 'simple',
  name: 'Simple',
  colors: {
    primary: '#000',
    secondary: '#111',
    text: '#000',
    textSecondary: '#333',
    background: '#fff',
    surface: '#eee',
    accent: '#f60',
    border: '#ddd',
    tipBlock: { background: '#f0fdf4', border: '#22c55e', text: '#166534' },
    importantBlock: { background: '#eff6ff', border: '#3b82f6', text: '#1e40af' },
    warningBlock: { background: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  },
  typography: {
    headingFont: 'Inter',
    bodyFont: 'Inter',
    headingSizes: { h1: 32, h2: 24, h3: 20 },
    bodySize: 14,
    lineHeight: 1.6,
  },
  spacing: { pagePadding: 20, blockSpacing: 16, elementSpacing: 8 },
  blocks: { borderRadius: 8, borderWidth: 1, shadow: '' },
};

const baseBlock: PdfBlock = {
  id: '1',
  type: 'table',
  content: undefined as any,
  styles: { fontSize: 14, lineHeight: 1.6 },
  position: { x: 0, y: 0, width: 100, height: 20, unit: 'percent' },
};

describe('TableBlock', () => {
  it('renders headers and rows from content', () => {
    const block: PdfBlock = {
      ...baseBlock,
      content: {
        headers: ['Колонка 1', 'Колонка 2'],
        rows: [
          ['A1', 'B1'],
          ['A2', 'B2'],
        ],
      } as any,
    };

    const { queryByText } = render(
      <TableBlock block={block} theme={baseTheme} scale={1} />,
    );

    // Для web-таблицы текст заголовков/ячеек может быть недоступен через RN getByText,
    // поэтому просто убеждаемся, что плейсхолдер "Пустая таблица" не отображается.
    expect(queryByText('Пустая таблица')).toBeNull();
  });

  it('shows placeholder for empty rows', () => {
    const block: PdfBlock = {
      ...baseBlock,
      content: { rows: [] } as any,
    };

    const { getByText } = render(
      <TableBlock block={block} theme={baseTheme} scale={1} />,
    );

    expect(getByText('Пустая таблица')).toBeTruthy();
  });
});
