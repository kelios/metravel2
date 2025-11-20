// components/export/constructor/blocks/TableBlock.tsx
// ✅ АРХИТЕКТУРА: Компонент блока-таблицы

import React from 'react';
import { Text } from 'react-native';
import type { PdfBlock, PdfTheme } from '@/src/types/pdf-constructor';

interface TableBlockProps {
  block: PdfBlock;
  theme: PdfTheme;
  scale: number;
}

interface TableContent {
  headers?: string[];
  rows: string[][];
  borders?: {
    width: number;
    color: string;
  };
}

export function TableBlock({ block, theme, scale }: TableBlockProps) {
  const fontSize = (block.styles.fontSize || theme.typography.bodySize) * scale;
  const color = block.styles.color || theme.colors.text;
  const borderColor = theme.colors.border || '#e5e7eb';
  const borderWidth = 1 * scale;

  // Парсим контент таблицы
  let tableData: TableContent = { rows: [] };
  if (typeof block.content === 'object' && 'rows' in block.content) {
    tableData = block.content as TableContent;
  } else {
    // Создаем пустую таблицу
    tableData = { rows: [['', ''], ['', '']] };
  }

  const headers = tableData.headers || [];
  const rows = tableData.rows || [];
  const borders = tableData.borders || { width: 1, color: borderColor };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        boxSizing: 'border-box',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: Math.max(fontSize, 10),
        }}
      >
        {headers.length > 0 && (
          <thead>
            <tr>
              {headers.map((header, index) => (
                <th
                  key={index}
                  style={{
                    border: `${borders.width * scale}px solid ${borders.color}`,
                    padding: 8 * scale,
                    backgroundColor: theme.colors.surface || '#f9fafb',
                    color,
                    fontWeight: 'bold',
                    textAlign: 'left',
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  style={{
                    border: `${borders.width * scale}px solid ${borders.color}`,
                    padding: 8 * scale,
                    color,
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div style={{ padding: 16 * scale, textAlign: 'center', color: '#999' }}>
          <Text style={{ fontSize: Math.max(fontSize, 10) }}>Пустая таблица</Text>
        </div>
      )}
    </div>
  );
}

