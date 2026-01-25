import React from 'react';
import { ActivityIndicator, Platform, Text, View, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
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
  width = 380,
  imageHeight = 86,
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
  const isCompactPopup = viewportWidth <= 640;
  const isNarrowPopup = viewportWidth <= 480;
  const compactLabel = isNarrowPopup ? 'В мои точки' : addLabel;
  const maxPopupWidth = Math.min(width, Math.max(280, viewportWidth - (isNarrowPopup ? 32 : 64)));
  const thumbSize = isNarrowPopup ? 64 : isCompactPopup ? 72 : imageHeight;

  return (
    <View style={{ width: '100%', maxWidth: maxPopupWidth, gap: isCompactPopup ? 6 : 10 }}>
      <View style={{ flexDirection: 'row', gap: isCompactPopup ? 8 : 12 }}>
        <View
          style={{
            width: thumbSize,
            minWidth: thumbSize,
            flexShrink: 0,
            aspectRatio: 1,
            borderRadius: isNarrowPopup ? 8 : isCompactPopup ? 10 : 12,
            overflow: 'hidden',
            backgroundColor: colors.backgroundSecondary ?? colors.surface,
          }}
        >
          {imageUrl ? (
            <ImageCardMedia
              src={imageUrl}
              alt={title || 'Point image'}
              fit="cover"
              blurBackground
              blurRadius={16}
              loading="lazy"
              priority="low"
              style={{ width: '100%', height: '100%' } as any}
            />
          ) : (
            <View style={{ width: '100%', height: '100%', backgroundColor: colors.backgroundSecondary }} />
          )}
          {hasArticle && (
            <CardActionPressable
              accessibilityLabel="Открыть статью"
              onPress={onOpenArticle}
              title="Открыть статью"
              style={{ position: 'absolute', inset: 0 } as any}
            >
              {null}
            </CardActionPressable>
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Text
            style={{
              fontSize: isNarrowPopup ? 11 : isCompactPopup ? 12 : 13,
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
            }}
            numberOfLines={2}
          >
            {title}
          </Text>

          {!!categoryLabel && (
            <View
              style={{
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: isNarrowPopup ? 0 : isCompactPopup ? 1 : 2,
                paddingHorizontal: isNarrowPopup ? 5 : isCompactPopup ? 6 : 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.borderLight ?? colors.border,
                backgroundColor: colors.backgroundSecondary ?? colors.surface,
              }}
            >
              <Feather name="tag" size={12} color={colors.textMuted} />
              <Text
                style={{
                  fontSize: isNarrowPopup ? 9 : isCompactPopup ? 10 : 11,
                  color: colors.textMuted,
                }}
                numberOfLines={1}
              >
                {categoryLabel}
              </Text>
            </View>
          )}

          {(isDrivingLoading || hasDrivingInfo) && (
            <View
              testID="popup-driving-info"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
              }}
            >
              <Feather name="navigation" size={12} color={colors.textMuted} />
              {isDrivingLoading ? (
                <ActivityIndicator size="small" color={colors.textMuted} />
              ) : (
                <Text
                  style={{
                    fontSize: isNarrowPopup ? 9 : isCompactPopup ? 10 : 11,
                    color: colors.textMuted,
                  }}
                  numberOfLines={1}
                >
                  {drivingText}
                </Text>
              )}
            </View>
          )}

          {hasCoord && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text
                style={{
                  fontSize: isNarrowPopup ? 9 : isCompactPopup ? 10 : 11,
                  color: colors.text,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' as any,
                }}
              >
                {coord}
              </Text>
              {onCopyCoord && (
                <CardActionPressable
                  accessibilityLabel="Скопировать координаты"
                  onPress={() => void onCopyCoord()}
                  title="Скопировать координаты"
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: isNarrowPopup ? 2 : isCompactPopup ? 3 : 4,
                    paddingHorizontal: isNarrowPopup ? 5 : isCompactPopup ? 6 : 8,
                    borderRadius: isNarrowPopup ? 6 : isCompactPopup ? 7 : 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    opacity: pressed ? 0.9 : 1,
                    cursor: Platform.OS === 'web' ? ('pointer' as any) : undefined,
                  })}
                >
                  <Feather name="clipboard" size={13} color={colors.textMuted} />
                </CardActionPressable>
              )}
            </View>
          )}
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: isCompactPopup ? 5 : 8 }}>
        {hasCoord && onOpenGoogleMaps && (
          <CardActionPressable
            accessibilityLabel="Открыть в Google Maps"
            onPress={onOpenGoogleMaps}
            title="Открыть в Google Maps"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: isNarrowPopup ? 4 : isCompactPopup ? 5 : 6,
              paddingHorizontal: isNarrowPopup ? 6 : isCompactPopup ? 6 : 8,
              borderRadius: isNarrowPopup ? 6 : isCompactPopup ? 7 : 8,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              opacity: pressed ? 0.9 : 1,
              cursor: Platform.OS === 'web' ? ('pointer' as any) : undefined,
            })}
          >
            <Feather name="external-link" size={13} color={colors.textMuted} />
            <Text
              style={{
                fontSize: isNarrowPopup ? 9 : isCompactPopup ? 10 : 11,
                color: colors.text,
              }}
            >
              Google Maps
            </Text>
          </CardActionPressable>
        )}

        {hasCoord && onOpenOrganicMaps && (
          <CardActionPressable
            accessibilityLabel="Открыть в Organic Maps"
            onPress={onOpenOrganicMaps}
            title="Открыть в Organic Maps"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: isNarrowPopup ? 4 : isCompactPopup ? 5 : 6,
              paddingHorizontal: isNarrowPopup ? 6 : isCompactPopup ? 6 : 8,
              borderRadius: isNarrowPopup ? 6 : isCompactPopup ? 7 : 8,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              opacity: pressed ? 0.9 : 1,
              cursor: Platform.OS === 'web' ? ('pointer' as any) : undefined,
            })}
          >
            <Feather name="navigation" size={13} color={colors.textMuted} />
            <Text
              style={{
                fontSize: isNarrowPopup ? 9 : isCompactPopup ? 10 : 11,
                color: colors.text,
              }}
            >
              Organic Maps
            </Text>
          </CardActionPressable>
        )}

        {hasCoord && onShareTelegram && (
          <CardActionPressable
            accessibilityLabel="Поделиться в Telegram"
            onPress={onShareTelegram}
            title="Поделиться в Telegram"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: isNarrowPopup ? 4 : isCompactPopup ? 5 : 6,
              paddingHorizontal: isNarrowPopup ? 6 : isCompactPopup ? 6 : 8,
              borderRadius: isNarrowPopup ? 6 : isCompactPopup ? 7 : 8,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              opacity: pressed ? 0.9 : 1,
              cursor: Platform.OS === 'web' ? ('pointer' as any) : undefined,
            })}
          >
            <Feather name="send" size={13} color={colors.textMuted} />
            <Text
              style={{
                fontSize: isNarrowPopup ? 9 : isCompactPopup ? 10 : 11,
                color: colors.text,
              }}
            >
              Телеграм
            </Text>
          </CardActionPressable>
        )}

        {hasArticle && (
          <CardActionPressable
            accessibilityLabel="Открыть статью"
            onPress={onOpenArticle}
            title="Открыть статью"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: isNarrowPopup ? 4 : isCompactPopup ? 5 : 6,
              paddingHorizontal: isNarrowPopup ? 6 : isCompactPopup ? 6 : 8,
              borderRadius: isNarrowPopup ? 6 : isCompactPopup ? 7 : 8,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              opacity: pressed ? 0.9 : 1,
              cursor: Platform.OS === 'web' ? ('pointer' as any) : undefined,
            })}
          >
            <Feather name="book-open" size={13} color={colors.textMuted} />
            <Text
              style={{
                fontSize: isNarrowPopup ? 9 : isCompactPopup ? 10 : 11,
                color: colors.text,
              }}
            >
              Статья
            </Text>
          </CardActionPressable>
        )}
      </View>

      {onAddPoint && (
        <CardActionPressable
          accessibilityLabel={compactLabel}
          onPress={() => void onAddPoint()}
          disabled={addDisabled || isAdding}
          title={compactLabel}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: isNarrowPopup ? 5 : isCompactPopup ? 6 : 7,
            paddingHorizontal: isNarrowPopup ? 8 : isCompactPopup ? 8 : 10,
            borderRadius: isNarrowPopup ? 8 : isCompactPopup ? 9 : 10,
            backgroundColor: addDisabled || isAdding ? 'rgba(0,0,0,0.08)' : colors.primary,
            opacity: pressed ? 0.92 : 1,
            cursor: Platform.OS === 'web' ? ('pointer' as any) : undefined,
          })}
        >
          {isAdding ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <Feather name="map-pin" size={14} color={colors.textOnPrimary} />
          )}
          <Text
            style={{
              fontSize: isNarrowPopup ? 9 : isCompactPopup ? 10 : 11,
              fontWeight: '700',
              color: colors.textOnPrimary,
              letterSpacing: -0.2,
            }}
          >
            {compactLabel}
          </Text>
        </CardActionPressable>
      )}
    </View>
  );
};

export default PlacePopupCard;
