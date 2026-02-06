import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import type { GalleryLayout } from '@/types/pdf-gallery';

export interface GalleryLayoutInfo {
  id: GalleryLayout;
  name: string;
  description: string;
  iconName: string;
  bestFor: string;
}

interface LayoutCardProps {
  layout: GalleryLayoutInfo;
  isSelected: boolean;
  onSelect: () => void;
}

export function LayoutCard({ layout, isSelected, onSelect }: LayoutCardProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      style={[styles.layoutCard, isSelected && styles.layoutCardSelected]}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={`Раскладка ${layout.name}`}
      accessibilityHint={layout.description}
    >
      <View style={styles.layoutIcon}>
        <Feather name={layout.iconName as any} size={24} color={styles.layoutIconText.color} />
      </View>

      <Text style={styles.layoutName}>{layout.name}</Text>
      <Text style={styles.layoutDescription} numberOfLines={2}>
        {layout.description}
      </Text>

      <View style={styles.layoutBestFor}>
        <Text style={styles.layoutBestForText} numberOfLines={2}>
          {layout.bestFor}
        </Text>
      </View>

      {isSelected && (
        <View style={styles.selectedBadge}>
          <Feather name="check" size={14} color={styles.selectedBadgeText.color} />
        </View>
      )}
    </Pressable>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  layoutCard: {
    width: 180,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 16,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: colors.boxShadows.card, cursor: 'pointer', transition: 'all 0.2s' } as any)
      : { ...colors.shadows.medium }),
    flexShrink: 0,
  },
  layoutCardSelected: {
    borderColor: colors.primary,
    borderWidth: 3,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: colors.boxShadows.heavy, transform: 'translateY(-2px)' } as any)
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
    minHeight: 32,
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
  },
});
