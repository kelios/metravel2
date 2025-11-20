// components/export/constructor/BlockPaletteImproved.tsx
// ✅ АРХИТЕКТУРА: Улучшенная палитра блоков с категориями и поиском

import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import type { BlockType } from '@/src/types/pdf-constructor';

interface BlockPaletteProps {
  onSelectBlock: (type: BlockType) => void;
  onClose: () => void;
}

interface BlockDefinition {
  type: BlockType;
  label: string;
  icon: string;
  description: string;
  category: 'text' | 'media' | 'layout' | 'special';
  keywords: string[];
}

const BLOCK_TYPES: BlockDefinition[] = [
  // Текстовые блоки
  { type: 'heading-h1', label: 'Заголовок H1', icon: 'H1', description: 'Главный заголовок', category: 'text', keywords: ['заголовок', 'h1', 'title'] },
  { type: 'heading-h2', label: 'Заголовок H2', icon: 'H2', description: 'Подзаголовок', category: 'text', keywords: ['заголовок', 'h2', 'subtitle'] },
  { type: 'heading-h3', label: 'Заголовок H3', icon: 'H3', description: 'Малый заголовок', category: 'text', keywords: ['заголовок', 'h3'] },
  { type: 'paragraph', label: 'Абзац', icon: '¶', description: 'Текстовый блок', category: 'text', keywords: ['текст', 'абзац', 'paragraph'] },
  { type: 'quote', label: 'Цитата', icon: '💬', description: 'Цитата или отзыв', category: 'text', keywords: ['цитата', 'quote', 'отзыв'] },
  { type: 'checklist', label: 'Чек-лист', icon: '☑️', description: 'Список задач', category: 'text', keywords: ['чеклист', 'список', 'задачи'] },
  
  // Медиа блоки
  { type: 'image', label: 'Фото', icon: '🖼️', description: 'Одно изображение', category: 'media', keywords: ['фото', 'изображение', 'image'] },
  { type: 'image-with-caption', label: 'Фото с подписью', icon: '📷', description: 'Изображение с текстом', category: 'media', keywords: ['фото', 'подпись', 'caption'] },
  { type: 'image-gallery', label: 'Галерея', icon: '🖼️🖼️', description: 'Несколько фото', category: 'media', keywords: ['галерея', 'gallery', 'фото'] },
  { type: 'map', label: 'Карта', icon: '🗺️', description: 'Карта маршрута', category: 'media', keywords: ['карта', 'map', 'маршрут'] },
  
  // Специальные блоки
  { type: 'tip-block', label: 'Совет', icon: '💡', description: 'Блок с советом', category: 'special', keywords: ['совет', 'tip', 'подсказка'] },
  { type: 'important-block', label: 'Важно', icon: '⚠️', description: 'Важная информация', category: 'special', keywords: ['важно', 'important', 'информация'] },
  { type: 'warning-block', label: 'Предупреждение', icon: '🚨', description: 'Предупреждение', category: 'special', keywords: ['предупреждение', 'warning', 'внимание'] },
  { type: 'table', label: 'Таблица', icon: '📊', description: 'Таблица данных', category: 'special', keywords: ['таблица', 'table', 'данные'] },
  
  // Блоки макета
  { type: 'divider', label: 'Разделитель', icon: '─', description: 'Горизонтальная линия', category: 'layout', keywords: ['разделитель', 'divider', 'линия'] },
  { type: 'spacer', label: 'Отступ', icon: '⬜', description: 'Пустое пространство', category: 'layout', keywords: ['отступ', 'spacer', 'пробел'] },
  { type: 'cover', label: 'Обложка', icon: '📕', description: 'Титульная страница', category: 'layout', keywords: ['обложка', 'cover', 'титул'] },
  { type: 'toc', label: 'Оглавление', icon: '📑', description: 'Содержание', category: 'layout', keywords: ['оглавление', 'toc', 'содержание'] },
  { type: 'author-block', label: 'Об авторе', icon: '👤', description: 'Информация об авторе', category: 'layout', keywords: ['автор', 'author', 'информация'] },
  { type: 'recommendations-block', label: 'Рекомендации', icon: '⭐', description: 'Рекомендации', category: 'layout', keywords: ['рекомендации', 'recommendations'] },
];

const CATEGORIES = [
  { id: 'all', label: 'Все', icon: '📦' },
  { id: 'text', label: 'Текст', icon: '📝' },
  { id: 'media', label: 'Медиа', icon: '🖼️' },
  { id: 'layout', label: 'Макет', icon: '📐' },
  { id: 'special', label: 'Специальные', icon: '✨' },
] as const;

export function BlockPaletteImproved({ onSelectBlock, onClose }: BlockPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredBlocks = useMemo(() => {
    let blocks = BLOCK_TYPES;

    // Фильтр по категории
    if (selectedCategory !== 'all') {
      blocks = blocks.filter(block => block.category === selectedCategory);
    }

    // Фильтр по поиску
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      blocks = blocks.filter(block =>
        block.label.toLowerCase().includes(query) ||
        block.description.toLowerCase().includes(query) ||
        block.keywords.some(keyword => keyword.toLowerCase().includes(query))
      );
    }

    return blocks;
  }, [searchQuery, selectedCategory]);

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
          borderRadius: 16,
          padding: 24,
          maxWidth: 900,
          width: '90%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div style={styles.header as React.CSSProperties}>
          <Text style={styles.title}>Добавить блок</Text>
          <Pressable onPress={onClose}>
            <div style={styles.closeButton as React.CSSProperties}>
              <Text style={styles.closeButtonText}>×</Text>
            </div>
          </Pressable>
        </div>

        {/* Поиск */}
        <div style={styles.searchContainer}>
          <input
            type="text"
            placeholder="Поиск блоков..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
            autoFocus
          />
        </div>

        {/* Категории */}
        <div style={styles.categories}>
            {CATEGORIES.map((category) => (
              <Pressable
                key={category.id}
                onPress={() => setSelectedCategory(category.id)}
              >
                <div style={{ ...styles.categoryButton, ...(selectedCategory === category.id ? styles.categoryButtonActive : {}) } as React.CSSProperties}>
                  <span style={styles.categoryIcon}>{category.icon}</span>
                  <Text style={styles.categoryLabel}>{category.label}</Text>
                </div>
              </Pressable>
            ))}
        </div>

        {/* Список блоков */}
        <div style={{ flex: 1, minHeight: 300, overflow: 'auto' } as React.CSSProperties}>
          {filteredBlocks.length === 0 ? (
            <div style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Блоки не найдены</Text>
            </div>
          ) : (
            <div style={styles.gridContainer}>
              {filteredBlocks.map((block) => (
                <Pressable
                  key={block.type}
                  onPress={() => {
                    onSelectBlock(block.type);
                    onClose();
                  }}
                >
                  <div style={styles.blockCard as React.CSSProperties}>
                    <div style={styles.blockCardContent as React.CSSProperties}>
                      <div style={styles.blockIcon as React.CSSProperties}>{block.icon}</div>
                      <Text style={styles.blockLabel}>{block.label}</Text>
                      <Text style={styles.blockDescription}>{block.description}</Text>
                    </div>
                  </div>
                </Pressable>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1a202c',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    cursor: 'pointer' as const,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#6b7280',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    fontSize: 14,
    outline: 'none',
  },
  categories: {
    display: 'flex',
    flexDirection: 'row' as const,
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap' as const,
  },
  categoryButton: {
    display: 'flex',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    cursor: 'pointer' as const,
    transition: 'all 0.2s',
  },
  categoryButtonActive: {
    backgroundColor: '#ff9f5a',
  },
  categoryIcon: {
    fontSize: 16,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#1f2937',
  },
  grid: {
    flex: 1,
    minHeight: 300,
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 12,
  },
  blockCard: {
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    cursor: 'pointer' as const,
    transition: 'all 0.2s',
  },
  blockCardContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    textAlign: 'center' as const,
  },
  blockIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  blockLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1a202c',
    marginBottom: 4,
  },
  blockDescription: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 1.4,
  },
  emptyState: {
    padding: 40,
    textAlign: 'center' as const,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#9ca3af',
  },
} as const;

