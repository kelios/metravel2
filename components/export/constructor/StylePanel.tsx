// components/export/constructor/StylePanel.tsx
// ✅ АРХИТЕКТУРА: Панель стилей для редактирования блока

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import type { PdfBlock, PdfTheme } from '@/src/types/pdf-constructor';

interface StylePanelProps {
  block: PdfBlock;
  theme: PdfTheme;
  onUpdate: (updates: Partial<PdfBlock>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function StylePanel({ block, theme, onUpdate, onDelete, onClose }: StylePanelProps) {
  const [localStyles, setLocalStyles] = useState(block.styles);
  const [localContent, setLocalContent] = useState(block.content);

  const handleUpdate = () => {
    onUpdate({
      styles: localStyles,
      content: localContent,
    });
  };

  return (
    <div
      style={{
        width: 320,
        backgroundColor: '#fff',
        borderLeft: '1px solid #e0e0e0',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
      }}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Стили блока</Text>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>×</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.content}>
        {/* Редактирование контента */}
        {typeof block.content === 'string' && (
          <View style={styles.section}>
            <Text style={styles.label}>Текст</Text>
            <textarea
              value={localContent as string}
              onChange={(e) => setLocalContent(e.target.value)}
              onBlur={handleUpdate}
              style={{
                width: '100%',
                minHeight: 100,
                padding: 8,
                border: '1px solid #e0e0e0',
                borderRadius: 4,
                fontSize: 14,
                fontFamily: 'inherit',
              }}
            />
          </View>
        )}

        {/* Размер шрифта */}
        <View style={styles.section}>
          <Text style={styles.label}>Размер шрифта</Text>
          <input
            type="number"
            value={localStyles.fontSize || theme.typography.bodySize}
            onChange={(e) => {
              setLocalStyles({ ...localStyles, fontSize: parseFloat(e.target.value) });
            }}
            onBlur={handleUpdate}
            style={styles.input}
          />
        </View>

        {/* Цвет текста */}
        <View style={styles.section}>
          <Text style={styles.label}>Цвет текста</Text>
          <input
            type="color"
            value={localStyles.color || theme.colors.text}
            onChange={(e) => {
              setLocalStyles({ ...localStyles, color: e.target.value });
            }}
            onBlur={handleUpdate}
            style={styles.colorInput}
          />
        </View>

        {/* Выравнивание */}
        <View style={styles.section}>
          <Text style={styles.label}>Выравнивание</Text>
          <div style={styles.buttonGroup}>
            {(['left', 'center', 'right', 'justify'] as const).map((align) => (
              <Pressable
                key={align}
                onPress={() => {
                  setLocalStyles({ ...localStyles, textAlign: align });
                  handleUpdate();
                }}
                style={{
                  ...styles.alignButton,
                  ...(localStyles.textAlign === align ? styles.alignButtonActive : {}),
                } as any}
              >
                <Text style={styles.alignButtonText}>
                  {align === 'left' ? '←' : align === 'center' ? '↔' : align === 'right' ? '→' : '═'}
                </Text>
              </Pressable>
            ))}
          </div>
        </View>

        {/* Фон */}
        <View style={styles.section}>
          <Text style={styles.label}>Цвет фона</Text>
          <input
            type="color"
            value={localStyles.backgroundColor || '#ffffff'}
            onChange={(e) => {
              setLocalStyles({ ...localStyles, backgroundColor: e.target.value });
            }}
            onBlur={handleUpdate}
            style={styles.colorInput}
          />
        </View>

        {/* Отступы */}
        <View style={styles.section}>
          <Text style={styles.label}>Отступы</Text>
          <div style={styles.paddingGrid}>
            <input
              type="number"
              placeholder="Верх"
              value={localStyles.padding?.top || 0}
              onChange={(e) => {
                setLocalStyles({
                  ...localStyles,
                  padding: { ...localStyles.padding, top: parseFloat(e.target.value) || 0 },
                });
              }}
              onBlur={handleUpdate}
              style={styles.paddingInput}
            />
            <input
              type="number"
              placeholder="Право"
              value={localStyles.padding?.right || 0}
              onChange={(e) => {
                setLocalStyles({
                  ...localStyles,
                  padding: { ...localStyles.padding, right: parseFloat(e.target.value) || 0 },
                });
              }}
              onBlur={handleUpdate}
              style={styles.paddingInput}
            />
            <input
              type="number"
              placeholder="Низ"
              value={localStyles.padding?.bottom || 0}
              onChange={(e) => {
                setLocalStyles({
                  ...localStyles,
                  padding: { ...localStyles.padding, bottom: parseFloat(e.target.value) || 0 },
                });
              }}
              onBlur={handleUpdate}
              style={styles.paddingInput}
            />
            <input
              type="number"
              placeholder="Лево"
              value={localStyles.padding?.left || 0}
              onChange={(e) => {
                setLocalStyles({
                  ...localStyles,
                  padding: { ...localStyles.padding, left: parseFloat(e.target.value) || 0 },
                });
              }}
              onBlur={handleUpdate}
              style={styles.paddingInput}
            />
          </div>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={onDelete} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>Удалить</Text>
        </Pressable>
      </View>
    </div>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a202c',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#6b7280',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    padding: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    fontSize: 14,
  },
  colorInput: {
    width: '100%',
    height: 40,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    cursor: 'pointer',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  alignButton: {
    flex: 1,
    padding: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    alignItems: 'center',
  },
  alignButtonActive: {
    backgroundColor: '#ff9f5a',
  },
  alignButtonText: {
    fontSize: 16,
  },
  paddingGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  paddingInput: {
    padding: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    fontSize: 14,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  deleteButton: {
    padding: 12,
    backgroundColor: '#ef4444',
    borderRadius: 6,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

