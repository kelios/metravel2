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
import { translate as i18nT } from '@/i18n'


const GALLERY_LAYOUTS: GalleryLayoutInfo[] = [
  {
    id: 'grid',
    get name() { return i18nT('export:components.export.GalleryLayoutSelector.layout.grid.name') },
    get description() { return i18nT('export:components.export.GalleryLayoutSelector.layout.grid.description') },
    iconName: 'grid',
    get bestFor() { return i18nT('export:components.export.GalleryLayoutSelector.layout.grid.bestFor') },
  },
  {
    id: 'masonry',
    get name() { return i18nT('export:components.export.GalleryLayoutSelector.layout.masonry.name') },
    get description() { return i18nT('export:components.export.GalleryLayoutSelector.layout.masonry.description') },
    iconName: 'grid',
    get bestFor() { return i18nT('export:components.export.GalleryLayoutSelector.layout.masonry.bestFor') },
  },
  {
    id: 'collage',
    get name() { return i18nT('export:components.export.GalleryLayoutSelector.layout.collage.name') },
    get description() { return i18nT('export:components.export.GalleryLayoutSelector.layout.collage.description') },
    iconName: 'layout',
    get bestFor() { return i18nT('export:components.export.GalleryLayoutSelector.layout.collage.bestFor') },
  },
  {
    id: 'polaroid',
    get name() { return i18nT('export:components.export.GalleryLayoutSelector.layout.polaroid.name') },
    get description() { return i18nT('export:components.export.GalleryLayoutSelector.layout.polaroid.description') },
    iconName: 'square',
    get bestFor() { return i18nT('export:components.export.GalleryLayoutSelector.layout.polaroid.bestFor') },
  },
  {
    id: 'slideshow',
    get name() { return i18nT('export:components.export.GalleryLayoutSelector.layout.slideshow.name') },
    get description() { return i18nT('export:components.export.GalleryLayoutSelector.layout.slideshow.description') },
    iconName: 'image',
    get bestFor() { return i18nT('export:components.export.GalleryLayoutSelector.layout.slideshow.bestFor') },
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
      <Text style={styles.title}>{i18nT('export:components.export.GalleryLayoutSelector.raskladka_galerei_d0bddf26')}</Text>
      
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
            <Text style={styles.settingLabel}>{i18nT('export:components.export.GalleryLayoutSelector.kolonok_49b4f8c6')}</Text>
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
            <Text style={styles.settingLabel}>{i18nT('export:components.export.GalleryLayoutSelector.foto_na_stranitse_d47b7141')}</Text>
            <SelectionGroup
              options={[
                { value: 1, label: '1' },
                { value: 2, label: '2' },
                { value: 3, label: '3' },
                { value: 4, label: '4' },
                { value: 0, label: i18nT('export:components.export.GalleryLayoutSelector.vse_615bd522') },
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
              <Text style={styles.settingLabel}>{i18nT('export:components.export.GalleryLayoutSelector.2_foto_58e63034')}</Text>
              <SelectionGroup
                options={[
                  { value: 'vertical', label: i18nT('export:components.export.GalleryLayoutSelector.vertikalno_d9f1b104') },
                  { value: 'horizontal', label: i18nT('export:components.export.GalleryLayoutSelector.gorizontalno_e78d0ea4') },
                ]}
                value={twoPerPageLayout}
                onChange={onTwoPerPageLayoutChange}
              />
            </View>
          )}

        {/* Подписи */}
        {onShowCaptionsChange && (
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>{i18nT('export:components.export.GalleryLayoutSelector.podpisi_k_foto_caa4cc8e')}</Text>
            <Toggle
              value={showCaptions}
              onValueChange={onShowCaptionsChange}
            />
          </View>
        )}

        {/* Позиция подписей */}
        {showCaptions && onCaptionPositionChange && selectedLayout !== 'polaroid' && (
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>{i18nT('export:components.export.GalleryLayoutSelector.pozitsiya_b1c1fd6b')}</Text>
            <SelectionGroup
              options={[
                { value: 'top', label: i18nT('export:components.export.GalleryLayoutSelector.sverhu_9e51cd60') },
                { value: 'bottom', label: i18nT('export:components.export.GalleryLayoutSelector.snizu_78ac3509') },
                { value: 'overlay', label: i18nT('export:components.export.GalleryLayoutSelector.poverh_dc946194') },
              ]}
              value={captionPosition}
              onChange={onCaptionPositionChange}
            />
          </View>
        )}

        {/* Отступы */}
        {onSpacingChange && (
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>{i18nT('export:components.export.GalleryLayoutSelector.otstupy_50a9780a')}</Text>
            <SelectionGroup
              options={[
                { value: 'compact', label: i18nT('export:components.export.GalleryLayoutSelector.kompaktno_08e72636') },
                { value: 'normal', label: i18nT('export:components.export.GalleryLayoutSelector.obychno_7740f652') },
                { value: 'spacious', label: i18nT('export:components.export.GalleryLayoutSelector.prostorno_f6ed5bea') },
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
