import React from 'react';
import { render } from '@testing-library/react-native';
import { ChecklistBlock } from '@/components/export/constructor/blocks/ChecklistBlock';
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
  type: 'checklist',
  content: '',
  styles: { fontSize: 14, lineHeight: 1.6 },
  position: { x: 0, y: 0, width: 100, height: 20, unit: 'percent' },
};

describe('ChecklistBlock', () => {
  it('renders items from structured content', () => {
    const block: PdfBlock = {
      ...baseBlock,
      content: {
        items: [
          { text: 'Пункт 1', checked: true },
          { text: 'Пункт 2', checked: false },
        ],
      } as any,
    };

    const { getByText } = render(
      <ChecklistBlock block={block} theme={baseTheme} scale={1} />,
    );

    expect(getByText('Пункт 1')).toBeTruthy();
    expect(getByText('Пункт 2')).toBeTruthy();
  });

  it('parses string content into checklist items', () => {
    const block: PdfBlock = {
      ...baseBlock,
      content: '☑ Выполнено\n☐ Не выполнено',
    };

    const { getByText, queryByText } = render(
      <ChecklistBlock block={block} theme={baseTheme} scale={1} />,
    );

    expect(getByText('Выполнено')).toBeTruthy();
    expect(getByText('Не выполнено')).toBeTruthy();
    expect(queryByText('Добавьте элементы чеклиста')).toBeNull();
  });

  it('shows placeholder when no items', () => {
    const { getByText } = render(
      <ChecklistBlock block={baseBlock} theme={baseTheme} scale={1} />,
    );

    expect(getByText('Добавьте элементы чеклиста')).toBeTruthy();
  });
});
