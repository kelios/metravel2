import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { ThemedColors } from '@/hooks/useTheme';
import ImageCardMedia, { isIOSSafariUserAgent } from '@/components/ui/ImageCardMedia';
import CardActionPressable from '@/components/ui/CardActionPressable';
import {
  COMPACT_IMAGE_MAX_HEIGHT_BY_BREAKPOINT,
  COMPACT_POPUP_MAX_WIDTH_BY_BREAKPOINT,
  IMAGE_ASPECT,
  IMAGE_MAX_HEIGHT_BY_BREAKPOINT,
  POPUP_MAX_WIDTH_BY_BREAKPOINT,
  POPUP_TOOLTIPS,
  SPLIT_LAYOUT_IMAGE_ASPECT,
  SPLIT_LAYOUT_MIN_POPUP_WIDTH,
  SPLIT_LAYOUT_MIN_VIEWPORT,
  getBreakpoint,
} from './constants';
import FullscreenImageViewer from './FullscreenImageViewer';
import FullscreenPopupOverlay from './FullscreenPopupOverlay';
import { getStyles } from './styles';

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
  onCopyCoord?: () => void;
  onShareTelegram?: () => void;
  onOpenGoogleMaps?: () => void;
  onOpenOrganicMaps?: () => void;
  onOpenWaze?: () => void;
  onOpenYandexNavi?: () => void;
  onAddPoint?: () => void;
  onBuildRoute?: () => void;
  addDisabled?: boolean;
  isAdding?: boolean;
  addLabel?: string;
  addTooltip?: string;
  width?: number;
  imageHeight?: number;
  compactLayout?: boolean;
  fullscreenOnMobile?: boolean;
  onClose?: () => void;
  colors: ThemedColors;
};

const stopWebPopupEvent = (event?: any) => {
  if (Platform.OS !== 'web') return;
  try {
    event?.stopPropagation?.();
    event?.nativeEvent?.stopPropagation?.();
  } catch {
    // noop
  }
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
  onCopyCoord,
  onShareTelegram,
  onOpenGoogleMaps,
  onOpenOrganicMaps,
  onOpenWaze,
  onOpenYandexNavi,
  onAddPoint,
  onBuildRoute,
  addDisabled = false,
  isAdding = false,
  addLabel = 'Сохранить',
  addTooltip,
  width = 352,
  imageHeight: _imageHeight = 56,
  compactLayout = false,
  fullscreenOnMobile = false,
  onClose,
  colors,
}) => {
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const revealPopupImageOnLoadOnly = useMemo(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
    return isIOSSafariUserAgent(
      String(navigator.userAgent || ''),
      typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints : 0,
    );
  }, []);
  const hasCoord = !!coord;
  const hasArticle = typeof onOpenArticle === 'function';
  const normalizedArticleHref = useMemo(() => {
    const rawHref = String(articleHref ?? '').trim();
    if (!rawHref) return null;
    if (rawHref.startsWith('/travel/') || rawHref.startsWith('/travels/')) return rawHref;

    if (/^https?:\/\//i.test(rawHref)) {
      try {
        const parsed = new URL(rawHref);
        if (parsed.pathname.startsWith('/travel/') || parsed.pathname.startsWith('/travels/')) {
          return `${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
      } catch {
        return null;
      }
    }

    return null;
  }, [articleHref]);
  const hasDrivingInfo =
    typeof drivingDistanceMeters === 'number' &&
    Number.isFinite(drivingDistanceMeters) &&
    typeof drivingDurationSeconds === 'number' &&
    Number.isFinite(drivingDurationSeconds);

  const drivingText = React.useMemo(() => {
    if (!hasDrivingInfo) return null;
    const km = drivingDistanceMeters! / 1000;
    const mins = Math.max(1, Math.round(drivingDurationSeconds! / 60));
    const kmLabel = km >= 10 ? `${Math.round(km)} км` : `${km.toFixed(1)} км`;
    return `${kmLabel} · ${mins} мин`;
  }, [drivingDistanceMeters, drivingDurationSeconds, hasDrivingInfo]);

  const primaryAction = useMemo(() => {
    if (onBuildRoute) {
      return {
        label: 'Маршрут сюда',
        icon: 'corner-up-right' as const,
        onPress: onBuildRoute,
        tooltip: POPUP_TOOLTIPS.buildRoute,
        accessibilityLabel: 'Построить маршрут сюда',
      };
    }

    if (hasArticle) {
      return {
        label: 'Подробнее',
        icon: 'arrow-right' as const,
        onPress: onOpenArticle!,
        tooltip: POPUP_TOOLTIPS.openArticle,
        accessibilityLabel: 'Открыть статью о точке',
      };
    }

    if (hasCoord && onOpenGoogleMaps) {
      return {
        label: 'Google Maps',
        icon: 'map' as const,
        onPress: onOpenGoogleMaps,
        tooltip: POPUP_TOOLTIPS.openGoogleMaps,
        accessibilityLabel: 'Открыть точку в Google Maps',
      };
    }

    return null;
  }, [hasArticle, hasCoord, onBuildRoute, onOpenArticle, onOpenGoogleMaps]);

  const { width: viewportWidth } = useWindowDimensions();
  const bp = getBreakpoint(viewportWidth);
  const isNarrow = bp === 'narrow';
  const compactLabel = isNarrow ? 'Сохранить' : addLabel;
  const viewportGutter = bp === 'narrow' ? 24 : bp === 'compact' ? 32 : 48;
  const useFullscreenMobileOverlay = Platform.OS === 'web' && fullscreenOnMobile && viewportWidth <= 560;
  const useCompactLayout = compactLayout || (viewportWidth <= 420 && !useFullscreenMobileOverlay);
  const safeViewportWidth = Math.max(220, viewportWidth - viewportGutter);
  const popupWidthCap = useFullscreenMobileOverlay
    ? Math.min(480, safeViewportWidth)
    : useCompactLayout
      ? COMPACT_POPUP_MAX_WIDTH_BY_BREAKPOINT[bp]
      : POPUP_MAX_WIDTH_BY_BREAKPOINT[bp];
  const imageHeightCap = useFullscreenMobileOverlay
    ? 220
    : useCompactLayout
    ? COMPACT_IMAGE_MAX_HEIGHT_BY_BREAKPOINT[bp]
    : IMAGE_MAX_HEIGHT_BY_BREAKPOINT[bp];
  const maxPopupWidth = Math.min(width, popupWidthCap, safeViewportWidth);
  const useSplitLayout =
    Boolean(imageUrl) &&
    !useFullscreenMobileOverlay &&
    !useCompactLayout &&
    viewportWidth >= SPLIT_LAYOUT_MIN_VIEWPORT &&
    maxPopupWidth >= SPLIT_LAYOUT_MIN_POPUP_WIDTH;
  const heroWidth = useSplitLayout
    ? Math.max(100, Math.min(118, Math.round(maxPopupWidth * 0.34)))
    : maxPopupWidth;
  const heroHeight = useSplitLayout
    ? Math.max(100, Math.min(118, Math.round(heroWidth / SPLIT_LAYOUT_IMAGE_ASPECT)))
    : Math.max(
        1,
        Math.min(
          imageHeightCap,
          Math.round(heroWidth / IMAGE_ASPECT[bp])
        )
      );

  const styles = useMemo(
    () => getStyles(colors, bp, heroWidth, heroHeight, useCompactLayout, useSplitLayout),
    [colors, bp, heroWidth, heroHeight, useCompactLayout, useSplitLayout],
  );

  const handleOpenFullscreen = useCallback((event?: any) => {
    stopWebPopupEvent(event);
    if (imageUrl) setFullscreenVisible(true);
  }, [imageUrl]);

  const handleCloseFullscreen = useCallback(() => {
    setFullscreenVisible(false);
  }, []);

  useEffect(() => {
    setFullscreenVisible(false);
  }, [imageUrl]);

  const topInfoSlot = useMemo(() => (
    <View style={styles.infoSection}>
      <Text style={styles.titleText} numberOfLines={useCompactLayout ? 2 : bp === 'narrow' ? 2 : 2}>
        {title}
      </Text>

      {!!_subtitle && (
        <Text style={styles.subtitleText} numberOfLines={useCompactLayout ? 2 : 1}>
          {_subtitle}
        </Text>
      )}

      {normalizedArticleHref && Platform.OS === 'web' && primaryAction?.onPress !== onOpenArticle && (
        <View
          style={styles.inlineLinkRow}
          {...({
            'data-card-action': 'true',
          } as any)}
        >
          <a
            href={normalizedArticleHref}
            style={styles.inlineLink as any}
            aria-label="Открыть страницу точки"
          >
            Открыть страницу
          </a>
        </View>
      )}

      <View style={styles.metaRow}>
        {!!categoryLabel && (
          <View style={styles.metaBadge}>
            <Feather name="tag" size={12} color={colors.textMuted} />
            <Text style={styles.categoryText} numberOfLines={1}>
              {categoryLabel}
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
    _subtitle,
    bp,
    categoryLabel,
    colors.textMuted,
    drivingText,
    hasDrivingInfo,
    isDrivingLoading,
    normalizedArticleHref,
    onOpenArticle,
    primaryAction,
    styles,
    title,
    useCompactLayout,
  ]);

  const secondaryActions = useMemo(() => {
    const items: Array<{
      key: string;
      accessibilityLabel: string;
      label: string;
      icon: React.ComponentProps<typeof Feather>['name'];
      iconColor: string;
      tintBg: string;
      onPress: () => void;
      title: string;
    }> = [];

    if (hasCoord && onOpenGoogleMaps && primaryAction?.onPress !== onOpenGoogleMaps) {
      items.push({
        key: 'google',
        accessibilityLabel: 'Google Maps',
        label: 'Google',
        icon: 'map-pin',
        iconColor: '#1A73E8',
        tintBg: 'rgba(26,115,232,0.12)',
        onPress: onOpenGoogleMaps,
        title: POPUP_TOOLTIPS.openGoogleMaps,
      });
    }

    if (hasCoord && onOpenOrganicMaps) {
      items.push({
        key: 'organic',
        accessibilityLabel: 'Organic Maps',
        label: 'Organic',
        icon: 'compass',
        iconColor: '#2E7D32',
        tintBg: 'rgba(46,125,50,0.12)',
        onPress: onOpenOrganicMaps,
        title: POPUP_TOOLTIPS.openOrganicMaps,
      });
    }

    // Skip the "Статья" chip on web when the inline "Открыть страницу" link is rendered
    // (avoids duplicating the same destination right above the action grid).
    const inlineArticleLinkVisible = Platform.OS === 'web' && !!normalizedArticleHref && primaryAction?.onPress !== onOpenArticle;
    if (
      hasArticle &&
      primaryAction?.onPress !== onOpenArticle &&
      onOpenArticle &&
      !inlineArticleLinkVisible
    ) {
      items.push({
        key: 'article',
        accessibilityLabel: 'Открыть статью',
        label: 'Статья',
        icon: 'book-open',
        iconColor: colors.primary,
        tintBg: colors.primarySoft ?? 'rgba(15,23,42,0.06)',
        onPress: onOpenArticle,
        title: POPUP_TOOLTIPS.openArticle,
      });
    }

    if (hasCoord && onOpenWaze) {
      items.push({
        key: 'waze',
        accessibilityLabel: 'Waze',
        label: 'Waze',
        icon: 'navigation',
        iconColor: '#00B5F0',
        tintBg: 'rgba(0,181,240,0.14)',
        onPress: onOpenWaze,
        title: POPUP_TOOLTIPS.openWaze,
      });
    }

    if (hasCoord && onOpenYandexNavi) {
      items.push({
        key: 'yandex',
        accessibilityLabel: 'Яндекс Навигатор',
        label: 'Яндекс',
        icon: 'navigation-2',
        iconColor: '#FC3F1D',
        tintBg: 'rgba(252,63,29,0.12)',
        onPress: onOpenYandexNavi,
        title: POPUP_TOOLTIPS.openYandexNavi,
      });
    }

    if (hasCoord && onShareTelegram) {
      items.push({
        key: 'telegram',
        accessibilityLabel: 'Поделиться',
        label: 'Telegram',
        icon: 'send',
        iconColor: '#229ED9',
        tintBg: 'rgba(34,158,217,0.14)',
        onPress: onShareTelegram,
        title: POPUP_TOOLTIPS.shareTelegram,
      });
    }

    return items;
  }, [
    colors.primary,
    colors.primarySoft,
    hasArticle,
    hasCoord,
    normalizedArticleHref,
    onOpenGoogleMaps,
    onOpenOrganicMaps,
    onOpenArticle,
    onOpenWaze,
    onOpenYandexNavi,
    onShareTelegram,
    primaryAction,
  ]);

  const footerSlot = useMemo(() => (
    <View style={styles.footerStack}>
      {hasCoord && (
        <CardActionPressable
          accessibilityLabel="Скопировать координаты"
          onPress={onCopyCoord ? () => void onCopyCoord() : undefined}
          title={POPUP_TOOLTIPS.copyCoords}
          style={styles.coordRow}
        >
          <Feather name="map-pin" size={13} color={colors.textMuted} style={{ flexShrink: 0 } as any} />
          <Text style={styles.coordText} numberOfLines={1} selectable>{coord}</Text>
          {onCopyCoord && <Feather name="copy" size={13} color={colors.textMuted} style={{ flexShrink: 0 } as any} />}
        </CardActionPressable>
      )}

      <View style={styles.actionsStack}>
        {primaryAction && (
          <CardActionPressable
            accessibilityLabel={primaryAction.accessibilityLabel}
            onPress={primaryAction.onPress}
            title={primaryAction.tooltip}
            testID="popup-primary-action"
            style={({ pressed }) => [
              styles.primaryActionBtn,
              pressed && styles.primaryActionBtnPressed,
            ]}
          >
            <Feather name={primaryAction.icon} size={15} color={colors.textOnPrimary ?? colors.textOnDark} />
            <Text style={styles.primaryActionText}>{primaryAction.label}</Text>
          </CardActionPressable>
        )}

        <View style={styles.secondaryActionsRow}>
          {secondaryActions.map((action) => (
            <CardActionPressable
              key={action.key}
              accessibilityLabel={action.accessibilityLabel}
              onPress={action.onPress}
              title={action.title}
              style={({ pressed }) => [
                styles.chipActionBtn,
                pressed && styles.chipActionBtnPressed,
              ]}
            >
              <View style={[styles.chipIconBubble, { backgroundColor: action.tintBg }]}>
                <Feather name={action.icon} size={16} color={action.iconColor} />
              </View>
              <Text style={styles.chipActionText} numberOfLines={1}>
                {action.label}
              </Text>
            </CardActionPressable>
          ))}

          {onAddPoint && (
            <CardActionPressable
              accessibilityLabel={compactLabel}
              onPress={() => void onAddPoint()}
              disabled={addDisabled || isAdding}
              title={addTooltip ?? compactLabel}
              style={({ pressed }) => [
                styles.chipActionBtn,
                (addDisabled || isAdding) && styles.addBtnDisabled,
                pressed && styles.chipActionBtnPressed,
              ]}
            >
              <View style={[styles.chipIconBubble, { backgroundColor: colors.primarySoft ?? 'rgba(15,23,42,0.06)' }]}>
                {isAdding ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Feather name="bookmark" size={16} color={colors.primary} />
                )}
              </View>
              <Text style={styles.chipActionText} numberOfLines={1}>
                {compactLabel}
              </Text>
            </CardActionPressable>
          )}
        </View>
      </View>
    </View>
  ), [
    secondaryActions,
    addDisabled,
    addTooltip,
    colors.primary,
    colors.primarySoft,
    colors.textMuted,
    compactLabel,
    coord,
    hasCoord,
    isAdding,
    onAddPoint,
    onCopyCoord,
    primaryAction,
    styles,
    colors.textOnDark,
    colors.textOnPrimary,
  ]);

  const cardBody = (
    <View style={[styles.container, { maxWidth: maxPopupWidth }]}>
      <View style={styles.popupCard}>
        <View style={[styles.topSection, useSplitLayout && styles.topSectionSplit]}>
          {imageUrl && (
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
                  } as any)
                : null)}
              style={({ pressed, hovered }: any) => [
                styles.imageContainer,
                useSplitLayout && styles.imageContainerSplit,
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
                    width={heroWidth}
                    height={heroHeight}
                    style={StyleSheet.absoluteFill}
                  />
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
                </>
              )}
            </Pressable>
          )}

          <View style={[styles.contentContainer, useSplitLayout && styles.contentContainerSplit]}>
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
    </>
  );
};

export default React.memo(PlacePopupCard);
