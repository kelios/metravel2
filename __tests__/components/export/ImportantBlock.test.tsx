import React from 'react';
import { render } from '@testing-library/react-native';
import { ImportantBlock } from '@/components/export/constructor/blocks/ImportantBlock';
import type { PdfBlock, PdfTheme } from '@/src/types/pdf-constructor';

const baseTheme = {
  colors: {
    importantBlock: {
      background: '#eff6ff',
      border: '#3b82f6',
      text: '#1e40af',
    },
  },
  typography: {
    bodySize: 12,
    lineHeight: 1.4,
  },
  blocks: {
    borderRadius: 8,
  },
} as PdfTheme;

const baseBlock = {
  id: '1',
  type: 'important',
  content: 'Важно: возьмите с собой паспорт',
  styles: {
    fontSize: 14,
    lineHeight: 1.5,
  },
} as PdfBlock;

describe('ImportantBlock', () => {
  it('renders text content from block', () => {
    const { getByText } = render(
      <ImportantBlock block={baseBlock} theme={baseTheme} scale={1} />,
    );

    expect(getByText('Важно: возьмите с собой паспорт')).toBeTruthy();
  });

  it('falls back to empty string when content is not string', () => {
    const block: PdfBlock = {
      ...baseBlock,
      content: { text: 'object-content' } as any,
    };

    const { queryByText } = render(
      <ImportantBlock block={block} theme={baseTheme} scale={1} />,
    );

    expect(queryByText('object-content')).toBeNull();
  });
});
