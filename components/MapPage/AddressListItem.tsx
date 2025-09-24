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
      () => categoryName?.split(',').map((c) => c.trim()) ?? [],
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

        // 1) пробуем открыть приложение Telegram
        const deeplinks = [
            `tg://msg_url?url=${encodeURIComponent(mapUrl)}&text=${encodeURIComponent(text)}`,
            `tg://share?text=${encodeURIComponent(`${text}\n${mapUrl}`)}`,
        ];
        for (const dl of deeplinks) {
            try {
                const can = await Linking.canOpenURL(dl);
                if (can) { await Linking.openURL(dl); return; }
            } catch {}
        }
        // 2) веб-шеринг
        await openExternal(`https://t.me/share/url?url=${encodeURIComponent(mapUrl)}&text=${encodeURIComponent(text)}`);
    }, [coord]);

    const openMap = useCallback(() => openExternal(buildMapUrl(coord)), [coord]);

    const handlePress = useCallback(() => {
        if (onPress) onPress();
        else openExternal(articleUrl || urlTravel);
    }, [onPress, articleUrl, urlTravel]);

    const height = isMobile ? 200 : 400;

    return (
      <View
        style={[styles.card, { height }]}
        onMouseEnter={() => !isMobile && setHovered(true)}
        onMouseLeave={() => !isMobile && setHovered(false)}
      >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handlePress}
            accessibilityRole="button"
            accessibilityLabel="Открыть маршрут"
            android_ripple={{ color: '#0002' }}
            onLongPress={copyCoords}
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
              >
                  {!imgLoaded && (
                    <View style={styles.loader}>
                        <ActivityIndicator size="small" color="#fff" />
                    </View>
                  )}

                  {/* верхние иконки — по hover на web, всегда на мобиле */}
                  {showOverlays && (
                    <View style={styles.iconCol}>
                        <IconButton
                          icon="link"
                          size={20}
                          onPress={() => openExternal(articleUrl || urlTravel)}
                          iconColor="#fff"
                          style={styles.iconBtn}
                        />
                        <IconButton
                          icon="content-copy"
                          size={20}
                          onPress={copyCoords}
                          iconColor="#fff"
                          style={styles.iconBtn}
                        />
                        <IconButton
                          icon="send"
                          size={20}
                          onPress={openTelegram}
                          iconColor="#fff"
                          style={styles.iconBtn}
                        />
                    </View>
                  )}

                  {/* нижняя плашка — по hover на web, всегда на мобиле */}
                  {showOverlays && (
                    <View style={styles.overlay}>
                        {!!address && (
                          <Text style={styles.title} numberOfLines={1}>
                              {address}
                          </Text>
                        )}

                        {!!coord && (
                          <Pressable onPress={openMap}>
                              <Text style={styles.coord}>{coord}</Text>
                          </Pressable>
                        )}

                        {!!categories.length && (
                          <View style={styles.catWrap}>
                              {categories.map((cat, i) => (
                                <View key={i.toString()} style={styles.catChip}>
                                    <Text style={styles.catText}>{cat}</Text>
                                </View>
                              ))}
                          </View>
                        )}
                    </View>
                  )}
              </ImageBackground>
          </Pressable>
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
        overflow: 'hidden',
    },
    image: { flex: 1, justifyContent: 'flex-end' },
    loader: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#0003',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
    },

    // иконки — столбиком, квадратные тёмные кнопки
    iconCol: {
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 2,
        gap: 8,
    },
    iconBtn: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        margin: 0,
        marginBottom: 8,
        borderRadius: 12,
        width: 44,
        height: 44,
    },

    overlay: {
        padding: 12,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
    },
    title: { color: '#fff', fontWeight: '800', fontSize: 16, marginBottom: 6 },
    coord: {
        color: '#fff',
        textDecorationLine: 'underline',
        textDecorationColor: '#fff' as any,
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 8,
    },
    catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    catChip: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    catText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});

export default React.memo(AddressListItem);
