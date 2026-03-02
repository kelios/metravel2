// components/MapPage/AddressListItem.tsx
import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Text } from '@/ui/paper';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import CardActionPressable from '@/components/ui/CardActionPressable';
import { TravelCoords } from '@/types/types';
import { METRICS } from '@/constants/layout';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import PlaceListCard from '@/components/places/PlaceListCard';
import Feather from '@expo/vector-icons/Feather';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { getDistanceInfo } from '@/utils/distanceCalculator';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import {
  useAddressListItemActions,
  buildMapUrl, buildAppleMapsUrl, buildYandexMapsUrl, buildOsmUrl, openExternal,
} from '@/hooks/useAddressListItemActions';

type Props = {
    travel: TravelCoords;
    isMobile?: boolean;
    onPress?: () => void;
    onHidePress?: () => void;
    userLocation?: { latitude: number; longitude: number } | null;
    transportMode?: 'car' | 'bike' | 'foot';
};

const addVersion = (url?: string, updated?: string) =>
  url && updated ? `${url}?v=${new Date(updated).getTime()}` : url;

const parseCoord = (coord?: string) => {
    if (!coord) return null;
    const parsed = CoordinateConverter.fromLooseString(coord);
    return parsed ? { lat: parsed.lat, lon: parsed.lng } : null;
};

const PRESSED_OPACITY = { opacity: 0.85 };
const PLACE_CARD_STYLE = { margin: 8 };

const ActionIconButton = React.memo(function ActionIconButton({
    name, size, color, onPress, style, accessibilityLabel,
}: {
    name: keyof typeof Feather.glyphMap; size: number; color: string;
    onPress?: () => void; style?: any; accessibilityLabel: string;
}) {
    return (
        <CardActionPressable onPress={onPress} style={({ pressed }) => [style, pressed && PRESSED_OPACITY]} accessibilityLabel={accessibilityLabel}>
            <Feather name={name} size={size} color={color} />
        </CardActionPressable>
    );
});

const AddressListItem: React.FC<Props> = ({
    travel, isMobile: isMobileProp, onPress, onHidePress, userLocation, transportMode: _transportMode = 'car',
}) => {
    const { address, coord, travelImageThumbUrl, articleUrl, urlTravel } = travel;

    const [imgLoaded, setImgLoaded] = useState(false);
    const [hovered, setHovered] = useState(false);
    const colors = useThemedColors();
    const styles = useMemo(() => getStyles(colors), [colors]);

    const { width, isPhone, isLargePhone } = useResponsive();
    const isMobile = isMobileProp ?? (isPhone || isLargePhone);
    const isSmallScreen = isPhone;
    const isTablet = width > 480 && width <= METRICS.breakpoints.largeTablet;

    const {
      categories, isAddingPoint, pointAdded, isAuthenticated, authReady,
      copyCoords, openTelegram, openMap, openArticle, handleAddPoint,
    } = useAddressListItemActions(travel);

    const webCardWidth = useMemo(() => {
      if (Platform.OS !== 'web') return 300;
      const horizontalInsets = width <= 360 ? 28 : width <= 480 ? 40 : width <= 768 ? 56 : 72;
      return Math.max(236, Math.min(360, width - horizontalInsets));
    }, [width]);
    const webCardImageHeight = useMemo(() => Math.round(Math.max(128, Math.min(188, webCardWidth * 0.48))), [webCardWidth]);

    const showOverlays = isMobile || hovered;
    const iconSize = isSmallScreen ? 20 : 22;
    const iconButtonSize = isSmallScreen ? 40 : 48;
    const titleFontSize = isSmallScreen ? 16 : isTablet ? 17 : 18;
    const coordFontSize = isSmallScreen ? 12 : 13;

    const handleMainPress = useCallback(() => {
        if (onPress) onPress();
        else openArticle();
    }, [onPress, openArticle]);

    const handleIconPress = useCallback((handler: () => void) => () => handler(), []);

    const getCardHeight = () => {
        if (width <= 320) return 200;
        if (width <= 480) return 240;
        if (width <= METRICS.breakpoints.tablet) return 280;
        if (width <= METRICS.breakpoints.largeTablet) return 320;
        return 360;
    };
    const height = getCardHeight();

    const imgUri = useMemo(() => {
      if (!travelImageThumbUrl) return null;
      return addVersion(travelImageThumbUrl, (travel as Record<string, unknown>).updated_at as string | undefined);
    }, [travelImageThumbUrl, travel]);

    const isNoImage = !imgUri;

    useEffect(() => { setImgLoaded(isNoImage); }, [isNoImage]);

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
        const badges = distanceInfo ? [distanceInfo.distanceText, `${travelModeLabel} ${distanceInfo.travelTimeText}`] : [];

        return (
          <PlaceListCard
            title={address ?? ''} imageUrl={imgUri} categoryLabel={categoryLabel || undefined}
            coord={coord} badges={badges} onCardPress={handleMainPress}
            onMediaPress={!onPress && (articleUrl || urlTravel) ? () => openArticle() : undefined}
            onCopyCoord={coord ? copyCoords : undefined} onShare={coord ? openTelegram : undefined}
            mapActions={coord ? [
              { key: 'google', label: 'Google', icon: 'map-pin', onPress: () => openExternal(buildMapUrl(coord)), title: 'Открыть в Google Maps' },
              { key: 'apple', label: 'Apple', icon: 'map', onPress: () => openExternal(buildAppleMapsUrl(coord)), title: 'Открыть в Apple Maps' },
              { key: 'yandex', label: 'Яндекс', icon: 'navigation', onPress: () => openExternal(buildYandexMapsUrl(coord)), title: 'Открыть в Яндекс Картах' },
              { key: 'osm', label: 'OSM', icon: 'map', onPress: () => openExternal(buildOsmUrl(coord)), title: 'Открыть в OpenStreetMap' },
            ] : []}
            inlineActions={articleUrl || urlTravel ? [{ key: 'article', label: 'Статья', icon: 'book-open', onPress: () => openArticle(), title: 'Открыть статью' }] : []}
            onAddPoint={handleAddPoint} addDisabled={!authReady || !isAuthenticated || isAddingPoint}
            isAdding={isAddingPoint} imageHeight={webCardImageHeight} width={webCardWidth}
            style={PLACE_CARD_STYLE} testID="map-travel-card"
          />
        );
    }

    return (
      <Pressable style={[styles.card, { height }, hovered && styles.cardHovered]}
        onHoverIn={() => !isMobile && setHovered(true)} onHoverOut={() => !isMobile && setHovered(false)}>
        <View style={styles.image}>
          {imgUri ? (
            <ImageCardMedia src={imgUri} fit="contain" blurBackground blurRadius={12} overlayColor={colors.overlayLight}
              cachePolicy="memory-disk" transition={200} loading="lazy" priority="low"
              style={StyleSheet.absoluteFillObject} onLoad={() => setImgLoaded(true)} onError={() => setImgLoaded(true)} />
          ) : <View style={styles.noImageFallback} />}

          {!imgLoaded && <View style={styles.loader}><ActivityIndicator size="small" color={colors.textOnDark} /></View>}

          <Pressable style={styles.mainPressable} onPress={handleMainPress} accessibilityRole="button"
            accessibilityLabel={address || 'Место'} android_ripple={{ color: colors.overlayLight }} onLongPress={copyCoords}>
            <View style={styles.mainPressArea} />
          </Pressable>

          {showOverlays && (
            <View style={styles.iconCol}>
              {!isMobile && onHidePress && (
                <ActionIconButton name="eye-off" size={iconSize} onPress={handleIconPress(onHidePress)} color={colors.textOnDark} style={[styles.iconBtnDanger, { width: iconButtonSize, height: iconButtonSize }]} accessibilityLabel="Скрыть объект" />
              )}
              <ActionIconButton name="link" size={iconSize} onPress={handleIconPress(openArticle)} color={isNoImage ? colors.text : colors.textOnDark} style={[isNoImage ? styles.iconBtnLight : styles.iconBtn, { width: iconButtonSize, height: iconButtonSize }]} accessibilityLabel="Открыть статью" />
              <ActionIconButton name="copy" size={iconSize} onPress={handleIconPress(copyCoords)} color={isNoImage ? colors.text : colors.textOnDark} style={[isNoImage ? styles.iconBtnLight : styles.iconBtn, { width: iconButtonSize, height: iconButtonSize }]} accessibilityLabel="Скопировать координаты" />
              <ActionIconButton name="send" size={iconSize} onPress={handleIconPress(openTelegram)} color={isNoImage ? colors.text : colors.textOnDark} style={[isNoImage ? styles.iconBtnLight : styles.iconBtn, { width: iconButtonSize, height: iconButtonSize }]} accessibilityLabel="Поделиться в Telegram" />
            </View>
          )}

          {showOverlays && (
            <View style={[styles.overlay, isNoImage ? styles.overlayLight : null]}>
              {!!address && <Text style={[styles.title, isNoImage ? styles.titleOnLight : null, { fontSize: titleFontSize, color: isNoImage ? colors.text : colors.textOnDark }]} numberOfLines={2}>{address}</Text>}
              {distanceInfo && (
                <View style={styles.distanceRow}><View style={styles.distanceBadge}><View style={styles.distanceTextRow}>
                  <Feather name="map-pin" size={12} color={colors.textOnPrimary} />
                  <Text style={styles.distanceText}>{distanceInfo.distanceText} · {distanceInfo.travelTimeText}</Text>
                </View></View></View>
              )}
              {!!coord && !isMobile && (
                <CardActionPressable onPress={openMap} style={styles.coordPressable} accessibilityLabel="Открыть в карте">
                  <Text style={[styles.coord, isNoImage ? styles.coordOnLight : null, { fontSize: coordFontSize, color: isNoImage ? colors.text : colors.textOnDark }]}>{coord}</Text>
                </CardActionPressable>
              )}
              {!!categories.length && (
                <View style={styles.catWrap}>{categories.slice(0, 1).map((cat, i) => (
                  <View key={`${cat}-${i}`} style={styles.catChip}><Text style={styles.catText}>{cat}</Text></View>
                ))}</View>
              )}
              <View style={styles.addButtonRow}>
                <CardActionPressable accessibilityLabel={pointAdded ? 'Добавлено' : 'Мои точки'}
                  onPress={() => void handleAddPoint()} disabled={!authReady || !isAuthenticated || isAddingPoint}
                  style={({ pressed }) => [styles.addButton, pointAdded && styles.addButtonSuccess, (pressed || isAddingPoint) && styles.addButtonPressed, (!authReady || !isAuthenticated || isAddingPoint) && styles.addButtonDisabled]}
                  title={pointAdded ? 'Добавлено' : 'Мои точки'}>
                  {isAddingPoint ? <ActivityIndicator size="small" color={colors.textOnPrimary} /> : pointAdded ? (
                    <><Feather name="check" size={14} color={colors.textOnPrimary} /><Text style={[styles.addButtonText, { color: colors.textOnPrimary }]}>Добавлено</Text></>
                  ) : (
                    <><Feather name="map-pin" size={14} color={colors.textOnPrimary} /><Text style={[styles.addButtonText, { color: colors.textOnPrimary }]}>Мои точки</Text></>
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
        ...(Platform.OS === 'web'
          ? ({ textShadow: `0px 2px 8px ${colors.overlay}` } as any)
          : {
              textShadowColor: colors.overlay,
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 8,
            }),
    },
    titleOnLight: {
        ...(Platform.OS === 'web'
          ? ({ textShadow: 'none' } as any)
          : {
              textShadowColor: 'transparent',
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 0,
            }),
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
        ...(Platform.OS === 'web'
          ? ({ textShadow: `0px 1px 4px ${colors.overlay}` } as any)
          : {
              textShadowColor: colors.overlay,
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 4,
            }),
    },
    coordOnLight: {
        ...(Platform.OS === 'web'
          ? ({ textShadow: 'none' } as any)
          : {
              textShadowColor: 'transparent',
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 0,
            }),
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
        ...(Platform.OS === 'web'
          ? ({ textShadow: `0px 1px 3px ${colors.overlay}` } as any)
          : {
              textShadowColor: colors.overlay,
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 3,
            }),
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
