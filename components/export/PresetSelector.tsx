// components/export/PresetSelector.tsx
// Компонент для выбора пресетов настроек PDF

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import type { BookPreset, PresetCategory } from '@/src/types/pdf-presets';
import { BOOK_PRESETS, PRESET_CATEGORIES } from '@/src/types/pdf-presets';

// Импортируем CSS для web
if (Platform.OS === 'web') {
  require('./PresetSelector.web.css');
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
          contentContainerStyle={styles.categoriesContent}
          {...(Platform.OS === 'web' && {
            // @ts-ignore - web-specific props
            className: 'categories-scroll-container',
          })}
        >
          <View
            style={{ flexDirection: 'row', gap: 8 }}
            {...(Platform.OS === 'web' && {
              // @ts-ignore - web-specific props
              className: 'categories-content',
            })}
          >
            <CategoryChip
              label="Все"
              isSelected={selectedCategory === 'all'}
              onPress={() => setSelectedCategory('all')}
            />
            {Object.entries(PRESET_CATEGORIES).map(([key, category]) => (
              <CategoryChip
                key={key}
                label={category.name}
                isSelected={selectedCategory === key}
                onPress={() => setSelectedCategory(key as PresetCategory)}
              />
            ))}
          </View>
        </ScrollView>
      )}

      {/* Список пресетов */}
      <View style={styles.presetsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={Platform.OS !== 'web'}
          style={styles.presetsContainer}
          contentContainerStyle={styles.presetsContent}
          {...(Platform.OS === 'web' && {
            // @ts-ignore - web-specific props
            className: 'presets-scroll-container',
          })}
        >
          <View
            style={{ flexDirection: 'row', gap: 12 }}
            {...(Platform.OS === 'web' && {
              // @ts-ignore - web-specific props
              className: 'presets-content',
            })}
          >
            {filteredPresets.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                isSelected={selectedPresetId === preset.id}
                onSelect={() => onPresetSelect(preset)}
              />
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

interface CategoryChipProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

function CategoryChip({ label, isSelected, onPress }: CategoryChipProps) {
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
}

function PresetCard({ preset, isSelected, onSelect }: PresetCardProps) {
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
            <FeatureBadge icon="📸" label="Галерея" />
          )}
          {preset.settings.includeMap && (
            <FeatureBadge icon="🗺️" label="Карты" />
          )}
          {preset.settings.includeChecklists && (
            <FeatureBadge icon="✓" label="Чек-листы" />
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
}

function FeatureBadge({ icon, label }: FeatureBadgeProps) {
  return (
    <View style={styles.featureBadge}>
      <Text style={styles.featureBadgeIcon}>{icon}</Text>
      <Text style={styles.featureBadgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  categoriesContainer: {
    marginBottom: 16,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  categoryChipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4b5563',
  },
  categoryChipTextSelected: {
    color: '#ffffff',
  },
  presetsWrapper: {
    position: 'relative',
    overflow: 'hidden',
  },
  presetsContainer: {
    marginTop: 8,
  },
  presetsContent: {
    paddingHorizontal: 16,
    gap: 12,
    flexDirection: 'row',
  },
  presetCard: {
    width: 260,
    minHeight: 200,
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
  presetCardSelected: {
    borderColor: '#2563eb',
    borderWidth: 3,
    shadowColor: '#2563eb',
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  presetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
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
    color: '#1a1a1a',
    marginBottom: 6,
  },
  presetDescription: {
    fontSize: 12,
    color: '#6b7280',
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
    backgroundColor: '#f3f4f6',
    gap: 4,
  },
  featureBadgeIcon: {
    fontSize: 12,
  },
  featureBadgeText: {
    fontSize: 11,
    color: '#4b5563',
    fontWeight: '500',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  selectedIndicatorText: {
    color: '#ffffff',
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
    backgroundColor: '#10b981',
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  customBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f59e0b',
  },
  customBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
});
