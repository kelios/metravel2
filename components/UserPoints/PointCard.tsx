import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { ImportedPoint } from '@/types/userPoints';
import { COLOR_CATEGORIES, CATEGORY_LABELS, STATUS_LABELS } from '@/types/userPoints';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface PointCardProps {
  point: ImportedPoint;
  onPress?: (point: ImportedPoint) => void;
}

export const PointCard: React.FC<PointCardProps> = ({ point, onPress }) => {
  const colorInfo = COLOR_CATEGORIES[point.color];
  const colors = useThemedColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress?.(point)}
      activeOpacity={0.7}
    >
      <View testID="color-indicator" style={[styles.colorIndicator, { backgroundColor: colorInfo.color }]} />
      
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {point.name}
        </Text>
        
        {point.description && (
          <Text style={styles.description} numberOfLines={2}>
            {point.description}
          </Text>
        )}
        
        <View style={styles.metadata}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {CATEGORY_LABELS[point.category]}
            </Text>
          </View>
          
          <View style={[styles.badge, styles.statusBadge]}>
            <Text style={styles.badgeText}>
              {STATUS_LABELS[point.status]}
            </Text>
          </View>
        </View>
        
        {point.address && (
          <Text style={styles.address} numberOfLines={1}>
            {point.address}
          </Text>
        )}
        
        {point.rating && (
          <Text style={styles.rating}>
            {point.rating.toFixed(1)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    marginHorizontal: DESIGN_TOKENS.spacing.lg,
    marginBottom: DESIGN_TOKENS.spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorIndicator: {
    width: 6,
  },
  content: {
    flex: 1,
    padding: DESIGN_TOKENS.spacing.md,
  },
  name: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '600' as any,
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  description: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: DESIGN_TOKENS.spacing.sm,
    lineHeight: 20,
  },
  metadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  badge: {
    backgroundColor: colors.backgroundTertiary,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 4,
    borderRadius: DESIGN_TOKENS.radii.sm,
    marginRight: DESIGN_TOKENS.spacing.xs,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  statusBadge: {
    backgroundColor: colors.backgroundTertiary,
  },
  badgeText: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    color: colors.textMuted,
  },
  address: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
  },
  rating: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
  },
});
