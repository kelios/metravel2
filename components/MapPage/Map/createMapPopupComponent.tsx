import React, { useCallback, useMemo, useState } from 'react';
import { Text, View, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
import type { ThemedColors } from '@/hooks/useTheme';
import type { Point } from './types';
import { buildGoogleMapsUrl, buildOrganicMapsUrl, buildTelegramShareUrl } from './mapLinks';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/src/utils/toast';
import { userPointsApi } from '@/src/api/userPoints';
import { useQueryClient } from '@tanstack/react-query';
import { PointStatus } from '@/types/userPoints';

type UseMap = () => any;

interface CreatePopupComponentArgs {
  useMap: UseMap;
  colors: ThemedColors;
}

export const createMapPopupComponent = ({ useMap, colors }: CreatePopupComponentArgs) => {
  const PopupComponent: React.FC<{ point: Point }> = ({ point }) => {
    const [isAdding, setIsAdding] = useState(false);
    const map = useMap();
    const coord = String(point.coord ?? '').trim();
    const { isAuthenticated, authReady } = useAuth();
    const queryClient = useQueryClient();

    const handlePress = useCallback(() => {
      if (map) {
        map.closePopup();
      }
    }, [map]);

    const handleOpenArticle = useCallback(() => {
      const url = String(point.articleUrl || point.urlTravel || '').trim();
      if (!url) return;
      try {
        if (typeof window !== 'undefined') {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } catch {
        // noop
      }
    }, [point.articleUrl, point.urlTravel]);

    const handleCopyCoord = useCallback(async () => {
      if (!coord) return;
      try {
        if ((navigator as any)?.clipboard?.writeText) {
          await (navigator as any).clipboard.writeText(coord);
        }
      } catch {
        // noop
      }
    }, [coord]);

    const handleOpenGoogleMaps = useCallback(() => {
      if (!coord) return;
      const url = buildGoogleMapsUrl(coord);
      if (!url) return;
      try {
        if (typeof window !== 'undefined') {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } catch {
        // noop
      }
    }, [coord]);

    const handleOpenOrganicMaps = useCallback(() => {
      if (!coord) return;
      const url = buildOrganicMapsUrl(coord);
      if (!url) return;
      try {
        if (typeof window !== 'undefined') {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } catch {
        // noop
      }
    }, [coord]);

    const handleShareTelegram = useCallback(() => {
      if (!coord) return;
      const telegramUrl = buildTelegramShareUrl(coord);
      if (!telegramUrl) return;
      try {
        if (typeof window !== 'undefined') {
          window.open(telegramUrl, '_blank', 'noopener,noreferrer');
        }
      } catch {
        // noop
      }
    }, [coord]);

    const normalizedCoord = useMemo(() => {
      if (!coord) return null;
      const parts = coord.replace(/;/g, ',').split(',').map((v) => v.trim());
      if (parts.length < 2) return null;
      const lat = Number(parts[0]);
      const lng = Number(parts[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    }, [coord]);

    const handleAddPoint = useCallback(async () => {
      if (!authReady) return;
      if (!isAuthenticated) {
        void showToast({ type: 'info', text1: 'Войдите, чтобы сохранить точку', position: 'bottom' });
        return;
      }
      if (isAdding) return;
      if (!normalizedCoord) {
        void showToast({ type: 'info', text1: 'Не удалось распознать координаты', position: 'bottom' });
        return;
      }
      const rawCategoryName = Array.isArray(point.categoryName)
        ? point.categoryName.join(', ')
        : typeof point.categoryName === 'object'
        ? String((point.categoryName as any).name ?? '')
        : String(point.categoryName ?? '').trim();
      const categoryNameString = rawCategoryName || undefined;

      const payload: Partial<{ [key: string]: any }> = {
        name: point.address || 'Точка маршрута',
        address: point.address,
        latitude: normalizedCoord.lat,
        longitude: normalizedCoord.lng,
        color: '#ff922b',
        status: PointStatus.PLANNING,
        category: categoryNameString,
        categoryName: categoryNameString,
      };
      if (point.categoryId || point.category_ids) {
        const ids = [
          point.categoryId,
          ...(Array.isArray(point.category_ids) ? point.category_ids : []),
        ]
          .filter(Boolean)
          .map((v) => String(v));
        if (ids.length > 0) {
          payload.categoryIds = ids;
        }
      }

      setIsAdding(true);
      try {
        await userPointsApi.createPoint(payload);
        void showToast({ type: 'success', text1: 'Точка добавлена в мои точки', position: 'bottom' });
        void queryClient.invalidateQueries({ queryKey: ['userPointsAll'] });
        handlePress();
      } catch {
        void showToast({ type: 'error', text1: 'Не удалось сохранить точку', position: 'bottom' });
      } finally {
        setIsAdding(false);
      }
    }, [
      authReady,
      isAuthenticated,
      isAdding,
      normalizedCoord,
      point.address,
      point.categoryId,
      point.categoryName,
      point.category_ids,
      queryClient,
      handlePress,
    ]);

    return (
      <UnifiedTravelCard
        title={point.address || ''}
        imageUrl={point.travelImageThumbUrl}
        metaText={point.categoryName}
        onPress={handlePress}
        onMediaPress={handleOpenArticle}
        imageHeight={180}
        width={300}
        contentSlot={
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }} numberOfLines={2}>
              {point.address || ''}
            </Text>
            {!!coord && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textMuted,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' as any,
                  }}
                  numberOfLines={1}
                >
                  {coord}
                </Text>
                <View
                  {...({
                    role: 'button',
                    tabIndex: 0,
                    title: 'Скопировать координаты',
                    'aria-label': 'Скопировать координаты',
                    'data-card-action': 'true',
                    onClick: (e: any) => {
                      e?.preventDefault?.();
                      e?.stopPropagation?.();
                      void handleCopyCoord();
                    },
                    onKeyDown: (e: any) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e?.stopPropagation?.();
                        void handleCopyCoord();
                      }
                    },
                    style: { cursor: 'pointer' },
                  } as any)}
                >
                  <Feather name="clipboard" size={16} color={colors.textMuted} />
                </View>
                <View
                  {...({
                    role: 'button',
                    tabIndex: 0,
                    title: 'Поделиться в Telegram',
                    'aria-label': 'Поделиться в Telegram',
                    'data-card-action': 'true',
                    onClick: (e: any) => {
                      e?.preventDefault?.();
                      e?.stopPropagation?.();
                      handleShareTelegram();
                    },
                    onKeyDown: (e: any) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e?.stopPropagation?.();
                        handleShareTelegram();
                      }
                    },
                    style: { cursor: 'pointer' },
                  } as any)}
                >
                  <Feather name="send" size={16} color={colors.textMuted} />
                </View>
              </View>
            )}
            {(!!point.categoryName || !!coord) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                {!!point.categoryName && (
                  <Text style={{ fontSize: 12, color: colors.textMuted }} numberOfLines={1}>
                    {point.categoryName}
                  </Text>
                )}

                {!!coord && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <View
                      {...({
                        role: 'button',
                        tabIndex: 0,
                        title: 'Открыть в Google Maps',
                        'aria-label': 'Открыть в Google Maps',
                        'data-card-action': 'true',
                        onClick: (e: any) => {
                          e?.preventDefault?.();
                          e?.stopPropagation?.();
                          handleOpenGoogleMaps();
                        },
                        onKeyDown: (e: any) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e?.stopPropagation?.();
                            handleOpenGoogleMaps();
                          }
                        },
                        style: { cursor: 'pointer' },
                      } as any)}
                    >
                      <Feather name="external-link" size={16} color={colors.textMuted} />
                    </View>

                    <View
                      {...({
                        role: 'button',
                        tabIndex: 0,
                        title: 'Открыть в Organic Maps',
                        'aria-label': 'Открыть в Organic Maps',
                        'data-card-action': 'true',
                        onClick: (e: any) => {
                          e?.preventDefault?.();
                          e?.stopPropagation?.();
                          handleOpenOrganicMaps();
                        },
                        onKeyDown: (e: any) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e?.stopPropagation?.();
                            handleOpenOrganicMaps();
                          }
                        },
                        style: { cursor: 'pointer' },
                      } as any)}
                    >
                      <Feather name="navigation" size={16} color={colors.textMuted} />
                    </View>

                    {!!String(point.articleUrl || point.urlTravel || '').trim() && (
                      <View
                        {...({
                          role: 'button',
                          tabIndex: 0,
                          title: 'Открыть статью',
                          'aria-label': 'Открыть статью',
                          'data-card-action': 'true',
                          onClick: (e: any) => {
                            e?.preventDefault?.();
                            e?.stopPropagation?.();
                            handleOpenArticle();
                          },
                          onKeyDown: (e: any) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e?.stopPropagation?.();
                              handleOpenArticle();
                            }
                          },
                          style: { cursor: 'pointer' },
                        } as any)}
                      >
                        <Feather name="book-open" size={16} color={colors.textMuted} />
                      </View>
                    )}
                  </View>
                )}
            </View>
            )}
            <View style={{ marginTop: 6, alignItems: 'flex-end' }}>
              <Pressable
                onPress={(e: any) => {
                  e?.preventDefault?.();
                  e?.stopPropagation?.();
                  void handleAddPoint();
                }}
                disabled={!authReady || !isAuthenticated || !normalizedCoord || isAdding}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingVertical: 4,
                  paddingHorizontal: 8,
                  borderRadius: 8,
                  backgroundColor:
                    !authReady || !isAuthenticated || !normalizedCoord || isAdding
                      ? 'rgba(0,0,0,0.08)'
                      : colors.primary,
                  opacity: pressed ? 0.85 : 1,
                  cursor: 'pointer',
                })}
              >
                <Feather
                  name="map-pin"
                  size={16}
                  color={colors.textOnPrimary}
                  style={{ marginTop: -1 }}
                />
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textOnPrimary,
                    fontWeight: '600',
                  }}
                >
                  Добавить в мои точки
                </Text>
              </Pressable>
            </View>
          </View>
        }
        mediaProps={{
          blurBackground: true,
          blurRadius: 16,
          loading: 'lazy',
          priority: 'low',
        }}
      />
    );
  };

  return PopupComponent;
};
