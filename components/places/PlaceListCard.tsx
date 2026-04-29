import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
import CardActionPressable from '@/components/ui/CardActionPressable';
import { Menu } from '@/ui/paper';

import { useThemedColors } from '@/hooks/useTheme';
import {
  getNavigationActionVisual,
  resolveNavigationActionKind,
} from '@/components/navigation/navigationActionMeta';

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
  showActionRow?: boolean;
  showAddButton?: boolean;
  addButtonPlacement?: 'button' | 'row';
  webTouchAction?: string;
  compact?: boolean;
  titleLayout?: 'overlay' | 'content';
  titleNumberOfLines?: number;
};

const MapActionChip = React.memo(function MapActionChip({
  action,
  colors,
  styles,
}: {
  action: ActionChip;
  colors: ReturnType<typeof useThemedColors>;
  styles: Record<string, any>;
}) {
  const kind = resolveNavigationActionKind(action.key, action.label);
  const visual = kind ? getNavigationActionVisual(kind, colors) : null;

  return (
    <LabeledActionChip
      accessibilityLabel={action.accessibilityLabel ?? action.title ?? action.label}
      icon={visual?.icon ?? action.icon}
      iconBubbleStyle={visual ? { backgroundColor: visual.tintBg } : null}
      iconColor={visual?.iconColor ?? colors.textMuted}
      label={action.label}
      onPress={action.onPress}
      styles={styles}
      title={action.title ?? action.label}
    />
  );
});

const LabeledActionChip = React.memo(function LabeledActionChip({
  accessibilityLabel,
  accessibilityState,
  children,
  disabled,
  icon,
  iconBubbleStyle,
  iconColor,
  label,
  onPress,
  styles,
  title,
}: {
  accessibilityLabel?: string;
  accessibilityState?: { checked?: boolean; selected?: boolean; disabled?: boolean; expanded?: boolean; busy?: boolean };
  children?: React.ReactNode;
  disabled?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  iconBubbleStyle?: any;
  iconColor?: string;
  label: string;
  onPress?: () => void;
  styles: Record<string, any>;
  title?: string;
}) {
  return (
    <CardActionPressable
      accessibilityLabel={accessibilityLabel ?? title ?? label}
      accessibilityState={accessibilityState ?? (disabled ? { disabled: true } : undefined)}
      disabled={disabled}
      onPress={onPress}
      title={title ?? label}
      style={({ pressed }) => [
        styles.mapActionChip,
        pressed && !disabled && styles.iconBtnPressed,
        disabled && styles.iconBtnDisabled,
      ]}
    >
      <View style={[styles.mapActionIconBubble, iconBubbleStyle]}>
        {children ?? (icon ? <Feather name={icon} size={16} color={iconColor} /> : null)}
      </View>
      <Text style={styles.mapActionLabel} numberOfLines={1}>
        {label}
      </Text>
    </CardActionPressable>
  );
});

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
  width,
  imageHeight = 140,
  testID,
  style,
  showActionRow = true,
  showAddButton = true,
  addButtonPlacement = 'button',
  webTouchAction,
  compact = false,
  titleLayout = 'overlay',
  titleNumberOfLines = 2,
}) => {
  const colors = useThemedColors();
  const showTitleInContent = titleLayout === 'content';
  const styles = useMemo(
    () => createStyles(colors, compact, showTitleInContent),
    [colors, compact, showTitleInContent],
  );
  const [overflowVisible, setOverflowVisible] = useState(false);

  const hasCoord = !!coord;
  const showBadges = badges.length > 0;
  const isCompactWebCard = compact && Platform.OS === 'web';
  const visibleMapActions = isCompactWebCard ? mapActions.slice(0, 1) : mapActions;
  const visibleInlineActions = isCompactWebCard ? [] : inlineActions;
  const overflowActions = isCompactWebCard ? [...mapActions.slice(1), ...inlineActions] : [];
  const hasActionRow = showActionRow && (
    (hasCoord && !!onCopyCoord) ||
    (hasCoord && !!onShare) ||
    visibleMapActions.length > 0 ||
    visibleInlineActions.length > 0 ||
    overflowActions.length > 0 ||
    (showAddButton && addButtonPlacement === 'row' && !!onAddPoint)
  );
  const openOverflowMenu = useCallback(() => setOverflowVisible(true), []);
  const closeOverflowMenu = useCallback(() => setOverflowVisible(false), []);

  return (
    <UnifiedTravelCard
      title={title}
      imageUrl={imageUrl}
      metaText={categoryLabel ?? undefined}
      onPress={onCardPress ?? (() => {})}
      onMediaPress={onMediaPress}
      mediaFit="contain"
      imageHeight={imageHeight}
      width={width}
      testID={testID}
      style={style}
      heroTitleOverlay={!showTitleInContent}
      webHoverScale={false}
      webTouchAction={webTouchAction}
      contentSlot={
        <View style={styles.content}>
          {showTitleInContent ? (
            <View style={styles.titleBlock}>
              {!!categoryLabel && (
                <View style={styles.categoryPill}>
                  <Text style={styles.categoryPillText} numberOfLines={1}>
                    {categoryLabel}
                  </Text>
                </View>
              )}
              <Text style={styles.titleText} numberOfLines={titleNumberOfLines}>
                {title}
              </Text>
            </View>
          ) : null}

          {(!!categoryLabel || showBadges) ? (
            showTitleInContent ? (
              showBadges ? (
                <View style={styles.detailRow}>
                  {badges.map((badge, index) => (
                    <View key={`${badge}-${index}`} style={styles.detailChip}>
                      <Text style={styles.detailChipText} numberOfLines={1}>
                        {badge}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null
            ) : (
              <View style={styles.metaRow}>
                {!!categoryLabel && (
                  compact ? (
                    <View style={styles.metaChip}>
                      <Text style={styles.metaChipText} numberOfLines={1}>
                        {categoryLabel}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.categoryText} numberOfLines={1}>
                      {categoryLabel}
                    </Text>
                  )
                )}
                {showBadges && badges.map((badge, index) => (
                  <Text key={`${badge}-${index}`} style={styles.badgeText}>
                    {badge}
                  </Text>
                ))}
              </View>
            )
          ) : null}

          {hasActionRow ? (
            <View style={styles.actionsRow}>
              {hasCoord && onCopyCoord && (
                <LabeledActionChip
                  accessibilityLabel="Скопировать координаты"
                  icon="copy"
                  iconColor={colors.textMuted}
                  label="Коорд."
                  onPress={() => void onCopyCoord()}
                  styles={styles}
                  title={coord || 'Скопировать координаты'}
                />
              )}

              {hasCoord && onShare && (
                <LabeledActionChip
                  accessibilityLabel="Поделиться в Telegram"
                  icon="send"
                  iconColor={colors.textMuted}
                  label="Telegram"
                  onPress={() => void onShare()}
                  styles={styles}
                  title="Телеграм"
                />
              )}

              {visibleMapActions.map((action) => (
                <MapActionChip
                  key={action.key}
                  action={action}
                  colors={colors}
                  styles={styles}
                />
              ))}

              {visibleInlineActions.map((action) => (
                <LabeledActionChip
                  key={action.key}
                  accessibilityLabel={action.accessibilityLabel ?? action.title ?? action.label}
                  icon={action.icon}
                  iconColor={colors.textMuted}
                  label={action.label}
                  onPress={action.onPress}
                  styles={styles}
                  title={action.title ?? action.label}
                />
              ))}

              {overflowActions.length > 0 ? (
                <Menu
                  visible={overflowVisible}
                  onDismiss={closeOverflowMenu}
                  contentStyle={styles.overflowMenuContent}
                  anchor={
                    <LabeledActionChip
                      accessibilityLabel="Ещё действия"
                      accessibilityState={{ expanded: overflowVisible }}
                      icon="more-horizontal"
                      iconColor={colors.textMuted}
                      label="Ещё"
                      onPress={openOverflowMenu}
                      styles={styles}
                      title="Ещё действия"
                    />
                  }
                >
                  {overflowActions.map((action) => (
                    <Menu.Item
                      key={action.key}
                      onPress={() => {
                        closeOverflowMenu();
                        action.onPress();
                      }}
                      title={action.title ?? action.label}
                      style={styles.overflowMenuItem}
                      titleStyle={styles.overflowMenuItemTitle}
                      leadingIcon={({ size }) => (
                        <Feather name={action.icon} size={size} color={colors.textMuted} />
                      )}
                    />
                  ))}
                </Menu>
              ) : null}

              {showAddButton && addButtonPlacement === 'row' && onAddPoint ? (
                <LabeledActionChip
                  accessibilityLabel={addLabel}
                  disabled={addDisabled || isAdding}
                  icon={isAdding ? undefined : 'bookmark'}
                  iconColor={colors.textMuted}
                  label={addLabel}
                  onPress={() => void onAddPoint()}
                  styles={styles}
                  title={addLabel}
                >
                  {isAdding ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : null}
                </LabeledActionChip>
              ) : null}
            </View>
          ) : null}

          {showAddButton && addButtonPlacement === 'button' && onAddPoint && (
            <CardActionPressable
              onPress={() => void onAddPoint()}
              disabled={addDisabled || isAdding}
              accessibilityLabel={addLabel}
              title={addLabel}
              style={({ pressed }) => [
                styles.addButton,
                pressed && !addDisabled && !isAdding && styles.addButtonPressed,
                (addDisabled || isAdding) && styles.addButtonDisabled,
              ]}
            >
              {isAdding ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Feather name="map-pin" size={13} color={colors.primary} />
                  <Text style={styles.addButtonText} numberOfLines={1}>
                    {addLabel}
                  </Text>
                </>
              )}
            </CardActionPressable>
          )}
        </View>
      }
      mediaProps={{
        blurBackground: !!imageUrl,
        allowCriticalWebBlur: Platform.OS === 'web',
        blurRadius: 16,
        loading: 'lazy',
        priority: 'low',
        optimizeWeb: false,
      }}
      contentContainerStyle={styles.contentContainer}
    />
  );
};

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  compact: boolean,
  showTitleInContent: boolean,
) =>
  StyleSheet.create({
    contentContainer: {
      paddingHorizontal: compact ? 10 : showTitleInContent ? 14 : 12,
      paddingTop: compact ? 8 : showTitleInContent ? 12 : 10,
      paddingBottom: compact ? 10 : showTitleInContent ? 14 : 12,
    },
    content: {
      gap: compact ? 4 : showTitleInContent ? 8 : 6,
    },
    titleBlock: {
      gap: compact ? 4 : 8,
    },
    titleText: {
      fontSize: compact ? 15 : 18,
      lineHeight: compact ? 19 : 23,
      fontWeight: '800',
      letterSpacing: -0.35,
      color: colors.text,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: compact ? 6 : 8,
    },
    detailRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    categoryText: {
      fontSize: compact ? 11 : 12,
      color: colors.textMuted,
    },
    badgeText: {
      fontSize: compact ? 11 : 12,
      color: colors.textMuted,
    },
    categoryPill: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
      paddingHorizontal: compact ? 8 : 10,
      paddingVertical: compact ? 4 : 5,
      borderRadius: 999,
      backgroundColor: colors.primarySoft ?? colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30 ?? colors.borderLight,
    },
    categoryPillText: {
      fontSize: compact ? 10 : 11,
      lineHeight: compact ? 12 : 14,
      color: colors.primaryDark ?? colors.primary,
      fontWeight: '700',
      letterSpacing: 0.1,
    },
    detailChip: {
      maxWidth: '100%',
      paddingHorizontal: compact ? 8 : 10,
      paddingVertical: compact ? 4 : 5,
      borderRadius: 999,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    detailChipText: {
      fontSize: compact ? 11 : 12,
      lineHeight: compact ? 14 : 16,
      color: colors.textMuted,
      fontWeight: '600',
    },
    metaChip: {
      maxWidth: '100%',
      paddingHorizontal: compact ? 7 : 8,
      paddingVertical: compact ? 3 : 4,
      borderRadius: 999,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    metaChipText: {
      fontSize: 10,
      lineHeight: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: compact ? 4 : 6,
    },
    iconBtnPressed: {
      opacity: 0.7,
    },
    iconBtnDisabled: {
      opacity: 0.5,
    },
    mapActionChip: {
      alignItems: 'center',
      justifyContent: 'flex-start',
      width: compact ? 54 : 60,
      minHeight: compact ? 52 : 58,
      paddingHorizontal: 2,
      paddingVertical: compact ? 3 : 4,
      borderRadius: 12,
      gap: 4,
      ...Platform.select({
        web: {
          cursor: 'pointer' as any,
          transition: 'background-color 0.15s ease, transform 0.15s ease',
        },
      }),
    },
    mapActionIconBubble: {
      width: compact ? 32 : 36,
      height: compact ? 32 : 36,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
    },
    mapActionLabel: {
      fontSize: compact ? 10 : 11,
      lineHeight: compact ? 12 : 14,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      maxWidth: compact ? 54 : 60,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: compact ? 5 : 6,
      paddingVertical: compact ? 5 : 6,
      paddingHorizontal: compact ? 10 : 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderLight ?? colors.border,
      backgroundColor: 'transparent',
      ...Platform.select({
        web: {
          cursor: 'pointer' as any,
          transition: 'opacity 0.15s ease',
        },
      }),
    },
    addButtonPressed: {
      opacity: 0.7,
    },
    addButtonDisabled: {
      borderColor: colors.borderLight ?? colors.border,
      opacity: 0.5,
    },
    addButtonText: {
      fontSize: compact ? 11 : 12,
      fontWeight: '600',
      color: colors.primary,
    },
    overflowMenuContent: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 12,
      minWidth: compact ? 180 : 200,
    },
    overflowMenuItem: {
      minHeight: compact ? 40 : 44,
    },
    overflowMenuItemTitle: {
      fontSize: compact ? 13 : 14,
      color: colors.text,
    },
  });

export default React.memo(PlaceListCard);
