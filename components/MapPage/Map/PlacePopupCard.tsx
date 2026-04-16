import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { ThemedColors } from '@/hooks/useTheme';
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
  width?: number;
  imageHeight?: number;
  compactLayout?: boolean;
  fullscreenOnMobile?: boolean;
  onClose?: () => void;
  colors: ThemedColors;
};

const escapeCssUrlString = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const POPUP_TOOLTIPS = {
  openPhoto: 'Открыть фото на весь экран',
  copyCoords: 'Скопировать координаты',
  openGoogleMaps: 'Открыть точку в Google Maps',
  openOrganicMaps: 'Открыть точку в Organic Maps',
  openWaze: 'Маршрут в Waze',
  openYandexNavi: 'Маршрут в Яндекс Навигаторе',
  shareTelegram: 'Поделиться точкой в Telegram',
  openArticle: 'Открыть статью по точке',
  buildRoute: 'Построить маршрут сюда',
} as const;

const FullscreenImageViewer: React.FC<{ imageUrl: string; alt: string; visible: boolean; onClose: () => void; colors: ThemedColors }> = ({ imageUrl, alt, visible, onClose, colors }) => {
  const { width, height } = useWindowDimensions();

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
            backgroundImage: blurBackdropUrl ? `url("${escapeCssUrlString(blurBackdropUrl)}")` : 'none',
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

const FullscreenPopupOverlay: React.FC<{
  visible: boolean;
  onClose: () => void;
  colors: ThemedColors;
  imageUrl?: string | null;
  imageAlt?: string;
  topInfoSlot: React.ReactNode;
  footerSlot: React.ReactNode;
  onOpenFullscreenImage?: () => void;
}> = ({ visible, onClose, colors, imageUrl, imageAlt, topInfoSlot, footerSlot, onOpenFullscreenImage }) => {
  const portalCreate = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    try {
      return (require('react-dom') as any)?.createPortal ?? null;
    } catch {
      return null;
    }
  }, []);

  if (Platform.OS !== 'web' || !visible) return null;

  const optimizedUrl = imageUrl
    ? optimizeImageUrl(imageUrl, { width: 600, height: 600, quality: 80, format: 'auto', fit: 'cover' }) ?? imageUrl
    : null;

  const overlay = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: colors.surface,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Hero image — 50% of screen */}
      <div
        style={{
          position: 'relative',
          flex: '0 0 50%',
          maxHeight: '50vh',
          minHeight: '40vh',
          backgroundColor: String(colors.backgroundSecondary ?? '#eee'),
          overflow: 'hidden',
        }}
      >
        {optimizedUrl ? (
          <img
            src={optimizedUrl}
            alt={imageAlt || ''}
            onClick={onOpenFullscreenImage}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              cursor: onOpenFullscreenImage ? 'pointer' : 'default',
            }}
            loading="eager"
            decoding="async"
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: String(colors.backgroundSecondary ?? '#eee'),
            }}
          />
        )}

        {/* Close button over image */}
        <button
          onClick={onClose}
          aria-label="Закрыть"
          style={{
            position: 'absolute',
            top: 'max(12px, env(safe-area-inset-top, 12px))',
            right: 12,
            width: 40,
            height: 40,
            borderRadius: 20,
            border: 'none',
            backgroundColor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
          }}
        >
          <Feather name="x" size={20} color="#fff" />
        </button>

        {/* Expand image button */}
        {optimizedUrl && onOpenFullscreenImage && (
          <button
            onClick={onOpenFullscreenImage}
            aria-label="Открыть фото на весь экран"
            style={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              width: 36,
              height: 36,
              borderRadius: 18,
              border: 'none',
              backgroundColor: 'rgba(0,0,0,0.35)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="maximize-2" size={16} color="#fff" />
          </button>
        )}
      </div>

      {/* Content — remaining 50% with scroll */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingTop: 16,
          paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
          paddingLeft: 'max(16px, env(safe-area-inset-left, 16px))',
          paddingRight: 'max(16px, env(safe-area-inset-right, 16px))',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
          {topInfoSlot}
          <div style={{ marginTop: 16 }}>
            {footerSlot}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && portalCreate) {
    return portalCreate(overlay, document.body);
  }

  return overlay;
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
  narrow: { title: 15, small: 12, coord: 11 },
  compact: { title: 15, small: 12, coord: 12 },
  default: { title: 16, small: 12, coord: 12 },
};

const SPACING: Record<BreakpointKey, { gap: number; btnPadV: number; btnPadH: number; radius: number; iconButtonSize: number; sectionGap: number }> = {
  narrow: { gap: 6, btnPadV: 6, btnPadH: 10, radius: 12, iconButtonSize: 34, sectionGap: 8 },
  compact: { gap: 8, btnPadV: 7, btnPadH: 12, radius: 14, iconButtonSize: 36, sectionGap: 10 },
  default: { gap: 8, btnPadV: 7, btnPadH: 14, radius: 14, iconButtonSize: 36, sectionGap: 10 },
};

const COMPACT_LAYOUT_SPACING: Record<BreakpointKey, { radius: number; iconButtonSize: number; sectionGap: number; horizontalPadding: number; topPadding: number; bottomPadding: number; metaMinHeight: number; coordMinHeight: number; addBtnMinHeight: number }> = {
  narrow: { radius: 10, iconButtonSize: 32, sectionGap: 6, horizontalPadding: 8, topPadding: 8, bottomPadding: 8, metaMinHeight: 22, coordMinHeight: 30, addBtnMinHeight: 32 },
  compact: { radius: 12, iconButtonSize: 34, sectionGap: 8, horizontalPadding: 10, topPadding: 10, bottomPadding: 10, metaMinHeight: 24, coordMinHeight: 32, addBtnMinHeight: 34 },
  default: { radius: 12, iconButtonSize: 36, sectionGap: 8, horizontalPadding: 10, topPadding: 10, bottomPadding: 10, metaMinHeight: 24, coordMinHeight: 34, addBtnMinHeight: 36 },
};

const POPUP_MAX_WIDTH_BY_BREAKPOINT: Record<BreakpointKey, number> = {
  narrow: 272,
  compact: 296,
  default: 332,
};

const COMPACT_POPUP_MAX_WIDTH_BY_BREAKPOINT: Record<BreakpointKey, number> = {
  narrow: 216,
  compact: 236,
  default: 252,
};

const IMAGE_MAX_HEIGHT_BY_BREAKPOINT: Record<BreakpointKey, number> = {
  narrow: 120,
  compact: 144,
  default: 176,
};

const COMPACT_IMAGE_MAX_HEIGHT_BY_BREAKPOINT: Record<BreakpointKey, number> = {
  narrow: 96,
  compact: 112,
  default: 120,
};

const SPLIT_LAYOUT_MIN_VIEWPORT = 640;
const SPLIT_LAYOUT_MIN_POPUP_WIDTH = 300;
const SPLIT_LAYOUT_IMAGE_ASPECT = 1;

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
  width = 332,
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

  const showLabeled = useFullscreenMobileOverlay;

  const labeledActionStyle = useMemo(
    () =>
      ({ pressed }: { pressed: boolean }) => [styles.labeledActionBtn, pressed && styles.actionBtnPressed],
    [styles],
  );

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

        {onAddPoint && showLabeled && (
          <CardActionPressable
            accessibilityLabel={compactLabel}
            onPress={() => void onAddPoint()}
            disabled={addDisabled || isAdding}
            title={compactLabel}
            style={({ pressed }) => [
              styles.saveFullBtn,
              (addDisabled || isAdding) && styles.addBtnDisabled,
              pressed && styles.addBtnPressed,
            ]}
          >
            {isAdding ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Feather name="bookmark" size={15} color={colors.primary} />
                <Text style={styles.saveFullBtnText}>{compactLabel}</Text>
              </>
            )}
          </CardActionPressable>
        )}

        <View style={styles.secondaryActionsRow}>
          {hasCoord && onOpenGoogleMaps && primaryAction?.onPress !== onOpenGoogleMaps && (
            <CardActionPressable
              accessibilityLabel="Google Maps"
              onPress={onOpenGoogleMaps}
              title={POPUP_TOOLTIPS.openGoogleMaps}
              style={showLabeled ? labeledActionStyle : actionBtnStyle}
            >
              <Feather name="map" size={14} color={colors.textMuted} />
              {showLabeled && <Text style={styles.labeledActionText}>Google</Text>}
            </CardActionPressable>
          )}

          {hasCoord && onOpenOrganicMaps && (
            <CardActionPressable
              accessibilityLabel="Organic Maps"
              onPress={onOpenOrganicMaps}
              title={POPUP_TOOLTIPS.openOrganicMaps}
              style={showLabeled ? labeledActionStyle : actionBtnStyle}
            >
              <Feather name="compass" size={14} color={colors.textMuted} />
              {showLabeled && <Text style={styles.labeledActionText}>Organic</Text>}
            </CardActionPressable>
          )}

          {hasCoord && onOpenWaze && (
            <CardActionPressable
              accessibilityLabel="Waze"
              onPress={onOpenWaze}
              title={POPUP_TOOLTIPS.openWaze}
              style={showLabeled ? labeledActionStyle : actionBtnStyle}
            >
               <Feather name="zap" size={14} color={colors.textMuted} />
              {showLabeled && <Text style={styles.labeledActionText}>Waze</Text>}
            </CardActionPressable>
          )}

          {hasCoord && onOpenYandexNavi && (
            <CardActionPressable
              accessibilityLabel="Яндекс Навигатор"
              onPress={onOpenYandexNavi}
              title={POPUP_TOOLTIPS.openYandexNavi}
              style={showLabeled ? labeledActionStyle : actionBtnStyle}
            >
              <Feather name="crosshair" size={14} color={colors.textMuted} />
              {showLabeled && <Text style={styles.labeledActionText}>Яндекс</Text>}
            </CardActionPressable>
          )}

          {hasCoord && onShareTelegram && (
            <CardActionPressable
              accessibilityLabel="Поделиться"
              onPress={onShareTelegram}
              title={POPUP_TOOLTIPS.shareTelegram}
              style={showLabeled ? labeledActionStyle : actionBtnStyle}
            >
              <Feather name="send" size={14} color={colors.textMuted} />
              {showLabeled && <Text style={styles.labeledActionText}>Telegram</Text>}
            </CardActionPressable>
          )}

          {hasArticle && primaryAction?.onPress !== onOpenArticle && (
            <CardActionPressable
              accessibilityLabel="Открыть статью"
              onPress={onOpenArticle}
              title={POPUP_TOOLTIPS.openArticle}
              style={showLabeled ? labeledActionStyle : actionBtnStyle}
            >
              <Feather name="book-open" size={14} color={colors.textMuted} />
              {showLabeled && <Text style={styles.labeledActionText}>Статья</Text>}
            </CardActionPressable>
          )}

          {onBuildRoute && primaryAction?.onPress !== onBuildRoute && (
            <CardActionPressable
              accessibilityLabel="Маршрут"
              onPress={onBuildRoute}
              title={POPUP_TOOLTIPS.buildRoute}
              testID="popup-build-route"
              style={showLabeled
                ? ({ pressed }) => [styles.labeledActionBtn, styles.routeBtn, pressed && styles.actionBtnPressed]
                : ({ pressed }) => [styles.iconBtn, styles.routeBtn, pressed && styles.actionBtnPressed]
              }
            >
              <Feather name="corner-up-right" size={14} color={colors.primary} />
              {showLabeled && <Text style={[styles.labeledActionText, { color: colors.primary }]}>Маршрут</Text>}
            </CardActionPressable>
          )}

          {onAddPoint && !showLabeled && (
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
                <Feather name="plus" size={14} color={colors.primary} />
              )}
            </CardActionPressable>
          )}
        </View>
      </View>
    </View>
  ), [
    actionBtnStyle,
    labeledActionStyle,
    showLabeled,
    addDisabled,
    colors.primary,
    colors.textMuted,
    compactLabel,
    coord,
    hasArticle,
    hasCoord,
    isAdding,
    onAddPoint,
    onBuildRoute,
    onCopyCoord,
    onOpenArticle,
    onOpenGoogleMaps,
    onOpenOrganicMaps,
    onOpenWaze,
    onOpenYandexNavi,
    onShareTelegram,
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
      ? 10
      : 12;
  const topPadding = compactLayout
    ? compactSp.topPadding
    : bp === 'narrow'
      ? 10
      : 10;
  const bottomPadding = compactLayout
    ? compactSp.bottomPadding
    : bp === 'narrow'
      ? 10
      : 10;

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
    topSection: {
      width: '100%',
    },
    topSectionSplit: {
      flexDirection: 'row',
      alignItems: 'flex-start',
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
      height: undefined,
      minHeight: heroHeight > 0 ? heroHeight : 0,
      flexShrink: 0,
      alignSelf: 'flex-start',
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
      paddingBottom: 0,
    },
    contentContainerSplit: {
      flex: 1,
      minWidth: 0,
      paddingLeft: splitLayout ? 12 : horizontalPadding + 2,
      paddingRight: splitLayout ? 12 : horizontalPadding + 2,
      paddingTop: splitLayout ? 8 : topPadding + 2,
      paddingBottom: 0,
      justifyContent: 'flex-start',
    },
    footerContainer: {
      paddingHorizontal: horizontalPadding + 2,
      paddingTop: splitLayout ? 10 : 12,
      paddingBottom: bottomPadding + 2,
    },
    footerStack: {
      gap: splitLayout ? 10 : compactLayout ? compactSp.sectionGap : sp.sectionGap,
    },
    infoSection: {
      gap: compactLayout ? 4 : splitLayout ? 5 : bp === 'narrow' ? 6 : 8,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: bp === 'narrow' ? 'flex-start' : 'center',
      gap: splitLayout ? 5 : 6,
    },
    metaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: compactLayout ? 5 : 6,
      minHeight: compactLayout ? compactSp.metaMinHeight : splitLayout ? 24 : 26,
      paddingHorizontal: compactLayout ? 8 : splitLayout ? 9 : 10,
      paddingVertical: compactLayout ? 4 : splitLayout ? 4 : 5,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    titleText: {
      fontSize: splitLayout ? fs.title + 1 : fs.title,
      fontWeight: '700',
      color: colors.text,
      lineHeight: (splitLayout ? fs.title + 1 : fs.title) * 1.28,
      letterSpacing: Platform.OS === 'web' ? -0.35 : undefined,
      ...(Platform.OS === 'web'
        ? ({
            display: '-webkit-box',
            WebkitLineClamp: splitLayout ? 2 : bp === 'narrow' ? 3 : 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          } as any)
        : null),
    },
    subtitleText: {
      fontSize: compactLayout ? fs.small - 1 : splitLayout ? fs.small + 1 : fs.small,
      color: colors.textMuted,
      lineHeight: (compactLayout ? fs.small - 1 : splitLayout ? fs.small + 1 : fs.small) * 1.35,
      ...(Platform.OS === 'web'
        ? ({
            display: '-webkit-box',
            WebkitLineClamp: splitLayout ? 2 : 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          } as any)
        : null),
    },
    inlineLinkRow: {
      alignItems: 'flex-start',
    },
    inlineLink: {
      color: colors.primary,
      fontSize: compactLayout ? fs.small : fs.small + 1,
      fontWeight: '600',
      textDecorationLine: 'none',
      ...(Platform.OS === 'web'
        ? ({
            cursor: 'pointer',
          } as any)
        : null),
    },
    categoryText: {
      fontSize: compactLayout ? fs.small - 1 : fs.small,
      color: colors.textMuted,
    },
    smallText: {
      fontSize: compactLayout ? fs.small - 1 : fs.small,
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
      gap: compactLayout ? 5 : 6,
      minHeight: compactLayout ? compactSp.coordMinHeight : splitLayout ? 30 : 32,
      paddingHorizontal: compactLayout ? 8 : splitLayout ? 10 : 9,
      paddingVertical: compactLayout ? 4 : 5,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight ?? colors.border,
    },
    coordText: {
      fontSize: compactLayout ? fs.small : splitLayout ? fs.coord - 1 : fs.coord,
      fontWeight: '500',
      color: colors.text,
      flex: 1,
      minWidth: 0,
      fontFamily:
        Platform.OS === 'web'
          ? ('ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' as any)
          : undefined,
    },
    actionsStack: {
      gap: splitLayout ? 8 : 10,
    },
    secondaryActionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: splitLayout ? 7 : compactLayout ? 6 : 8,
    },
    iconBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      width: compactLayout ? compactSp.iconButtonSize : splitLayout ? sp.iconButtonSize - 2 : sp.iconButtonSize,
      height: compactLayout ? compactSp.iconButtonSize : splitLayout ? sp.iconButtonSize - 2 : sp.iconButtonSize,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight ?? colors.border,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'background-color 0.15s ease' } as any) : null),
    },
    actionBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      width: compactLayout ? compactSp.iconButtonSize : splitLayout ? sp.iconButtonSize - 2 : sp.iconButtonSize,
      height: compactLayout ? compactSp.iconButtonSize : splitLayout ? sp.iconButtonSize - 2 : sp.iconButtonSize,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight ?? colors.border,
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
      gap: 6,
      width: '100%',
      minHeight: compactLayout ? compactSp.addBtnMinHeight : splitLayout ? 38 : 40,
      paddingVertical: compactLayout ? 4 : 6,
      paddingHorizontal: compactLayout ? sp.btnPadH : splitLayout ? 14 : sp.btnPadH,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.primary,
      borderWidth: 0,
      borderColor: 'transparent',
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'opacity 0.15s ease' } as any) : null),
    },
    primaryActionBtnPressed: {
      opacity: 0.72,
    },
    primaryActionText: {
      fontSize: compactLayout ? fs.small : fs.small + 1,
      fontWeight: '600',
      color: colors.textOnPrimary ?? colors.textOnDark,
      letterSpacing: Platform.OS === 'web' ? 0 : undefined,
    },
    routeBtn: {
      backgroundColor: colors.primarySoft ?? colors.backgroundSecondary,
      borderColor: colors.primarySoft ?? colors.borderLight ?? colors.border,
    },
    addBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      width: compactLayout ? compactSp.iconButtonSize : splitLayout ? sp.iconButtonSize - 2 : sp.iconButtonSize,
      height: compactLayout ? compactSp.iconButtonSize : splitLayout ? sp.iconButtonSize - 2 : sp.iconButtonSize,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.primarySoft ?? colors.borderLight ?? colors.border,
      backgroundColor: colors.primarySoft ?? colors.backgroundSecondary,
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
    labeledActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 38,
      paddingHorizontal: 12,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight ?? colors.border,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'background-color 0.15s ease' } as any) : null),
    },
    labeledActionText: {
      fontSize: fs.small,
      fontWeight: '500',
      color: colors.textMuted,
    },
    saveFullBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      width: '100%',
      minHeight: 40,
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.primarySoft ?? colors.borderLight ?? colors.border,
      backgroundColor: colors.primarySoft ?? colors.backgroundSecondary,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'opacity 0.15s ease' } as any) : null),
    },
    saveFullBtnText: {
      fontSize: fs.small + 1,
      fontWeight: '600',
      color: colors.primary,
    },
  });
};

export default React.memo(PlacePopupCard);
