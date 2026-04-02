import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import ImageCardMedia, { isIOSSafariUserAgent } from '@/components/ui/ImageCardMedia';
import CardActionPressable from '@/components/ui/CardActionPressable';
import { optimizeImageUrl } from '@/utils/imageOptimization';
import { DESIGN_TOKENS } from '@/constants/designSystem';

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
  onCopyCoord?: () => void;
  onShareTelegram?: () => void;
  onOpenGoogleMaps?: () => void;
  onOpenOrganicMaps?: () => void;
  onAddPoint?: () => void;
  onBuildRoute?: () => void;
  addDisabled?: boolean;
  isAdding?: boolean;
  addLabel?: string;
  width?: number;
  imageHeight?: number;
  compactLayout?: boolean;
};

const POPUP_TOOLTIPS = {
  openPhoto: 'Открыть фото на весь экран',
  copyCoords: 'Скопировать координаты',
  openGoogleMaps: 'Открыть точку в Google Maps',
  openOrganicMaps: 'Открыть точку в Organic Maps',
  shareTelegram: 'Поделиться точкой в Telegram',
  openArticle: 'Открыть статью по точке',
  buildRoute: 'Построить маршрут сюда',
} as const;

const FullscreenImageViewer: React.FC<{ imageUrl: string; alt: string; visible: boolean; onClose: () => void }> = ({ imageUrl, alt, visible, onClose }) => {
  const { width, height } = useWindowDimensions();
  const colors = useThemedColors();

  const portalCreate = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    try {
      return (require('react-dom') as any)?.createPortal ?? null;
    } catch {
      return null;
    }
  }, []);

  const maxW = Math.round(width * 0.92);
  const maxH = Math.round(height * 0.92);

  const hiResUrl = useMemo(() => {
    if (!imageUrl) return imageUrl;
    return optimizeImageUrl(imageUrl, {
      width: maxW,
      height: maxH,
      quality: 90,
      format: 'auto',
      fit: 'contain',
      dpr: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
    }) ?? imageUrl;
  }, [imageUrl, maxW, maxH]);

  const blurBackdropUrl = useMemo(() => {
    if (!imageUrl) return imageUrl;
    return optimizeImageUrl(imageUrl, {
      width: 180,
      height: 180,
      quality: 20,
      format: 'jpg',
      fit: 'cover',
      blur: 12,
    }) ?? imageUrl;
  }, [imageUrl]);

  if (Platform.OS === 'web') {
    if (!visible) return null;

    const overlay = (
      <div
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          backgroundColor: 'rgba(0,0,0,0.92)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          boxSizing: 'border-box',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: '-5%',
            width: '110%',
            height: '110%',
            backgroundImage: blurBackdropUrl ? `url("${blurBackdropUrl}")` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(24px)',
            transform: 'scale(1.04)',
            opacity: 0.9,
            pointerEvents: 'none',
          }}
        />
        <img
          src={hiResUrl ?? undefined}
          alt={alt}
          style={{
            position: 'relative',
            maxWidth: maxW,
            maxHeight: maxH,
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: 8,
            display: 'block',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          }}
          loading="eager"
          // @ts-ignore -- fetchPriority is a valid HTML attribute not yet in React types
          fetchPriority="high"
          decoding="async"
        />
        <button
          onClick={onClose}
          aria-label="Закрыть фото"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: 'rgba(0,0,0,0.5)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.textOnDark,
            fontSize: 20,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>
    );

    if (typeof document !== 'undefined' && portalCreate) {
      return portalCreate(overlay, document.body);
    }

    return overlay;
  }

  const nativeContent = (
    <View style={[fullscreenStyles.container, { width, height }]}>
      <View style={fullscreenStyles.centeredWrap}>
        <View style={{ maxWidth: maxW, maxHeight: maxH, width: maxW, height: maxH }}>
          <ImageCardMedia
            src={hiResUrl}
            fit="contain"
            blurBackground
            allowCriticalWebBlur
            blurRadius={20}
            priority="high"
            loading="eager"
            transition={0}
            width={maxW}
            height={maxH}
            alt={alt}
          />
        </View>
      </View>
      <Pressable
        onPress={onClose}
        style={fullscreenStyles.closeBtn}
        accessibilityRole="button"
        accessibilityLabel="Закрыть фото"
      >
        <Feather name="x" size={24} color={colors.textOnDark} />
      </Pressable>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {nativeContent}
    </Modal>
  );
};

const fullscreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  centeredWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.select({ ios: 54, default: 16 }),
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});

type BreakpointKey = 'narrow' | 'compact' | 'default';

const getBreakpoint = (viewportWidth: number): BreakpointKey => {
  if (viewportWidth <= 480) return 'narrow';
  if (viewportWidth <= 640) return 'compact';
  return 'default';
};

const FONT_SIZES: Record<BreakpointKey, { title: number; small: number; coord: number }> = {
  narrow: { title: 16, small: 12, coord: 12 },
  compact: { title: 17, small: 13, coord: 13 },
  default: { title: 18, small: 13, coord: 13 },
};

const SPACING: Record<BreakpointKey, { gap: number; btnPadV: number; btnPadH: number; radius: number; iconButtonSize: number; sectionGap: number }> = {
  narrow: { gap: 10, btnPadV: 8, btnPadH: 12, radius: 14, iconButtonSize: 40, sectionGap: 16 },
  compact: { gap: 12, btnPadV: 9, btnPadH: 14, radius: 16, iconButtonSize: 42, sectionGap: 18 },
  default: { gap: 14, btnPadV: 10, btnPadH: 16, radius: 16, iconButtonSize: 44, sectionGap: 20 },
};

const COMPACT_LAYOUT_SPACING: Record<BreakpointKey, { radius: number; iconButtonSize: number; sectionGap: number; horizontalPadding: number; topPadding: number; bottomPadding: number; metaMinHeight: number; coordMinHeight: number; addBtnMinHeight: number }> = {
  narrow: { radius: 12, iconButtonSize: 36, sectionGap: 10, horizontalPadding: 10, topPadding: 10, bottomPadding: 12, metaMinHeight: 24, coordMinHeight: 38, addBtnMinHeight: 38 },
  compact: { radius: 14, iconButtonSize: 40, sectionGap: 12, horizontalPadding: 12, topPadding: 12, bottomPadding: 14, metaMinHeight: 26, coordMinHeight: 40, addBtnMinHeight: 40 },
  default: { radius: 14, iconButtonSize: 42, sectionGap: 14, horizontalPadding: 14, topPadding: 14, bottomPadding: 16, metaMinHeight: 26, coordMinHeight: 42, addBtnMinHeight: 42 },
};

const POPUP_MAX_WIDTH_BY_BREAKPOINT: Record<BreakpointKey, number> = {
  narrow: 300,
  compact: 348,
  default: 436,
};

const COMPACT_POPUP_MAX_WIDTH_BY_BREAKPOINT: Record<BreakpointKey, number> = {
  narrow: 228,
  compact: 268,
  default: 288,
};

const IMAGE_MAX_HEIGHT_BY_BREAKPOINT: Record<BreakpointKey, number> = {
  narrow: 164,
  compact: 212,
  default: 320,
};

const COMPACT_IMAGE_MAX_HEIGHT_BY_BREAKPOINT: Record<BreakpointKey, number> = {
  narrow: 118,
  compact: 148,
  default: 156,
};

const SPLIT_LAYOUT_MIN_VIEWPORT = 820;
const SPLIT_LAYOUT_MIN_POPUP_WIDTH = 380;
const SPLIT_LAYOUT_IMAGE_ASPECT = 1.24;

const PlacePopupCard: React.FC<Props> = ({
  title,
  subtitle,
  imageUrl,
  categoryLabel,
  coord,
  drivingDistanceMeters,
  drivingDurationSeconds,
  isDrivingLoading = false,
  onOpenArticle,
  onCopyCoord,
  onShareTelegram,
  onOpenGoogleMaps,
  onOpenOrganicMaps,
  onAddPoint,
  onBuildRoute,
  addDisabled = false,
  isAdding = false,
  addLabel = 'Мои точки',
  width = 436,
  imageHeight: _imageHeight = 72,
  compactLayout = false,
}) => {
  const colors = useThemedColors();
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
        label: 'Открыть точку',
        icon: 'book-open' as const,
        onPress: onOpenArticle!,
        tooltip: POPUP_TOOLTIPS.openArticle,
        accessibilityLabel: 'Открыть статью',
      };
    }

    if (hasCoord && onOpenGoogleMaps) {
      return {
        label: 'Открыть в Google Maps',
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
  const compactLabel = isNarrow ? 'В мои точки' : addLabel;
  const viewportGutter = bp === 'narrow' ? 24 : bp === 'compact' ? 32 : 48;
  const useCompactLayout = compactLayout || viewportWidth <= 420;
  const safeViewportWidth = Math.max(220, viewportWidth - viewportGutter);
  const popupWidthCap = useCompactLayout
    ? COMPACT_POPUP_MAX_WIDTH_BY_BREAKPOINT[bp]
    : POPUP_MAX_WIDTH_BY_BREAKPOINT[bp];
  const imageHeightCap = useCompactLayout
    ? COMPACT_IMAGE_MAX_HEIGHT_BY_BREAKPOINT[bp]
    : IMAGE_MAX_HEIGHT_BY_BREAKPOINT[bp];
  const maxPopupWidth = Math.min(width, popupWidthCap, safeViewportWidth);
  const useSplitLayout =
    Boolean(imageUrl) &&
    !useCompactLayout &&
    viewportWidth >= SPLIT_LAYOUT_MIN_VIEWPORT &&
    maxPopupWidth >= SPLIT_LAYOUT_MIN_POPUP_WIDTH;
  const heroWidth = useSplitLayout
    ? Math.max(148, Math.min(166, Math.round(maxPopupWidth * 0.36)))
    : maxPopupWidth;
  const heroHeight = useSplitLayout
    ? Math.max(124, Math.min(148, Math.round(heroWidth / SPLIT_LAYOUT_IMAGE_ASPECT)))
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

  const actionBtnStyle = useMemo(
    () =>
      ({ pressed }: { pressed: boolean }) => [styles.actionBtn, pressed && styles.actionBtnPressed],
    [styles],
  );

  const handleOpenFullscreen = useCallback(() => {
    if (imageUrl) setFullscreenVisible(true);
  }, [imageUrl]);

  const handleCloseFullscreen = useCallback(() => {
    setFullscreenVisible(false);
  }, []);

  const contentSlot = useMemo(() => (
    <View style={styles.content}>
      <View style={styles.infoSection}>
        <Text style={styles.titleText} numberOfLines={useCompactLayout ? 2 : bp === 'narrow' ? 3 : 2}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={styles.subtitleText} numberOfLines={2}>
            {subtitle}
          </Text>
        )}

        <View style={styles.metaRow}>
          {!!categoryLabel && (
            <View style={styles.metaBadge}>
              <Feather name="tag" size={13} color={colors.textMuted} />
              <Text style={styles.categoryText} numberOfLines={1}>
                {categoryLabel}
              </Text>
            </View>
          )}

          {(isDrivingLoading || hasDrivingInfo) && (
            <View testID="popup-driving-info" style={[styles.drivingRow, styles.metaBadge]}>
              <Feather name="navigation" size={14} color={colors.textMuted} />
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

      {hasCoord && (
        <CardActionPressable
          accessibilityLabel="Скопировать координаты"
          onPress={onCopyCoord ? () => void onCopyCoord() : undefined}
          title={POPUP_TOOLTIPS.copyCoords}
          style={styles.coordRow}
        >
          <Feather name="map-pin" size={15} color={colors.textMuted} style={{ flexShrink: 0 } as any} />
          <Text style={styles.coordText} numberOfLines={1} selectable>{coord}</Text>
          {onCopyCoord && <Feather name="copy" size={16} color={colors.textMuted} style={{ flexShrink: 0 } as any} />}
        </CardActionPressable>
      )}

      <View style={styles.actionsGroup}>
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
            <Feather name={primaryAction.icon} size={16} color={colors.textOnPrimary ?? colors.textOnDark} />
            <Text style={styles.primaryActionText}>{primaryAction.label}</Text>
          </CardActionPressable>
        )}
        <View style={styles.actionsRow}>
        {hasCoord && onOpenGoogleMaps && primaryAction?.onPress !== onOpenGoogleMaps && (
          <CardActionPressable
            accessibilityLabel="Открыть в Google Maps"
            onPress={onOpenGoogleMaps}
            title={POPUP_TOOLTIPS.openGoogleMaps}
            style={actionBtnStyle}
          >
            <Feather name="map" size={16} color={colors.textMuted} />
          </CardActionPressable>
        )}

        {hasCoord && onOpenOrganicMaps && (
          <CardActionPressable
            accessibilityLabel="Открыть в Organic Maps"
            onPress={onOpenOrganicMaps}
            title={POPUP_TOOLTIPS.openOrganicMaps}
            style={actionBtnStyle}
          >
            <Feather name="compass" size={16} color={colors.textMuted} />
          </CardActionPressable>
        )}

        {hasCoord && onShareTelegram && (
          <CardActionPressable
            accessibilityLabel="Поделиться в Telegram"
            onPress={onShareTelegram}
            title={POPUP_TOOLTIPS.shareTelegram}
            style={actionBtnStyle}
          >
            <Feather name="send" size={16} color={colors.textMuted} />
          </CardActionPressable>
        )}

        {hasArticle && primaryAction?.onPress !== onOpenArticle && (
          <CardActionPressable
            accessibilityLabel="Открыть статью"
            onPress={onOpenArticle}
            title={POPUP_TOOLTIPS.openArticle}
            style={actionBtnStyle}
          >
            <Feather name="book-open" size={16} color={colors.textMuted} />
          </CardActionPressable>
        )}

        {onBuildRoute && primaryAction?.onPress !== onBuildRoute && (
          <CardActionPressable
            accessibilityLabel="Маршрут сюда"
            onPress={onBuildRoute}
            title={POPUP_TOOLTIPS.buildRoute}
            testID="popup-build-route"
            style={({ pressed }) => [
              styles.iconBtn,
              styles.routeBtn,
              pressed && styles.actionBtnPressed,
            ]}
          >
            <Feather name="corner-up-right" size={16} color={colors.primary} />
          </CardActionPressable>
        )}
        </View>
      </View>

      {onAddPoint && (
        <CardActionPressable
          accessibilityLabel={compactLabel}
          onPress={() => void onAddPoint()}
          disabled={addDisabled || isAdding}
          title={compactLabel}
          style={({ pressed }) => [
            styles.addBtn,
            (addDisabled || isAdding) && styles.addBtnDisabled,
            pressed && styles.addBtnPressed,
          ]}
        >
          {isAdding ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="plus" size={16} color={colors.primary} />
          )}
          <Text style={styles.addBtnText}>{compactLabel}</Text>
        </CardActionPressable>
      )}
    </View>
  ), [
    actionBtnStyle,
    addDisabled,
    bp,
    categoryLabel,
    colors.primary,
    colors.textMuted,
    compactLabel,
    coord,
    drivingText,
    hasArticle,
    hasCoord,
    hasDrivingInfo,
    isAdding,
    isDrivingLoading,
    onAddPoint,
    onBuildRoute,
    onCopyCoord,
    onOpenArticle,
    onOpenGoogleMaps,
    onOpenOrganicMaps,
    onShareTelegram,
    primaryAction,
    styles,
    colors.textOnDark,
    colors.textOnPrimary,
    subtitle,
    title,
    useCompactLayout,
  ]);

  return (
    <View style={[styles.container, { maxWidth: maxPopupWidth }]}>
      <View style={[styles.popupCard, useSplitLayout && styles.popupCardSplit]}>
        {imageUrl && (
          <Pressable
            onPress={handleOpenFullscreen}
            style={[styles.imageContainer, useSplitLayout && styles.imageContainerSplit]}
            accessibilityRole="button"
            accessibilityLabel="Открыть фото на весь экран"
          >
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
            <View style={styles.imageExpandButton}>
              <Feather name="maximize-2" size={18} color={colors.textOnDark} />
            </View>
          </Pressable>
        )}

        <View style={[styles.contentContainer, useSplitLayout && styles.contentContainerSplit]}>
          {contentSlot}
        </View>
      </View>

      {imageUrl && (
        <FullscreenImageViewer
          imageUrl={imageUrl}
          alt={title || 'Point image'}
          visible={fullscreenVisible}
          onClose={handleCloseFullscreen}
        />
      )}
    </View>
  );
};

const IMAGE_ASPECT: Record<BreakpointKey, number> = {
  narrow: 1.2,
  compact: 1.3,
  default: 1.35,
};

const getStyles = (
  colors: ThemedColors,
  bp: BreakpointKey,
  heroWidth: number,
  heroHeight: number,
  compactLayout: boolean,
  splitLayout: boolean,
) => {
  const sp = SPACING[bp];
  const fs = FONT_SIZES[bp];
  const compactSp = COMPACT_LAYOUT_SPACING[bp];
  const horizontalPadding = compactLayout
    ? compactSp.horizontalPadding
    : bp === 'narrow'
      ? 12
      : 14;
  const topPadding = compactLayout
    ? compactSp.topPadding
    : bp === 'narrow'
      ? 12
      : 14;
  const bottomPadding = compactLayout
    ? compactSp.bottomPadding
    : bp === 'narrow'
      ? 14
      : 16;

  return StyleSheet.create({
    container: {
      width: '100%',
      minWidth: 0,
      alignSelf: 'stretch',
    },
    popupCard: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: (compactLayout ? compactSp.radius : sp.radius) + 4,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 8px 28px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
          } as any)
        : {
            shadowColor: DESIGN_TOKENS.colors.text,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.06,
            shadowRadius: 16,
            elevation: 4,
          }),
    },
    popupCardSplit: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    imageContainer: {
      width: '100%',
      height: heroHeight > 0 ? heroHeight : undefined,
      minHeight: heroHeight > 0 ? heroHeight : 0,
      position: 'relative',
      backgroundColor: colors.backgroundSecondary,
    },
    imageContainerSplit: {
      width: heroWidth,
      minWidth: heroWidth,
      maxWidth: heroWidth,
      height: heroHeight > 0 ? heroHeight : undefined,
      minHeight: heroHeight > 0 ? heroHeight : 0,
      flexShrink: 0,
    },
    imageExpandButton: {
      position: 'absolute',
      top: compactLayout ? 8 : 10,
      right: compactLayout ? 8 : 10,
      width: compactLayout ? 30 : 34,
      height: compactLayout ? 30 : 34,
      borderRadius: compactLayout ? 15 : 17,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } as any) : null),
    },
    contentContainer: {
      paddingHorizontal: horizontalPadding + 2,
      paddingTop: topPadding + 2,
      paddingBottom: bottomPadding + 2,
    },
    contentContainerSplit: {
      flex: 1,
      minWidth: 0,
      paddingLeft: splitLayout ? 16 : horizontalPadding + 2,
      paddingRight: splitLayout ? 16 : horizontalPadding + 2,
      paddingTop: splitLayout ? 16 : topPadding + 2,
      paddingBottom: splitLayout ? 16 : bottomPadding + 2,
    },
    content: {
      gap: compactLayout ? compactSp.sectionGap + 2 : sp.sectionGap + 2,
    },
    infoSection: {
      gap: compactLayout ? 5 : bp === 'narrow' ? 8 : 10,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: bp === 'narrow' ? 'flex-start' : 'center',
      gap: 6,
    },
    metaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: compactLayout ? 5 : 6,
      minHeight: compactLayout ? compactSp.metaMinHeight : 26,
      paddingHorizontal: compactLayout ? 8 : 10,
      paddingVertical: compactLayout ? 4 : 5,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    titleText: {
      fontSize: fs.title,
      fontWeight: '600',
      color: colors.text,
      lineHeight: fs.title * 1.35,
      letterSpacing: Platform.OS === 'web' ? -0.2 : undefined,
      ...(Platform.OS === 'web'
        ? ({
            display: '-webkit-box',
            WebkitLineClamp: splitLayout || bp === 'narrow' ? 3 : 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          } as any)
        : null),
    },
    subtitleText: {
      fontSize: compactLayout ? fs.small - 1 : fs.small,
      color: colors.textMuted,
      lineHeight: (compactLayout ? fs.small - 1 : fs.small) * 1.45,
      ...(Platform.OS === 'web'
        ? ({
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          } as any)
        : null),
    },
    categoryText: {
      fontSize: fs.small,
      color: colors.textMuted,
    },
    smallText: {
      fontSize: fs.small,
      color: colors.textMuted,
    },
    drivingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      flexWrap: 'wrap',
    },
    coordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: compactLayout ? 8 : 10,
      minHeight: Math.max(DESIGN_TOKENS.touchTarget.minHeight, compactLayout ? compactSp.coordMinHeight : 44),
      paddingHorizontal: compactLayout ? 10 : 12,
      paddingVertical: compactLayout ? 8 : 10,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    coordText: {
      fontSize: compactLayout ? fs.small : fs.coord,
      fontWeight: '400',
      color: colors.textMuted,
      flex: 1,
      minWidth: 0,
      fontFamily:
        Platform.OS === 'web'
          ? ('ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' as any)
          : undefined,
    },
    actionsGroup: {
      gap: 6,
    },
    sectionLabel: {
      fontSize: 11,
      lineHeight: 16,
      fontWeight: '600',
      color: colors.textMuted,
      paddingHorizontal: 2,
      textTransform: 'uppercase',
      letterSpacing: Platform.OS === 'web' ? 0.4 : undefined,
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: splitLayout ? 6 : compactLayout ? 6 : bp === 'narrow' ? 6 : 8,
    },
    iconBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      width: compactLayout ? compactSp.iconButtonSize : sp.iconButtonSize,
      height: compactLayout ? compactSp.iconButtonSize : sp.iconButtonSize,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      borderWidth: 0,
      borderColor: 'transparent',
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'background-color 0.15s ease' } as any) : null),
    },
    actionBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      width: compactLayout ? compactSp.iconButtonSize : sp.iconButtonSize,
      height: compactLayout ? compactSp.iconButtonSize : sp.iconButtonSize,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      borderWidth: 0,
      borderColor: 'transparent',
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'background-color 0.15s ease' } as any) : null),
    },
    actionBtnPressed: {
      opacity: 0.65,
      transform: [{ scale: 0.96 }],
    },
    primaryActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'stretch',
      gap: 7,
      minHeight: Math.max(DESIGN_TOKENS.touchTarget.minHeight, compactLayout ? compactSp.addBtnMinHeight : 44),
      paddingVertical: compactLayout ? sp.btnPadV : sp.btnPadV,
      paddingHorizontal: compactLayout ? sp.btnPadH : sp.btnPadH,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.primary,
      borderWidth: 0,
      borderColor: 'transparent',
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'opacity 0.15s ease' } as any) : null),
    },
    primaryActionBtnPressed: {
      opacity: 0.72,
    },
    primaryActionText: {
      fontSize: compactLayout ? fs.small - 1 : fs.small,
      fontWeight: '600',
      color: colors.textOnPrimary ?? colors.textOnDark,
      letterSpacing: Platform.OS === 'web' ? 0.1 : undefined,
    },
    routeBtn: {
      backgroundColor: colors.primarySoft ?? colors.backgroundSecondary,
      borderColor: 'transparent',
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'stretch',
      gap: compactLayout ? 6 : 8,
      minHeight: Math.max(DESIGN_TOKENS.touchTarget.minHeight, compactLayout ? compactSp.addBtnMinHeight : 44),
      paddingVertical: compactLayout ? sp.btnPadV : sp.btnPadV,
      paddingHorizontal: compactLayout ? sp.btnPadH : sp.btnPadH + 4,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.borderLight ?? colors.border,
      backgroundColor: 'transparent',
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'opacity 0.15s ease' } as any) : null),
    },
    addBtnDisabled: {
      borderColor: colors.borderLight ?? colors.border,
      opacity: 0.4,
    },
    addBtnPressed: {
      opacity: 0.6,
    },
    addBtnText: {
      fontSize: compactLayout ? fs.small - 1 : bp === 'narrow' ? 13 : fs.small,
      fontWeight: '500',
      color: colors.text,
    },
  });
};

export default React.memo(PlacePopupCard);
