// components/MapPage/AddressListItem.tsx
import React, { useMemo, useCallback, useState } from 'react';
import {
    View,
    StyleSheet,
    Pressable,
    ImageBackground,
    Linking,
    useWindowDimensions,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { TravelCoords } from '@/src/types/types';

type Props = {
    travel: TravelCoords;
    isMobile?: boolean;
    onPress?: () => void;
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
                                          }) => {
    const {
        address,
        categoryName,
        coord,
        travelImageThumbUrl,
        articleUrl,
        urlTravel,
        updated_at,
    } = travel;

    const [imgLoaded, setImgLoaded] = useState(false);
    const [hovered, setHovered] = useState(false);

    const { width } = useWindowDimensions();
    const isMobile = isMobileProp ?? width <= 768;

    // показываем оверлеи всегда на мобиле и только при hover на web
    const showOverlays = isMobile || hovered;

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
            if (Platform.OS === 'web' && navigator.clipboard) {
                await navigator.clipboard.writeText(coord);
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

        // 1) пробуем открыть приложение Telegram
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
                // Продолжаем пробовать следующую ссылку
                continue;
            }
        }

        // 2) веб-шеринг
        await openExternal(`https://t.me/share/url?url=${encodeURIComponent(mapUrl)}&text=${encodeURIComponent(text)}`);
    }, [coord]);

    const openMap = useCallback((e: any) => {
        e?.stopPropagation(); // Предотвращаем всплытие события
        openExternal(buildMapUrl(coord));
    }, [coord]);

    const openArticle = useCallback((e?: any) => {
        e?.stopPropagation(); // Предотвращаем всплытие события
        openExternal(articleUrl || urlTravel);
    }, [articleUrl, urlTravel]);

    const handleMainPress = useCallback(() => {
        if (onPress) {
            onPress();
        } else {
            openArticle();
        }
    }, [onPress, openArticle]);

    const handleIconPress = useCallback((handler: () => void) => {
        return (e: any) => {
            e?.stopPropagation(); // Важно: предотвращаем всплытие до основного Pressable
            handler();
        };
    }, []);

    // Увеличиваем высоту на мобильных устройствах
    const height = isMobile ? 280 : 400; // Было 200, стало 280

    return (
      <View
        style={[styles.card, { height }]}
        onMouseEnter={() => !isMobile && setHovered(true)}
        onMouseLeave={() => !isMobile && setHovered(false)}
      >
          <ImageBackground
            source={
                travelImageThumbUrl
                  ? { uri: addVersion(travelImageThumbUrl, updated_at) }
                  : require('@/assets/no-data.webp')
            }
            style={styles.image}
            imageStyle={{ borderRadius: 12 }}
            onLoadEnd={() => setImgLoaded(true)}
            resizeMode="cover"
          >
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
                accessibilityLabel={`Открыть статью: ${address || 'Место'}`}
                android_ripple={{ color: '#00000020' }}
                onLongPress={copyCoords}
              >
                  <View style={styles.mainPressArea} />
              </Pressable>

              {/* верхние иконки — по hover на web, всегда на мобиле */}
              {showOverlays && (
                <View style={styles.iconCol}>
                    <IconButton
                      icon="link"
                      size={20}
                      onPress={handleIconPress(openArticle)}
                      iconColor="#fff"
                      style={styles.iconBtn}
                      accessibilityLabel="Открыть статью"
                    />
                    <IconButton
                      icon="content-copy"
                      size={20}
                      onPress={handleIconPress(copyCoords)}
                      iconColor="#fff"
                      style={styles.iconBtn}
                      accessibilityLabel="Скопировать координаты"
                    />
                    <IconButton
                      icon="send"
                      size={20}
                      onPress={handleIconPress(openTelegram)}
                      iconColor="#fff"
                      style={styles.iconBtn}
                      accessibilityLabel="Поделиться в Telegram"
                    />
                </View>
              )}

              {/* нижняя плашка — по hover на web, всегда на мобиле */}
              {showOverlays && (
                <View style={styles.overlay}>
                    {!!address && (
                      <Text style={styles.title} numberOfLines={2}>
                          {address}
                      </Text>
                    )}

                    {!!coord && (
                      <Pressable
                        onPress={openMap}
                        style={styles.coordPressable}
                        accessibilityRole="button"
                        accessibilityLabel="Открыть карту"
                      >
                          <Text style={styles.coord}>{coord}</Text>
                      </Pressable>
                    )}

                    {!!categories.length && (
                      <View style={styles.catWrap}>
                          {categories.slice(0, 3).map((cat, i) => ( // Ограничиваем количество категорий
                            <View key={`${cat}-${i}`} style={styles.catChip}>
                                <Text style={styles.catText}>{cat}</Text>
                            </View>
                          ))}
                          {categories.length > 3 && (
                            <View style={styles.catChip}>
                                <Text style={styles.catText}>+{categories.length - 3}</Text>
                            </View>
                          )}
                      </View>
                    )}
                </View>
              )}
          </ImageBackground>
      </View>
    );
};

const styles = StyleSheet.create({
    card: {
        marginVertical: 8,
        marginHorizontal: 4,
        borderRadius: 12,
        backgroundColor: '#f3f3f3',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        overflow: 'hidden',
        position: 'relative',
    },
    image: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    loader: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#00000030',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
    },
    mainPressable: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
    },
    mainPressArea: {
        flex: 1,
    },

    // иконки — столбиком, квадратные тёмные кнопки
    iconCol: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 3,
        gap: 8,
    },
    iconBtn: {
        backgroundColor: 'rgba(0,0,0,0.7)',
        margin: 0,
        borderRadius: 12,
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },

    overlay: {
        padding: 16,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        zIndex: 2,
        position: 'relative',
    },
    title: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 16,
        marginBottom: 8,
        lineHeight: 20,
    },
    coordPressable: {
        alignSelf: 'flex-start',
        marginBottom: 8,
    },
    coord: {
        color: '#fff',
        textDecorationLine: 'underline',
        fontSize: 14,
        fontWeight: '600',
    },
    catWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    catChip: {
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    catText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
});

export default React.memo(AddressListItem);