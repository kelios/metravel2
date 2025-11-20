// components/export/constructor/BlockPalette.tsx
// ✅ АРХИТЕКТУРА: Палитра блоков для добавления в конструктор

import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import type { BlockType } from '@/src/types/pdf-constructor';

interface BlockPaletteProps {
  onSelectBlock: (type: BlockType) => void;
  onClose: () => void;
}

const BLOCK_TYPES: Array<{ type: BlockType; label: string; icon: string; description: string }> = [
  { type: 'heading-h1', label: 'Заголовок H1', icon: 'H1', description: 'Главный заголовок' },
  { type: 'heading-h2', label: 'Заголовок H2', icon: 'H2', description: 'Подзаголовок' },
  { type: 'heading-h3', label: 'Заголовок H3', icon: 'H3', description: 'Малый заголовок' },
  { type: 'paragraph', label: 'Абзац', icon: '¶', description: 'Текстовый блок' },
  { type: 'image', label: 'Фото', icon: '🖼️', description: 'Одно изображение' },
  { type: 'image-with-caption', label: 'Фото с подписью', icon: '📷', description: 'Изображение с текстом' },
  { type: 'image-gallery', label: 'Галерея', icon: '🖼️🖼️', description: 'Несколько фото' },
  { type: 'map', label: 'Карта', icon: '🗺️', description: 'Карта маршрута' },
  { type: 'tip-block', label: 'Совет', icon: '💡', description: 'Блок с советом' },
  { type: 'important-block', label: 'Важно', icon: '⚠️', description: 'Важная информация' },
  { type: 'warning-block', label: 'Предупреждение', icon: '🚨', description: 'Предупреждение' },
  { type: 'quote', label: 'Цитата', icon: '💬', description: 'Цитата или отзыв' },
  { type: 'checklist', label: 'Чек-лист', icon: '☑️', description: 'Список задач' },
  { type: 'table', label: 'Таблица', icon: '📊', description: 'Таблица данных' },
  { type: 'divider', label: 'Разделитель', icon: '─', description: 'Горизонтальная линия' },
  { type: 'spacer', label: 'Отступ', icon: '⬜', description: 'Пустое пространство' },
  { type: 'cover', label: 'Обложка', icon: '📕', description: 'Титульная страница' },
  { type: 'toc', label: 'Оглавление', icon: '📑', description: 'Содержание' },
  { type: 'author-block', label: 'Об авторе', icon: '👤', description: 'Информация об авторе' },
  { type: 'recommendations-block', label: 'Рекомендации', icon: '⭐', description: 'Рекомендации' },
];

export function BlockPalette({ onSelectBlock, onClose }: BlockPaletteProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 12,
          padding: 24,
          maxWidth: 800,
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Добавить блок</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>×</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.grid}>
          <div style={styles.gridContainer}>
            {BLOCK_TYPES.map((block) => (
              <Pressable
                key={block.type}
                onPress={() => onSelectBlock(block.type)}
                style={styles.blockCard}
              >
                <Text style={styles.blockIcon}>{block.icon}</Text>
                <Text style={styles.blockLabel}>{block.label}</Text>
                <Text style={styles.blockDescription}>{block.description}</Text>
              </Pressable>
            ))}
          </div>
        </ScrollView>
      </div>
    </div>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a202c',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#6b7280',
  },
  grid: {
    flex: 1,
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: 12,
  },
  blockCard: {
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  blockIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  blockLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 4,
    textAlign: 'center',
  },
  blockDescription: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
});

