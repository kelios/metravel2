// components/export/GalleryLayoutSelector.tsx
// Компонент для выбора раскладки галереи

import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import type { GalleryLayout, CaptionPosition } from '@/src/types/pdf-gallery';

interface GalleryLayoutInfo {
  id: GalleryLayout;
  name: string;
  description: string;
  icon: string;
  preview: string; // ASCII art preview
  bestFor: string;
}

const GALLERY_LAYOUTS: GalleryLayoutInfo[] = [
  {
    id: 'grid',
    name: 'Сетка',
    description: 'Классическая раскладка с одинаковыми размерами',
    icon: '▦',
    preview: '▢▢▢\n▢▢▢\n▢▢▢',
    bestFor: 'Универсальная раскладка для любых фото',
  },
  {
    id: 'masonry',
    name: 'Мозаика',
    description: 'Pinterest-style с разной высотой фото',
    icon: '▦',
    preview: '▢▢\n▢▢\n▢▢',
    bestFor: 'Фото с разными пропорциями',
  },
  {
    id: 'collage',
    name: 'Коллаж',
    description: 'Одно большое фото + несколько маленьких',
    icon: '▦',
    preview: '▢▢\n▢▢',
    bestFor: 'Выделение ключевого фото',
  },
  {
    id: 'polaroid',
    name: 'Полароид',
    description: 'Ретро стиль с белыми рамками',
    icon: '▢',
    preview: '▢ ▢\n▢ ▢',
    bestFor: 'Винтажный стиль, воспоминания',
  },
  {
    id: 'slideshow',
    name: 'Слайдшоу',
    description: 'Одно фото на страницу',
    icon: '▢',
    preview: '▢',
    bestFor: 'Крупные фото с подробными подписями',
  },
];

interface GalleryLayoutSelectorProps {
  selectedLayout: GalleryLayout;
  onLayoutSelect: (layout: GalleryLayout) => void;
  columns?: number;
  onColumnsChange?: (columns: number) => void;
  showCaptions?: boolean;
  onShowCaptionsChange?: (show: boolean) => void;
  captionPosition?: CaptionPosition;
  onCaptionPositionChange?: (position: CaptionPosition) => void;
  spacing?: 'compact' | 'normal' | 'spacious';
  onSpacingChange?: (spacing: 'compact' | 'normal' | 'spacious') => void;
}

export default function GalleryLayoutSelector({
  selectedLayout,
  onLayoutSelect,
  columns = 3,
  onColumnsChange,
  showCaptions = true,
  onShowCaptionsChange,
  captionPosition = 'bottom',
  onCaptionPositionChange,
  spacing = 'normal',
  onSpacingChange,
}: GalleryLayoutSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Раскладка галереи</Text>
      
      {/* Выбор раскладки */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.layoutsContainer}
        contentContainerStyle={styles.layoutsContent}
      >
        {GALLERY_LAYOUTS.map((layout) => (
          <LayoutCard
            key={layout.id}
            layout={layout}
            isSelected={selectedLayout === layout.id}
            onSelect={() => onLayoutSelect(layout.id)}
          />
        ))}
      </ScrollView>

      {/* Дополнительные настройки */}
      <View style={styles.settingsContainer}>
        {/* Колонки (только для grid и masonry) */}
        {(selectedLayout === 'grid' || selectedLayout === 'masonry') && onColumnsChange && (
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Колонок:</Text>
            <View style={styles.columnsButtons}>
              {[2, 3, 4].map((num) => (
                <Pressable
                  key={num}
                  style={[
                    styles.columnButton,
                    columns === num && styles.columnButtonActive,
                  ]}
                  onPress={() => onColumnsChange(num)}
                >
                  <Text
                    style={[
                      styles.columnButtonText,
                      columns === num && styles.columnButtonTextActive,
                    ]}
                  >
                    {num}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Подписи */}
        {onShowCaptionsChange && (
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Подписи к фото:</Text>
            <Pressable
              style={[styles.toggle, showCaptions && styles.toggleActive]}
              onPress={() => onShowCaptionsChange(!showCaptions)}
            >
              <View style={[styles.toggleThumb, showCaptions && styles.toggleThumbActive]} />
            </Pressable>
          </View>
        )}

        {/* Позиция подписей */}
        {showCaptions && onCaptionPositionChange && selectedLayout !== 'polaroid' && (
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Позиция:</Text>
            <View style={styles.positionButtons}>
              {[
                { value: 'top', label: 'Сверху' },
                { value: 'bottom', label: 'Снизу' },
                { value: 'overlay', label: 'Поверх' },
              ].map((pos) => (
                <Pressable
                  key={pos.value}
                  style={[
                    styles.positionButton,
                    captionPosition === pos.value && styles.positionButtonActive,
                  ]}
                  onPress={() => onCaptionPositionChange(pos.value as CaptionPosition)}
                >
                  <Text
                    style={[
                      styles.positionButtonText,
                      captionPosition === pos.value && styles.positionButtonTextActive,
                    ]}
                  >
                    {pos.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Отступы */}
        {onSpacingChange && (
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Отступы:</Text>
            <View style={styles.spacingButtons}>
              {[
                { value: 'compact', label: 'Компактно' },
                { value: 'normal', label: 'Обычно' },
                { value: 'spacious', label: 'Просторно' },
              ].map((sp) => (
                <Pressable
                  key={sp.value}
                  style={[
                    styles.spacingButton,
                    spacing === sp.value && styles.spacingButtonActive,
                  ]}
                  onPress={() => onSpacingChange(sp.value as any)}
                >
                  <Text
                    style={[
                      styles.spacingButtonText,
                      spacing === sp.value && styles.spacingButtonTextActive,
                    ]}
                  >
                    {sp.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

interface LayoutCardProps {
  layout: GalleryLayoutInfo;
  isSelected: boolean;
  onSelect: () => void;
}

function LayoutCard({ layout, isSelected, onSelect }: LayoutCardProps) {
  return (
    <Pressable
      style={[styles.layoutCard, isSelected && styles.layoutCardSelected]}
      onPress={onSelect}
    >
      {/* Иконка */}
      <View style={styles.layoutIcon}>
        <Text style={styles.layoutIconText}>{layout.icon}</Text>
      </View>

      {/* Информация */}
      <Text style={styles.layoutName}>{layout.name}</Text>
      <Text style={styles.layoutDescription} numberOfLines={2}>
        {layout.description}
      </Text>

      {/* Для чего подходит */}
      <View style={styles.layoutBestFor}>
        <Text style={styles.layoutBestForText} numberOfLines={2}>
          {layout.bestFor}
        </Text>
      </View>

      {/* Индикатор выбора */}
      {isSelected && (
        <View style={styles.selectedBadge}>
          <Text style={styles.selectedBadgeText}>✓</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  layoutsContainer: {
    marginBottom: 16,
  },
  layoutsContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  layoutCard: {
    width: 180,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  layoutCardSelected: {
    borderColor: '#2563eb',
    borderWidth: 3,
    shadowColor: '#2563eb',
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  layoutIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  layoutIconText: {
    fontSize: 24,
  },
  layoutName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  layoutDescription: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
    marginBottom: 8,
  },
  layoutBestFor: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  layoutBestForText: {
    fontSize: 11,
    color: '#9ca3af',
    fontStyle: 'italic',
    lineHeight: 14,
  },
  selectedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBadgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  settingsContainer: {
    paddingHorizontal: 16,
    gap: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4b5563',
  },
  columnsButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  columnButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  columnButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  columnButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  columnButtonTextActive: {
    color: '#ffffff',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#d1d5db',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#2563eb',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  positionButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  positionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  positionButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  positionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  positionButtonTextActive: {
    color: '#ffffff',
  },
  spacingButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  spacingButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  spacingButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  spacingButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6b7280',
  },
  spacingButtonTextActive: {
    color: '#ffffff',
  },
});
