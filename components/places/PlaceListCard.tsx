import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
import CardActionPressable from '@/components/ui/CardActionPressable';
import RelatedTravelActionStack from '@/components/travel/RelatedTravelActionStack'
import { Menu } from '@/ui/paper';

import { useThemedColors } from '@/hooks/useTheme';
import {
  getNavigationActionVisual,
  resolveNavigationActionKind,
} from '@/components/navigation/navigationActionMeta';

const IS_WEB = Platform.OS === 'web';

type ActionChip = {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  accessibilityLabel?: string;
  title?: string;
};

type InlineAction = ActionChip;

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
  quickActions?: ActionChip[];
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
  relatedTravelUrl?: string | null;
  relatedTravelCountry?: string | null;
  relatedTravelCity?: string | null;
  // Fallback favorite (used for cards without a related travel so EVERY card
  // shows the same top-right favorite affordance).
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
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

const CardMeta = React.memo(function CardMeta({
  showTitleInContent,
  categoryLabel,
  badges,
  compact,
  styles,
}: {
  showTitleInContent: boolean;
  categoryLabel?: string | null;
  badges: string[];
  compact: boolean;
  styles: Record<string, any>;
}) {
  const showBadges = badges.length > 0;
  if (!categoryLabel && !showBadges) return null;

  // Content layout: category is rendered as a pill in the title block above —
  // here we only render the badges row.
  if (showTitleInContent) {
    if (!showBadges) return null;
    return (
      <View style={styles.detailRow}>
        {badges.map((badge, index) => (
          <View key={`${badge}-${index}`} style={styles.detailChip}>
            <Text style={styles.detailChipText} numberOfLines={1}>
              {badge}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  // Overlay layout: inline category + badges.
  return (
    <View style={styles.metaRow}>
      {!!categoryLabel &&
        (compact ? (
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText} numberOfLines={1}>
              {categoryLabel}
            </Text>
          </View>
        ) : (
          <Text style={styles.categoryText} numberOfLines={1}>
            {categoryLabel}
          </Text>
        ))}
      {showBadges &&
        badges.map((badge, index) => (
          <Text key={`${badge}-${index}`} style={styles.badgeText}>
            {badge}
          </Text>
        ))}
    </View>
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
  quickActions = [],
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
  relatedTravelUrl,
  relatedTravelCountry,
  relatedTravelCity,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const colors = useThemedColors();
  const showTitleInContent = titleLayout === 'content';
  const styles = useMemo(
    () => createStyles(colors, compact, showTitleInContent),
    [colors, compact, showTitleInContent],
  );
  const [overflowVisible, setOverflowVisible] = useState(false);

  const hasCoord = !!coord;
  const isCompactWebCard = compact && IS_WEB;
  // Unified compact card: primary actions (♥ favorite + ＋ save) live in the
  // top-right overlay so every list card reads identically. Every secondary
  // action (Telegram / map apps / «Открыть») collapses into a single «Ещё»
  // overflow menu, so the action row can never balloon into a long horizontal
  // strip on some cards and a short one on others.
  const overlayAddInline = isCompactWebCard && addButtonPlacement === 'row';
  const shareOverflowAction: ActionChip | null =
    isCompactWebCard && hasCoord && onShare
      ? {
          key: 'share',
          label: 'Telegram',
          icon: 'send',
          onPress: onShare,
          accessibilityLabel: 'Поделиться в Telegram',
          title: 'Поделиться в Telegram',
        }
      : null;
  const visibleMapActions = isCompactWebCard ? [] : mapActions;
  const visibleInlineActions = isCompactWebCard ? [] : inlineActions;
  const overflowActions = isCompactWebCard
    ? [
        ...(shareOverflowAction ? [shareOverflowAction] : []),
        ...mapActions,
        ...inlineActions,
      ]
    : [];
  const showShareChip = !isCompactWebCard && hasCoord && !!onShare;
  const showRowAddButton =
    showAddButton && addButtonPlacement === 'row' && !!onAddPoint && !overlayAddInline;
  const hasActionRow = showActionRow && (
    (hasCoord && !!onCopyCoord) ||
    showShareChip ||
    visibleMapActions.length > 0 ||
    visibleInlineActions.length > 0 ||
    overflowActions.length > 0 ||
    showRowAddButton
  );
  const openOverflowMenu = useCallback(() => setOverflowVisible(true), []);
  const closeOverflowMenu = useCallback(() => setOverflowVisible(false), []);
  const showInlineRelatedTravelActions = !!relatedTravelUrl && showTitleInContent;
  // Top-right overlay holds the two primary affordances (♥ favorite + ＋ save)
  // on EVERY card, so the list reads as one pattern regardless of whether a
  // card has a related travel or its own photo. Related-travel cards delegate
  // to the shared favorite/status stack; plain cards get the fallback ♥ plus
  // the ＋ "save point" button lifted out of the action row.
  const overlayAddButton =
    overlayAddInline && onAddPoint ? (
      <CardActionPressable
        accessibilityRole="button"
        accessibilityLabel={addLabel}
        accessibilityState={{ disabled: addDisabled || isAdding, busy: isAdding }}
        disabled={addDisabled || isAdding}
        onPress={() => void onAddPoint()}
        title={addLabel}
        style={({ pressed }) => [
          styles.fallbackFavButton,
          pressed && !addDisabled && !isAdding && styles.iconBtnPressed,
          (addDisabled || isAdding) && styles.iconBtnDisabled,
        ]}
      >
        {isAdding ? (
          <ActivityIndicator size="small" color={colors.textOnDark} />
        ) : (
          <Feather name="plus" size={18} color={colors.textOnDark} />
        )}
      </CardActionPressable>
    ) : null;

  const favoriteAffordance = relatedTravelUrl && !showInlineRelatedTravelActions ? (
    <RelatedTravelActionStack
      relatedTravelUrl={relatedTravelUrl}
      fallbackTitle={title}
      fallbackImageUrl={imageUrl}
      fallbackCountry={relatedTravelCountry}
      fallbackCity={relatedTravelCity}
    />
  ) : onToggleFavorite ? (
    // Cards without a related travel still expose the same top-right favorite
    // affordance so the whole list reads as one card pattern.
    <CardActionPressable
      accessibilityRole="button"
      accessibilityState={{ selected: isFavorite }}
      accessibilityLabel={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
      onPress={onToggleFavorite}
      title={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
      style={({ pressed }) => [styles.fallbackFavButton, pressed && styles.iconBtnPressed]}
    >
      <Feather
        name="heart"
        size={18}
        color={isFavorite ? colors.danger : colors.textOnDark}
        {...(!isFavorite ? ({ style: { opacity: 0.85 } } as any) : null)}
      />
    </CardActionPressable>
  ) : null

  const quickActionButtons = quickActions.map((action) => (
    <CardActionPressable
      key={action.key}
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel ?? action.title ?? action.label}
      onPress={action.onPress}
      title={action.title ?? action.label}
      style={({ pressed }) => [
        styles.fallbackFavButton,
        styles.quickActionButton,
        pressed && styles.iconBtnPressed,
      ]}
    >
      <Feather
        name={action.icon}
        size={18}
        color={colors.textOnPrimary ?? colors.textOnDark}
      />
    </CardActionPressable>
  ))

  const relatedTravelActions =
    quickActionButtons.length > 0 || favoriteAffordance || overlayAddButton ? (
      <View style={styles.fallbackActionStack}>
        {quickActionButtons}
        {favoriteAffordance}
        {overlayAddButton}
      </View>
    ) : null

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
      rightTopSlot={relatedTravelActions}
      rightTopSlotScrim
      mediaPlaceholderSlot={
        <View style={styles.mediaPlaceholder}>
          <Feather name="map-pin" size={26} color={colors.textMuted} />
          <Text style={styles.mediaPlaceholderText} numberOfLines={1}>
            {categoryLabel || 'Без фото'}
          </Text>
        </View>
      }
      contentSlot={
        <View style={styles.content}>
          {showTitleInContent && (
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
          )}

          <CardMeta
            showTitleInContent={showTitleInContent}
            categoryLabel={categoryLabel}
            badges={badges}
            compact={compact}
            styles={styles}
          />

          {showInlineRelatedTravelActions && relatedTravelUrl ? (
            <View style={styles.inlineRelatedTravelActions}>
              <RelatedTravelActionStack
                relatedTravelUrl={relatedTravelUrl}
                fallbackTitle={title}
                fallbackImageUrl={imageUrl}
                fallbackCountry={relatedTravelCountry}
                fallbackCity={relatedTravelCity}
                variant="inline"
                style={styles.inlineRelatedTravelActionStack}
              />
            </View>
          ) : null}

          {hasActionRow && (
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

              {showShareChip && onShare && (
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

              {overflowActions.length > 0 && (
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
              )}

              {showRowAddButton && onAddPoint && (
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
              )}
            </View>
          )}

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
                  <Feather
                    name="bookmark"
                    size={14}
                    color={colors.primaryDark ?? colors.primary}
                  />
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
        allowCriticalWebBlur: IS_WEB,
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
) => {
  // Modern compact spacing scale (4pt grid).
  const padX = compact ? 12 : showTitleInContent ? 16 : 14
  const padY = compact ? 10 : showTitleInContent ? 14 : 12
  const stackGap = compact ? 6 : showTitleInContent ? 10 : 8
  const chipPadX = compact ? 9 : 11
  const chipPadY = compact ? 4 : 5
  const webTransition = (props: string) =>
    Platform.select({ web: { transition: props } as any })

  return StyleSheet.create({
    contentContainer: {
      paddingHorizontal: padX,
      paddingTop: padY,
      paddingBottom: padY,
    },
    mediaPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 16,
    },
    mediaPlaceholderText: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.2,
      color: colors.textMuted,
      maxWidth: 180,
    },
    content: {
      gap: stackGap,
    },
    titleBlock: {
      gap: compact ? 6 : 8,
    },
    titleText: {
      fontSize: compact ? 15 : 18,
      lineHeight: compact ? 20 : 24,
      fontWeight: '800',
      letterSpacing: compact ? -0.3 : -0.45,
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
      gap: compact ? 6 : 8,
    },
    // Plain inline category text (overlay layout, non-compact).
    categoryText: {
      fontSize: compact ? 11 : 12.5,
      fontWeight: '600',
      letterSpacing: 0.1,
      color: colors.textMuted,
    },
    badgeText: {
      fontSize: compact ? 11 : 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    // Accent category pill (content layout title block).
    categoryPill: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
      paddingHorizontal: chipPadX,
      paddingVertical: chipPadY,
      borderRadius: 999,
      backgroundColor: colors.primarySoft ?? colors.backgroundSecondary,
    },
    categoryPillText: {
      fontSize: compact ? 10.5 : 11.5,
      lineHeight: compact ? 13 : 15,
      color: colors.primaryDark ?? colors.primary,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    // Neutral info pill (badges in content layout).
    detailChip: {
      maxWidth: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: chipPadX,
      paddingVertical: chipPadY,
      borderRadius: 999,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    detailChipText: {
      fontSize: compact ? 11 : 12,
      lineHeight: compact ? 14 : 16,
      color: colors.textMuted,
      fontWeight: '600',
      letterSpacing: 0.1,
    },
    // Subtle ghost pill (category in overlay/compact layout).
    metaChip: {
      maxWidth: '100%',
      paddingHorizontal: compact ? 8 : 9,
      paddingVertical: compact ? 3 : 4,
      borderRadius: 999,
      backgroundColor: colors.backgroundSecondary,
    },
    metaChipText: {
      fontSize: 10.5,
      lineHeight: 13,
      color: colors.textMuted,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      gap: compact ? 6 : 8,
      marginTop: 2,
    },
    iconBtnPressed: {
      opacity: 0.65,
      ...Platform.select({ web: { transform: 'scale(0.97)' as any } }),
    },
    fallbackActionStack: {
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 6,
    },
    fallbackFavButton: {
      alignSelf: 'flex-start',
      padding: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      ...Platform.select({ web: { cursor: 'pointer' as any } }),
    },
    inlineRelatedTravelActions: {
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    inlineRelatedTravelActionStack: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      flexWrap: 'wrap',
      gap: 8,
    },
    quickActionButton: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    iconBtnDisabled: {
      opacity: 0.45,
    },
    // Vertical icon+label action tile.
    mapActionChip: {
      alignItems: 'center',
      justifyContent: 'flex-start',
      width: compact ? 56 : 62,
      minHeight: compact ? 54 : 60,
      paddingHorizontal: 2,
      paddingVertical: compact ? 4 : 5,
      borderRadius: 14,
      gap: 5,
      ...webTransition('background-color 0.16s ease, transform 0.16s ease'),
    },
    mapActionIconBubble: {
      width: compact ? 34 : 38,
      height: compact ? 34 : 38,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    mapActionLabel: {
      fontSize: compact ? 10 : 11,
      lineHeight: compact ? 12 : 14,
      fontWeight: '600',
      color: colors.textMuted,
      textAlign: 'center',
      maxWidth: compact ? 56 : 62,
    },
    // Primary-soft filled "add" button (modern).
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: compact ? 6 : 7,
      paddingVertical: compact ? 8 : 9,
      paddingHorizontal: compact ? 14 : 16,
      borderRadius: 999,
      backgroundColor: colors.primarySoft ?? colors.backgroundSecondary,
      ...webTransition('background-color 0.16s ease, opacity 0.16s ease, transform 0.16s ease'),
    },
    addButtonPressed: {
      opacity: 0.85,
      ...Platform.select({ web: { transform: 'scale(0.985)' as any } }),
    },
    addButtonDisabled: {
      opacity: 0.45,
    },
    addButtonText: {
      fontSize: compact ? 12 : 13,
      fontWeight: '700',
      letterSpacing: 0.1,
      color: colors.primaryDark ?? colors.primary,
    },
    overflowMenuContent: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      borderRadius: 14,
      minWidth: compact ? 184 : 208,
      ...Platform.select({
        web: { boxShadow: '0 8px 28px rgba(15,23,42,0.16)' as any },
      }),
    },
    overflowMenuItem: {
      minHeight: compact ? 42 : 46,
    },
    overflowMenuItemTitle: {
      fontSize: compact ? 13 : 14,
      fontWeight: '600',
      color: colors.text,
    },
  })
}

export default React.memo(PlaceListCard);
