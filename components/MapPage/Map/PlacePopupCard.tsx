import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import CardActionPressable from '@/components/ui/CardActionPressable';

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

  const content = (
    <View style={[fullscreenStyles.container, { width, height }]}>
      <ImageCardMedia
        src={imageUrl}
        fit="contain"
        blurBackground={false}
        priority="high"
        loading="eager"
        transition={0}
        style={StyleSheet.absoluteFillObject}
        alt={alt}
      />
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

  if (Platform.OS === 'web') {
    if (!visible) return null;

    const overlay = (
      <View
        style={[fullscreenStyles.webOverlay, { width, height }]}
        {...({ onClick: (e: any) => { if (e.target === e.currentTarget) onClose(); } } as any)}
      >
        {content}
      </View>
    );

    if (typeof document !== 'undefined' && portalCreate) {
      return portalCreate(overlay, document.body);
    }

    return overlay;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {content}
    </Modal>
  );
};

const fullscreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  webOverlay: {
    ...Platform.select({
      web: {
        position: 'fixed' as any,
        top: 0,
        left: 0,
        zIndex: 99999,
      },
      default: {},
    }),
    backgroundColor: 'rgba(0,0,0,0.95)',
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
  narrow: { title: 11, small: 9 },
  compact: { title: 12, small: 10 },
  default: { title: 13, small: 11 },
};

const SPACING: Record<BreakpointKey, { gap: number; btnPadV: number; btnPadH: number; radius: number; thumbSize: number }> = {
  narrow: { gap: 4, btnPadV: 3, btnPadH: 5, radius: 6, thumbSize: 60 },
  compact: { gap: 6, btnPadV: 4, btnPadH: 6, radius: 7, thumbSize: 68 },
  default: { gap: 8, btnPadV: 5, btnPadH: 7, radius: 8, thumbSize: 72 },
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
  width = 380,
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
  const maxPopupWidth = Math.min(width, Math.max(260, viewportWidth - (isNarrow ? 28 : 56)));

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
              fit="cover"
              blurBackground={false}
              loading="lazy"
              priority="low"
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.expandIcon}>
              <Feather name="maximize-2" size={12} color="#fff" />
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
              <Feather name="navigation" size={11} color={colors.textMuted} />
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
          {onCopyCoord && <Feather name="copy" size={12} color={colors.textMuted} />}
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
            <Feather name="map" size={14} color={colors.textMuted} />
          </CardActionPressable>
        )}

        {hasCoord && onOpenOrganicMaps && (
          <CardActionPressable
            accessibilityLabel="Открыть в Organic Maps"
            onPress={onOpenOrganicMaps}
            title="Organic Maps"
            style={actionBtnStyle}
          >
            <Feather name="compass" size={14} color={colors.textMuted} />
          </CardActionPressable>
        )}

        {hasCoord && onShareTelegram && (
          <CardActionPressable
            accessibilityLabel="Поделиться в Telegram"
            onPress={onShareTelegram}
            title="Телеграм"
            style={actionBtnStyle}
          >
            <Feather name="send" size={14} color={colors.textMuted} />
          </CardActionPressable>
        )}

        {hasArticle && (
          <CardActionPressable
            accessibilityLabel="Открыть статью"
            onPress={onOpenArticle}
            title="Статья"
            style={actionBtnStyle}
          >
            <Feather name="book-open" size={14} color={colors.textMuted} />
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
            <Feather name="corner-up-right" size={14} color={colors.primary} />
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
            <Feather name="map-pin" size={13} color={colors.primary} />
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
  narrow: 2.2,
  compact: 2.4,
  default: 2.5,
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
      bottom: 5,
      right: 5,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    infoSection: {
      gap: 3,
      paddingHorizontal: 2,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    titleText: {
      fontSize: fs.title + 1,
      fontWeight: '600',
      color: colors.text,
      lineHeight: (fs.title + 1) * 1.3,
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
      gap: 4,
      flexWrap: 'wrap',
    },
    coordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 2,
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
      gap: 4,
      paddingHorizontal: 2,
    },
    iconBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    actionBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 32,
      height: 32,
      borderRadius: 8,
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
      gap: 6,
      paddingVertical: sp.btnPadV + 1,
      paddingHorizontal: sp.btnPadH + 4,
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
