import React from 'react';
import { render } from '@testing-library/react-native';
import { QuoteBlock } from '@/components/export/constructor/blocks/QuoteBlock';
import type { PdfBlock, PdfTheme } from '@/src/types/pdf-constructor';

const baseTheme: PdfTheme = {
  id: 'simple',
  name: 'Simple',
  colors: {
    primary: '#000',
    secondary: '#111',
    text: '#000',
    textSecondary: '#666',
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
  type: 'quote',
  content: 'Путешествия расширяют кругозор',
  styles: { fontSize: 14, lineHeight: 1.6 },
  position: { x: 0, y: 0, width: 100, height: 20, unit: 'percent' },
};

describe('QuoteBlock', () => {
  it('renders quote text', () => {
    const { getByText } = render(
      <QuoteBlock block={baseBlock} theme={baseTheme} scale={1} />,
    );

    expect(getByText('Путешествия расширяют кругозор')).toBeTruthy();
  });

  it('handles non-string content by rendering empty text', () => {
    const block: PdfBlock = {
      ...baseBlock,
      content: { value: 'object' } as any,
    };

    const { queryByText } = render(
      <QuoteBlock block={block} theme={baseTheme} scale={1} />,
    );

    expect(queryByText('object')).toBeNull();
  });
});
