import React from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import ImageCardMedia from '@/components/ui/ImageCardMedia';

type Props = {
  title: string;
  imageUrl?: string | null;
  categoryLabel?: string | null;
  coord?: string | null;
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
  onOpenArticle,
  onCopyCoord,
  onShareTelegram,
  onOpenGoogleMaps,
  onOpenOrganicMaps,
  onAddPoint,
  addDisabled = false,
  isAdding = false,
  addLabel = 'Добавить в мои точки',
  width = 320,
  imageHeight = 86,
}) => {
  const colors = useThemedColors();
  const hasCoord = !!coord;
  const hasArticle = typeof onOpenArticle === 'function';
  const { width: viewportWidth } = useWindowDimensions();
  const isCompactPopup = viewportWidth <= 640;
  const isNarrowPopup = viewportWidth <= 480;
  const compactLabel = isNarrowPopup ? 'В мои точки' : addLabel;

  return (
    <View style={{ width: '100%', maxWidth: width, gap: isCompactPopup ? 6 : 10 }}>
      <View style={{ flexDirection: 'row', gap: isCompactPopup ? 8 : 12 }}>
        <View
          style={{
            width: '30%',
            minWidth: isNarrowPopup ? 64 : isCompactPopup ? 72 : imageHeight,
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
            <Pressable
              accessibilityLabel="Открыть статью"
              onPress={(e) => {
                (e as any)?.stopPropagation?.();
                onOpenArticle?.();
              }}
              {...({ 'data-card-action': 'true', title: 'Открыть статью' } as any)}
              style={{ position: 'absolute', inset: 0 } as any}
            />
          )}
        </View>

        <View style={{ width: '70%', gap: 6 }}>
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

          {hasCoord && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text
                style={{
                  fontSize: isNarrowPopup ? 9 : isCompactPopup ? 10 : 11,
                  color: colors.text,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' as any,
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {coord}
              </Text>
              {onCopyCoord && (
                <Pressable
                  accessibilityLabel="Скопировать координаты"
                  onPress={(e) => {
                    (e as any)?.stopPropagation?.();
                    void onCopyCoord();
                  }}
                  {...({ 'data-card-action': 'true', title: 'Скопировать координаты' } as any)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
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
                  <Text
                    style={{
                      fontSize: isNarrowPopup ? 9 : isCompactPopup ? 10 : 11,
                      color: colors.textMuted,
                    }}
                  >
                    Копировать
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: isCompactPopup ? 5 : 8 }}>
        {hasCoord && onOpenGoogleMaps && (
          <Pressable
            accessibilityLabel="Открыть в Google Maps"
            onPress={(e) => {
              (e as any)?.stopPropagation?.();
              onOpenGoogleMaps();
            }}
            {...({ 'data-card-action': 'true', title: 'Открыть в Google Maps' } as any)}
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
          </Pressable>
        )}

        {hasCoord && onOpenOrganicMaps && (
          <Pressable
            accessibilityLabel="Открыть в Organic Maps"
            onPress={(e) => {
              (e as any)?.stopPropagation?.();
              onOpenOrganicMaps();
            }}
            {...({ 'data-card-action': 'true', title: 'Открыть в Organic Maps' } as any)}
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
          </Pressable>
        )}

        {hasCoord && onShareTelegram && (
          <Pressable
            accessibilityLabel="Поделиться в Telegram"
            onPress={(e) => {
              (e as any)?.stopPropagation?.();
              onShareTelegram();
            }}
            {...({ 'data-card-action': 'true', title: 'Поделиться в Telegram' } as any)}
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
              Поделиться
            </Text>
          </Pressable>
        )}

        {hasArticle && (
          <Pressable
            accessibilityLabel="Открыть статью"
            onPress={(e) => {
              (e as any)?.stopPropagation?.();
              onOpenArticle?.();
            }}
            {...({ 'data-card-action': 'true', title: 'Открыть статью' } as any)}
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
          </Pressable>
        )}
      </View>

      {onAddPoint && (
        <Pressable
          accessibilityLabel={compactLabel}
          onPress={(e) => {
            (e as any)?.stopPropagation?.();
            void onAddPoint();
          }}
          disabled={addDisabled || isAdding}
          {...(Platform.OS === 'web'
            ? ({
                title: compactLabel,
                'aria-label': compactLabel,
              } as any)
            : ({ accessibilityRole: 'button' } as any))}
          {...({ 'data-card-action': 'true' } as any)}
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
        </Pressable>
      )}
    </View>
  );
};

export default PlacePopupCard;
