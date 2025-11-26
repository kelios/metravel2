import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { View } from 'react-native';
import { DraggableBlock } from '@/components/export/constructor/DraggableBlock';
import type { PdfBlock, PdfTheme } from '@/src/types/pdf-constructor';

describe('DraggableBlock', () => {
  const baseBlock: PdfBlock = {
    id: 'block-1',
    type: 'paragraph',
    position: {
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      unit: 'mm',
    },
    styles: {},
    content: 'Test content',
  };

  const baseTheme: PdfTheme = {
    id: 'theme-1',
    name: 'Test theme',
    colors: {
      primary: '#000000',
      secondary: '#111111',
      text: '#000000',
      textSecondary: '#666666',
      background: '#ffffff',
      surface: '#ffffff',
      accent: '#ff9f5a',
      border: '#dddddd',
      tipBlock: {
        background: '#f0f8ff',
        border: '#c0e0ff',
        text: '#003366',
      },
      importantBlock: {
        background: '#fff4e5',
        border: '#ff9f5a',
        text: '#663300',
      },
      warningBlock: {
        background: '#ffe5e5',
        border: '#ff4d4f',
        text: '#660000',
      },
    },
    typography: {
      headingFont: 'System',
      bodyFont: 'System',
      headingSizes: {
        h1: 24,
        h2: 20,
        h3: 18,
      },
      bodySize: 14,
      lineHeight: 1.5,
    },
    spacing: {
      pagePadding: 16,
      blockSpacing: 12,
      elementSpacing: 8,
    },
    blocks: {
      borderRadius: 4,
      borderWidth: 1,
      shadow: 'none',
    },
  };

  const renderBlock = (override?: Partial<React.ComponentProps<typeof DraggableBlock>>) => {
    const onSelect = jest.fn();
    const onUpdate = jest.fn();
    const onDelete = jest.fn();

    const result = render(
      <DraggableBlock
        block={baseBlock}
        pageFormat="A4"
        theme={baseTheme}
        scale={1}
        isSelected={false}
        onSelect={onSelect}
        onUpdate={onUpdate}
        onDelete={onDelete}
        renderContent={(block) => <View testID="inner-view" />}
        {...override}
      />
    );

    return { ...result, onSelect, onUpdate, onDelete };
  };

  it('renders children and calls onSelect on click', () => {
    const { getByTestId, onSelect } = renderBlock();

    const wrapper = getByTestId('inner-view').parent as HTMLElement;
    fireEvent(wrapper, 'click', {
      stopPropagation: jest.fn(),
    } as any);
    expect(onSelect).toHaveBeenCalledWith('block-1');
  });

  it('calls onContextMenu on right click', () => {
    const onContextMenu = jest.fn();
    const { getByTestId } = renderBlock({ onContextMenu });

    const wrapper = getByTestId('inner-view').parent as HTMLElement;
    fireEvent(wrapper, 'contextMenu', {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      button: 2,
    } as any);

    expect(onContextMenu).toHaveBeenCalled();
  });

  it('supports updating isSelected prop without crashing', () => {
    const { rerender } = render(
      <DraggableBlock
        block={baseBlock}
        pageFormat="A4"
        theme={baseTheme}
        scale={1}
        isSelected={false}
        onSelect={jest.fn()}
        onUpdate={jest.fn()}
        onDelete={jest.fn()}
        renderContent={() => <View />}
      />
    );

    rerender(
      <DraggableBlock
        block={baseBlock}
        pageFormat="A4"
        theme={baseTheme}
        scale={1}
        isSelected
        onSelect={jest.fn()}
        onUpdate={jest.fn()}
        onDelete={jest.fn()}
        renderContent={() => <View />}
      />
    );
  });
});
