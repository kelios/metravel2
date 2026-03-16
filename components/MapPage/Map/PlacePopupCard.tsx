import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import CardActionPressable from '@/components/ui/CardActionPressable';
import { optimizeImageUrl } from '@/utils/imageOptimization';
import { DESIGN_TOKENS } from '@/constants/designSystem';

type Props = {
  title: string;
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
            color: '#fff',
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
  narrow: { title: 15, small: 12, coord: 13 },
  compact: { title: 16, small: 13, coord: 14 },
  default: { title: 17, small: 14, coord: 14 },
};

const SPACING: Record<BreakpointKey, { gap: number; btnPadV: number; btnPadH: number; radius: number; iconButtonSize: number; sectionGap: number }> = {
  narrow: { gap: 10, btnPadV: 10, btnPadH: 12, radius: 12, iconButtonSize: 44, sectionGap: 14 },
  compact: { gap: 12, btnPadV: 11, btnPadH: 14, radius: 13, iconButtonSize: 46, sectionGap: 16 },
  default: { gap: 14, btnPadV: 12, btnPadH: 16, radius: 14, iconButtonSize: 48, sectionGap: 18 },
};

const POPUP_MAX_WIDTH_BY_BREAKPOINT: Record<BreakpointKey, number> = {
  narrow: 300,
  compact: 348,
  default: 436,
};

const PlacePopupCard: React.FC<Props> = ({
  title,
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
  width = 560,
  imageHeight: _imageHeight = 72,
}) => {
  const colors = useThemedColors();
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
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

  const { width: viewportWidth } = useWindowDimensions();
  const bp = getBreakpoint(viewportWidth);
  const isNarrow = bp === 'narrow';
  const _fs = FONT_SIZES[bp];
  const compactLabel = isNarrow ? 'В мои точки' : addLabel;
  const viewportGutter = bp === 'narrow' ? 24 : bp === 'compact' ? 32 : 48;
  const safeViewportWidth = Math.max(220, viewportWidth - viewportGutter);
  const maxPopupWidth = Math.min(width, POPUP_MAX_WIDTH_BY_BREAKPOINT[bp], safeViewportWidth);
  const heroWidth = maxPopupWidth;
  const heroHeight = Math.max(1, Math.round(heroWidth / IMAGE_ASPECT[bp]));

  const styles = useMemo(() => getStyles(colors, bp, heroHeight), [colors, bp, heroHeight]);

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
        <Text style={styles.titleText} numberOfLines={bp === 'narrow' ? 3 : 2}>
          {title}
        </Text>

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
          <Feather name="map-pin" size={15} color={colors.primary} style={{ flexShrink: 0 } as any} />
          <Text style={styles.coordText} numberOfLines={1} selectable>{coord}</Text>
          {onCopyCoord && <Feather name="copy" size={16} color={colors.textMuted} style={{ flexShrink: 0 } as any} />}
        </CardActionPressable>
      )}

      <View style={styles.actionsGroup}>
        <View style={styles.actionsRow}>
        {hasCoord && onOpenGoogleMaps && (
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

        {hasArticle && (
          <CardActionPressable
            accessibilityLabel="Открыть статью"
            onPress={onOpenArticle}
            title={POPUP_TOOLTIPS.openArticle}
            style={actionBtnStyle}
          >
            <Feather name="book-open" size={16} color={colors.textMuted} />
          </CardActionPressable>
        )}

        {onBuildRoute && (
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
            <Feather name="map-pin" size={16} color={colors.primary} />
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
    styles,
    title,
  ]);

  return (
    <View style={[styles.container, { maxWidth: maxPopupWidth }]}>
      <View style={styles.popupCard}>
        {imageUrl && (
          <Pressable
            onPress={handleOpenFullscreen}
            style={styles.imageContainer}
            accessibilityRole="button"
            accessibilityLabel="Открыть фото на весь экран"
          >
            <ImageCardMedia
              src={imageUrl}
              alt={title}
              fit="contain"
              blurBackground
              allowCriticalWebBlur={Platform.OS === 'web'}
              blurRadius={16}
              priority="low"
              loading="lazy"
              width={maxPopupWidth}
              height={heroHeight}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.imageExpandButton}>
              <Feather name="maximize-2" size={18} color={colors.textOnDark} />
            </View>
          </Pressable>
        )}

        <View style={styles.contentContainer}>
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

const getStyles = (colors: ThemedColors, bp: BreakpointKey, heroHeight: number) => {
  const sp = SPACING[bp];
  const fs = FONT_SIZES[bp];

  return StyleSheet.create({
    container: {
      width: '100%',
    },
    popupCard: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: sp.radius + 2,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
          } as any)
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 3,
          }),
    },
    imageContainer: {
      width: '100%',
      height: heroHeight > 0 ? heroHeight : undefined,
      minHeight: heroHeight > 0 ? heroHeight : 0,
      position: 'relative',
      backgroundColor: colors.backgroundSecondary,
    },
    imageExpandButton: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    contentContainer: {
      paddingHorizontal: bp === 'narrow' ? 12 : 14,
      paddingTop: bp === 'narrow' ? 12 : 14,
      paddingBottom: bp === 'narrow' ? 14 : 16,
    },
    content: {
      gap: sp.sectionGap,
    },
    infoSection: {
      gap: bp === 'narrow' ? 10 : 12,
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
      gap: 7,
      minHeight: 30,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight ?? colors.border,
    },
    titleText: {
      fontSize: fs.title,
      fontWeight: '600',
      color: colors.text,
      lineHeight: fs.title * 1.4,
      ...(Platform.OS === 'web'
        ? ({
            display: '-webkit-box',
            WebkitLineClamp: bp === 'narrow' ? 3 : 2,
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
      gap: 6,
      flexWrap: 'wrap',
    },
    coordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: Math.max(DESIGN_TOKENS.touchTarget.minHeight, 48),
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: sp.radius,
      backgroundColor: colors.primarySoft ?? colors.backgroundSecondary,
      borderWidth: 1.5,
      borderColor: colors.primaryAlpha30 ?? colors.border,
    },
    coordText: {
      fontSize: fs.coord,
      fontWeight: '500',
      color: colors.text,
      flex: 1,
      minWidth: 0,
      fontFamily:
        Platform.OS === 'web'
          ? ('ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' as any)
          : undefined,
    },
    actionsGroup: {
      gap: 0,
    },
    sectionLabel: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
      color: colors.textMuted,
      paddingHorizontal: 2,
      textTransform: 'uppercase',
      letterSpacing: Platform.OS === 'web' ? 0.3 : undefined,
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: bp === 'narrow' ? 8 : 10,
    },
    iconBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      width: sp.iconButtonSize,
      height: sp.iconButtonSize,
      borderRadius: sp.radius,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight ?? colors.border,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    actionBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      width: sp.iconButtonSize,
      height: sp.iconButtonSize,
      borderRadius: sp.radius,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight ?? colors.border,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    actionBtnPressed: {
      opacity: 0.78,
      transform: [{ scale: 0.98 }],
    },
    routeBtn: {
      backgroundColor: colors.primarySoft ?? colors.backgroundSecondary,
      borderColor: colors.primaryAlpha30 ?? colors.border,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      minHeight: Math.max(DESIGN_TOKENS.touchTarget.minHeight, 48),
      paddingVertical: sp.btnPadV + 2,
      paddingHorizontal: sp.btnPadH + 6,
      borderRadius: DESIGN_TOKENS.radii.pill,
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft ?? 'transparent',
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    addBtnDisabled: {
      borderColor: colors.borderLight ?? colors.border,
      opacity: 0.5,
    },
    addBtnPressed: {
      opacity: 0.7,
    },
    addBtnText: {
      fontSize: bp === 'narrow' ? 14 : fs.small,
      fontWeight: '600',
      color: colors.primary,
    },
  });
};

export default React.memo(PlacePopupCard);
