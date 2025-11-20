// components/export/constructor/blocks/TipBlock.tsx
// ✅ АРХИТЕКТУРА: Компонент блока-совета

import React from 'react';
import { Text } from 'react-native';
import type { PdfBlock, PdfTheme } from '@/src/types/pdf-constructor';

interface TipBlockProps {
  block: PdfBlock;
  theme: PdfTheme;
  scale: number;
}

export function TipBlock({ block, theme, scale }: TipBlockProps) {
  const tipColors = theme.colors.tipBlock || {
    background: '#f0fdf4',
    border: '#22c55e',
    text: '#166534',
  };

  const text = typeof block.content === 'string' ? block.content : '';
  const fontSize = (block.styles.fontSize || theme.typography.bodySize) * scale;
  const padding = 12 * scale;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: tipColors.background,
        border: `2px solid ${tipColors.border}`,
        borderRadius: (theme.blocks.borderRadius || 8) * scale,
        padding: padding,
        display: 'flex',
        alignItems: 'flex-start',
        boxSizing: 'border-box',
      }}
    >
      <span style={{ marginRight: 8 * scale, fontSize: 20 * scale, lineHeight: 1 }}>💡</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: Math.max(fontSize, 10),
            color: tipColors.text,
            lineHeight: (block.styles.lineHeight || theme.typography.lineHeight) * fontSize,
          }}
        >
          {text}
        </Text>
      </div>
    </div>
  );
}

