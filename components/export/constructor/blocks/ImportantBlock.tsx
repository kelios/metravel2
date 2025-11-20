// components/export/constructor/blocks/ImportantBlock.tsx
// ✅ АРХИТЕКТУРА: Компонент важного блока

import React from 'react';
import { Text } from 'react-native';
import type { PdfBlock, PdfTheme } from '@/src/types/pdf-constructor';

interface ImportantBlockProps {
  block: PdfBlock;
  theme: PdfTheme;
  scale: number;
}

export function ImportantBlock({ block, theme, scale }: ImportantBlockProps) {
  const importantColors = theme.colors.importantBlock || {
    background: '#eff6ff',
    border: '#3b82f6',
    text: '#1e40af',
  };

  const text = typeof block.content === 'string' ? block.content : '';
  const fontSize = (block.styles.fontSize || theme.typography.bodySize) * scale;
  const padding = 12 * scale;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: importantColors.background,
        border: `2px solid ${importantColors.border}`,
        borderRadius: (theme.blocks.borderRadius || 8) * scale,
        padding: padding,
        display: 'flex',
        alignItems: 'flex-start',
        boxSizing: 'border-box',
      }}
    >
      <span style={{ marginRight: 8 * scale, fontSize: 20 * scale, lineHeight: 1 }}>⚠️</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: Math.max(fontSize, 10),
            color: importantColors.text,
            lineHeight: (block.styles.lineHeight || theme.typography.lineHeight) * fontSize,
          }}
        >
          {text}
        </Text>
      </div>
    </div>
  );
}

