import React, { useMemo } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

type ActionChip = {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  accessibilityLabel?: string;
  title?: string;
};

type InlineAction = {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  accessibilityLabel?: string;
  title?: string;
};

type Props = {
  title: string;
  imageUrl?: string | null;
  categoryLabel?: string | null;
  coord?: string | null;
  badges?: string[];
  onCardPress?: () => void;
  onMediaPress?: () => void;
  onCopyCoord?: () => void;
  onShare?: () => void;
  mapActions?: ActionChip[];
  inlineActions?: InlineAction[];
  onAddPoint?: () => void;
  addDisabled?: boolean;
  isAdding?: boolean;
  addLabel?: string;
  width?: number;
  imageHeight?: number;
  testID?: string;
  style?: any;
};

const PlaceListCard: React.FC<Props> = ({
  title,
  imageUrl,
  categoryLabel,
  coord,
  badges = [],
  onCardPress,
  onMediaPress,
  onCopyCoord,
  onShare,
  mapActions = [],
  inlineActions = [],
  onAddPoint,
  addDisabled = false,
  isAdding = false,
  addLabel = 'Мои точки',
  width = 300,
  imageHeight = 180,
  testID,
  style,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const hasCoord = !!coord;
  const showBadges = badges.length > 0;
  const hasMapActions = mapActions.length > 0;
  const hasInlineActions = inlineActions.length > 0;
  const showBottomRow = Boolean(onAddPoint);

  return (
    <UnifiedTravelCard
      title={title}
      imageUrl={imageUrl}
      metaText={categoryLabel ?? undefined}
      onPress={onCardPress ?? (() => {})}
      onMediaPress={onMediaPress}
      imageHeight={imageHeight}
      width={width}
      testID={testID}
      style={style}
      contentSlot={
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text numberOfLines={2} style={styles.titleText}>
              {title}
            </Text>
            {!!categoryLabel && (
              <View style={styles.categoryChip}>
                <Feather name="tag" size={12} color={colors.textMuted} />
                <Text style={styles.categoryText} numberOfLines={1}>
                  {categoryLabel}
                </Text>
              </View>
            )}
          </View>

          {showBadges && (
            <View style={styles.badgesRow}>
              {badges.map((badge) => (
                <View key={badge} style={styles.badgeChip}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              ))}
            </View>
          )}

          {hasCoord && (
            <View style={styles.section}>
              <View style={styles.coordRow}>
                <Text style={styles.coordText}>
                  {coord}
                </Text>
                {onCopyCoord && (
                  <Pressable
                    accessibilityLabel="Скопировать координаты"
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      void onCopyCoord();
                    }}
                    {...({ 'data-card-action': 'true', title: 'Скопировать координаты' } as any)}
                    style={styles.inlineAction}
                  >
                    <Feather name="copy" size={14} color={colors.textMuted} />
                  </Pressable>
                )}
                {onShare && (
                  <Pressable
                    accessibilityLabel="Поделиться в Telegram"
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      void onShare();
                    }}
                    {...({ 'data-card-action': 'true', title: 'Поделиться в Telegram' } as any)}
                    style={styles.inlineAction}
                  >
                    <Feather name="send" size={14} color={colors.textMuted} />
                    <Text style={styles.inlineActionText}>Телеграм</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {(hasMapActions || hasInlineActions) && (
            <View style={styles.section}>
              {hasMapActions && (
                <View style={styles.mapActionsRow}>
                  {mapActions.map((action) => (
                    <Pressable
                      key={action.key}
                      accessibilityLabel={action.accessibilityLabel ?? action.title ?? action.label}
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        action.onPress();
                      }}
                      {...({
                        'data-card-action': 'true',
                        title: action.title ?? action.label,
                      } as any)}
                      style={styles.mapChip}
                    >
                      <Feather name={action.icon} size={14} color={colors.text} />
                      <Text style={styles.mapChipText}>{action.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {showBottomRow ? (
            <View style={styles.bottomRow}>
              {hasInlineActions && (
                <View style={styles.bottomInlineActions}>
                  {inlineActions.map((action) => (
                    <Pressable
                      key={action.key}
                      accessibilityLabel={action.accessibilityLabel ?? action.title ?? action.label}
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        action.onPress();
                      }}
                      {...({
                        'data-card-action': 'true',
                        title: action.title ?? action.label,
                      } as any)}
                      style={styles.bottomInlineAction}
                    >
                      <Feather name={action.icon} size={14} color={colors.textMuted} />
                      <Text style={styles.inlineActionText}>{action.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {onAddPoint && (
                <View style={styles.addButtonContainerInline}>
                  <Pressable
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      void onAddPoint();
                    }}
                    disabled={addDisabled || isAdding}
                    accessibilityLabel={addLabel}
                    style={({ pressed }) => [
                      styles.addButton,
                      pressed && !addDisabled && !isAdding && styles.addButtonPressed,
                      (addDisabled || isAdding) && styles.addButtonDisabled,
                    ]}
                    {...(Platform.OS === 'web'
                      ? ({ title: addLabel, 'aria-label': addLabel } as any)
                      : ({ accessibilityRole: 'button' } as any))}
                  >
                    {isAdding ? (
                      <ActivityIndicator size="small" color={colors.textOnPrimary} />
                    ) : (
                      <View style={styles.addButtonRow}>
                        <Feather name="plus-circle" size={16} color={colors.textOnPrimary} />
                        <Text style={styles.addButtonText} numberOfLines={1}>
                          {addLabel}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                </View>
              )}
            </View>
          ) : (
            hasInlineActions && (
              <View style={[styles.section, styles.inlineActionsRow]}>
                {inlineActions.map((action) => (
                  <Pressable
                    key={action.key}
                    accessibilityLabel={action.accessibilityLabel ?? action.title ?? action.label}
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      action.onPress();
                    }}
                    {...({
                      'data-card-action': 'true',
                      title: action.title ?? action.label,
                    } as any)}
                    style={styles.inlineAction}
                  >
                    <Feather name={action.icon} size={14} color={colors.textMuted} />
                    <Text style={styles.inlineActionText}>{action.label}</Text>
                  </Pressable>
                ))}
              </View>
            )
          )}
        </View>
      }
      mediaProps={{
        blurBackground: true,
        blurRadius: 16,
        loading: 'lazy',
        priority: 'low',
      }}
      contentContainerStyle={styles.contentContainer}
    />
  );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    contentContainer: {
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    content: {
      gap: 10,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    titleText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      flexShrink: 1,
    },
    categoryChip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderLight ?? colors.border,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    categoryText: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textMuted,
    },
    badgesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    badgeChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    section: {
      gap: 6,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    coordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    coordText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' as any,
    },
    inlineAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    inlineActionText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    mapActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    mapChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      ...Platform.select({
        web: {
          cursor: 'pointer' as any,
        },
      }),
    },
    mapChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: -0.2,
    },
    inlineActionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    bottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginTop: 4,
    },
    bottomInlineActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
    },
    bottomInlineAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      ...Platform.select({
        web: {
          cursor: 'pointer' as any,
        },
      }),
    },
    addButtonContainer: {
      marginTop: 4,
    },
    addButtonContainerInline: {
      flex: 1,
      minWidth: 160,
    },
    addButton: {
      backgroundColor: colors.primary,
      borderRadius: DESIGN_TOKENS.radii.lg,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      ...Platform.select({
        web: {
          cursor: 'pointer' as any,
          transition: 'all 0.2s ease',
        },
      }),
    },
    addButtonPressed: {
      transform: [{ scale: 0.98 }],
    },
    addButtonDisabled: {
      opacity: 0.65,
    },
    addButtonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    addButtonText: {
      fontWeight: '600',
      letterSpacing: -0.2,
      color: colors.textOnPrimary,
    },
  });

export default PlaceListCard;
