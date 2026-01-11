import React, { useCallback } from 'react';
import { Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
import type { ThemedColors } from '@/hooks/useTheme';
import type { Point } from './types';
import { buildGoogleMapsUrl, buildOrganicMapsUrl, buildTelegramShareUrl } from './mapLinks';

type UseMap = () => any;

interface CreatePopupComponentArgs {
  useMap: UseMap;
  colors: ThemedColors;
}

export const createMapPopupComponent = ({ useMap, colors }: CreatePopupComponentArgs) => {
  const PopupComponent: React.FC<{ point: Point }> = ({ point }) => {
    const map = useMap();
    const coord = String(point.coord ?? '').trim();

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
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }} numberOfLines={1}>
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
