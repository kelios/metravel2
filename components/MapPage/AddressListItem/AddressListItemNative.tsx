import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { Text } from '@/ui/paper'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import CardActionPressable from '@/components/ui/CardActionPressable'
import { type ThemedColors } from '@/hooks/useTheme'

import ActionIconButton from './ActionIconButton'
import { PRESSED_OPACITY } from './constants'

type DistanceInfo = {
  distanceText: string
  travelTimeText: string
} | null

type Props = {
  address?: string
  coord?: string
  imgUri?: string | null
  categories: string[]
  colors: ThemedColors
  styles: Record<string, any>
  isMobile: boolean
  isFavorite: boolean
  onToggleFavorite?: () => void
  onHidePress?: () => void
  imgLoaded: boolean
  setImgLoaded: (value: boolean) => void
  hovered: boolean
  setHovered: (value: boolean) => void
  height: number
  iconSize: number
  iconButtonSize: number
  titleFontSize: number
  coordFontSize: number
  showOverlays: boolean
  showActionIcons: boolean
  distanceInfo: DistanceInfo
  handleMainPress: () => void
  openArticle: () => void
  openMap: () => void
  openTelegram: () => void
  copyCoords: () => void
  handleAddPoint: () => void | Promise<void>
  authReady: boolean
  isAuthenticated: boolean
  isAddingPoint: boolean
  pointAdded: boolean
}

const AddressListItemNative: React.FC<Props> = ({
  address,
  coord,
  imgUri,
  categories,
  colors,
  styles,
  isMobile,
  isFavorite,
  onToggleFavorite,
  onHidePress,
  imgLoaded,
  setImgLoaded,
  hovered,
  setHovered,
  height,
  iconSize,
  iconButtonSize,
  titleFontSize,
  coordFontSize,
  showOverlays,
  showActionIcons,
  distanceInfo,
  handleMainPress,
  openArticle,
  openMap,
  openTelegram,
  copyCoords,
  handleAddPoint,
  authReady,
  isAuthenticated,
  isAddingPoint,
  pointAdded,
}) => {
  const isNoImage = !imgUri
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

export default AddressListItemNative
