import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { ThemedColors } from '@/hooks/useTheme';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import CardActionPressable from '@/components/ui/CardActionPressable';
import ActionListSheet, { type ActionListSheetItem } from '@/components/ui/ActionListSheet';
import RelatedTravelActionStack from '@/components/travel/RelatedTravelActionStack'
import { SEMANTIC_ACTION_ICON } from '@/components/navigation/navigationActionMeta';
import { POPUP_TOOLTIPS } from './constants';
import FullscreenImageViewer from './FullscreenImageViewer';
import FullscreenPopupOverlay from './FullscreenPopupOverlay';
import { stopWebPopupEvent } from './domEvents';
import { usePopupDomGuard } from './usePopupDomGuard';
import { usePopupLayout } from './usePopupLayout';
import { usePopupActions } from './usePopupActions';

type Props = {
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  categoryLabel?: string | null;
  coord?: string | null;
  drivingDistanceMeters?: number | null;
  drivingDurationSeconds?: number | null;
  isDrivingLoading?: boolean;
  onOpenArticle?: () => void;
  articleHref?: string | null;
  relatedTravelUrl?: string | null;
  relatedTravelCountry?: string | null;
  relatedTravelCity?: string | null;
  onCopyCoord?: () => void;
  onShareTelegram?: () => void;
  onOpenGoogleMaps?: () => void;
  onOpenAppleMaps?: () => void;
  onOpenOrganicMaps?: () => void;
  onOpenWaze?: () => void;
  onOpenYandexMaps?: () => void;
  onOpenYandexNavi?: () => void;
  onOpenOpenStreetMap?: () => void;
  onAddPoint?: () => void;
  onBuildRoute?: () => void;
  extraActions?: Array<{
    key: string;
    label: string;
    icon: React.ComponentProps<typeof Feather>['name'];
    onPress: () => void;
    accessibilityLabel?: string;
    tooltip?: string;
  }>;
  suppressFallbackPrimaryAction?: boolean;
  /**
   * #FIX-3 — surface «Поделиться» as a small icon in the title row (next to the
   * share/utility area) instead of inside the navigation sheet. Telegram is a share
   * action, not a map-app, so it no longer belongs in «Навигация и действия». Used
   * by the native bottom card; also drives the native nav ActionListSheet + the
   * coherence relayout (hero-corner ♥, full-width status, «Сохранить» chip).
   */
  shareInActionRow?: boolean;
  addDisabled?: boolean;
  isAdding?: boolean;
  /**
   * #334 — the point is already in the user's «Мои точки» collection. Drives the
   * toggle visual (check + «Сохранено») and the tap-to-remove tooltip; the actual
   * remove is wired by the caller via `onAddPoint`.
   */
  isSaved?: boolean;
  addLabel?: string;
  addTooltip?: string;
  width?: number;
  imageHeight?: number;
  compactLayout?: boolean;
  fullscreenOnMobile?: boolean;
  /**
   * Mobile bottom-sheet split (web): render a FIXED hero photo header with the
   * caption/actions in a separate scrollable region below, so expanding «Ещё»
   * scrolls the text UNDER a still photo (the photo never jerks). Used by
   * `MapPlaceBottomCard`; desktop Leaflet popup / native keep the stacked layout.
   */
  bottomSheetSplit?: boolean;
  fullscreenTopInset?: number;
  fullscreenBottomInset?: number;
  /**
   * Desktop Leaflet popup split (web): same FIXED hero photo header + scrollable
   * caption/actions as `bottomSheetSplit`, but the popup has NO fixed outer height
   * (content-driven, capped by CSS max-height). So the hero keeps its NATURAL height
   * (`flexShrink:0`) instead of a percentage — only the lower region scrolls when
   * «Ещё» expands, the photo stays pinned, and the popup box stays capped so Leaflet
   * never re-pans. Used by the desktop MapPage popup; mobile uses `bottomSheetSplit`.
   */
  popupSplit?: boolean;
  onClose?: () => void;
  /**
   * Suppress the card's own top-right ✕. Set by wrappers that already draw their
   * own close affordance (e.g. `MapPlaceBottomCard`'s sheet header ✕) so the same
   * corner doesn't show two stacked crosses. `onClose` still fires from the wrapper.
   */
  suppressInlineClose?: boolean;
  colors: ThemedColors;
  /**
   * Optional override for the primary action button. When provided, it wins over
   * the default selection (route → article → google maps). Used by feature-specific
   * popups (e.g. quest map) to surface a custom CTA without forking the card.
   */
  primaryActionOverride?: {
    label: string;
    icon: React.ComponentProps<typeof Feather>['name'];
    onPress: () => void;
    accessibilityLabel?: string;
    tooltip?: string;
  };
};

const PlacePopupCard: React.FC<Props> = ({
  title,
  subtitle: _subtitle,
  imageUrl,
  categoryLabel,
  coord,
  drivingDistanceMeters,
  drivingDurationSeconds,
  isDrivingLoading = false,
  onOpenArticle,
  articleHref,
  relatedTravelUrl,
  relatedTravelCountry,
  relatedTravelCity,
  onCopyCoord,
  onShareTelegram,
  onOpenGoogleMaps,
  onOpenAppleMaps,
  onOpenOrganicMaps,
  onOpenWaze,
  onOpenYandexMaps,
  onOpenYandexNavi,
  onOpenOpenStreetMap,
  onAddPoint,
  onBuildRoute,
  extraActions,
  suppressFallbackPrimaryAction = false,
  shareInActionRow = false,
  addDisabled = false,
  isAdding = false,
  isSaved = false,
  addLabel = 'Мои точки',
  addTooltip,
  width = 352,
  imageHeight: _imageHeight = 56,
  compactLayout = false,
  fullscreenOnMobile = false,
  bottomSheetSplit = false,
  popupSplit = false,
  fullscreenTopInset = 0,
  fullscreenBottomInset = 0,
  onClose,
  suppressInlineClose = false,
  colors,
  primaryActionOverride,
}) => {
  const setCardRootNode = usePopupDomGuard();
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [navExpanded, setNavExpanded] = useState(false);
  // Native bottom-card routes navigation into a separate bottom-sheet modal
  // (ActionListSheet) instead of an always-expanded inline grid, so the card
  // content (status / point actions) stays visible without scrolling.
  const [navSheetVisible, setNavSheetVisible] = useState(false);

  const {
    revealPopupImageOnLoadOnly,
    bp,
    compactLabel,
    useFullscreenMobileOverlay,
    useCompactLayout,
    isBottomCardLayout,
    maxPopupWidth,
    useSplitLayout,
    styles,
  } = usePopupLayout({
    colors,
    width,
    imageUrl,
    addLabel,
    imageHeight: _imageHeight,
    compactLayout,
    fullscreenOnMobile,
  });

  const {
    hasCoord,
    hasDrivingInfo,
    drivingText,
    primaryAction,
    saveActionVisual,
    secondaryActions,
  } = usePopupActions({
    colors,
    coord,
    articleHref,
    drivingDistanceMeters,
    drivingDurationSeconds,
    onOpenArticle,
    onOpenGoogleMaps,
    onOpenAppleMaps,
    onOpenOrganicMaps,
    onOpenWaze,
    onOpenYandexMaps,
    onOpenYandexNavi,
    onOpenOpenStreetMap,
    onShareTelegram,
    onBuildRoute,
    primaryActionOverride,
  });

  // The reverse-geocoded subtitle is a long, mixed-language OSM chain
  // («Podzamcze, Old Town, Stare Miasto, Краков, Малопольское…») that the 2-line
  // clamp chops mid-word. In the bottom card we keep only the most informative
  // tail segments (locality + region/country) so the line ends on a clean
  // boundary. Desktop popup / nearby list keep the full subtitle untouched.
  const displaySubtitle = useMemo(() => {
    if (!_subtitle || !isBottomCardLayout) return _subtitle;
    const segments = _subtitle.split(',').map((s) => s.trim()).filter(Boolean);
    if (segments.length <= 3) return _subtitle;
    return segments.slice(-3).join(', ');
  }, [_subtitle, isBottomCardLayout]);

  // In the mobile bottom card the coordinates are secondary metadata, so show a
  // shorter ~5-decimal value (50.05470, 19.93488) instead of the raw 7-decimal
  // string. Copy still uses the full original `coord` (handled in the factory),
  // so precision is preserved on paste.
  const displayCoord = useMemo(() => {
    if (!coord) return coord;
    if (!isBottomCardLayout) return coord;
    const parts = coord.replace(/;/g, ',').split(',').map((v) => v.trim());
    if (parts.length < 2) return coord;
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return coord;
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }, [coord, isBottomCardLayout]);

  const handleOpenFullscreen = useCallback((event?: any) => {
    stopWebPopupEvent(event);
    event?.preventDefault?.();
    if (imageUrl) setFullscreenVisible(true);
  }, [imageUrl]);

  const handleCloseFullscreen = useCallback(() => {
    setFullscreenVisible(false);
  }, []);

  // Bottom-card chrome (mobile web sheet + native bottom card share ONE contract, per
  // docs/features/map.md §Mobile parity contract): navigation opens in a separate
  // ActionListSheet modal, ♥ + trip status live in the hero corner, the save chip
  // reads «Сохранить/Сохранено», and a divider precedes the action row. The desktop
  // Leaflet popup (isBottomCardLayout === false) keeps its own inline layout untouched.
  const useBottomCardChrome = isBottomCardLayout;
  // Route the secondary navigation (Google/Apple/Organic/Waze/Яндекс/OSM) into the
  // ActionListSheet on EVERY mobile surface — the native bottom card AND the mobile
  // web fullscreen overlay — so mobile web matches the device (compact card, nav in a
  // sheet) instead of an always-expanded inline grid. Desktop (Leaflet popup /
  // popupSplit) keeps its inline toggle-expand grid untouched.
  const useNavSheet = useBottomCardChrome || useFullscreenMobileOverlay;

  const toggleNav = useCallback(() => {
    if (useNavSheet) {
      setNavSheetVisible(true);
      return;
    }
    setNavExpanded((prev) => !prev);
  }, [useNavSheet]);

  const closeNavSheet = useCallback(() => setNavSheetVisible(false), []);

  // The «Ещё» panel is navigation-only. The article opens via its own round icon in
  // the action row; «Поделиться в Telegram» is a share action (not a map-app), so when
  // `shareInActionRow` it is surfaced as a small icon in the TITLE row and excluded
  // here — it must not appear inside the «Навигация и действия» sheet (#FIX-3).
  const navActions = useMemo(
    () =>
      secondaryActions.filter(
        (action) =>
          action.key !== 'article' && !(shareInActionRow && action.key === 'telegram'),
      ),
    [secondaryActions, shareInActionRow],
  );
  const showNavToggle = navActions.length > 0;
  // Inline nav grid is DESKTOP-ONLY now: the desktop Leaflet popup expands it on
  // toggle. Every mobile surface (native bottom card + mobile web fullscreen overlay)
  // has useNavSheet === true → nav opens in the ActionListSheet, never inline.
  const showNavGrid = navActions.length > 0 && !useNavSheet && navExpanded;

  const navSheetActions = useMemo<ActionListSheetItem[]>(
    () =>
      navActions.map((action) => ({
        key: action.key,
        label: action.label,
        icon: action.icon,
        onPress: action.onPress,
        accessibilityLabel: action.accessibilityLabel,
        title: action.title,
        iconColor: action.iconColor,
        iconBubbleColor: action.tintBg,
      })),
    [navActions],
  );

  useEffect(() => {
    setFullscreenVisible(false);
    setNavSheetVisible(false);
    // Nav starts collapsed everywhere: mobile surfaces open the ActionListSheet on
    // tap (useNavSheet), the desktop popup expands the inline grid on the «Ещё» toggle.
    setNavExpanded(false);
  }, [imageUrl, navActions.length, useNavSheet]);

  const renderFallbackPrimaryAction =
    !suppressFallbackPrimaryAction &&
    !primaryActionOverride &&
    !!primaryAction &&
    !onBuildRoute &&
    !(!!articleHref && !!onOpenArticle);
  const primaryIconActionLabel =
    isBottomCardLayout && primaryAction?.icon === 'arrow-right'
      ? 'Страница'
      : primaryAction?.label;

  // #FIX-3 — «Мои точки» is an ambiguous noun (reads as "view", but the chip ADDS the
  // point). On the bottom card (mobile web + native) show the verb «Сохранить» /
  // «Сохранено» (the bookmark/✓ icon already conveys save vs saved). Keeps the #334
  // add/un-save toggle. Desktop Leaflet popup keeps the existing `compactLabel`.
  const saveChipLabel = useBottomCardChrome ? (isSaved ? 'Сохранено' : 'Сохранить') : compactLabel;

  // #FIX-3 — «Поделиться» is a share action surfaced as a small right-aligned icon in
  // the title row on the native bottom card (NOT in the action row, which must stay at
  // 4 items so «Маршрут» never overflows, and NOT in the nav sheet).
  const showTitleShare = shareInActionRow && !!onShareTelegram;
  const reserveInlineCloseSpace = Boolean(onClose && (!imageUrl || useSplitLayout));

  const topInfoSlot = useMemo(() => (
    <View style={styles.infoSection}>
      <View style={styles.titleRow}>
        <Text
          style={[styles.titleText, showTitleShare && styles.titleTextWithShare]}
          numberOfLines={isBottomCardLayout ? 2 : useCompactLayout ? 2 : bp === 'narrow' ? 2 : 2}
        >
          {title}
        </Text>
        {showTitleShare && onShareTelegram ? (
          <CardActionPressable
            accessibilityLabel="Поделиться в Telegram"
            onPress={onShareTelegram}
            title={POPUP_TOOLTIPS.shareTelegram}
            enableWebClickFallback
            style={({ pressed }) => [styles.titleShareBtn, pressed && styles.iconActionBtnPressed]}
          >
            <Feather name="send" size={18} color={colors.primaryDark} />
          </CardActionPressable>
        ) : null}
      </View>

      {!!displaySubtitle && (
        <Text style={styles.subtitleText} numberOfLines={isBottomCardLayout ? 1 : useCompactLayout ? 2 : 1}>
          {displaySubtitle}
        </Text>
      )}

      <View style={styles.metaRow}>
        {!!categoryLabel && (
          <View style={styles.metaBadge}>
            <Feather name="tag" size={12} color={colors.textMuted} />
            {/* Bottom card (native): RN Android rounds a tightly-hugged <Text> line
                width down and clips the trailing glyph («Замок» → «Замо»). Appending a
                thin space widens the measured line just enough for «к» to paint; the
                badge still hugs the visible label. Web/desktop popup are untouched. */}
            <Text
              style={styles.categoryText}
              numberOfLines={isBottomCardLayout ? undefined : 1}
            >
              {categoryLabel}
              {isBottomCardLayout && Platform.OS !== 'web' ? ' ' : ''}
            </Text>
          </View>
        )}

        {(isDrivingLoading || hasDrivingInfo) && (
          <View testID="popup-driving-info" style={[styles.drivingRow, styles.metaBadge]}>
            <Feather name="navigation" size={12} color={colors.textMuted} />
            {isDrivingLoading ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : (
              <Text style={styles.smallText} numberOfLines={1}>
                {drivingText}
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  ), [
    displaySubtitle,
    bp,
    categoryLabel,
    colors.primaryDark,
    colors.textMuted,
    drivingText,
    hasDrivingInfo,
    isBottomCardLayout,
    isDrivingLoading,
    onShareTelegram,
    showTitleShare,
    styles,
    title,
    useCompactLayout,
  ]);

  // Desktop Leaflet popup keeps this as a hero overlay. Bottom cards render the
  // same stack inline in the footer so trip statuses stay visible as text.
  const relatedTravelActionStack = useMemo(() => {
    if (!relatedTravelUrl) return null;
    return (
      <RelatedTravelActionStack
        relatedTravelUrl={relatedTravelUrl}
        fallbackTitle={title}
        fallbackImageUrl={imageUrl}
        fallbackCountry={relatedTravelCountry}
        fallbackCity={relatedTravelCity}
        style={isBottomCardLayout ? styles.relatedTravelActionsInline : undefined}
        variant={isBottomCardLayout ? 'inline' : 'overlay'}
      />
    );
  }, [
    imageUrl,
    isBottomCardLayout,
    relatedTravelCity,
    relatedTravelCountry,
    relatedTravelUrl,
    styles.relatedTravelActionsInline,
    title,
  ]);

  // Desktop overlay only. Bottom-card status controls are rendered inline below
  // the title/meta so the labels remain visible on mobile web and native.
  const heroActionOverlay = useMemo(() => {
    if (isBottomCardLayout || !useBottomCardChrome || !relatedTravelUrl) return null;
    return (
      <View style={styles.heroFavoriteOverlay} pointerEvents="box-none">
        <RelatedTravelActionStack
          relatedTravelUrl={relatedTravelUrl}
          fallbackTitle={title}
          fallbackImageUrl={imageUrl}
          fallbackCountry={relatedTravelCountry}
          fallbackCity={relatedTravelCity}
          variant="overlay"
        />
      </View>
    );
  }, [
    imageUrl,
    relatedTravelCity,
    relatedTravelCountry,
    relatedTravelUrl,
    styles.heroFavoriteOverlay,
    title,
    isBottomCardLayout,
    useBottomCardChrome,
  ]);

  const footerSlot = useMemo(() => (
    <View style={styles.footerStack}>
      {hasCoord && (
        <View style={styles.coordRow}>
          <Feather name="map-pin" size={13} color={colors.textMuted} style={{ flexShrink: 0 } as any} />
          <Text style={styles.coordText} numberOfLines={1} selectable>{displayCoord}</Text>
          {onCopyCoord ? (
            <CardActionPressable
              accessibilityLabel="Скопировать координаты"
              onPress={() => void onCopyCoord()}
              title={POPUP_TOOLTIPS.copyCoords}
              enableWebClickFallback
              style={({ pressed }) => [styles.coordCopyButton, pressed && styles.iconActionBtnPressed]}
            >
              <Feather name="copy" size={13} color={colors.textMuted} />
            </CardActionPressable>
          ) : null}
        </View>
      )}

      <View style={styles.actionsStack}>
        {primaryActionOverride && primaryAction ? (
          // Feature popups (e.g. quest «Начать квест») keep the prominent CTA button;
          // they don't expose the route/article/save/nav action set below.
          <CardActionPressable
            accessibilityLabel={primaryAction.accessibilityLabel}
            onPress={primaryAction.onPress}
            title={primaryAction.tooltip}
            testID="popup-primary-action"
            enableWebClickFallback
            style={({ pressed }) => [
              styles.primaryActionBtn,
              pressed && styles.primaryActionBtnPressed,
            ]}
          >
            <Feather name={primaryAction.icon} size={15} color={colors.textOnPrimary ?? colors.textOnDark} />
            <Text style={styles.primaryActionText} numberOfLines={1}>{primaryAction.label}</Text>
          </CardActionPressable>
        ) : (
          <>
            {isBottomCardLayout && relatedTravelActionStack ? (
              <View style={styles.relatedTravelInlineSection}>
                {relatedTravelActionStack}
              </View>
            ) : null}
            {useNavSheet ? <View style={styles.blockDivider} /> : null}
            <View style={styles.actionGroup}>
              <View style={styles.iconActionRow}>
                {renderFallbackPrimaryAction && primaryAction && (
                  <CardActionPressable
                    accessibilityLabel={primaryAction.accessibilityLabel}
                    onPress={primaryAction.onPress}
                    title={primaryAction.tooltip}
                    testID="popup-primary-action"
                    enableWebClickFallback
                    style={({ pressed }) => [styles.iconActionBtn, pressed && styles.iconActionBtnPressed]}
                  >
                    <View style={[styles.iconActionBubble, styles.iconActionBubblePrimary]}>
                      <Feather name={primaryAction.icon} size={19} color={colors.textOnPrimary ?? colors.textOnDark} />
                    </View>
                    <View style={styles.iconActionLabelRow}>
                      <Text style={styles.iconActionLabel} numberOfLines={1}>{primaryIconActionLabel}</Text>
                    </View>
                  </CardActionPressable>
                )}

                {onBuildRoute && (
                  <CardActionPressable
                    accessibilityLabel="Построить маршрут от моего местоположения"
                    onPress={onBuildRoute}
                    title={POPUP_TOOLTIPS.buildRoute}
                    testID="popup-primary-action"
                    enableWebClickFallback
                    style={({ pressed }) => [styles.iconActionBtn, pressed && styles.iconActionBtnPressed]}
                  >
                    <View style={[styles.iconActionBubble, styles.iconActionBubblePrimary]}>
                      <Feather name="corner-up-right" size={20} color={colors.textOnPrimary ?? colors.textOnDark} />
                    </View>
                    <View style={styles.iconActionLabelRow}>
                      <Text style={styles.iconActionLabel} numberOfLines={2}>Маршрут от меня</Text>
                    </View>
                  </CardActionPressable>
                )}

              {!!articleHref && !!onOpenArticle && (
                <CardActionPressable
                  accessibilityLabel="Открыть статью"
                  onPress={onOpenArticle}
                  title={POPUP_TOOLTIPS.openArticle}
                  enableWebClickFallback
                  style={({ pressed }) => [styles.iconActionBtn, pressed && styles.iconActionBtnPressed]}
                >
                  <View style={styles.iconActionBubble}>
                    <Feather name="book-open" size={19} color={colors.primaryDark} />
                  </View>
                  <View style={styles.iconActionLabelRow}>
                    <Text style={styles.iconActionLabel} numberOfLines={1}>Страница</Text>
                  </View>
                </CardActionPressable>
              )}

              {onAddPoint && (
                <CardActionPressable
                  accessibilityLabel={compactLabel}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSaved, disabled: addDisabled || isAdding }}
                  onPress={() => void onAddPoint()}
                  disabled={addDisabled || isAdding}
                  title={addTooltip ?? compactLabel}
                  enableWebClickFallback
                  style={({ pressed }) => [
                    styles.iconActionBtn,
                    (addDisabled || isAdding) && styles.addBtnDisabled,
                    pressed && styles.iconActionBtnPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.iconActionBubble,
                      isSaved && { backgroundColor: colors.successSoft, borderColor: colors.successSoft },
                    ]}
                  >
                    {isAdding ? (
                      <ActivityIndicator
                        size="small"
                        color={isSaved ? colors.successDark : saveActionVisual.iconColor}
                      />
                    ) : (
                      <Feather
                        name={isSaved ? 'check' : saveActionVisual.icon}
                        size={19}
                        color={isSaved ? colors.successDark : saveActionVisual.iconColor}
                      />
                    )}
                  </View>
                  <View style={styles.iconActionLabelRow}>
                    <Text style={styles.iconActionLabel} numberOfLines={1}>{saveChipLabel}</Text>
                  </View>
                </CardActionPressable>
              )}

              {(extraActions ?? []).map((action) => (
                <CardActionPressable
                  key={action.key}
                  accessibilityLabel={action.accessibilityLabel ?? action.label}
                  onPress={action.onPress}
                  title={action.tooltip ?? action.label}
                  enableWebClickFallback
                  style={({ pressed }) => [styles.iconActionBtn, pressed && styles.iconActionBtnPressed]}
                >
                  <View style={styles.iconActionBubble}>
                    <Feather name={action.icon} size={19} color={colors.text} />
                  </View>
                  <View style={styles.iconActionLabelRow}>
                    <Text style={styles.iconActionLabel} numberOfLines={1}>{action.label}</Text>
                  </View>
                </CardActionPressable>
              ))}

              {showNavToggle && (
                <CardActionPressable
                  accessibilityLabel={
                    useNavSheet
                      ? 'Открыть способы навигации'
                      : navExpanded
                        ? 'Скрыть способы навигации'
                        : 'Показать способы навигации'
                  }
                  accessibilityState={useNavSheet ? { expanded: navSheetVisible } : { expanded: navExpanded }}
                  onPress={toggleNav}
                  title={POPUP_TOOLTIPS.moreNavigation}
                  enableWebClickFallback
                  style={({ pressed }) => [styles.iconActionBtn, pressed && styles.iconActionBtnPressed]}
                >
                  <View style={[styles.iconActionBubble, navExpanded && styles.iconActionBubbleActive]}>
                    {/* #842: единая иконка «Навигация» (компас) — как в PointNavigationMenu и на карточках. */}
                    <Feather name={SEMANTIC_ACTION_ICON.navigationMenu} size={19} color={colors.text} />
                    {isBottomCardLayout ? (
                      <Feather
                        name={useNavSheet ? 'more-horizontal' : navExpanded ? 'chevron-up' : 'chevron-down'}
                        size={11}
                        color={colors.textMuted}
                        style={{ position: 'absolute', right: 6, bottom: 5 } as any}
                      />
                    ) : null}
                  </View>
                  <View style={styles.iconActionLabelRow}>
                    <Text style={styles.iconActionLabel} numberOfLines={1}>Навигация</Text>
                    {/* #FIX-3 — on the native bottom card the indicator is already in the
                        bubble (more-horizontal); a second chevron in the label row stole
                        width and clipped «Навигация» → «Навигац…». Keep the trailing
                        chevron only for the web popup. */}
                    {isBottomCardLayout ? null : (
                      <Feather name={navExpanded ? 'chevron-up' : 'chevron-down'} size={13} color={colors.textMuted} />
                    )}
                  </View>
                </CardActionPressable>
              )}
            </View>
            </View>

            {showNavGrid && (
              <View style={styles.navSection}>
                <Text style={styles.navSectionTitle}>Открыть в навигаторе</Text>
                <View style={styles.navGrid}>
                  {navActions.map((action) => (
                    <CardActionPressable
                      key={action.key}
                      accessibilityLabel={action.accessibilityLabel}
                      onPress={action.onPress}
                      title={action.title}
                      enableWebClickFallback
                      style={({ pressed }) => [styles.navGridItem, pressed && styles.iconActionBtnPressed]}
                    >
                      <View style={[styles.iconActionBubble, { backgroundColor: action.tintBg, borderColor: action.tintBg }]}>
                        <Feather name={action.icon} size={19} color={action.iconColor} />
                      </View>
                      <Text style={styles.iconActionLabel} numberOfLines={isBottomCardLayout ? 2 : 1}>
                        {action.label}
                      </Text>
                    </CardActionPressable>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  ), [
    navActions,
    addDisabled,
    addTooltip,
    articleHref,
    colors.primaryDark,
    colors.text,
    colors.textMuted,
    compactLabel,
    colors.successDark,
    colors.successSoft,
    displayCoord,
    extraActions,
    hasCoord,
    isAdding,
    isBottomCardLayout,
    isSaved,
    navExpanded,
    navSheetVisible,
    relatedTravelActionStack,
    useNavSheet,
    onAddPoint,
    onBuildRoute,
    onCopyCoord,
    onOpenArticle,
    saveChipLabel,
    primaryAction,
    primaryIconActionLabel,
    primaryActionOverride,
    renderFallbackPrimaryAction,
    saveActionVisual,
    showNavGrid,
    showNavToggle,
    styles,
    toggleNav,
    colors.textOnDark,
    colors.textOnPrimary,
  ]);

  const relatedTravelOverlays = relatedTravelUrl ? (
    <>
      {isBottomCardLayout ? null : (
        // Soft scrim so the semi-transparent ♥/＋ buttons stay readable over busy
        // photos in the mobile bottom card (scoped — desktop popup unchanged).
        <View
          pointerEvents="none"
          style={styles.relatedTravelScrim}
          {...(Platform.OS === 'web' ? ({ 'aria-hidden': 'true' } as any) : null)}
        />
      )}
      {!isBottomCardLayout && relatedTravelActionStack ? (
        <View style={styles.relatedTravelActions} pointerEvents="box-none">
          {relatedTravelActionStack}
        </View>
      ) : null}
    </>
  ) : null;

  const closeControl = onClose && !suppressInlineClose ? (
    <CardActionPressable
      accessibilityLabel="Закрыть попап"
      onPress={onClose}
      title="Закрыть"
      enableWebClickFallback
      style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
    >
      <Feather name="x" size={useCompactLayout ? 20 : 22} color={colors.text} />
    </CardActionPressable>
  ) : null;

  const heroImage = imageUrl ? (
    <Pressable
      onPress={handleOpenFullscreen}
      onMouseDown={stopWebPopupEvent as any}
      onPointerDown={stopWebPopupEvent as any}
      onTouchStart={stopWebPopupEvent as any}
      accessibilityRole="button"
      accessibilityLabel="Открыть фото на весь экран"
      {...(Platform.OS === 'web'
        ? ({
            'data-card-action': 'true',
            title: POPUP_TOOLTIPS.openPhoto,
            onMouseDownCapture: handleOpenFullscreen,
            onPointerDownCapture: handleOpenFullscreen,
            onClickCapture: handleOpenFullscreen,
            onTouchStartCapture: stopWebPopupEvent,
            onTouchEndCapture: handleOpenFullscreen,
          } as any)
        : null)}
      style={({ pressed, hovered }: any) => [
        styles.imageContainer,
        useSplitLayout && styles.imageContainerSplit,
        // Bottom-sheet split: fill the fixed hero header (62% of the sheet) instead
        // of the card's own fixed photo height, so the photo never jerks/leaves a gap.
        // Desktop popup split: hero container has a fixed natural height — fill it.
        (bottomSheetSplit || popupSplit) && Platform.OS === 'web' ? styles.imageContainerFill : null,
        hovered && styles.imageContainerHovered,
        pressed && styles.imageContainerPressed,
      ]}
    >
      {({ pressed, hovered }: any) => (
        <>
          <ImageCardMedia
            src={imageUrl}
            alt={title}
            fit="contain"
            blurBackground
            allowCriticalWebBlur
            revealOnLoadOnly={revealPopupImageOnLoadOnly}
            priority="high"
            loading="eager"
            optimizeWeb={false}
            style={StyleSheet.absoluteFill}
          />
          {Platform.OS === 'web' ? (
            <span
              data-card-action="true"
              aria-hidden="true"
              title={POPUP_TOOLTIPS.openPhoto}
              onMouseDownCapture={handleOpenFullscreen}
              onPointerDownCapture={handleOpenFullscreen}
              onClickCapture={handleOpenFullscreen}
              onTouchStartCapture={stopWebPopupEvent as any}
              onTouchEndCapture={handleOpenFullscreen}
              onClick={handleOpenFullscreen}
              onMouseDown={stopWebPopupEvent as any}
              onPointerDown={stopWebPopupEvent as any}
              onTouchStart={stopWebPopupEvent as any}
              onTouchEnd={handleOpenFullscreen}
              style={{
                position: 'absolute',
                bottom: useCompactLayout ? 8 : 10,
                right: useCompactLayout ? 8 : 10,
                width: useCompactLayout ? 30 : 34,
                height: useCompactLayout ? 30 : 34,
                borderRadius: 9999,
                border: 'none',
                padding: 0,
                backgroundColor: pressed
                  ? 'rgba(15,23,42,0.85)'
                  : hovered
                    ? 'rgba(15,23,42,0.78)'
                    : 'rgba(15,23,42,0.58)',
                color: colors.textOnDark,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                // Live backdrop blur recomposites the map region on close (jank on
                // mobile, CLAUDE.md arch #2). Desktop only; the static dark frost
                // (rgba(15,23,42,0.58)) keeps the icon legible on mobile.
                ...(useCompactLayout
                  ? null
                  : { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }),
                transform: pressed ? 'scale(0.94)' : hovered ? 'scale(1.06)' : 'scale(1)',
                transition: 'background-color 0.15s ease, transform 0.15s ease',
              }}
            >
              <Feather name="maximize-2" size={16} color={colors.textOnDark} />
            </span>
          ) : (
            <View
              pointerEvents="none"
              style={[
                styles.imageExpandButton,
                hovered && styles.imageExpandButtonHovered,
                pressed && styles.imageExpandButtonPressed,
              ]}
            >
              <Feather name="maximize-2" size={16} color={colors.textOnDark} />
            </View>
          )}
        </>
      )}
    </Pressable>
  ) : null;

  // Mobile bottom-sheet split (web): FIXED hero header + scrollable caption/actions.
  // The photo stays pinned while the text scrolls beneath it, so expanding «Ещё»
  // never jerks the photo. The hero keeps contain+blur (ImageCardMedia) intact.
  if (bottomSheetSplit && Platform.OS === 'web' && imageUrl) {
    return (
      <>
        <View
          ref={setCardRootNode}
          style={styles.splitRoot}
          {...({
            onClick: stopWebPopupEvent,
            onMouseDown: stopWebPopupEvent,
            onMouseUp: stopWebPopupEvent,
            onPointerDown: stopWebPopupEvent,
            onPointerUp: stopWebPopupEvent,
            onTouchStart: stopWebPopupEvent,
            onTouchEnd: stopWebPopupEvent,
          } as any)}
        >
          <View style={styles.splitHero}>
            {relatedTravelOverlays}
            {heroImage}
            {heroActionOverlay}
            {closeControl}
          </View>
          <View
            style={styles.splitScroll}
            {...({ 'data-card-action': 'true' } as any)}
          >
            <View style={styles.splitContentPadding}>
              {topInfoSlot}
            </View>
            <View style={styles.footerContainer}>
              {footerSlot}
            </View>
          </View>
        </View>

        {imageUrl && (
          <FullscreenImageViewer
            imageUrl={imageUrl}
            alt={title || 'Point image'}
            visible={fullscreenVisible}
            onClose={handleCloseFullscreen}
            colors={colors}
          />
        )}

        {useNavSheet && navSheetActions.length > 0 ? (
          <ActionListSheet
            visible={navSheetVisible}
            onClose={closeNavSheet}
            title="Навигация и действия"
            actions={navSheetActions}
          />
        ) : null}
      </>
    );
  }

  // Desktop Leaflet popup split (web): FIXED natural-height hero + scrollable
  // caption/actions. The popup box is height-capped by CSS (max-height), so expanding
  // «Ещё» scrolls only the body UNDER a pinned photo — the popup never grows off-screen
  // and Leaflet never re-pans. Only used when there's a photo to pin; image-less popups
  // fall through to the stacked layout below. Hero keeps contain+blur (ImageCardMedia).
  if (popupSplit && imageUrl && !useFullscreenMobileOverlay && Platform.OS === 'web') {
    return (
      <>
        <View
          ref={setCardRootNode}
          style={[styles.popupSplitRoot, { maxWidth: maxPopupWidth }]}
          {...({
            onClick: stopWebPopupEvent,
            onMouseDown: stopWebPopupEvent,
            onMouseUp: stopWebPopupEvent,
            onPointerDown: stopWebPopupEvent,
            onPointerUp: stopWebPopupEvent,
            onTouchStart: stopWebPopupEvent,
            onTouchEnd: stopWebPopupEvent,
          } as any)}
        >
          <View style={styles.popupSplitHero}>
            {relatedTravelOverlays}
            {heroImage}
            {closeControl}
          </View>
          <View
            style={styles.popupSplitScroll}
            {...({ 'data-card-action': 'true' } as any)}
          >
            <View style={styles.splitContentPadding}>
              {topInfoSlot}
            </View>
            <View style={styles.footerContainer}>
              {footerSlot}
            </View>
          </View>
        </View>

        {imageUrl && (
          <FullscreenImageViewer
            imageUrl={imageUrl}
            alt={title || 'Point image'}
            visible={fullscreenVisible}
            onClose={handleCloseFullscreen}
            colors={colors}
          />
        )}
      </>
    );
  }

  const cardBody = (
    <View
      ref={setCardRootNode}
      style={[styles.container, isBottomCardLayout ? null : { maxWidth: maxPopupWidth }]}
      {...(Platform.OS === 'web'
        ? ({
            onClick: stopWebPopupEvent,
            onMouseDown: stopWebPopupEvent,
            onMouseUp: stopWebPopupEvent,
            onPointerDown: stopWebPopupEvent,
            onPointerUp: stopWebPopupEvent,
            onTouchStart: stopWebPopupEvent,
            onTouchEnd: stopWebPopupEvent,
          } as any)
        : null)}
    >
      <View style={styles.popupCard}>
        {relatedTravelOverlays}
        {closeControl}
        <View style={[styles.topSection, useSplitLayout && styles.topSectionSplit]}>
          {heroImage}
          {heroActionOverlay}

          <View
            style={[
              styles.contentContainer,
              useSplitLayout && styles.contentContainerSplit,
              reserveInlineCloseSpace ? { paddingRight: 58 } : null,
            ]}
          >
            {topInfoSlot}
          </View>
        </View>

        <View style={styles.footerContainer}>
          {footerSlot}
        </View>
      </View>
    </View>
  );

  return (
    <>
      {useFullscreenMobileOverlay ? (
        <>
          <View style={{ width: 1, height: 1, opacity: 0 }} />
          <FullscreenPopupOverlay
            visible
            onClose={onClose ?? (() => {})}
            colors={colors}
            imageUrl={imageUrl}
            imageAlt={title}
            topInfoSlot={topInfoSlot}
            footerSlot={footerSlot}
            onOpenFullscreenImage={imageUrl ? handleOpenFullscreen : undefined}
            topInset={fullscreenTopInset}
            bottomInset={fullscreenBottomInset}
          />
        </>
      ) : (
        cardBody
      )}

      {imageUrl && (
        <FullscreenImageViewer
          imageUrl={imageUrl}
          alt={title || 'Point image'}
          visible={fullscreenVisible}
          onClose={handleCloseFullscreen}
          colors={colors}
        />
      )}

      {useNavSheet && navSheetActions.length > 0 ? (
        <ActionListSheet
          visible={navSheetVisible}
          onClose={closeNavSheet}
          title="Навигация и действия"
          actions={navSheetActions}
        />
      ) : null}
    </>
  );
};

export default React.memo(PlacePopupCard);
