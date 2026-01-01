// components/export/PresetSelector.tsx
// Компонент для выбора пресетов настроек PDF

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import type { BookPreset, PresetCategory } from '@/src/types/pdf-presets';
import { BOOK_PRESETS, PRESET_CATEGORIES } from '@/src/types/pdf-presets';
import { useThemedColors } from '@/hooks/useTheme';

// Добавляем стили для web через style tag
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'preset-selector-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.type = 'text/css';
    const css = `
      .presets-scroll-container {
        display: flex;
        overflow-x: auto;
        overflow-y: hidden;
        scroll-behavior: smooth;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
        scrollbar-color: var(--color-borderStrong) var(--color-backgroundSecondary);
        padding: 8px 0;
      }
      .presets-scroll-container::-webkit-scrollbar { height: 8px; }
      .presets-scroll-container::-webkit-scrollbar-track {
        background: var(--color-backgroundSecondary);
        border-radius: 4px;
        margin: 0 16px;
      }
      .presets-scroll-container::-webkit-scrollbar-thumb {
        background: var(--color-borderStrong);
        border-radius: 4px;
      }
      .presets-scroll-container::-webkit-scrollbar-thumb:hover { background: var(--color-borderAccent); }
      .presets-content {
        display: flex;
        flex-direction: row;
        gap: 12px;
        padding: 0 16px;
        min-width: min-content;
      }
      .categories-scroll-container {
        display: flex;
        overflow-x: auto;
        overflow-y: hidden;
        scroll-behavior: smooth;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
      }
      .categories-scroll-container::-webkit-scrollbar { display: none; }
      .categories-content {
        display: flex;
        flex-direction: row;
        gap: 8px;
        padding: 0 16px;
        min-width: min-content;
      }
    `;
    if ((style as any).styleSheet) {
      // IE support
      (style as any).styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }
    document.head.appendChild(style);
  }
}

interface PresetSelectorProps {
  onPresetSelect: (preset: BookPreset) => void;
  selectedPresetId?: string;
  showCategories?: boolean;
}

export default function PresetSelector({
  onPresetSelect,
  selectedPresetId,
  showCategories = true,
}: PresetSelectorProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedCategory, setSelectedCategory] = useState<PresetCategory | 'all'>('all');

  const categoriesScrollRef = useRef<HTMLDivElement | null>(null);
  const presetsScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    const attach = (el: HTMLDivElement | null) => {
      if (!el) return () => {};

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
    };

    const detachCategories = attach(categoriesScrollRef.current);
    const detachPresets = attach(presetsScrollRef.current);

    return () => {
      detachCategories();
      detachPresets();
    };
  }, []);

  const filteredPresets =
    selectedCategory === 'all'
      ? BOOK_PRESETS
      : BOOK_PRESETS.filter((preset) => preset.category === selectedCategory);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Быстрый старт</Text>
      <Text style={styles.subtitle}>Выберите готовый пресет или настройте вручную</Text>

      {/* Фильтр по категориям */}
      {showCategories && (
        Platform.OS === 'web' ? (
          <div
            style={styles.categoriesWebScroll as any}
            className="categories-scroll-container"
            ref={categoriesScrollRef}
          >
            <div style={styles.categoriesWebContent as any}>
              <CategoryChip
                label="Все"
                isSelected={selectedCategory === 'all'}
                onPress={() => setSelectedCategory('all')}
                styles={styles}
              />
              {Object.entries(PRESET_CATEGORIES).map(([key, category]) => (
                <CategoryChip
                  key={key}
                  label={category.name}
                  isSelected={selectedCategory === key}
                  onPress={() => setSelectedCategory(key as PresetCategory)}
                  styles={styles}
                />
              ))}
            </div>
          </div>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesContainer}
            contentContainerStyle={styles.categoriesContent}
          >
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <CategoryChip
                label="Все"
                isSelected={selectedCategory === 'all'}
                onPress={() => setSelectedCategory('all')}
                styles={styles}
              />
              {Object.entries(PRESET_CATEGORIES).map(([key, category]) => (
                <CategoryChip
                  key={key}
                  label={category.name}
                  isSelected={selectedCategory === key}
                  onPress={() => setSelectedCategory(key as PresetCategory)}
                  styles={styles}
                />
              ))}
            </View>
          </ScrollView>
        )
      )}

      {/* Список пресетов */}
      <View style={styles.presetsWrapper}>
        {Platform.OS === 'web' ? (
          <div
            style={styles.presetsWebScroll as any}
            className="presets-scroll-container"
            ref={presetsScrollRef}
          >
            <div style={styles.presetsWebContent as any}>
              {filteredPresets.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  isSelected={selectedPresetId === preset.id}
                  onSelect={() => onPresetSelect(preset)}
                  styles={styles}
                />
              ))}
            </div>
          </div>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.presetsContainer}
            contentContainerStyle={styles.presetsContent}
          >
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {filteredPresets.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  isSelected={selectedPresetId === preset.id}
                  onSelect={() => onPresetSelect(preset)}
                  styles={styles}
                />
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

interface CategoryChipProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}

function CategoryChip({ label, isSelected, onPress, styles }: CategoryChipProps) {
  return (
    <Pressable
      style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

interface PresetCardProps {
  preset: BookPreset;
  isSelected: boolean;
  onSelect: () => void;
  styles: ReturnType<typeof createStyles>;
}

function PresetCard({ preset, isSelected, onSelect, styles }: PresetCardProps) {
  return (
    <Pressable
      style={[styles.presetCard, isSelected && styles.presetCardSelected]}
      onPress={onSelect}
    >
      {/* Иконка */}
      <View style={styles.presetIcon}>
        <Text style={styles.presetIconText}>{preset.icon}</Text>
      </View>

      {/* Информация */}
      <View style={styles.presetInfo}>
        <Text style={styles.presetName} numberOfLines={1}>
          {preset.name}
        </Text>
        <Text style={styles.presetDescription} numberOfLines={2}>
          {preset.description}
        </Text>

        {/* Особенности пресета */}
        <View style={styles.presetFeatures}>
          {preset.settings.includeGallery && (
            <FeatureBadge icon="📸" label="Галерея" styles={styles} />
          )}
          {preset.settings.includeMap && (
            <FeatureBadge icon="🗺️" label="Карты" styles={styles} />
          )}
          {preset.settings.includeChecklists && (
            <FeatureBadge icon="✓" label="Чек-листы" styles={styles} />
          )}
        </View>
      </View>

      {/* Индикатор выбора */}
      {isSelected && (
        <View style={styles.selectedIndicator}>
          <Text style={styles.selectedIndicatorText}>✓</Text>
        </View>
      )}

      {/* Бейдж "По умолчанию" */}
      {preset.isDefault && (
        <View style={styles.defaultBadge}>
          <Text style={styles.defaultBadgeText}>По умолчанию</Text>
        </View>
      )}

      {/* Бейдж "Пользовательский" */}
      {preset.isCustom && (
        <View style={styles.customBadge}>
          <Text style={styles.customBadgeText}>Мой</Text>
        </View>
      )}
    </Pressable>
  );
}

interface FeatureBadgeProps {
  icon: string;
  label: string;
  styles: ReturnType<typeof createStyles>;
}

function FeatureBadge({ icon, label, styles }: FeatureBadgeProps) {
  return (
    <View style={styles.featureBadge}>
      <Text style={styles.featureBadgeIcon}>{icon}</Text>
      <Text style={styles.featureBadgeText}>{label}</Text>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  categoriesContainer: {
    marginBottom: 16,
  },
  categoriesWebScroll: {
    overflowX: 'scroll',
    overflowY: 'hidden',
    width: '100%',
    WebkitOverflowScrolling: 'touch',
    scrollBehavior: 'smooth',
    scrollbarWidth: 'thin',
    scrollbarColor: 'var(--color-borderStrong) var(--color-backgroundSecondary)',
    paddingBottom: 8,
    marginBottom: 16,
  } as any,

  categoriesWebContent: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    paddingTop: 0,
    paddingRight: 16,
    paddingBottom: 0,
    paddingLeft: 16,
    width: 'max-content',
  } as any,

  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  categoryChipTextSelected: {
    color: colors.textOnPrimary,
  },

  presetsWrapper: {
    position: 'relative',
    overflow: Platform.OS === 'web' ? 'visible' : 'hidden',
  },
  presetsContainer: {
    marginTop: 8,
  },
  presetsWebScroll: {
    overflowX: 'scroll',
    overflowY: 'hidden',
    width: '100%',
    WebkitOverflowScrolling: 'touch',
    scrollBehavior: 'smooth',
    scrollbarWidth: 'thin',
    scrollbarColor: 'var(--color-borderStrong) var(--color-backgroundSecondary)',
    paddingVertical: 8,
    paddingHorizontal: 0,
  } as any,

  presetsWebContent: {
    display: 'flex',
    flexDirection: 'row',
    gap: 12,
    paddingTop: 0,
    paddingRight: 16,
    paddingBottom: 0,
    paddingLeft: 16,
    width: 'max-content',
  } as any,
  presetsContent: {
    paddingHorizontal: 16,
    gap: 12,
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  presetCard: {
    width: 260,
    minHeight: 200,
    flexShrink: 0,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 16,
    ...Platform.select({
      web: {
        boxShadow: colors.boxShadows.card,
      },
      default: {
        ...colors.shadows.medium,
      },
    }),
  },
  presetCardSelected: {
    borderColor: colors.primary,
    borderWidth: 3,
    ...Platform.select({
      web: {
        boxShadow: colors.boxShadows.heavy,
      },
      default: {
        ...colors.shadows.hover,
      },
    }),
  },
  presetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  presetIconText: {
    fontSize: 24,
  },
  presetInfo: {
    flex: 1,
  },
  presetName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  presetDescription: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
    marginBottom: 12,
    minHeight: 32,
  },
  presetFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    gap: 4,
  },
  featureBadgeIcon: {
    fontSize: 12,
  },
  featureBadgeText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: colors.boxShadows.medium,
      },
      default: {
        ...colors.shadows.medium,
      },
    }),
  },
  selectedIndicatorText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  defaultBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.success,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textOnPrimary,
  },
  customBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.warning,
  },
  customBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textOnPrimary,
  },
});
