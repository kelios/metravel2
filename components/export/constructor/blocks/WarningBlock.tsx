// components/export/constructor/blocks/WarningBlock.tsx
// ✅ АРХИТЕКТУРА: Компонент блока-предупреждения

import React from 'react';
import { Text } from 'react-native';
import type { PdfBlock, PdfTheme } from '@/src/types/pdf-constructor';

interface WarningBlockProps {
  block: PdfBlock;
  theme: PdfTheme;
  scale: number;
}

export function WarningBlock({ block, theme, scale }: WarningBlockProps) {
  const warningColors = theme.colors.warningBlock || {
    background: '#fef3c7',
    border: '#f59e0b',
    text: '#92400e',
  };

  const text = typeof block.content === 'string' ? block.content : '';
  const fontSize = (block.styles.fontSize || theme.typography.bodySize) * scale;
  const padding = 12 * scale;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: warningColors.background,
        border: `2px solid ${warningColors.border}`,
        borderRadius: (theme.blocks.borderRadius || 8) * scale,
        padding: padding,
        display: 'flex',
        alignItems: 'flex-start',
        boxSizing: 'border-box',
      }}
    >
      <span style={{ marginRight: 8 * scale, fontSize: 20 * scale, lineHeight: 1 }}>🚨</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: Math.max(fontSize, 10),
            color: warningColors.text,
            lineHeight: (block.styles.lineHeight || theme.typography.lineHeight) * fontSize,
          }}
        >
          {text}
        </Text>
      </div>
    </div>
  );
}

