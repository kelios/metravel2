import React from 'react';
import { render } from '@testing-library/react-native';
import { WarningBlock } from '@/components/export/constructor/blocks/WarningBlock';

// Простые smoke-тесты для WarningBlock, аналогично ImportantBlock

describe('WarningBlock', () => {
  const baseBlock = {
    id: '1',
    type: 'warning-block',
    content: 'Важно: проверьте сроки действия визы',
    styles: { fontSize: 14, lineHeight: 1.5 },
    position: { x: 0, y: 0, width: 100, height: 20, unit: 'percent' },
  } as any;

  const baseTheme = {
    colors: {
      warningBlock: {
        background: '#fef3c7',
        border: '#f59e0b',
        text: '#92400e',
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
    const { getByText } = render(<WarningBlock block={baseBlock} theme={baseTheme} scale={1} />);
    expect(getByText('Важно: проверьте сроки действия визы')).toBeTruthy();
  });

  it('handles non-string content gracefully', () => {
    const blockWithObjectContent = {
      ...baseBlock,
      content: { foo: 'bar' },
    } as any;

    const { queryByText } = render(<WarningBlock block={blockWithObjectContent} theme={baseTheme} scale={1} />);

    // В этом случае компонент приводит контент к пустой строке, поэтому исходного текста быть не должно
    expect(queryByText('Важно: проверьте сроки действия визы')).toBeNull();
  });
});
