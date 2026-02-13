// components/MapPage/AddressListItem.tsx
import React, { useEffect, useMemo, useCallback, useState } from 'react';
import {
    View,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { Text } from '@/ui/paper';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import CardActionPressable from '@/components/ui/CardActionPressable';
import * as Clipboard from 'expo-clipboard';
import { TravelCoords } from '@/types/types';
import { METRICS } from '@/constants/layout';
import { DESIGN_COLORS, DESIGN_TOKENS } from '@/constants/designSystem';
import PlaceListCard from '@/components/places/PlaceListCard';
import Feather from '@expo/vector-icons/Feather';
import { useResponsive } from '@/hooks/useResponsive';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { openExternalUrlInNewTab, openExternalUrl } from '@/utils/externalLinks';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { getDistanceInfo } from '@/utils/distanceCalculator';
import { showToast } from '@/utils/toast';
import { useAuth } from '@/context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { userPointsApi } from '@/api/userPoints';
import { PointStatus } from '@/types/userPoints';

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

const buildAppleMapsUrl = (coord?: string) => {
  const p = parseCoord(coord);
  return p ? `https://maps.apple.com/?q=${encodeURIComponent(`${p.lat},${p.lon}`)}` : '';
};

const buildYandexMapsUrl = (coord?: string) => {
  const p = parseCoord(coord);
  return p ? `https://yandex.ru/maps/?pt=${encodeURIComponent(`${p.lon},${p.lat}`)}&z=16&l=map` : '';
};

const buildOsmUrl = (coord?: string) => {
  const p = parseCoord(coord);
  if (!p) return '';
  return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(p.lat))}&mlon=${encodeURIComponent(String(p.lon))}#map=16/${encodeURIComponent(String(p.lat))}/${encodeURIComponent(String(p.lon))}`;
};

const openExternal = async (url?: string) => {
    try {
        const opened = await openExternalUrlInNewTab(url ?? '');
        if (!opened) {
          await showToast({ type: 'info', text1: 'Не удалось открыть ссылку', position: 'bottom' });
        }
  } catch {
    await showToast({ type: 'info', text1: 'Не удалось открыть ссылку', position: 'bottom' });
  }
};

const DEFAULT_TRAVEL_POINT_COLOR = DESIGN_COLORS.travelPoint;
const DEFAULT_TRAVEL_POINT_STATUS = PointStatus.PLANNING;

const stripCountryFromCategoryString = (raw: string | null | undefined, address?: string | null) => {
  const category = String(raw ?? '').trim();
  if (!category) return '';
  const addr = String(address ?? '').trim();
  const countryCandidate = addr
    ? addr
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .slice(-1)[0]
    : '';
  if (!countryCandidate) return category;

  const filtered = category
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => p.localeCompare(countryCandidate, undefined, { sensitivity: 'accent' }) !== 0);

  return filtered.join(', ');
};

const PRESSED_OPACITY = { opacity: 0.85 };
const PLACE_CARD_STYLE = { margin: 8 };

const ActionIconButton = React.memo(function ActionIconButton({
    name,
    size,
    color,
    onPress,
    style,
    accessibilityLabel,
}: {
    name: keyof typeof Feather.glyphMap;
    size: number;
    color: string;
    onPress?: () => void;
    style?: any;
    accessibilityLabel: string;
}) {
    return (
        <CardActionPressable
            onPress={onPress}
            style={({ pressed }) => [style, pressed && PRESSED_OPACITY]}
            accessibilityLabel={accessibilityLabel}
        >
            <Feather name={name} size={size} color={color} />
        </CardActionPressable>
    );
});

const AddressListItem: React.FC<Props> = ({
                                              travel,
                                              isMobile: isMobileProp,
                                              onPress,
                                              onHidePress,
                                              userLocation,
                                              transportMode: _transportMode = 'car',
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
    const [isAddingPoint, setIsAddingPoint] = useState(false);
    const [pointAdded, setPointAdded] = useState(false);
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

    const rawCategoryName = useMemo(() => {
      if (categoryName) return String(categoryName);
      const legacy = (travel as any).category_name ?? (travel as any).category ?? (travel as any).categories;
      if (Array.isArray(legacy)) {
        return legacy
          .map((item) => (typeof item === 'object' ? String((item as any)?.name ?? '') : String(item ?? '')))
          .map((item) => item.trim())
          .filter(Boolean)
          .join(', ');
      }
      if (legacy && typeof legacy === 'object') {
        return String((legacy as any).name ?? '');
      }
      return String(legacy ?? '').trim();
    }, [categoryName, travel]);

    const categories = useMemo(() => {
      const cleaned = stripCountryFromCategoryString(rawCategoryName, address);
      return cleaned ? cleaned.split(',').map((c) => c.trim()).filter(Boolean) : [];
    }, [address, rawCategoryName]);

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
        const text = `Координаты: ${coord}`;

        const deeplinks = [
            `tg://msg_url?url=${encodeURIComponent(mapUrl)}&text=${encodeURIComponent(text)}`,
            `tg://share?text=${encodeURIComponent(`${text}\n${mapUrl}`)}`,
        ];

        if (Platform.OS !== 'web') {
          for (const dl of deeplinks) {
              try {
                  const opened = await openExternalUrl(dl, { allowedProtocols: ['http:', 'https:', 'tg:'] });
                  if (opened) {
                      return;
                  }
              } catch {
                  // Try next deeplink
              }
          }
        }

        await openExternal(`https://t.me/share/url?url=${encodeURIComponent(mapUrl)}&text=${encodeURIComponent(text)}`);
    }, [coord]);

    const openMap = useCallback((e?: any) => {
        e?.stopPropagation?.();
        openExternal(buildMapUrl(coord));
    }, [coord]);

    const openArticle = useCallback((e?: any) => {
        e?.stopPropagation?.();
        openExternal(articleUrl || urlTravel);
    }, [articleUrl, urlTravel]);

    const handleMainPress = useCallback(() => {
        if (onPress) onPress();
        else openArticle();
    }, [onPress, openArticle]);

    const handleIconPress = useCallback((handler: () => void) => {
        return () => {
            handler();
        };
    }, []);

    const { isAuthenticated, authReady } = useAuth();
    const queryClient = useQueryClient();

    const handleAddPoint = useCallback(async () => {
        if (!authReady) return;
        if (!isAuthenticated) {
            void showToast({ type: 'info', text1: 'Войдите, чтобы сохранить точку', position: 'bottom' });
            return;
        }
        if (isAddingPoint) return;
        const lat = Number(travel.lat);
        const lng = Number(travel.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            void showToast({ type: 'info', text1: 'Не удалось распознать координаты', position: 'bottom' });
            return;
        }

        const cleanedCategory = stripCountryFromCategoryString(rawCategoryName, address);
        const categoryString = cleanedCategory || undefined;

        const payload: Record<string, unknown> = {
            name: address || 'Точка маршрута',
            address,
            latitude: lat,
            longitude: lng,
            color: DEFAULT_TRAVEL_POINT_COLOR,
            status: DEFAULT_TRAVEL_POINT_STATUS,
            category: categoryString,
            categoryName: categoryString,
        };

        if (travelImageThumbUrl) {
            payload.photo = travelImageThumbUrl;
        }

        const tags: Record<string, unknown> = {};
        if (urlTravel) tags.travelUrl = urlTravel;
        if (articleUrl) tags.articleUrl = articleUrl;
        if (Object.keys(tags).length > 0) {
            payload.tags = tags;
        }

        if (pointAdded) {
            void showToast({ type: 'info', text1: 'Точка уже добавлена', position: 'bottom' });
            return;
        }
        setIsAddingPoint(true);
        try {
            await userPointsApi.createPoint(payload);
            setPointAdded(true);
            void showToast({
                type: 'success',
                text1: 'Точка добавлена в «Мои точки»',
                position: 'bottom',
            });
            void queryClient.invalidateQueries({ queryKey: ['userPointsAll'] });
            setTimeout(() => setPointAdded(false), 2000);
        } catch {
            void showToast({
                type: 'error',
                text1: 'Не удалось сохранить точку',
                position: 'bottom',
            });
        } finally {
            setIsAddingPoint(false);
        }
    }, [
        address,
        articleUrl,
        authReady,
        rawCategoryName,
        isAddingPoint,
        isAuthenticated,
        pointAdded,
        queryClient,
        travel.lat,
        travel.lng,
        travelImageThumbUrl,
        urlTravel,
    ]);

    // Адаптивная высота в зависимости от размера экрана
    const getCardHeight = () => {
        if (width <= 320) return 200;       // Очень малые экраны
        if (width <= 480) return 240;       // Малые мобильные
        if (width <= METRICS.breakpoints.tablet) return 280;      // Планшеты
        if (width <= METRICS.breakpoints.largeTablet) return 320;     // Небольшие десктопы
        return 360;                         // Большие экраны
    };
    const height = getCardHeight();

    const imgUri = useMemo(() => {
      if (!travelImageThumbUrl) return null;
      return addVersion(travelImageThumbUrl, (travel as any).updated_at);
    }, [travelImageThumbUrl, travel]);

    const isNoImage = !imgUri;

    useEffect(() => {
        if (isNoImage) {
            setImgLoaded(true);
        } else {
            setImgLoaded(false);
        }
    }, [isNoImage]);

    // Расчет расстояния и времени в пути
    const distanceInfo = useMemo(() => {
        const parsed = parseCoord(coord);
        if (!parsed || !userLocation) return null;

        return getDistanceInfo(
            { lat: userLocation.latitude, lng: userLocation.longitude },
            { lat: parsed.lat, lng: parsed.lon },
            _transportMode
        );
    }, [coord, userLocation, _transportMode]);

    if (Platform.OS === 'web') {
        const categoryLabel = categories.join(', ');
        const travelModeLabel = _transportMode === 'car' ? 'Авто' : _transportMode === 'bike' ? 'Велосипед' : 'Пешком';
        const badges = distanceInfo
          ? [distanceInfo.distanceText, `${travelModeLabel} ${distanceInfo.travelTimeText}`]
          : [];

        return (
          <PlaceListCard
            title={address ?? ''}
            imageUrl={imgUri}
            categoryLabel={categoryLabel || undefined}
            coord={coord}
            badges={badges}
            onCardPress={handleMainPress}
            onMediaPress={
              !onPress && (articleUrl || urlTravel)
                ? () => openArticle()
                : undefined
            }
            onCopyCoord={coord ? copyCoords : undefined}
            onShare={coord ? openTelegram : undefined}
            mapActions={
              coord
                ? [
                    {
                      key: 'google',
                      label: 'Google',
                      icon: 'map-pin',
                      onPress: () => openExternal(buildMapUrl(coord)),
                      title: 'Открыть в Google Maps',
                    },
                    {
                      key: 'apple',
                      label: 'Apple',
                      icon: 'map',
                      onPress: () => openExternal(buildAppleMapsUrl(coord)),
                      title: 'Открыть в Apple Maps',
                    },
                    {
                      key: 'yandex',
                      label: 'Яндекс',
                      icon: 'navigation',
                      onPress: () => openExternal(buildYandexMapsUrl(coord)),
                      title: 'Открыть в Яндекс Картах',
                    },
                    {
                      key: 'osm',
                      label: 'OSM',
                      icon: 'map',
                      onPress: () => openExternal(buildOsmUrl(coord)),
                      title: 'Открыть в OpenStreetMap',
                    },
                  ]
                : []
            }
            inlineActions={
              articleUrl || urlTravel
                ? [
                    {
                      key: 'article',
                      label: 'Статья',
                      icon: 'book-open',
                      onPress: () => openArticle(),
                      title: 'Открыть статью',
                    },
                  ]
                : []
            }
            onAddPoint={handleAddPoint}
            addDisabled={!authReady || !isAuthenticated || isAddingPoint}
            isAdding={isAddingPoint}
            imageHeight={140}
            width={300}
            style={PLACE_CARD_STYLE}
            testID="map-travel-card"
          />
        );
    }

    return (
      <Pressable
        style={[styles.card, { height }, hovered && styles.cardHovered]}
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
            <View style={styles.noImageFallback} />
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
                    {!isMobile && onHidePress && (
                      <ActionIconButton
                        name="eye-off"
                        size={iconSize}
                        onPress={handleIconPress(onHidePress)}
                        color={colors.textOnDark}
                        style={[styles.iconBtnDanger, { width: iconButtonSize, height: iconButtonSize }]}
                        accessibilityLabel="Скрыть объект"
                      />
                    )}
                    <ActionIconButton
                      name="link"
                      size={iconSize}
                      onPress={handleIconPress(openArticle)}
                      color={isNoImage ? colors.text : colors.textOnDark}
                      style={[isNoImage ? styles.iconBtnLight : styles.iconBtn, { width: iconButtonSize, height: iconButtonSize }]}
                      accessibilityLabel="Открыть статью"
                    />
                    <ActionIconButton
                      name="copy"
                      size={iconSize}
                      onPress={handleIconPress(copyCoords)}
                      color={isNoImage ? colors.text : colors.textOnDark}
                      style={[isNoImage ? styles.iconBtnLight : styles.iconBtn, { width: iconButtonSize, height: iconButtonSize }]}
                      accessibilityLabel="Скопировать координаты"
                    />
                    <ActionIconButton
                      name="send"
                      size={iconSize}
                      onPress={handleIconPress(openTelegram)}
                      color={isNoImage ? colors.text : colors.textOnDark}
                      style={[isNoImage ? styles.iconBtnLight : styles.iconBtn, { width: iconButtonSize, height: iconButtonSize }]}
                      accessibilityLabel="Поделиться в Telegram"
                    />
                </View>
              )}

              {/* нижняя плашка — по hover на web, всегда на мобиле */}
              {showOverlays && (
                <View style={[styles.overlay, isNoImage ? styles.overlayLight : null]}>
                    {!!address && (
                      <Text
                        style={[styles.title, isNoImage ? styles.titleOnLight : null, { fontSize: titleFontSize, color: isNoImage ? colors.text : colors.textOnDark }]}
                        numberOfLines={2}
                      >
                          {address}
                      </Text>
                    )}

                    {/* Расстояние и время в пути — компактный бейдж */}
                    {distanceInfo && (
                      <View style={styles.distanceRow}>
                          <View style={styles.distanceBadge}>
                              <View style={styles.distanceTextRow}>
                                  <Feather name="map-pin" size={12} color={colors.textOnPrimary} />
                                  <Text style={styles.distanceText}>
                                      {distanceInfo.distanceText} · {distanceInfo.travelTimeText}
                                  </Text>
                              </View>
                          </View>
                      </View>
                    )}

                    {!!coord && !isMobile && (
                      <CardActionPressable
                        onPress={openMap}
                        style={styles.coordPressable}
                        accessibilityLabel="Открыть в карте"
                      >
                          <Text style={[styles.coord, isNoImage ? styles.coordOnLight : null, { fontSize: coordFontSize, color: isNoImage ? colors.text : colors.textOnDark }]}>{coord}</Text>
                      </CardActionPressable>
                    )}

                    {!!categories.length && (
                      <View style={styles.catWrap}>
                          {categories.slice(0, 1).map((cat, i) => (
                            <View key={`${cat}-${i}`} style={styles.catChip}>
                                <Text style={styles.catText}>{cat}</Text>
                            </View>
                          ))}
                      </View>
                    )}

                    <View style={styles.addButtonRow}>
                      <CardActionPressable
                        accessibilityLabel={pointAdded ? 'Добавлено' : 'Мои точки'}
                        onPress={() => void handleAddPoint()}
                        disabled={!authReady || !isAuthenticated || isAddingPoint}
                        style={({ pressed }) => [
                          styles.addButton,
                          pointAdded && styles.addButtonSuccess,
                          (pressed || isAddingPoint) && styles.addButtonPressed,
                          (!authReady || !isAuthenticated || isAddingPoint) && styles.addButtonDisabled,
                        ]}
                        title={pointAdded ? 'Добавлено' : 'Мои точки'}
                      >
                        {isAddingPoint ? (
                          <ActivityIndicator size="small" color={colors.textOnPrimary} />
                        ) : pointAdded ? (
                          <>
                            <Feather name="check" size={14} color={colors.textOnPrimary} />
                            <Text style={[styles.addButtonText, { color: colors.textOnPrimary }]}>
                              Добавлено
                            </Text>
                          </>
                        ) : (
                          <>
                            <Feather name="map-pin" size={14} color={colors.textOnPrimary} />
                            <Text style={[styles.addButtonText, { color: colors.textOnPrimary }]}>
                              Мои точки
                            </Text>
                          </>
                        )}
                      </CardActionPressable>
                    </View>
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
        ...(Platform.OS === 'web'
          ? ({ transition: 'transform 150ms ease, box-shadow 150ms ease' } as any)
          : null),
    },
    cardHovered: {
        ...(Platform.OS === 'web'
          ? ({
              transform: [{ translateY: -2 }],
              boxShadow: colors.boxShadows.heavy,
            } as any)
          : null),
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
    noImageFallback: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.backgroundTertiary,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.borderLight,
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
    iconBtnLight: {
        backgroundColor: colors.backgroundSecondary,
        margin: 0,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.borderLight,
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
    overlayLight: {
        backgroundColor: colors.backgroundSecondary,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.borderLight,
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
    titleOnLight: {
        textShadowColor: 'transparent',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 0,
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
    distanceTextRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    distanceText: {
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
    coordOnLight: {
        textShadowColor: 'transparent',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 0,
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
    addButtonRow: {
        marginTop: DESIGN_TOKENS.spacing.md,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: DESIGN_TOKENS.spacing.xs,
        paddingVertical: DESIGN_TOKENS.spacing.sm,
        paddingHorizontal: DESIGN_TOKENS.spacing.lg,
        borderRadius: DESIGN_TOKENS.radii.lg,
        backgroundColor: colors.primary,
        ...Platform.select({
            web: {
                cursor: 'pointer' as any,
                transition: 'all 0.2s ease',
            },
        }),
    },
    addButtonSuccess: {
        backgroundColor: colors.success,
    },
    addButtonPressed: {
        opacity: 0.95,
        transform: [{ scale: 0.98 }],
    },
    addButtonDisabled: {
        opacity: 0.6,
    },
    addButtonText: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
});

export default React.memo(AddressListItem);
