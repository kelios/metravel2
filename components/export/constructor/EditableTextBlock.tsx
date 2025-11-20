// components/export/constructor/EditableTextBlock.tsx
// ✅ АРХИТЕКТУРА: Компонент для inline редактирования текста

import React, { useState, useRef, useEffect } from 'react';
import { Text } from 'react-native';
import type { PdfBlock, PdfTheme } from '@/src/types/pdf-constructor';

interface EditableTextBlockProps {
  block: PdfBlock;
  theme: PdfTheme;
  scale: number;
  width: number;
  height: number;
  isEditing: boolean;
  onStartEdit: () => void;
  onEndEdit: (text: string) => void;
}

export function EditableTextBlock({
  block,
  theme,
  scale,
  width,
  height,
  isEditing,
  onStartEdit,
  onEndEdit,
}: EditableTextBlockProps) {
  const [text, setText] = useState(typeof block.content === 'string' ? block.content : '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    const currentText = typeof block.content === 'string' ? block.content : '';
    setText(currentText);
  }, [block.content]);

  const fontSize = (block.styles.fontSize || theme.typography.bodySize) * scale;
  const color = block.styles.color || theme.colors.text;
  const fontWeight = block.styles.fontWeight || 'normal';
  const textAlign = block.styles.textAlign || 'left';

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          onEndEdit(text);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onEndEdit(text);
          }
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            onEndEdit(text);
          }
          // Форматирование
          if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            // Примечание: Форматирование текста (жирный/курсив) будет реализовано в будущих версиях
            // См. issue #XXX для отслеживания прогресса
          }
          if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
            e.preventDefault();
            // Примечание: Форматирование текста (жирный/курсив) будет реализовано в будущих версиях
            // См. issue #XXX для отслеживания прогресса
          }
        }}
        style={{
          width: '100%',
          height: '100%',
          border: '2px solid #ff9f5a',
          padding: 4,
          fontSize: Math.max(fontSize, 12),
          fontFamily: block.styles.fontFamily || theme.typography.bodyFont,
          fontWeight,
          color,
          textAlign: textAlign as React.CSSProperties['textAlign'],
          backgroundColor: '#fff',
          resize: 'none',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    );
  }

  return (
    <div
      onDoubleClick={(e) => {
        e.stopPropagation();
        onStartEdit();
      }}
      onClick={(e) => {
        // Одиночный клик также может активировать редактирование, если блок пустой
        if (!text || text.trim() === '') {
          e.stopPropagation();
          onStartEdit();
        }
      }}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '24px', // Минимальная высота для удобного клика
        cursor: 'text',
        padding: '4px', // Увеличиваем область клика
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
      }}
      title="Двойной клик для редактирования"
    >
      <div style={{ textAlign: textAlign as React.CSSProperties['textAlign'], width: '100%' }}>
        <Text
          style={{
            fontSize: Math.max(fontSize, 10),
            color,
            fontWeight,
            fontFamily: block.styles.fontFamily || theme.typography.bodyFont,
          }}
          numberOfLines={Math.floor(height / (fontSize * 1.5))}
        >
          {text || 'Двойной клик для редактирования'}
        </Text>
      </div>
    </div>
  );
}

