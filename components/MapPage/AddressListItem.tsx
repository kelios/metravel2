// components/MapPage/AddressListItem.tsx
import React, { useMemo, useCallback, useState } from 'react';
import {
    View,
    StyleSheet,
    Pressable,
    Linking,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import * as Clipboard from 'expo-clipboard';
import { TravelCoords } from '@/src/types/types';
import { METRICS } from '@/constants/layout';
import PopupContentComponent from './PopupContentComponent';
import { useResponsive } from '@/hooks/useResponsive';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { getSafeExternalUrl } from '@/utils/safeExternalUrl';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { getDistanceInfo } from '@/utils/distanceCalculator';

let toastModulePromise: Promise<any> | null = null;
async function showToast(payload: any) {
    try {
        if (!toastModulePromise) {
            toastModulePromise = import('react-native-toast-message');
        }
        const mod = await toastModulePromise;
        const Toast = (mod as any)?.default ?? mod;
        if (Toast && typeof Toast.show === 'function') {
            Toast.show(payload);
        }
    } catch {
        // ignore
    }
}

type Props = {
    travel: TravelCoords;
    isMobile?: boolean;
    onPress?: () => void;
    /** новое — скрыть объект из списка/карты */
    onHidePress?: () => void;
    /** координаты пользователя для расчета расстояния */
    userLocation?: { latitude: number; longitude: number } | null;
    /** режим транспорта для расчета времени в пути */
    transportMode?: 'car' | 'bike' | 'foot';
};

const addVersion = (url?: string, updated?: string) =>
  url && updated ? `${url}?v=${new Date(updated).getTime()}` : url;

/* helpers */
const parseCoord = (coord?: string) => {
    if (!coord) return null;
    const parsed = CoordinateConverter.fromLooseString(coord);
    return parsed ? { lat: parsed.lat, lon: parsed.lng } : null;
};

const buildMapUrl = (coord?: string) => {
    const p = parseCoord(coord);
    return p ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}` : '';
};

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';

const openExternal = async (url?: string) => {
    const safeUrl = getSafeExternalUrl(url, { allowRelative: true, baseUrl: SITE_URL });
    if (!safeUrl) return;
    try {
        const can = await Linking.canOpenURL(safeUrl);
        if (can) await Linking.openURL(safeUrl);
        else await showToast({ type: 'info', text1: 'Не удалось открыть ссылку', position: 'bottom' });
    } catch {
        await showToast({ type: 'info', text1: 'Не удалось открыть ссылку', position: 'bottom' });
    }
};

const AddressListItem: React.FC<Props> = ({
                                              travel,
                                              isMobile: isMobileProp,
                                              onPress,
                                              onHidePress,
                                              userLocation,
                                              transportMode = 'car',
                                          }) => {
    const {
        address,
        categoryName,
        coord,
        travelImageThumbUrl,
        articleUrl,
        urlTravel,
    } = travel;

    const [imgLoaded, setImgLoaded] = useState(false);
    const [hovered, setHovered] = useState(false);
    const colors = useThemedColors();
    const styles = useMemo(() => getStyles(colors), [colors]);

    const { width, isPhone, isLargePhone } = useResponsive();
    const isMobile = isMobileProp ?? (isPhone || isLargePhone);
    const isSmallScreen = isPhone;
    const isTablet = width > 480 && width <= METRICS.breakpoints.largeTablet;

    // показываем оверлеи всегда на мобиле и только при hover на web
    const showOverlays = isMobile || hovered;

    // Адаптивные размеры
    const iconSize = isSmallScreen ? 20 : 22;
    const iconButtonSize = isSmallScreen ? 40 : 48;
    const titleFontSize = isSmallScreen ? 16 : isTablet ? 17 : 18;
    const coordFontSize = isSmallScreen ? 12 : 13;

    const categories = useMemo(
      () => categoryName?.split(',').map((c) => c.trim()).filter(Boolean) ?? [],
      [categoryName]
    );

    const showToastInfo = useCallback((msg: string) => {
        void showToast({ type: 'info', text1: msg, position: 'bottom' });
    }, []);

    const copyCoords = useCallback(async () => {
        if (!coord) return;
        try {
            if (Platform.OS === 'web' && (navigator as any)?.clipboard) {
                await (navigator as any).clipboard.writeText(coord);
            } else {
                await Clipboard.setStringAsync(coord);
            }
            showToastInfo('Координаты скопированы');
        } catch {
            showToastInfo('Не удалось скопировать');
        }
    }, [coord, showToastInfo]);

    const openTelegram = useCallback(async () => {
        if (!coord) return;
        const mapUrl = buildMapUrl(coord);
        const text = `📍 Координаты: ${coord}`;

        const deeplinks = [
            `tg://msg_url?url=${encodeURIComponent(mapUrl)}&text=${encodeURIComponent(text)}`,
            `tg://share?text=${encodeURIComponent(`${text}\n${mapUrl}`)}`,
        ];

        for (const dl of deeplinks) {
            try {
                const can = await Linking.canOpenURL(dl);
                if (can) {
                    await Linking.openURL(dl);
                    return;
                }
            } catch {
                // Try next deeplink
            }
        }

        await openExternal(`https://t.me/share/url?url=${encodeURIComponent(mapUrl)}&text=${encodeURIComponent(text)}`);
    }, [coord]);

    const openMap = useCallback((e: any) => {
        e?.stopPropagation();
        openExternal(buildMapUrl(coord));
    }, [coord]);

    const openArticle = useCallback((e?: any) => {
        e?.stopPropagation();
        openExternal(articleUrl || urlTravel);
    }, [articleUrl, urlTravel]);

    const handleMainPress = useCallback(() => {
        if (onPress) onPress();
        else openArticle();
    }, [onPress, openArticle]);

    const handleIconPress = useCallback((handler: () => void) => {
        return (e: any) => {
            e?.stopPropagation();
            handler();
        };
    }, []);

    // Адаптивная высота в зависимости от размера экрана
    const getCardHeight = () => {
        if (width <= 480) return 240;      // Малые мобильные
        if (width <= METRICS.breakpoints.tablet) return 280;      // Планшеты
        if (width <= METRICS.breakpoints.largeTablet) return 320;     // Небольшие десктопы
        return 360;                         // Большие экраны
    };
    const height = getCardHeight();

    const imgUri = useMemo(() => {
      if (!travelImageThumbUrl) return null;
      return addVersion(travelImageThumbUrl, (travel as any).updated_at);
    }, [travelImageThumbUrl, travel]);

    // Расчет расстояния и времени в пути
    const distanceInfo = useMemo(() => {
        const parsed = parseCoord(coord);
        if (!parsed || !userLocation) return null;

        return getDistanceInfo(
            { lat: userLocation.latitude, lng: userLocation.longitude },
            { lat: parsed.lat, lng: parsed.lon },
            transportMode
        );
    }, [coord, userLocation, transportMode]);

    if (Platform.OS === 'web') {
        return (
          <div style={{ padding: 8 }}>
            <PopupContentComponent travel={{
              address: address ?? '',
              coord: coord ?? '',
              travelImageThumbUrl,
              categoryName,
              description: undefined,
              articleUrl,
              urlTravel,
            }} />
          </div>
        );
    }

    return (
      <Pressable
        style={[styles.card, { height }]}
        onHoverIn={() => !isMobile && setHovered(true)}
        onHoverOut={() => !isMobile && setHovered(false)}
      >
        <View style={styles.image}>
          {imgUri ? (
            <ImageCardMedia
              src={imgUri}
              fit="contain"
              blurBackground
              blurRadius={12}
              overlayColor={colors.overlayLight}
              cachePolicy="memory-disk"
              transition={200}
              loading="lazy"
              priority="low"
              style={StyleSheet.absoluteFillObject}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(true)}
            />
          ) : (
            <View style={styles.noDataWrap}>
              <ImageCardMedia
                source={require('@/assets/no-data.webp')}
                fit="contain"
                blurBackground={false}
                transition={0}
                loading="lazy"
                priority="low"
                style={styles.noDataImage}
              />
            </View>
          )}

          {!imgLoaded && (
            <View style={styles.loader}>
              <ActivityIndicator size="small" color={colors.textOnDark} />
            </View>
          )}

              {/* Основной Pressable для всей карточки */}
              <Pressable
                style={styles.mainPressable}
                onPress={handleMainPress}
                accessibilityRole="button"
                accessibilityLabel={`Открыть: ${address || 'Место'}`}
                android_ripple={{ color: colors.overlayLight }}
                onLongPress={copyCoords}
              >
                  <View style={styles.mainPressArea} />
              </Pressable>

              {/* верхние иконки — по hover на web, всегда на мобиле */}
              {showOverlays && (
                <View style={styles.iconCol}>
                    <IconButton
                      icon="eye-off"
                      size={iconSize}
                      onPress={onHidePress ? handleIconPress(onHidePress) : undefined}
                      iconColor={colors.textOnDark}
                      style={[styles.iconBtnDanger, { width: iconButtonSize, height: iconButtonSize }]}
                      accessibilityLabel="Скрыть объект"
                    />
                    <IconButton
                      icon="link"
                      size={iconSize}
                      onPress={handleIconPress(openArticle)}
                      iconColor={colors.textOnDark}
                      style={[styles.iconBtn, { width: iconButtonSize, height: iconButtonSize }]}
                      accessibilityLabel="Открыть статью"
                    />
                    <IconButton
                      icon="content-copy"
                      size={iconSize}
                      onPress={handleIconPress(copyCoords)}
                      iconColor={colors.textOnDark}
                      style={[styles.iconBtn, { width: iconButtonSize, height: iconButtonSize }]}
                      accessibilityLabel="Скопировать координаты"
                    />
                    <IconButton
                      icon="send"
                      size={iconSize}
                      onPress={handleIconPress(openTelegram)}
                      iconColor={colors.textOnDark}
                      style={[styles.iconBtn, { width: iconButtonSize, height: iconButtonSize }]}
                      accessibilityLabel="Поделиться в Telegram"
                    />
                </View>
              )}

              {/* нижняя плашка — по hover на web, всегда на мобиле */}
              {showOverlays && (
                <View style={styles.overlay}>
                    {!!address && (
                      <Text style={[styles.title, { fontSize: titleFontSize }]} numberOfLines={2}>
                          {address}
                      </Text>
                    )}

                    {/* Расстояние и время в пути */}
                    {distanceInfo && (
                      <View style={styles.distanceRow}>
                          <View style={styles.distanceBadge}>
                              <Text style={styles.distanceText}>📍 {distanceInfo.distanceText}</Text>
                          </View>
                          <View style={styles.timeBadge}>
                              <Text style={styles.timeText}>
                                  {transportMode === 'car' ? '🚗' : transportMode === 'bike' ? '🚴' : '🚶'} {distanceInfo.travelTimeText}
                              </Text>
                          </View>
                      </View>
                    )}

                    {!!coord && !isMobile && (
                      <Pressable
                        onPress={openMap}
                        style={styles.coordPressable}
                        accessibilityRole="button"
                        accessibilityLabel="Открыть в карте"
                      >
                          <Text style={[styles.coord, { fontSize: coordFontSize }]}>{coord}</Text>
                      </Pressable>
                    )}

                    {!!categories.length && (
                      <View style={styles.catWrap}>
                          {categories.slice(0, 3).map((cat, i) => (
                            <View key={`${cat}-${i}`} style={styles.catChip}>
                                <Text style={styles.catText}>{cat}</Text>
                            </View>
                          ))}
                      </View>
                    )}
                </View>
              )}
        </View>
      </Pressable>
    );
};

const getStyles = (colors: ThemedColors) => StyleSheet.create<Record<string, any>>({
    card: {
        marginVertical: 12,
        marginHorizontal: 8,
        borderRadius: 24,
        backgroundColor: colors.surface,
        ...colors.shadows.medium,
        overflow: 'hidden',
        position: 'relative',
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
    },
    image: {
        flex: 1,
        justifyContent: 'flex-end',
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: colors.backgroundTertiary,
    },
    imageOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.overlayLight,
    },
    noDataWrap: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.backgroundTertiary,
    },
    noDataImage: {
        width: 120,
        height: 120,
        opacity: 0.9,
    },
    loader: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 24,
    },
    mainPressable: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
    },
    mainPressArea: {
        flex: 1,
    },

    // иконки
    iconCol: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 3,
        gap: 10,
        flexDirection: 'column',
    },
    iconBtn: {
        backgroundColor: colors.overlay,
        margin: 0,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        ...colors.shadows.medium,
    },
    iconBtnDanger: {
        backgroundColor: colors.danger,
        margin: 0,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        ...colors.shadows.medium,
    },

    overlay: {
        padding: 20,
        backgroundColor: colors.overlay,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        zIndex: 2,
        position: 'relative',
    },
    title: {
        color: colors.textOnDark,
        fontWeight: '800',
        marginBottom: 10,
        lineHeight: 24,
        letterSpacing: -0.4,
        textShadowColor: colors.overlay,
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
    },
    distanceRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
        flexWrap: 'wrap',
    },
    distanceBadge: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
        ...colors.shadows.light,
    },
    distanceText: {
        color: colors.textOnPrimary,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    timeBadge: {
        backgroundColor: colors.accent,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
        ...colors.shadows.light,
    },
    timeText: {
        color: colors.textOnPrimary,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    coordPressable: {
        alignSelf: 'flex-start',
        marginBottom: 12,
        paddingVertical: 6,
        paddingHorizontal: 4,
        borderRadius: 8,
    },
    coord: {
        color: colors.textOnDark,
        textDecorationLine: 'underline',
        fontWeight: '700',
        letterSpacing: 0.3,
        fontFamily: Platform.OS === 'web' ? 'Monaco, Menlo, "Ubuntu Mono", monospace' : 'monospace',
        textShadowColor: colors.overlay,
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    catWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 4,
    },
    catChip: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: colors.border,
        ...colors.shadows.light,
    },
    catText: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.3,
        textShadowColor: colors.overlay,
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
});

export default React.memo(AddressListItem);
