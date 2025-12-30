// components/export/GalleryLayoutSelector.tsx
// Компонент для выбора раскладки галереи

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import type { GalleryLayout, CaptionPosition } from '@/src/types/pdf-gallery';
import { DESIGN_TOKENS } from '@/constants/designSystem';

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
  const webScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    const el = webScrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      const deltaY = Number((e as any).deltaY ?? 0);
      const deltaX = Number((e as any).deltaX ?? 0);
      if (!deltaY || Math.abs(deltaY) <= Math.abs(deltaX)) return;

      const maxScrollLeft = (el.scrollWidth ?? 0) - (el.clientWidth ?? 0);
      if (maxScrollLeft <= 0) return;

      e.stopPropagation();
      e.preventDefault();
      el.scrollLeft += deltaY;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel as any);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Раскладка галереи</Text>
      
      {/* Выбор раскладки */}
      {Platform.OS === 'web' ? (
        <div
          ref={webScrollRef}
          style={styles.layoutsWebScroll as any}
        >
          <div style={styles.layoutsWebContent as any}>
            {GALLERY_LAYOUTS.map((layout) => (
              <LayoutCard
                key={layout.id}
                layout={layout}
                isSelected={selectedLayout === layout.id}
                onSelect={() => onLayoutSelect(layout.id)}
              />
            ))}
          </div>
        </div>
      ) : (
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
      )}

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
    color: DESIGN_TOKENS.colors.text,
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
  layoutsWebScroll: {
    overflowX: 'scroll',
    overflowY: 'hidden',
    width: '100%',
    WebkitOverflowScrolling: 'touch',
    scrollBehavior: 'smooth',
    scrollbarWidth: 'thin',
    scrollbarColor: 'var(--color-borderStrong) var(--color-backgroundSecondary)',
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 8,
    paddingLeft: 0,
    marginBottom: 16,
  } as any,
  layoutsWebContent: {
    display: 'flex',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 0,
    paddingHorizontal: 16,
    width: 'max-content',
  } as any,
  layoutCard: {
    width: 180,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: DESIGN_TOKENS.colors.border,
    padding: 16,
    shadowColor: DESIGN_TOKENS.colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexShrink: 0,
  },
  layoutCardSelected: {
    borderColor: DESIGN_TOKENS.colors.primary,
    borderWidth: 3,
    shadowColor: DESIGN_TOKENS.colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  layoutIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
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
    color: DESIGN_TOKENS.colors.text,
    marginBottom: 6,
  },
  layoutDescription: {
    fontSize: 12,
    color: DESIGN_TOKENS.colors.textMuted,
    lineHeight: 16,
    marginBottom: 8,
  },
  layoutBestFor: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: DESIGN_TOKENS.colors.borderLight,
  },
  layoutBestForText: {
    fontSize: 11,
    color: DESIGN_TOKENS.colors.textSubtle,
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
    backgroundColor: DESIGN_TOKENS.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBadgeText: {
    color: DESIGN_TOKENS.colors.textOnPrimary,
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
    color: DESIGN_TOKENS.colors.textMuted,
  },
  columnsButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  columnButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: DESIGN_TOKENS.colors.border,
  },
  columnButtonActive: {
    backgroundColor: DESIGN_TOKENS.colors.primary,
    borderColor: DESIGN_TOKENS.colors.primary,
  },
  columnButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.textMuted,
  },
  columnButtonTextActive: {
    color: DESIGN_TOKENS.colors.textOnPrimary,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: DESIGN_TOKENS.colors.disabled,
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: DESIGN_TOKENS.colors.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    shadowColor: DESIGN_TOKENS.colors.text,
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
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
  },
  positionButtonActive: {
    backgroundColor: DESIGN_TOKENS.colors.primary,
    borderColor: DESIGN_TOKENS.colors.primary,
  },
  positionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: DESIGN_TOKENS.colors.textMuted,
  },
  positionButtonTextActive: {
    color: DESIGN_TOKENS.colors.textOnPrimary,
  },
  spacingButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  spacingButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
  },
  spacingButtonActive: {
    backgroundColor: DESIGN_TOKENS.colors.primary,
    borderColor: DESIGN_TOKENS.colors.primary,
  },
  spacingButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: DESIGN_TOKENS.colors.textMuted,
  },
  spacingButtonTextActive: {
    color: DESIGN_TOKENS.colors.textOnPrimary,
  },
});
