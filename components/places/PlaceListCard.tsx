import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
import CardActionPressable from '@/components/ui/CardActionPressable';
import ActionListSheet from '@/components/ui/ActionListSheet';
import RelatedTravelActionStack from '@/components/travel/RelatedTravelActionStack'
import { Menu } from '@/ui/paper';

import { useThemedColors } from '@/hooks/useTheme';
import { SEMANTIC_ACTION_ICON } from '@/components/navigation/navigationActionMeta';
import {
  CardMeta,
  LabeledActionChip,
  MapActionChip,
} from './PlaceListCard.parts';
import type { PlaceListCardProps } from './PlaceListCard.types';
import { buildPlaceListCardActionModel } from './placeListCardActionModel';
import { translate as i18nT } from '@/i18n'


const IS_WEB = Platform.OS === 'web';

const PlaceListCard: React.FC<PlaceListCardProps> = ({
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
  isSaved = false,
  addLabel = i18nT('map:components.places.PlaceListCard.moi_tochki_bd56c6f8'),
  width,
  imageHeight = 140,
  eagerImage = false,
  testID,
  style,
  showActionRow = true,
  showAddButton = true,
  addButtonPlacement = 'button',
  webTouchAction,
  compact = false,
  titleLayout = 'overlay',
  titleNumberOfLines = 2,
  popupAligned = false,
  relatedTravelUrl,
  relatedTravelCountry,
  relatedTravelCity,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const colors = useThemedColors();
  const showTitleInContent = titleLayout === 'content';
  const styles = useMemo(
    () => createStyles(colors, compact, showTitleInContent, popupAligned),
    [colors, compact, showTitleInContent, popupAligned],
  );
  const [overflowVisible, setOverflowVisible] = useState(false);

  const hasCoord = !!coord;
  const isCompactActionCard = compact;
  const {
    hasActionRow,
    overflowActionLabel,
    overflowActionTitle,
    overflowActions,
    overlayAddInline,
    saveIcon,
    saveIconColor,
    saveLabel,
    savedColor,
    showInlineRelatedTravelActions,
    showRowAddButton,
    showRowQuickActions,
    showSaveTile,
    showShareChip,
    showTitleShare,
    visibleInlineActions,
    visibleMapActions,
  } = buildPlaceListCardActionModel({
    addButtonPlacement,
    addLabel,
    colors,
    hasCoord,
    inlineActions,
    isAdding,
    isCompactActionCard,
    isSaved,
    mapActions,
    onAddPoint,
    onCopyCoord,
    onShare,
    popupAligned,
    quickActions,
    relatedTravelUrl,
    showActionRow,
    showAddButton,
    showTitleInContent,
  });
  const openOverflowMenu = useCallback(() => setOverflowVisible(true), []);
  const closeOverflowMenu = useCallback(() => setOverflowVisible(false), []);
  // Top-right overlay holds the two primary affordances (♥ favorite + ＋ save)
  // on EVERY card, so the list reads as one pattern regardless of whether a
  // card has a related travel or its own photo. Related-travel cards delegate
  // to the shared favorite/status stack; plain cards get the fallback ♥ plus
  // the ＋ "save point" button lifted out of the action row.
  const overlayAddButton =
    overlayAddInline && !showSaveTile && onAddPoint ? (
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
      accessibilityLabel={isFavorite ? i18nT('map:components.places.PlaceListCard.ubrat_iz_izbrannogo_5252f484') : i18nT('map:components.places.PlaceListCard.dobavit_v_izbrannoe_47de2856')}
      onPress={onToggleFavorite}
      title={isFavorite ? i18nT('map:components.places.PlaceListCard.ubrat_iz_izbrannogo_5252f484') : i18nT('map:components.places.PlaceListCard.dobavit_v_izbrannoe_47de2856')}
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

  // Popup parity: in popup-aligned mode the hero corner stack holds ONLY the two
  // primary affordances (♥ favorite + trip-status), exactly like the map popup
  // and the travel-points card. Any quick action (e.g. «Построить маршрут сюда»)
  // moves OUT of the corner into the action row as a labeled tile (see
  // `rowQuickActions` below) so the photo keeps just 2 corner icons.
  const cornerQuickActions = popupAligned ? [] : quickActions;
  const quickActionButtons = cornerQuickActions.map((action) => (
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
      <View style={[styles.fallbackActionStack, popupAligned && styles.fallbackActionStackStart]}>
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
      style={style as React.ComponentProps<typeof UnifiedTravelCard>['style']}
      heroTitleOverlay={!showTitleInContent}
      webHoverScale={false}
      webTouchAction={webTouchAction}
      leftTopSlot={popupAligned ? relatedTravelActions : undefined}
      rightTopSlot={popupAligned ? undefined : relatedTravelActions}
      rightTopSlotScrim={!popupAligned}
      mediaPlaceholderSlot={<View style={styles.mediaPlaceholder} />}
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
              {showTitleShare && onShare ? (
                <View style={styles.titleShareRow}>
                  <Text
                    style={[styles.titleText, styles.titleTextFlex]}
                    numberOfLines={titleNumberOfLines}
                  >
                    {title}
                  </Text>
                  <CardActionPressable
                    accessibilityRole="button"
                    accessibilityLabel={i18nT('map:components.places.PlaceListCard.podelitsya_v_telegram_a5cebf19')}
                    onPress={() => void onShare()}
                    title={i18nT('map:components.places.PlaceListCard.podelitsya_v_telegram_a5cebf19')}
                    style={({ pressed }) => [
                      styles.titleShareButton,
                      pressed && styles.iconBtnPressed,
                    ]}
                  >
                    <Feather name={SEMANTIC_ACTION_ICON.telegramShare} size={18} color={colors.primaryDark} />
                  </CardActionPressable>
                </View>
              ) : (
                <Text style={styles.titleText} numberOfLines={titleNumberOfLines}>
                  {title}
                </Text>
              )}
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
              <Text style={styles.inlineSectionLabel}>{i18nT('map:components.places.PlaceListCard.status_poezdki_718acbe9')}</Text>
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
              {showRowQuickActions &&
                quickActions.map((action) => (
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

              {hasCoord && onCopyCoord && (
                <LabeledActionChip
                  accessibilityLabel={i18nT('map:components.places.PlaceListCard.skopirovat_koordinaty_6eaf9e07')}
                  icon="copy"
                  iconColor={colors.textMuted}
                  label={i18nT('map:components.places.PlaceListCard.koord_f65169a2')}
                  onPress={() => void onCopyCoord()}
                  styles={styles}
                  title={coord || i18nT('map:components.places.PlaceListCard.skopirovat_koordinaty_6eaf9e07')}
                />
              )}

              {showShareChip && onShare && (
                <LabeledActionChip
                  accessibilityLabel={i18nT('map:components.places.PlaceListCard.podelitsya_v_telegram_a5cebf19')}
                  icon={SEMANTIC_ACTION_ICON.telegramShare}
                  iconColor={colors.textMuted}
                  label={i18nT('map:components.places.PlaceListCard.telegram_5a2f6e04')}
                  onPress={() => void onShare()}
                  styles={styles}
                  title={i18nT('map:components.places.PlaceListCard.telegram_6d191220')}
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

              {showSaveTile && onAddPoint && (
                <LabeledActionChip
                  accessibilityLabel={saveLabel}
                  accessibilityState={{ checked: isSaved, disabled: addDisabled || isAdding, busy: isAdding }}
                  disabled={addDisabled || isAdding}
                  icon={saveIcon}
                  iconColor={saveIconColor}
                  label={saveLabel}
                  onPress={() => void onAddPoint()}
                  styles={styles}
                  title={saveLabel}
                >
                  {isAdding ? (
                    <ActivityIndicator size="small" color={colors.primaryDark} />
                  ) : null}
                </LabeledActionChip>
              )}

              {overflowActions.length > 0 && (
                isCompactActionCard ? (
                  <>
                    <LabeledActionChip
                      accessibilityLabel={overflowActionTitle}
                      accessibilityState={{ expanded: overflowVisible }}
                      icon={mapActions.length > 0 ? SEMANTIC_ACTION_ICON.navigationMenu : 'more-horizontal'}
                      iconColor={colors.textMuted}
                      label={overflowActionLabel}
                      onPress={openOverflowMenu}
                      styles={styles}
                      title={overflowActionTitle}
                    />
                    <ActionListSheet
                      actions={overflowActions}
                      onClose={closeOverflowMenu}
                      title={overflowActionTitle}
                      visible={overflowVisible}
                    />
                  </>
                ) : (
                  <Menu
                    visible={overflowVisible}
                    onDismiss={closeOverflowMenu}
                    contentStyle={styles.overflowMenuContent}
                    anchor={
                      <LabeledActionChip
                        accessibilityLabel={overflowActionTitle}
                        accessibilityState={{ expanded: overflowVisible }}
                        icon={mapActions.length > 0 ? SEMANTIC_ACTION_ICON.navigationMenu : 'more-horizontal'}
                        iconColor={colors.textMuted}
                        label={overflowActionLabel}
                        onPress={openOverflowMenu}
                        styles={styles}
                        title={overflowActionTitle}
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
                )
              )}

              {showRowAddButton && onAddPoint && (
                <LabeledActionChip
                  accessibilityLabel={saveLabel}
                  accessibilityState={{ checked: isSaved, disabled: addDisabled || isAdding, busy: isAdding }}
                  disabled={addDisabled || isAdding}
                  icon={saveIcon}
                  iconColor={saveIconColor}
                  label={saveLabel}
                  onPress={() => void onAddPoint()}
                  styles={styles}
                  title={saveLabel}
                >
                  {isAdding ? (
                    <ActivityIndicator size="small" color={colors.primaryDark} />
                  ) : null}
                </LabeledActionChip>
              )}
            </View>
          )}

          {showAddButton && addButtonPlacement === 'button' && !showSaveTile && onAddPoint && (
            <CardActionPressable
              onPress={() => void onAddPoint()}
              disabled={addDisabled || isAdding}
              accessibilityLabel={saveLabel}
              accessibilityState={{ checked: isSaved, disabled: addDisabled || isAdding, busy: isAdding }}
              title={saveLabel}
              style={({ pressed }) => [
                styles.addButton,
                pressed && !addDisabled && !isAdding && styles.addButtonPressed,
                (addDisabled || isAdding) && styles.addButtonDisabled,
              ]}
            >
              {isAdding ? (
                <ActivityIndicator size="small" color={colors.primaryDark} />
              ) : (
                <>
                  <Feather
                    name={isSaved ? 'check' : 'bookmark'}
                    size={14}
                    color={isSaved ? savedColor : colors.primaryDark ?? colors.primary}
                  />
                  <Text style={styles.addButtonText} numberOfLines={1}>
                    {saveLabel}
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
        loading: eagerImage ? 'eager' : 'lazy',
        priority: eagerImage ? 'high' : 'low',
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
  popupAligned: boolean,
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
      paddingHorizontal: 16,
      backgroundColor: colors.backgroundSecondary,
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
    titleShareRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    titleTextFlex: {
      flex: 1,
    },
    titleShareButton: {
      flexShrink: 0,
      padding: 6,
      marginTop: -2,
      borderRadius: 999,
      ...Platform.select({ web: { cursor: 'pointer' as any } }),
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
      color: colors.primaryText,
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
      // Popup-aligned: keep all tiles on ONE row spanning the full width (flex:1
      // chips shrink to fit) so labels are not pushed to a second line.
      flexWrap: popupAligned ? 'nowrap' : 'wrap',
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
    // Popup-aligned points card: hero TOP-LEFT corner stack (♥ + compact status),
    // matching the map popup — left-aligned instead of the default right corner.
    fallbackActionStackStart: {
      alignItems: 'flex-start',
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
      gap: compact ? 5 : 6,
    },
    inlineSectionLabel: {
      fontSize: compact ? 10.5 : 11.5,
      lineHeight: compact ? 13 : 15,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.2,
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
    // Popup-aligned mode: tiles distribute evenly across the FULL card width
    // (`flex:1, minWidth:0`) so 4 tiles each get ~¼ of the row and the labels
    // («Сохранить» / «Навигация») have room and never truncate. Non-popupAligned
    // (e.g. /places inline map-app chips) keep the fixed 56/62px width so many
    // inline chips don't squash.
    mapActionChip: {
      alignItems: 'center',
      justifyContent: 'flex-start',
      ...(popupAligned
        ? { flex: 1, minWidth: 0 }
        : { width: compact ? 56 : 62 }),
      minHeight: compact ? 54 : 60,
      paddingHorizontal: popupAligned ? 4 : 2,
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
      // Popup-aligned tiles span the full card width, so the label uses the whole
      // tile (no cap → no «…» truncation). Non-popupAligned keeps the fixed cap.
      ...(popupAligned ? { alignSelf: 'stretch' } : { maxWidth: compact ? 56 : 62 }),
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
      color: colors.primaryText,
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
