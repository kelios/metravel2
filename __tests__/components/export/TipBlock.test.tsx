import React from 'react';
import { render } from '@testing-library/react-native';
import { TipBlock } from '@/components/export/constructor/blocks/TipBlock';

// Простые smoke-тесты для TipBlock, аналогично ImportantBlock

describe('TipBlock', () => {
  const baseBlock = {
    id: '1',
    type: 'tip-block',
    content: 'Совет: не забудьте зарядку',
    styles: { fontSize: 14, lineHeight: 1.5 },
    position: { x: 0, y: 0, width: 100, height: 20, unit: 'percent' },
  } as any;

  const baseTheme = {
    colors: {
      tipBlock: {
        background: '#f0fdf4',
        border: '#22c55e',
        text: '#166534',
      },
      background: '#ffffff',
      text: '#000000',
    },
    typography: {
      bodySize: 12,
      lineHeight: 1.4,
    },
    blocks: {
      borderRadius: 8,
    },
  } as any;

  it('renders text content from block', () => {
    const { getByText } = render(<TipBlock block={baseBlock} theme={baseTheme} scale={1} />);
    expect(getByText('Совет: не забудьте зарядку')).toBeTruthy();
  });

  it('handles non-string content gracefully', () => {
    const blockWithObjectContent = {
      ...baseBlock,
      content: { foo: 'bar' },
    } as any;

    const { queryByText } = render(<TipBlock block={blockWithObjectContent} theme={baseTheme} scale={1} />);

    // В этом случае компонент приводит контент к пустой строке, поэтому исходного текста быть не должно
    expect(queryByText('Совет: не забудьте зарядку')).toBeNull();
  });
});
