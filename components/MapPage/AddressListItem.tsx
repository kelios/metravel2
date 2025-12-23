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
import { Image as ExpoImage } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { TravelCoords } from '@/src/types/types';
import { METRICS } from '@/constants/layout';
import PopupContentComponent from './PopupContentComponent';
import { useResponsive } from '@/hooks/useResponsive';

type Props = {
    travel: TravelCoords;
    isMobile?: boolean;
    onPress?: () => void;
    /** новое — скрыть объект из списка/карты */
    onHidePress?: () => void;
};

const addVersion = (url?: string, updated?: string) =>
  url && updated ? `${url}?v=${new Date(updated).getTime()}` : url;

/* helpers */
const parseCoord = (coord?: string) => {
    if (!coord) return null;
    const cleaned = coord.replace(/;/g, ',').replace(/\s+/g, '');
    const [latStr, lonStr] = cleaned.split(',').map(s => s.trim());
    const lat = Number(latStr), lon = Number(lonStr);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
};

const buildMapUrl = (coord?: string) => {
    const p = parseCoord(coord);
    return p ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}` : '';
};

const openExternal = async (url?: string) => {
    if (!url) return;
    try {
        const can = await Linking.canOpenURL(url);
        if (can) await Linking.openURL(url);
        else Toast.show({ type: 'info', text1: 'Не удалось открыть ссылку', position: 'bottom' });
    } catch {
        Toast.show({ type: 'info', text1: 'Не удалось открыть ссылку', position: 'bottom' });
    }
};

const AddressListItem: React.FC<Props> = ({
                                              travel,
                                              isMobile: isMobileProp,
                                              onPress,
                                              onHidePress,
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

    const showToast = useCallback((msg: string) => {
        Toast.show({ type: 'info', text1: msg, position: 'bottom' });
    }, []);

    const copyCoords = useCallback(async () => {
        if (!coord) return;
        try {
            if (Platform.OS === 'web' && (navigator as any)?.clipboard) {
                await (navigator as any).clipboard.writeText(coord);
            } else {
                await Clipboard.setStringAsync(coord);
            }
            showToast('Координаты скопированы');
        } catch {
            showToast('Не удалось скопировать');
        }
    }, [coord, showToast]);

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
                continue;
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
            <>
              <ExpoImage
                source={{ uri: imgUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={0}
                blurRadius={12}
                onLoadEnd={() => setImgLoaded(true)}
              />
              <View style={styles.imageOverlay} />
              <ExpoImage
                source={{ uri: imgUri }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={200}
                onLoadEnd={() => setImgLoaded(true)}
              />
            </>
          ) : (
            <View style={styles.noDataWrap}>
              <ExpoImage
                source={require('@/assets/no-data.webp')}
                style={styles.noDataImage}
                contentFit="contain"
                transition={0}
              />
            </View>
          )}

          {!imgLoaded && (
            <View style={styles.loader}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          )}

              {/* Основной Pressable для всей карточки */}
              <Pressable
                style={styles.mainPressable}
                onPress={handleMainPress}
                accessibilityRole="button"
                accessibilityLabel={`Открыть: ${address || 'Место'}`}
                android_ripple={{ color: '#00000020' }}
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
                      iconColor="#fff"
                      style={[styles.iconBtnDanger, { width: iconButtonSize, height: iconButtonSize }]}
                      accessibilityLabel="Скрыть объект"
                    />
                    <IconButton
                      icon="link"
                      size={iconSize}
                      onPress={handleIconPress(openArticle)}
                      iconColor="#fff"
                      style={[styles.iconBtn, { width: iconButtonSize, height: iconButtonSize }]}
                      accessibilityLabel="Открыть статью"
                    />
                    <IconButton
                      icon="content-copy"
                      size={iconSize}
                      onPress={handleIconPress(copyCoords)}
                      iconColor="#fff"
                      style={[styles.iconBtn, { width: iconButtonSize, height: iconButtonSize }]}
                      accessibilityLabel="Скопировать координаты"
                    />
                    <IconButton
                      icon="send"
                      size={iconSize}
                      onPress={handleIconPress(openTelegram)}
                      iconColor="#fff"
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

const styles = StyleSheet.create<Record<string, any>>({
    card: {
        marginVertical: 12,
        marginHorizontal: 8,
        borderRadius: 24,
        backgroundColor: '#ffffff',
        elevation: 4,
        shadowColor: '#1f1f1f',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
    },
    image: {
        flex: 1,
        justifyContent: 'flex-end',
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#0b1220',
    },
    imageOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    noDataWrap: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0b1220',
    },
    noDataImage: {
        width: 120,
        height: 120,
        opacity: 0.9,
    },
    loader: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
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
        backgroundColor: 'rgba(0,0,0,0.8)',
        margin: 0,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
    },
    iconBtnDanger: {
        backgroundColor: 'rgba(239,68,68,0.9)',
        margin: 0,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 6,
    },

    overlay: {
        padding: 20,
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        zIndex: 2,
        position: 'relative',
    },
    title: {
        color: '#fff',
        fontWeight: '800',
        marginBottom: 10,
        lineHeight: 24,
        letterSpacing: -0.4,
        textShadow: '0 2px 8px rgba(0,0,0,0.5)',
    },
    coordPressable: {
        alignSelf: 'flex-start',
        marginBottom: 12,
        paddingVertical: 6,
        paddingHorizontal: 4,
        borderRadius: 8,
    },
    coord: {
        color: '#fff',
        textDecorationLine: 'underline',
        fontWeight: '700',
        letterSpacing: 0.3,
        fontFamily: Platform.OS === 'web' ? 'Monaco, Menlo, "Ubuntu Mono", monospace' : 'monospace',
        textShadow: '0 1px 4px rgba(0,0,0,0.5)',
    },
    catWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 4,
    },
    catChip: {
        backgroundColor: 'rgba(255,255,255,0.28)',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    catText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.3,
        textShadow: '0 1px 3px rgba(0,0,0,0.3)',
    },
});

export default React.memo(AddressListItem);
