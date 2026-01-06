// components/export/GalleryLayoutSelector.tsx
// Компонент для выбора раскладки галереи

import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { GalleryLayout, CaptionPosition } from '@/src/types/pdf-gallery';
import { useThemedColors } from '@/hooks/useTheme';

interface GalleryLayoutInfo {
  id: GalleryLayout;
  name: string;
  description: string;
  iconName: string;
  bestFor: string;
}

const GALLERY_LAYOUTS: GalleryLayoutInfo[] = [
  {
    id: 'grid',
    name: 'Сетка',
    description: 'Классическая раскладка с одинаковыми размерами',
    iconName: 'grid-view',
    bestFor: 'Универсальная раскладка для любых фото',
  },
  {
    id: 'masonry',
    name: 'Мозаика',
    description: 'Pinterest-style с разной высотой фото',
    iconName: 'view-quilt',
    bestFor: 'Фото с разными пропорциями',
  },
  {
    id: 'collage',
    name: 'Коллаж',
    description: 'Одно большое фото + несколько маленьких',
    iconName: 'dashboard',
    bestFor: 'Выделение ключевого фото',
  },
  {
    id: 'polaroid',
    name: 'Полароид',
    description: 'Ретро стиль с белыми рамками',
    iconName: 'crop-square',
    bestFor: 'Винтажный стиль, воспоминания',
  },
  {
    id: 'slideshow',
    name: 'Слайдшоу',
    description: 'Одно фото на страницу',
    iconName: 'photo-size-select-large',
    bestFor: 'Крупные фото с подробными подписями',
  },
];

interface GalleryLayoutSelectorProps {
  selectedLayout: GalleryLayout;
  onLayoutSelect: (layout: GalleryLayout) => void;
  columns?: number;
  onColumnsChange?: (columns: number) => void;
  photosPerPage?: number;
  onPhotosPerPageChange?: (count: number) => void;
  twoPerPageLayout?: 'vertical' | 'horizontal';
  onTwoPerPageLayoutChange?: (layout: 'vertical' | 'horizontal') => void;
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
  columns = 1,
  onColumnsChange,
  photosPerPage = 2,
  onPhotosPerPageChange,
  twoPerPageLayout = 'vertical',
  onTwoPerPageLayoutChange,
  showCaptions = true,
  onShowCaptionsChange,
  captionPosition = 'bottom',
  onCaptionPositionChange,
  spacing = 'normal',
  onSpacingChange,
}: GalleryLayoutSelectorProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
                styles={styles}
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
              styles={styles}
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
              {[1, 2, 3, 4].map((num) => (
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

        {/* Фото на странице */}
        {(selectedLayout === 'grid' || selectedLayout === 'polaroid') &&
          onPhotosPerPageChange && (
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Фото на странице:</Text>
              <View style={styles.columnsButtons}>
                {[1, 2, 3, 4].map((count) => (
                  <Pressable
                    key={count}
                    style={[
                      styles.columnButton,
                      photosPerPage === count && styles.columnButtonActive,
                    ]}
                    onPress={() => onPhotosPerPageChange(count)}
                  >
                    <Text
                      style={[
                        styles.columnButtonText,
                        photosPerPage === count && styles.columnButtonTextActive,
                      ]}
                    >
                      {count}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  style={[
                    styles.columnButton,
                    (!photosPerPage || photosPerPage <= 0) && styles.columnButtonActive,
                  ]}
                  onPress={() => onPhotosPerPageChange(0)}
                >
                  <Text
                    style={[
                      styles.columnButtonText,
                      (!photosPerPage || photosPerPage <= 0) && styles.columnButtonTextActive,
                    ]}
                  >
                    Все
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

        {photosPerPage === 2 &&
          (selectedLayout === 'grid' || selectedLayout === 'polaroid') &&
          onTwoPerPageLayoutChange && (
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>2 фото:</Text>
              <View style={styles.positionButtons}>
                {[
                  { value: 'vertical', label: 'Вертикально' },
                  { value: 'horizontal', label: 'Горизонтально' },
                ].map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[
                      styles.positionButton,
                      twoPerPageLayout === opt.value && styles.positionButtonActive,
                    ]}
                    onPress={() => onTwoPerPageLayoutChange(opt.value as 'vertical' | 'horizontal')}
                  >
                    <Text
                      style={[
                        styles.positionButtonText,
                        twoPerPageLayout === opt.value && styles.positionButtonTextActive,
                      ]}
                    >
                      {opt.label}
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
  styles: ReturnType<typeof createStyles>;
}

function LayoutCard({ layout, isSelected, onSelect, styles }: LayoutCardProps) {
  return (
    <Pressable
      style={[styles.layoutCard, isSelected && styles.layoutCardSelected]}
      onPress={onSelect}
    >
      {/* Иконка */}
      <View style={styles.layoutIcon}>
        <MaterialIcons name={layout.iconName as any} size={24} color={styles.layoutIconText.color} />
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
          <MaterialIcons name="check" size={14} color={styles.selectedBadgeText.color} />
        </View>
      )}
    </Pressable>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
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
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 16,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: colors.boxShadows.card } as any)
      : { ...colors.shadows.medium }),
    flexShrink: 0,
  },
  layoutCardSelected: {
    borderColor: colors.primary,
    borderWidth: 3,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: colors.boxShadows.heavy } as any)
      : { ...colors.shadows.hover }),
  },
  layoutIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  layoutIconText: {
    fontSize: 24,
    color: colors.text,
  },
  layoutName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  layoutDescription: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
    marginBottom: 8,
  },
  layoutBestFor: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  layoutBestForText: {
    fontSize: 11,
    color: colors.textTertiary,
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
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBadgeText: {
    color: colors.textOnPrimary,
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
    color: colors.textMuted,
  },
  columnsButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  columnButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  columnButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  columnButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
  },
  columnButtonTextActive: {
    color: colors.textOnPrimary,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.disabled,
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: colors.boxShadows.light } as any)
      : { ...colors.shadows.light }),
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
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  positionButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  positionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
  },
  positionButtonTextActive: {
    color: colors.textOnPrimary,
  },
  spacingButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  spacingButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  spacingButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  spacingButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
  },
  spacingButtonTextActive: {
    color: colors.textOnPrimary,
  },
});
