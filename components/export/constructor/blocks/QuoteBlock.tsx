// components/export/constructor/blocks/QuoteBlock.tsx
// ✅ АРХИТЕКТУРА: Компонент блока-цитаты

import React from 'react';
import { Text } from 'react-native';
import type { PdfBlock, PdfTheme } from '@/src/types/pdf-constructor';

interface QuoteBlockProps {
  block: PdfBlock;
  theme: PdfTheme;
  scale: number;
}

export function QuoteBlock({ block, theme, scale }: QuoteBlockProps) {
  const text = typeof block.content === 'string' ? block.content : '';
  const fontSize = (block.styles.fontSize || theme.typography.bodySize) * scale;
  const color = block.styles.color || theme.colors.textSecondary || '#6b7280';
  const textAlign = block.styles.textAlign || 'left';
  const padding = 16 * scale;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: padding,
        borderLeft: `4px solid ${theme.colors.border || '#e5e7eb'}`,
        backgroundColor: block.styles.backgroundColor || 'transparent',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        boxSizing: 'border-box',
        fontStyle: 'italic',
      }}
    >
      <div style={{ fontSize: 32 * scale, color, opacity: 0.3, lineHeight: 1, marginBottom: 4 * scale }}>
        "
      </div>
      <div style={{ textAlign: textAlign as React.CSSProperties['textAlign'] }}>
        <Text
          style={{
            fontSize: Math.max(fontSize, 10),
            color,
            fontStyle: 'italic',
            lineHeight: (block.styles.lineHeight || theme.typography.lineHeight) * fontSize,
          }}
        >
          {text}
        </Text>
      </div>
      <div style={{ fontSize: 32 * scale, color, opacity: 0.3, lineHeight: 1, marginTop: 4 * scale, textAlign: 'right' }}>
        "
      </div>
    </div>
  );
}

