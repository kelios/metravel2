// components/export/PresetSelector.tsx
// Компонент для выбора пресетов настроек PDF

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { BookPreset, PresetCategory } from '@/src/types/pdf-presets';
import { BOOK_PRESETS, PRESET_CATEGORIES } from '@/src/types/pdf-presets';
import { useThemedColors } from '@/hooks/useTheme';

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
          <div style={styles.categoriesWebWrap as any}>
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
          <div style={styles.presetsWebGrid as any}>
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
      <View style={styles.presetHeader}>
        <View style={styles.presetIcon}>
          <MaterialIcons
            name={getPresetIconName(preset) as any}
            size={22}
            color={styles.presetIconColor.color}
          />
        </View>

        <View style={styles.presetMetaBadges}>
          {preset.isDefault && (
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeText}>По умолчанию</Text>
            </View>
          )}
          {preset.isCustom && (
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeText}>Мой</Text>
            </View>
          )}
          {isSelected && (
            <View style={styles.selectedPill}>
              <MaterialIcons name="check" size={16} color={styles.selectedPillIcon.color} />
              <Text style={styles.selectedPillText}>Выбрано</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.presetBody}>
        <Text style={styles.presetName} numberOfLines={1}>
          {preset.name}
        </Text>
        <Text style={styles.presetDescription} numberOfLines={2}>
          {preset.description}
        </Text>

        <View style={styles.presetFeatures}>
          {preset.settings.includeGallery && (
            <FeatureBadge iconName="photo" label="Галерея" styles={styles} />
          )}
          {preset.settings.includeMap && (
            <FeatureBadge iconName="map" label="Карты" styles={styles} />
          )}
          {preset.settings.includeChecklists && (
            <FeatureBadge iconName="checklist" label="Чек-листы" styles={styles} />
          )}
        </View>
      </View>

      <View style={styles.presetFooter}>
        <Text style={styles.presetCtaText}>Выбрать</Text>
        <MaterialIcons name="chevron-right" size={18} color={styles.presetCtaIcon.color} />
      </View>
    </Pressable>
  );
}

interface FeatureBadgeProps {
  iconName: string;
  label: string;
  styles: ReturnType<typeof createStyles>;
}

function FeatureBadge({ iconName, label, styles }: FeatureBadgeProps) {
  return (
    <View style={styles.featureBadge}>
      <MaterialIcons name={iconName as any} size={14} color={styles.featureBadgeIconColor.color} />
      <Text style={styles.featureBadgeText}>{label}</Text>
    </View>
  );
}

function getPresetIconName(preset: BookPreset): string {
  if (preset.category === 'minimal') return 'notes';
  if (preset.category === 'detailed') return 'menu-book';
  if (preset.category === 'photo-focused') return 'photo-camera';
  if (preset.category === 'map-focused') return 'map';
  if (preset.category === 'print') return 'print';
  return 'tune';
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
  categoriesWebWrap: {
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 16,
    overflowX: 'hidden',
  } as any,
  categoriesWebContent: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  presetsWebGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 8,
    width: '100%',
    boxSizing: 'border-box',
  } as any,
  presetsContent: {
    paddingHorizontal: 16,
    gap: 12,
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  presetCard: {
    width: Platform.OS === 'web' ? 'auto' : 260,
    height: 220,
    flexShrink: 0,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
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
    borderWidth: 2,
    backgroundColor: colors.backgroundSecondary,
    ...Platform.select({
      web: {
        boxShadow: colors.boxShadows.heavy,
      },
      default: {
        ...colors.shadows.hover,
      },
    }),
  },
  presetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  presetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetIconColor: {
    color: colors.text,
  },
  presetMetaBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexShrink: 1,
  },
  metaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selectedPillIcon: {
    color: colors.text,
  },
  selectedPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text,
  },
  presetBody: {
    flex: 1,
  },
  presetName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
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
    gap: 8,
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
  featureBadgeIconColor: {
    color: colors.textMuted,
  },
  featureBadgeText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  presetFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  presetCtaText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  presetCtaIcon: {
    color: colors.textMuted,
  },
});
