import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { ImportedPoint } from '@/types/userPoints';
import { COLOR_CATEGORIES, STATUS_LABELS } from '@/types/userPoints';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface PointCardProps {
  point: ImportedPoint;
  onPress?: (point: ImportedPoint) => void;
  onEdit?: (point: ImportedPoint) => void;
  onDelete?: (point: ImportedPoint) => void;
  layout?: 'list' | 'grid';
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (point: ImportedPoint) => void;
}

export const PointCard: React.FC<PointCardProps> = ({
  point,
  onPress,
  onEdit,
  onDelete,
  layout = 'list',
  selectionMode,
  selected,
  onToggleSelect,
}) => {
  const colorInfo = COLOR_CATEGORIES[point.color];
  const colors = useThemedColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const showActions = !selectionMode && (typeof onEdit === 'function' || typeof onDelete === 'function');

  const WebAction = ({
    label,
    icon,
    onActivate,
  }: {
    label: string;
    icon: 'edit-2' | 'trash-2';
    onActivate?: () => void;
  }) => {
    return (
      <Pressable
        style={styles.webActionButton}
        accessibilityRole="button"
        accessibilityLabel={label}
        {...({
          role: 'button',
          tabIndex: 0,
          title: label,
          'data-card-action': 'true',
        } as any)}
        onPress={(e) => {
          try {
            (e as any)?.preventDefault?.();
            (e as any)?.stopPropagation?.();
          } catch {
            // noop
          }
          onActivate?.();
        }}
      >
        <Feather name={icon} size={16} color={colors.text} />
      </Pressable>
    );
  };

  return (
    <TouchableOpacity
      style={[styles.container, layout === 'grid' ? styles.containerGrid : null]}
      onPress={() => {
        if (selectionMode) {
          onToggleSelect?.(point);
          return;
        }
        onPress?.(point);
      }}
      activeOpacity={0.7}
    >
      <View testID="color-indicator" style={[styles.colorIndicator, { backgroundColor: colorInfo.color }]} />
      
      <View
        style={[
          styles.content,
          selectionMode ? styles.contentSelectionMode : null,
          showActions ? styles.contentWithActions : null,
        ]}
      >
        {selectionMode ? (
          <View style={[styles.selectionBadge, selected ? styles.selectionBadgeSelected : styles.selectionBadgeUnselected]}>
            <Feather
              name={selected ? 'check-circle' : 'circle'}
              size={18}
              color={selected ? colors.textOnPrimary : colors.textMuted}
            />
          </View>
        ) : null}

        {showActions ? (
          <View style={styles.actionsRow}>
            {typeof onEdit === 'function' ? (
              Platform.OS === 'web' ? (
                <WebAction label="Редактировать" icon="edit-2" onActivate={() => onEdit(point)} />
              ) : (
                <TouchableOpacity
                  style={styles.actionButton}
                  accessibilityRole="button"
                  accessibilityLabel="Редактировать"
                  onPress={() => onEdit(point)}
                >
                  <Feather name="edit-2" size={16} color={colors.text} />
                </TouchableOpacity>
              )
            ) : null}

            {typeof onDelete === 'function' ? (
              Platform.OS === 'web' ? (
                <WebAction label="Удалить" icon="trash-2" onActivate={() => onDelete(point)} />
              ) : (
                <TouchableOpacity
                  style={styles.actionButton}
                  accessibilityRole="button"
                  accessibilityLabel="Удалить"
                  onPress={() => onDelete(point)}
                >
                  <Feather name="trash-2" size={16} color={colors.text} />
                </TouchableOpacity>
              )
            ) : null}
          </View>
        ) : null}

        <Text style={styles.name} numberOfLines={1}>
          {point.name}
        </Text>
        
        {point.description && (
          <Text style={styles.description} numberOfLines={2}>
            {point.description}
          </Text>
        )}
        
        <View style={styles.metadata}>
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
        
        {typeof point.rating === 'number' && Number.isFinite(point.rating) && (
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
  containerGrid: {
    marginHorizontal: 0,
    marginBottom: 0,
    flex: 1,
    alignSelf: 'stretch',
  },
  colorIndicator: {
    width: 6,
  },
  content: {
    flex: 1,
    padding: DESIGN_TOKENS.spacing.md,
  },
  contentWithActions: {
    paddingRight: DESIGN_TOKENS.spacing.md + 76,
  },
  contentSelectionMode: {
    paddingRight: DESIGN_TOKENS.spacing.md + 40,
  },
  actionsRow: {
    position: 'absolute',
    top: DESIGN_TOKENS.spacing.sm,
    right: DESIGN_TOKENS.spacing.sm,
    flexDirection: 'row',
    gap: 6,
    zIndex: 2,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  webActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  selectionBadge: {
    position: 'absolute',
    top: DESIGN_TOKENS.spacing.sm,
    right: DESIGN_TOKENS.spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectionBadgeSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectionBadgeUnselected: {
    backgroundColor: colors.surface,
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
