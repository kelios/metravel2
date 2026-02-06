// components/export/GalleryLayoutSelector.tsx
// Компонент для выбора раскладки галереи

import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';
import { useHorizontalScroll } from '@/hooks/useHorizontalScroll';
import { Toggle } from '@/components/ui/Toggle';
import { SelectionGroup } from '@/components/ui/SelectionGroup';
import { LayoutCard, type GalleryLayoutInfo } from './LayoutCard';
import type { GalleryLayout, CaptionPosition } from '@/types/pdf-gallery';

const GALLERY_LAYOUTS: GalleryLayoutInfo[] = [
  {
    id: 'grid',
    name: 'Сетка',
    description: 'Классическая раскладка с одинаковыми размерами',
    iconName: 'grid',
    bestFor: 'Универсальная раскладка для любых фото',
  },
  {
    id: 'masonry',
    name: 'Мозаика',
    description: 'Pinterest-style с разной высотой фото',
    iconName: 'grid',
    bestFor: 'Фото с разными пропорциями',
  },
  {
    id: 'collage',
    name: 'Коллаж',
    description: 'Одно большое фото + несколько маленьких',
    iconName: 'layout',
    bestFor: 'Выделение ключевого фото',
  },
  {
    id: 'polaroid',
    name: 'Полароид',
    description: 'Ретро стиль с белыми рамками',
    iconName: 'square',
    bestFor: 'Винтажный стиль, воспоминания',
  },
  {
    id: 'slideshow',
    name: 'Слайдшоу',
    description: 'Одно фото на страницу',
    iconName: 'image',
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
  const webScrollRef = useHorizontalScroll();

  const renderLayouts = () => (
    <>
      {GALLERY_LAYOUTS.map((layout) => (
        <LayoutCard
          key={layout.id}
          layout={layout}
          isSelected={selectedLayout === layout.id}
          onSelect={() => onLayoutSelect(layout.id)}
        />
      ))}
    </>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Раскладка галереи</Text>
      
      {/* Выбор раскладки */}
      {Platform.OS === 'web' ? (
        <div
          // @ts-ignore - ref совместимость
          ref={webScrollRef}
          style={styles.layoutsWebScroll as any}
        >
          <div style={styles.layoutsWebContent as any}>
            {renderLayouts()}
          </div>
        </div>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.layoutsContainer}
          contentContainerStyle={styles.layoutsContent}
        >
          {renderLayouts()}
        </ScrollView>
      )}

      {/* Дополнительные настройки */}
      <View style={styles.settingsContainer}>
        {/* Колонки (только для grid и masonry) */}
        {(selectedLayout === 'grid' || selectedLayout === 'masonry') && onColumnsChange && (
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Колонок:</Text>
            <SelectionGroup
              options={[1, 2, 3, 4]}
              value={columns}
              onChange={onColumnsChange}
            />
          </View>
        )}

        {/* Фото на странице */}
        {(selectedLayout === 'grid' || selectedLayout === 'polaroid') && onPhotosPerPageChange && (
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Фото на странице:</Text>
            <SelectionGroup
              options={[
                { value: 1, label: '1' },
                { value: 2, label: '2' },
                { value: 3, label: '3' },
                { value: 4, label: '4' },
                { value: 0, label: 'Все' },
              ]}
              value={photosPerPage}
              onChange={onPhotosPerPageChange}
            />
          </View>
        )}

        {photosPerPage === 2 &&
          (selectedLayout === 'grid' || selectedLayout === 'polaroid') &&
          onTwoPerPageLayoutChange && (
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>2 фото:</Text>
              <SelectionGroup
                options={[
                  { value: 'vertical', label: 'Вертикально' },
                  { value: 'horizontal', label: 'Горизонтально' },
                ]}
                value={twoPerPageLayout}
                onChange={onTwoPerPageLayoutChange}
              />
            </View>
          )}

        {/* Подписи */}
        {onShowCaptionsChange && (
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Подписи к фото:</Text>
            <Toggle
              value={showCaptions}
              onValueChange={onShowCaptionsChange}
            />
          </View>
        )}

        {/* Позиция подписей */}
        {showCaptions && onCaptionPositionChange && selectedLayout !== 'polaroid' && (
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Позиция:</Text>
            <SelectionGroup
              options={[
                { value: 'top', label: 'Сверху' },
                { value: 'bottom', label: 'Снизу' },
                { value: 'overlay', label: 'Поверх' },
              ]}
              value={captionPosition}
              onChange={onCaptionPositionChange}
            />
          </View>
        )}

        {/* Отступы */}
        {onSpacingChange && (
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Отступы:</Text>
            <SelectionGroup
              options={[
                { value: 'compact', label: 'Компактно' },
                { value: 'normal', label: 'Обычно' },
                { value: 'spacious', label: 'Просторно' },
              ]}
              value={spacing}
              onChange={onSpacingChange}
            />
          </View>
        )}
      </View>
    </View>
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
    scrollbarColor: `var(--color-borderStrong) var(--color-backgroundSecondary)`,
    paddingTop: 4,
    paddingRight: 0,
    paddingBottom: 12,
    paddingLeft: 0,
    marginBottom: 8,
  } as any,
  layoutsWebContent: {
    display: 'flex',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 0,
    paddingHorizontal: 16,
    width: 'max-content',
  } as any,
  settingsContainer: {
    paddingHorizontal: 16,
    gap: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
    marginRight: 16,
  },
});
