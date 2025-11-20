// components/export/constructor/blocks/ChecklistBlock.tsx
// ✅ АРХИТЕКТУРА: Компонент блока-чеклиста

import React from 'react';
import { Text } from 'react-native';
import type { PdfBlock, PdfTheme } from '@/src/types/pdf-constructor';

interface ChecklistBlockProps {
  block: PdfBlock;
  theme: PdfTheme;
  scale: number;
}

interface ChecklistItem {
  text: string;
  checked: boolean;
}

export function ChecklistBlock({ block, theme, scale }: ChecklistBlockProps) {
  const fontSize = (block.styles.fontSize || theme.typography.bodySize) * scale;
  const color = block.styles.color || theme.colors.text;
  const lineHeight = (block.styles.lineHeight || theme.typography.lineHeight) * fontSize;
  const padding = 8 * scale;

  // Парсим контент чеклиста
  let items: ChecklistItem[] = [];
  if (typeof block.content === 'object' && 'items' in block.content) {
    items = (block.content as any).items || [];
  } else if (typeof block.content === 'string') {
    // Парсим строку формата "✓ Текст" или "☐ Текст"
    const lines = block.content.split('\n').filter(line => line.trim());
    items = lines.map(line => ({
      text: line.replace(/^[✓☑☐✗✘]\s*/, '').trim(),
      checked: /^[✓☑]/.test(line.trim()),
    }));
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: padding,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        boxSizing: 'border-box',
      }}
    >
      {items.map((item, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            marginBottom: 4 * scale,
          }}
        >
          <span
            style={{
              marginRight: 8 * scale,
              fontSize: fontSize * 1.2,
              lineHeight: lineHeight,
              userSelect: 'none',
            }}
          >
            {item.checked ? '☑' : '☐'}
          </span>
          <Text
            style={{
              fontSize: Math.max(fontSize, 10),
              color,
              lineHeight: lineHeight,
              textDecoration: item.checked ? 'line-through' : 'none',
              opacity: item.checked ? 0.7 : 1,
            }}
          >
            {item.text}
          </Text>
        </div>
      ))}
      {items.length === 0 && (
        <Text style={{ fontSize: Math.max(fontSize, 10), color: '#999' }}>
          Добавьте элементы чеклиста
        </Text>
      )}
    </div>
  );
}

