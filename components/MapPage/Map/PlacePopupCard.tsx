import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import CardActionPressable from '@/components/ui/CardActionPressable';
import { optimizeImageUrl } from '@/utils/imageOptimization';

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
        <img
          src={hiResUrl ?? undefined}
          alt={alt}
          style={{
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
          // @ts-ignore
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
            blurBackground={false}
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

const FONT_SIZES: Record<BreakpointKey, { title: number; small: number }> = {
  narrow: { title: 14, small: 12 },
  compact: { title: 15, small: 13 },
  default: { title: 16, small: 14 },
};

const SPACING: Record<BreakpointKey, { gap: number; btnPadV: number; btnPadH: number; radius: number; thumbSize: number }> = {
  narrow: { gap: 8, btnPadV: 7, btnPadH: 9, radius: 10, thumbSize: 72 },
  compact: { gap: 10, btnPadV: 8, btnPadH: 10, radius: 11, thumbSize: 80 },
  default: { gap: 12, btnPadV: 9, btnPadH: 12, radius: 12, thumbSize: 88 },
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
  const maxPopupWidth = Math.min(width, Math.max(320, viewportWidth - (isNarrow ? 28 : 56)));

  const styles = useMemo(() => getStyles(colors, bp), [colors, bp]);

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

  return (
    <View style={[styles.container, { maxWidth: maxPopupWidth }]}>
      {/* Hero image — only when photo exists */}
      {imageUrl ? (
        <View style={styles.heroWrap}>
          <CardActionPressable
            accessibilityLabel="Открыть фото на полный экран"
            onPress={handleOpenFullscreen}
            title="Открыть фото на полный экран"
            style={styles.heroTouchable as any}
          >
            <ImageCardMedia
              src={imageUrl}
              alt={title || 'Point image'}
              fit="contain"
              blurBackground
              blurRadius={12}
              loading="lazy"
              priority="low"
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.expandIcon}>
              <Feather name="maximize-2" size={14} color={colors.textOnDark} />
            </View>
          </CardActionPressable>
        </View>
      ) : null}

      {/* Info section */}
      <View style={styles.infoSection}>
        <Text style={styles.titleText} numberOfLines={2}>
          {title}
        </Text>

        <View style={styles.metaRow}>
          {!!categoryLabel && (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryText} numberOfLines={1}>
                {categoryLabel}
              </Text>
            </View>
          )}

          {(isDrivingLoading || hasDrivingInfo) && (
            <View testID="popup-driving-info" style={styles.drivingRow}>
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

      {/* Coordinates row */}
      {hasCoord && (
        <CardActionPressable
          accessibilityLabel="Скопировать координаты"
          onPress={onCopyCoord ? () => void onCopyCoord() : undefined}
          title="Скопировать координаты"
          style={styles.coordRow}
        >
          <Text style={styles.coordText} numberOfLines={1} selectable>{coord}</Text>
          {onCopyCoord && <Feather name="copy" size={14} color={colors.textMuted} />}
        </CardActionPressable>
      )}

      {/* Compact icon action row */}
      <View style={styles.actionsRow}>

        {hasCoord && onOpenGoogleMaps && (
          <CardActionPressable
            accessibilityLabel="Открыть в Google Maps"
            onPress={onOpenGoogleMaps}
            title="Google Maps"
            style={actionBtnStyle}
          >
            <Feather name="map" size={16} color={colors.textMuted} />
          </CardActionPressable>
        )}

        {hasCoord && onOpenOrganicMaps && (
          <CardActionPressable
            accessibilityLabel="Открыть в Organic Maps"
            onPress={onOpenOrganicMaps}
            title="Organic Maps"
            style={actionBtnStyle}
          >
            <Feather name="compass" size={16} color={colors.textMuted} />
          </CardActionPressable>
        )}

        {hasCoord && onShareTelegram && (
          <CardActionPressable
            accessibilityLabel="Поделиться в Telegram"
            onPress={onShareTelegram}
            title="Телеграм"
            style={actionBtnStyle}
          >
            <Feather name="send" size={16} color={colors.textMuted} />
          </CardActionPressable>
        )}

        {hasArticle && (
          <CardActionPressable
            accessibilityLabel="Открыть статью"
            onPress={onOpenArticle}
            title="Статья"
            style={actionBtnStyle}
          >
            <Feather name="book-open" size={16} color={colors.textMuted} />
          </CardActionPressable>
        )}

        {onBuildRoute && (
          <CardActionPressable
            accessibilityLabel="Маршрут сюда"
            onPress={onBuildRoute}
            title="Маршрут сюда"
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

const getStyles = (colors: ThemedColors, bp: BreakpointKey) => {
  const sp = SPACING[bp];
  const fs = FONT_SIZES[bp];

  return StyleSheet.create({
    container: {
      width: '100%',
      gap: sp.gap,
    },
    heroWrap: {
      width: '100%',
      aspectRatio: IMAGE_ASPECT[bp],
      borderRadius: sp.radius,
      overflow: 'hidden',
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
    },
    heroTouchable: {
      width: '100%',
      height: '100%',
      ...(Platform.OS === 'web' ? ({ cursor: 'zoom-in' } as any) : null),
    },
    expandIcon: {
      position: 'absolute',
      bottom: 8,
      right: 8,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: 'rgba(0,0,0,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    infoSection: {
      gap: 6,
      paddingHorizontal: 4,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    titleText: {
      fontSize: fs.title,
      fontWeight: '600',
      color: colors.text,
      lineHeight: fs.title * 1.32,
      ...(Platform.OS === 'web'
        ? ({
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          } as any)
        : null),
    },
    categoryChip: {
      alignSelf: 'flex-start',
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
      gap: 8,
      paddingHorizontal: 4,
    },
    coordText: {
      fontSize: fs.small,
      color: colors.textMuted,
      fontFamily:
        Platform.OS === 'web'
          ? ('ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' as any)
          : undefined,
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      paddingHorizontal: 4,
    },
    iconBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    actionBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    actionBtnPressed: {
      opacity: 0.7,
    },
    routeBtn: {
      backgroundColor: colors.primarySoft ?? colors.backgroundSecondary,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: sp.btnPadV + 2,
      paddingHorizontal: sp.btnPadH + 6,
      borderRadius: sp.radius,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: 'transparent',
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
      fontSize: fs.small,
      fontWeight: '600',
      color: colors.primary,
    },
  });
};

export default React.memo(PlacePopupCard);
