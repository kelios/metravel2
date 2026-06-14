import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { Text } from '@/ui/paper'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import CardActionPressable from '@/components/ui/CardActionPressable'
import { TravelCoords } from '@/types/types'
import { METRICS } from '@/constants/layout'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import PlaceListCard from '@/components/places/PlaceListCard'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { getDistanceInfo } from '@/utils/distanceCalculator'
import { CoordinateConverter } from '@/utils/coordinateConverter'
import {
  useAddressListItemActions,
  buildMapUrl,
  openExternal,
} from '@/hooks/useAddressListItemActions'
import {
  buildOrganicMapsUrl,
  buildWazeUrl,
  buildYandexNaviUrl,
} from '@/components/MapPage/Map/mapLinks'

const isWebPlatform = () => Platform.OS === 'web'

const PRESSED_OPACITY = { opacity: 0.85 }
const PLACE_CARD_STYLE = { margin: 8 }

const TRANSPORT_LABELS: Record<'car' | 'bike' | 'foot', string> = {
  car: 'Авто',
  bike: 'Велосипед',
  foot: 'Пешком',
}

type Props = {
  travel: TravelCoords
  isMobile?: boolean
  onPress?: () => void
  onHidePress?: () => void
  userLocation?: { latitude: number; longitude: number } | null
  transportMode?: 'car' | 'bike' | 'foot'
  isFavorite?: boolean
  onToggleFavorite?: () => void
  /**
   * Viewport width supplied by the list. Lifted out of a per-row
   * useWindowDimensions so a resize doesn't re-subscribe every visible card.
   */
  screenWidth: number
}

function addVersion(url?: string, updated?: string) {
  return url && updated ? `${url}?v=${new Date(updated).getTime()}` : url
}

function parseCoord(coord?: string) {
  if (!coord) return null
  const parsed = CoordinateConverter.fromLooseString(coord)
  return parsed ? { lat: parsed.lat, lon: parsed.lng } : null
}

function getCardHeight(width: number) {
  if (width <= 320) return 200
  if (width <= 480) return 240
  if (width <= METRICS.breakpoints.tablet) return 280
  if (width <= METRICS.breakpoints.largeTablet) return 320
  return 360
}

function getWebCardWidth(width: number) {
  if (!isWebPlatform()) return 300
  const horizontalInsets = width <= 360 ? 20 : width <= 480 ? 36 : width <= 768 ? 56 : 72
  return Math.max(236, Math.min(360, width - horizontalInsets))
}

const ActionIconButton = React.memo(function ActionIconButton({
  name,
  size,
  color,
  onPress,
  style,
  accessibilityLabel,
}: {
  name: keyof typeof Feather.glyphMap
  size: number
  color: string
  onPress?: () => void
  style?: any
  accessibilityLabel: string
}) {
  return (
    <CardActionPressable
      onPress={onPress}
      style={({ pressed }) => [style, pressed && PRESSED_OPACITY]}
      accessibilityLabel={accessibilityLabel}
    >
      <Feather name={name} size={size} color={color} />
    </CardActionPressable>
  )
})

const AddressListItem: React.FC<Props> = ({
  travel,
  isMobile: isMobileProp,
  onPress,
  onHidePress,
  userLocation,
  transportMode = 'car',
  isFavorite = false,
  onToggleFavorite,
  screenWidth,
}) => {
  const { address, coord, travelImageThumbUrl, articleUrl, urlTravel } = travel

  const [imgLoaded, setImgLoaded] = useState(false)
  const [hovered, setHovered] = useState(false)
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])

  const width = screenWidth
  const isPhone = width >= METRICS.breakpoints.phone && width < METRICS.breakpoints.largePhone
  const isLargePhone =
    width >= METRICS.breakpoints.largePhone && width < METRICS.breakpoints.tablet
  const isMobile = isMobileProp ?? (isPhone || isLargePhone)
  const isSmallScreen = isPhone
  const isTablet = width > 480 && width <= METRICS.breakpoints.largeTablet

  const {
    categories,
    isAddingPoint,
    pointAdded,
    isAuthenticated,
    authReady,
    copyCoords,
    openTelegram,
    openMap,
    openArticle,
    handleAddPoint,
  } = useAddressListItemActions(travel)

  const webCardWidth = useMemo(() => getWebCardWidth(width), [width])
  const webCardImageHeight = useMemo(
    () => Math.round(Math.max(128, Math.min(188, webCardWidth * 0.48))),
    [webCardWidth],
  )

  const showOverlays = isMobile || hovered
  const showActionIcons = !isMobile && showOverlays
  const iconSize = isSmallScreen ? 20 : 22
  const iconButtonSize = isSmallScreen ? 40 : 48
  const titleFontSize = isSmallScreen ? 16 : isTablet ? 17 : 18
  const coordFontSize = isSmallScreen ? 12 : 13
  const height = getCardHeight(width)

  const handleMainPress = useCallback(() => {
    if (onPress) onPress()
    else openArticle()
  }, [onPress, openArticle])

  const travelUpdatedAt = (travel as Record<string, unknown>).updated_at as
    | string
    | undefined
  const imgUri = useMemo(() => {
    if (!travelImageThumbUrl) return null
    return addVersion(travelImageThumbUrl, travelUpdatedAt)
  }, [travelImageThumbUrl, travelUpdatedAt])
  const isNoImage = !imgUri

  useEffect(() => {
    setImgLoaded(!imgUri)
  }, [imgUri])

  useEffect(() => () => setHovered(false), [])

  const distanceInfo = useMemo(() => {
    const parsed = parseCoord(coord)
    if (!parsed || !userLocation) return null
    return getDistanceInfo(
      { lat: userLocation.latitude, lng: userLocation.longitude },
      { lat: parsed.lat, lng: parsed.lon },
      transportMode,
    )
  }, [coord, userLocation, transportMode])

  const webMapActions = useMemo(() => {
    if (!coord) return []
    return [
      {
        key: 'google',
        label: 'Google Maps',
        icon: 'map-pin' as const,
        onPress: () => openExternal(buildMapUrl(coord)),
        title: 'Открыть в Google Maps',
      },
      {
        key: 'organic',
        label: 'Organic Maps',
        icon: 'compass' as const,
        onPress: () => openExternal(buildOrganicMapsUrl(coord)),
        title: 'Открыть в Organic Maps',
      },
      {
        key: 'waze',
        label: 'Waze',
        icon: 'navigation' as const,
        onPress: () => openExternal(buildWazeUrl(coord)),
        title: 'Проложить маршрут в Waze',
      },
      {
        key: 'yandex',
        label: 'Яндекс.Навигатор',
        icon: 'navigation-2' as const,
        onPress: () => openExternal(buildYandexNaviUrl(coord)),
        title: 'Проложить маршрут в Яндекс.Навигаторе',
      },
    ]
  }, [coord])

  if (isWebPlatform()) {
    const categoryLabel = categories.join(', ')
    const badges = distanceInfo
      ? [distanceInfo.distanceText, `${TRANSPORT_LABELS[transportMode]} ${distanceInfo.travelTimeText}`]
      : []
    const travelRecord = travel as Record<string, unknown>

    return (
      <PlaceListCard
        title={address ?? ''}
        imageUrl={imgUri}
        categoryLabel={categoryLabel || undefined}
          relatedTravelUrl={urlTravel}
        relatedTravelCountry={typeof travelRecord.countryName === 'string' ? travelRecord.countryName : undefined}
        relatedTravelCity={typeof travelRecord.cityName === 'string' ? travelRecord.cityName : undefined}
        coord={coord}
        badges={badges}
        onCardPress={handleMainPress}
        onMediaPress={
          !onPress && (articleUrl || urlTravel) ? () => openArticle() : undefined
        }
        onCopyCoord={undefined}
        onShare={coord ? openTelegram : undefined}
        mapActions={webMapActions}
        inlineActions={
          articleUrl || urlTravel
            ? [{
                key: 'article',
                label: 'Открыть',
                icon: 'book-open',
                onPress: openArticle,
                accessibilityLabel: 'Открыть страницу',
                title: 'Открыть страницу',
              }]
            : []
        }
        onAddPoint={handleAddPoint}
        addDisabled={!authReady || !isAuthenticated || isAddingPoint}
        isAdding={isAddingPoint}
        imageHeight={webCardImageHeight}
        width={webCardWidth}
        addLabel={pointAdded ? 'Добавлено' : 'Сохранить'}
        addButtonPlacement="row"
        compact
        titleLayout="content"
        titleNumberOfLines={2}
        style={PLACE_CARD_STYLE}
        testID="map-travel-card"
      />
    )
  }

  // Native rendering — single layout below.
  const iconColor = isNoImage ? colors.text : colors.textOnDark
  const iconButtonStyle = [
    isNoImage ? styles.iconBtnLight : styles.iconBtn,
    { width: iconButtonSize, height: iconButtonSize },
  ]
  const overlayStyle = [styles.overlay, isNoImage && styles.overlayLight]
  const titleStyle = [
    styles.title,
    isNoImage && styles.titleOnLight,
    { fontSize: titleFontSize, color: iconColor },
  ]
  const coordStyle = [
    styles.coord,
    isNoImage && styles.coordOnLight,
    { fontSize: coordFontSize, color: iconColor },
  ]

  const renderAddButtonContent = () => {
    if (isAddingPoint) {
      return <ActivityIndicator size="small" color={colors.textOnPrimary} />
    }
    return (
      <>
        <Feather
          name={pointAdded ? 'check' : 'bookmark'}
          size={14}
          color={colors.textOnPrimary}
        />
        <Text
          style={[
            styles.addButtonText,
            isMobile && styles.addButtonTextMobile,
            { color: colors.textOnPrimary },
          ]}
        >
          {pointAdded ? 'Сохранено' : 'Сохранить'}
        </Text>
      </>
    )
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
            allowCriticalWebBlur
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
          <View style={styles.noImageFallback}>
            <Feather name="map-pin" size={28} color={colors.textMuted} />
            <Text style={styles.noImageFallbackText} numberOfLines={1}>
              {categories[0] || 'Без фото'}
            </Text>
          </View>
        )}

        {!imgLoaded && (
          <View style={styles.loader}>
            <ActivityIndicator size="small" color={colors.textOnDark} />
          </View>
        )}

        <Pressable
          style={styles.mainPressable}
          onPress={handleMainPress}
          accessibilityRole="button"
          accessibilityLabel={address || 'Место'}
          android_ripple={{ color: colors.overlayLight }}
          onLongPress={copyCoords}
        >
          <View style={styles.mainPressArea} />
        </Pressable>

        {showActionIcons && (
          <View style={styles.iconCol}>
            {onHidePress && (
              <ActionIconButton
                name="eye-off"
                size={iconSize}
                onPress={onHidePress}
                color={colors.textOnDark}
                style={[styles.iconBtnDanger, { width: iconButtonSize, height: iconButtonSize }]}
                accessibilityLabel="Скрыть объект"
              />
            )}
            <ActionIconButton
              name="link"
              size={iconSize}
              onPress={openArticle}
              color={iconColor}
              style={iconButtonStyle}
              accessibilityLabel="Открыть статью"
            />
            <ActionIconButton
              name="copy"
              size={iconSize}
              onPress={copyCoords}
              color={iconColor}
              style={iconButtonStyle}
              accessibilityLabel="Скопировать координаты"
            />
            <ActionIconButton
              name="send"
              size={iconSize}
              onPress={openTelegram}
              color={iconColor}
              style={iconButtonStyle}
              accessibilityLabel="Поделиться в Telegram"
            />
          </View>
        )}

        {showOverlays && (
          <View style={overlayStyle}>
            {!!address && (
              <Text style={titleStyle} numberOfLines={2}>
                {address}
              </Text>
            )}
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
                <Text style={coordStyle}>{coord}</Text>
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
            <View style={[styles.addButtonRow, onToggleFavorite && styles.addButtonRowWithFav]}>
              <CardActionPressable
                accessibilityLabel={pointAdded ? 'Сохранено' : 'Сохранить место'}
                onPress={() => void handleAddPoint()}
                disabled={!authReady || !isAuthenticated || isAddingPoint}
                style={({ pressed }: any) => [
                  styles.addButton,
                  onToggleFavorite && styles.addButtonFlex,
                  isMobile && styles.addButtonMobile,
                  pointAdded && styles.addButtonSuccess,
                  (pressed || isAddingPoint) && styles.addButtonPressed,
                  (!authReady || !isAuthenticated || isAddingPoint) && styles.addButtonDisabled,
                ]}
                title={pointAdded ? 'Сохранено' : 'Сохранить место'}
              >
                {renderAddButtonContent()}
              </CardActionPressable>
              {onToggleFavorite && (
                <CardActionPressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isFavorite }}
                  accessibilityLabel={
                    isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'
                  }
                  onPress={onToggleFavorite}
                  style={({ pressed }: any) => [
                    styles.favButton,
                    { width: iconButtonSize, height: iconButtonSize },
                    isFavorite && styles.favButtonActive,
                    pressed && PRESSED_OPACITY,
                  ]}
                  title={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
                >
                  <Feather
                    name="heart"
                    size={iconSize}
                    color={isFavorite ? colors.textOnPrimary : colors.danger}
                    {...(isFavorite ? ({ fill: colors.textOnPrimary } as any) : null)}
                  />
                </CardActionPressable>
              )}
            </View>
          </View>
        )}
      </View>
    </Pressable>
  )
}

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create<Record<string, any>>({
    card: {
      marginVertical: 12,
      marginHorizontal: 8,
      borderRadius: 24,
      backgroundColor: colors.surface,
      ...colors.shadows.medium,
      overflow: 'hidden',
      position: 'relative',
      ...(isWebPlatform()
        ? ({ transition: 'transform 150ms ease, box-shadow 150ms ease' } as any)
        : null),
    },
    cardHovered: {
      ...(isWebPlatform()
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
    imageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlayLight },
    noImageFallback: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.backgroundTertiary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 16,
    },
    noImageFallbackText: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.2,
      color: colors.textMuted,
      maxWidth: '90%',
    },
    loader: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 24,
    },
    mainPressable: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
    mainPressArea: { flex: 1 },

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
      ...(isWebPlatform()
        ? ({ textShadow: `0px 2px 8px ${colors.overlay}` } as any)
        : {
            textShadowColor: colors.overlay,
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: 8,
          }),
    },
    titleOnLight: {
      ...(isWebPlatform()
        ? ({ textShadow: 'none' } as any)
        : {
            textShadowColor: 'transparent',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 0,
          }),
    },
    distanceRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
    distanceBadge: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
      ...colors.shadows.light,
    },
    distanceTextRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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
      fontFamily: isWebPlatform() ? 'Monaco, Menlo, "Ubuntu Mono", monospace' : 'monospace',
      ...(isWebPlatform()
        ? ({ textShadow: `0px 1px 4px ${colors.overlay}` } as any)
        : {
            textShadowColor: colors.overlay,
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 4,
          }),
    },
    coordOnLight: {
      ...(isWebPlatform()
        ? ({ textShadow: 'none' } as any)
        : {
            textShadowColor: 'transparent',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 0,
          }),
    },
    catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
    catChip: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    catText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    addButtonRow: { marginTop: DESIGN_TOKENS.spacing.md },
    addButtonRowWithFav: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    addButtonFlex: { flex: 1 },
    favButton: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      ...Platform.select({
        web: { cursor: 'pointer' as any, transition: 'all 0.2s ease' },
      }),
    },
    favButtonActive: {
      backgroundColor: colors.danger,
      borderColor: colors.danger,
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
        web: { cursor: 'pointer' as any, transition: 'all 0.2s ease' },
      }),
    },
    addButtonMobile: {
      borderRadius: DESIGN_TOKENS.radii.md,
      paddingVertical: DESIGN_TOKENS.spacing.xs + 2,
    },
    addButtonSuccess: { backgroundColor: colors.success },
    addButtonPressed: { opacity: 0.95, transform: [{ scale: 0.98 }] },
    addButtonDisabled: { opacity: 0.6 },
    addButtonText: { fontSize: 12, fontWeight: '600', letterSpacing: -0.2 },
    addButtonTextMobile: { fontSize: 11 },
  })

export default React.memo(AddressListItem)
