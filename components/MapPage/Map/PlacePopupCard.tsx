import React, { useMemo } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
  addDisabled?: boolean;
  isAdding?: boolean;
  addLabel?: string;
  width?: number;
  imageHeight?: number;
};

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
  addDisabled = false,
  isAdding = false,
  addLabel = 'Мои точки',
  width = 320,
  imageHeight = 72,
}) => {
  const colors = useThemedColors();
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
  const sp = SPACING[bp];
  const _fs = FONT_SIZES[bp];
  const compactLabel = isNarrow ? 'В мои точки' : addLabel;
  const maxPopupWidth = Math.min(width, Math.max(260, viewportWidth - (isNarrow ? 28 : 56)));
  const thumbSize = sp.thumbSize === 72 ? imageHeight : sp.thumbSize;

  const styles = useMemo(() => getStyles(colors, bp), [colors, bp]);

  const actionBtnStyle = useMemo(
    () =>
      ({ pressed }: { pressed: boolean }) => [styles.actionBtn, pressed && styles.actionBtnPressed],
    [styles],
  );

  return (
    <View style={[styles.container, { maxWidth: maxPopupWidth }]}>
      <View style={styles.headerRow}>
        <View style={[styles.thumbWrap, { width: thumbSize, minWidth: thumbSize }]}>
          {imageUrl ? (
            <ImageCardMedia
              src={imageUrl}
              alt={title || 'Point image'}
              fit="cover"
              blurBackground
              blurRadius={16}
              loading="lazy"
              priority="low"
              style={StyleSheet.absoluteFillObject}
            />
          ) : (
            <View style={styles.thumbFallback} />
          )}
          {hasArticle && (
            <CardActionPressable
              accessibilityLabel="Открыть статью"
              onPress={onOpenArticle}
              title="Открыть статью"
              style={styles.thumbOverlay as any}
            >
              {null}
            </CardActionPressable>
          )}
        </View>

        <View style={styles.infoCol}>
          <Text style={styles.titleText} numberOfLines={2}>
            {title}
          </Text>

          {!!categoryLabel && (
            <View style={styles.categoryChip}>
              <Feather name="tag" size={12} color={colors.textMuted} />
              <Text style={styles.smallText} numberOfLines={1}>
                {categoryLabel}
              </Text>
            </View>
          )}

          {(isDrivingLoading || hasDrivingInfo) && (
            <View testID="popup-driving-info" style={styles.drivingRow}>
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

          {hasCoord && (
            <View style={styles.coordRow}>
              <Text style={styles.coordText}>{coord}</Text>
              {onCopyCoord && (
                <CardActionPressable
                  accessibilityLabel="Скопировать координаты"
                  onPress={() => void onCopyCoord()}
                  title="Скопировать координаты"
                  style={actionBtnStyle}
                >
                  <Feather name="clipboard" size={13} color={colors.textMuted} />
                </CardActionPressable>
              )}
            </View>
          )}
        </View>
      </View>

      <View style={styles.actionsRow}>
        {hasCoord && onOpenGoogleMaps && (
          <CardActionPressable
            accessibilityLabel="Открыть в Google Maps"
            onPress={onOpenGoogleMaps}
            title="Открыть в Google Maps"
            style={actionBtnStyle}
          >
            <Feather name="external-link" size={13} color={colors.textMuted} />
            <Text style={styles.actionBtnText}>Google Maps</Text>
          </CardActionPressable>
        )}

        {hasCoord && onOpenOrganicMaps && (
          <CardActionPressable
            accessibilityLabel="Открыть в Organic Maps"
            onPress={onOpenOrganicMaps}
            title="Открыть в Organic Maps"
            style={actionBtnStyle}
          >
            <Feather name="navigation" size={13} color={colors.textMuted} />
            <Text style={styles.actionBtnText}>Organic Maps</Text>
          </CardActionPressable>
        )}

        {hasCoord && onShareTelegram && (
          <CardActionPressable
            accessibilityLabel="Поделиться в Telegram"
            onPress={onShareTelegram}
            title="Поделиться в Telegram"
            style={actionBtnStyle}
          >
            <Feather name="send" size={13} color={colors.textMuted} />
            <Text style={styles.actionBtnText}>Телеграм</Text>
          </CardActionPressable>
        )}

        {hasArticle && (
          <CardActionPressable
            accessibilityLabel="Открыть статью"
            onPress={onOpenArticle}
            title="Открыть статью"
            style={actionBtnStyle}
          >
            <Feather name="book-open" size={13} color={colors.textMuted} />
            <Text style={styles.actionBtnText}>Статья</Text>
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
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <Feather name="map-pin" size={14} color={colors.textOnPrimary} />
          )}
          <Text style={styles.addBtnText}>{compactLabel}</Text>
        </CardActionPressable>
      )}
    </View>
  );
};

const getStyles = (colors: ThemedColors, bp: BreakpointKey) => {
  const sp = SPACING[bp];
  const fs = FONT_SIZES[bp];

  return StyleSheet.create({
    container: {
      width: '100%',
      gap: sp.gap,
    },
    headerRow: {
      flexDirection: 'row',
      gap: bp === 'narrow' ? 6 : bp === 'compact' ? 6 : 10,
    },
    thumbWrap: {
      flexShrink: 0,
      aspectRatio: 1,
      borderRadius: sp.radius + 2,
      overflow: 'hidden',
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
    },
    thumbFallback: {
      width: '100%',
      height: '100%',
      backgroundColor: colors.backgroundSecondary,
    },
    thumbOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    infoCol: {
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    titleText: {
      fontSize: fs.title,
      fontWeight: '700',
      color: colors.text,
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: bp === 'narrow' ? 0 : bp === 'compact' ? 1 : 2,
      paddingHorizontal: bp === 'narrow' ? 4 : bp === 'compact' ? 6 : 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderLight ?? colors.border,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
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
      gap: 6,
      flexWrap: 'wrap',
    },
    coordText: {
      fontSize: fs.small,
      color: colors.text,
      fontFamily:
        Platform.OS === 'web'
          ? ('ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' as any)
          : undefined,
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: sp.gap,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: sp.btnPadV,
      paddingHorizontal: sp.btnPadH,
      borderRadius: sp.radius,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    actionBtnPressed: {
      opacity: 0.9,
    },
    actionBtnText: {
      fontSize: fs.small,
      color: colors.text,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: sp.btnPadV + 1,
      paddingHorizontal: sp.btnPadH + 2,
      borderRadius: sp.radius + 2,
      backgroundColor: colors.primary,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    addBtnDisabled: {
      backgroundColor: 'rgba(0,0,0,0.08)',
    },
    addBtnPressed: {
      opacity: 0.92,
    },
    addBtnText: {
      fontSize: fs.small,
      fontWeight: '700',
      color: colors.textOnPrimary,
      letterSpacing: -0.2,
    },
  });
};

export default PlacePopupCard;
