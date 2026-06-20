import React from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import RelatedTravelActionStack from '@/components/travel/RelatedTravelActionStack'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { type ThemedColors } from '@/hooks/useTheme'
import { type CatalogPlace } from '@/utils/placesCatalog'
import { normalizeRelatedTravelRoute } from '@/utils/relatedTravel'

import { PRESSED_OPACITY } from './PlacesScreen.helpers'
import { type PlacesStyles } from './PlacesScreen.styles'

export const PlaceCard = React.memo(function PlaceCard({
  place,
  styles,
  colors,
  onOpenMap,
  onOpenTravel,
  containerStyle,
}: {
  place: CatalogPlace
  styles: PlacesStyles
  colors: ThemedColors
  onOpenMap: (place: CatalogPlace) => void
  onOpenTravel: (place: CatalogPlace) => void
  containerStyle?: StyleProp<ViewStyle>
}) {
  const imageUrl = place.imageUrl || place.travelImageThumbUrl || null
  const relatedTravelUrl = normalizeRelatedTravelRoute(place.urlTravel)

  return (
    <View style={[styles.card, styles.cardInner, containerStyle]}>
      <View style={styles.cardMediaWrap}>
        {imageUrl ? (
          <ImageCardMedia
            src={imageUrl}
            alt={place.title}
            fit="contain"
            width="100%"
            height={400}
            borderRadius={0}
            blurBackground
            allowCriticalWebBlur={Platform.OS === 'web'}
            blurRadius={18}
            loading="lazy"
            priority="low"
            style={styles.cardMedia}
          />
        ) : (
          <View style={styles.cardMediaFallback} />
        )}
        <View style={styles.cardMediaScrim} />
        {/* Press target is a sibling overlay (not a wrapper) so the favorite /
            status buttons in cardTravelActions are never nested inside a button. */}
        {/* Tappable for sighted users, but hidden from the a11y tree: the explicit
            «На карте» button below is the single announced map action (was 3 dupes). */}
        <Pressable
          onPress={() => onOpenMap(place)}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          focusable={false}
          style={({ pressed }) => [styles.cardMediaPressLayer, pressed && styles.cardPressed]}
        />
        {relatedTravelUrl ? (
          <View style={styles.cardTravelActions} pointerEvents="box-none">
            <RelatedTravelActionStack
              relatedTravelUrl={relatedTravelUrl}
              fallbackTitle={place.title}
              fallbackImageUrl={imageUrl}
              fallbackCountry={place.country}
            />
          </View>
        ) : null}
        <View style={styles.categoryBadge}>
          <Feather name="tag" size={10} color={colors.textOnDark} />
          <Text style={styles.categoryBadgeText} numberOfLines={1}>
            {place.category}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        {/* Title opens the map for sighted users; announced as a heading, not a
            third duplicate «на карте» button. */}
        <Pressable
          onPress={() => onOpenMap(place)}
          accessible={false}
          style={({ pressed }) => [styles.cardTitlePressable, pressed && PRESSED_OPACITY]}
        >
          <Text
            style={styles.cardTitle}
            numberOfLines={2}
            accessibilityRole="header"
          >
            {place.title}
          </Text>
        </Pressable>

        <View style={styles.cardMeta}>
          <Feather name="map-pin" size={12} color={colors.textMuted} />
          <Text style={styles.cardAddress} numberOfLines={1}>
            {place.address || place.country}
          </Text>
          {place.address && place.country ? (
            <Text style={styles.cardCountryTag} numberOfLines={1}>
              {place.country}
            </Text>
          ) : null}
        </View>

        <View style={styles.cardActions}>
          <Pressable
            onPress={() => onOpenMap(place)}
            accessibilityRole="button"
            accessibilityLabel={`Открыть ${place.title} на карте`}
            style={({ pressed }) => [
              styles.cardActionBtn,
              styles.cardActionBtnSecondary,
              pressed && PRESSED_OPACITY,
            ]}
          >
            <Feather name="map" size={14} color={colors.text} />
            <Text style={styles.cardActionBtnText}>На карте</Text>
          </Pressable>
          {place.urlTravel ? (
            <Pressable
              onPress={() => onOpenTravel(place)}
              accessibilityRole="button"
              accessibilityLabel={`Прочитать путешествие для ${place.title}`}
              style={({ pressed }) => [
                styles.cardActionBtn,
                styles.cardActionBtnPrimary,
                pressed && PRESSED_OPACITY,
              ]}
            >
              <Feather name="book-open" size={14} color={colors.textOnPrimary} />
              <Text style={[styles.cardActionBtnText, styles.cardActionBtnTextPrimary]}>
                Прочитать
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  )
})

export function SkeletonGrid({
  styles,
  isCompact,
  isWide,
}: {
  styles: PlacesStyles
  isCompact: boolean
  isWide: boolean
}) {
  const count = isCompact ? 4 : isWide ? 6 : 4
  return (
    <View style={styles.cardsGrid}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.card, styles.cardInner, styles.skeletonCard]}>
          <View style={styles.skeletonImage} />
          <View style={styles.skeletonBody}>
            <View style={[styles.skeletonLine, { width: '45%', height: 20 }]} />
            <View style={[styles.skeletonLine, { width: '70%', height: 14 }]} />
            <View style={[styles.skeletonLine, { width: '55%', height: 14 }]} />
            <View style={[styles.skeletonLine, { width: '100%', height: 1 }]} />
            <View style={styles.skeletonActions}>
              <View style={[styles.skeletonLine, { flex: 1, height: 36, borderRadius: DESIGN_TOKENS.radii.sm }]} />
              <View style={[styles.skeletonLine, { flex: 1, height: 36, borderRadius: DESIGN_TOKENS.radii.sm }]} />
            </View>
          </View>
        </View>
      ))}
    </View>
  )
}

export function StateBlock({
  styles,
  colors,
  icon,
  title,
  description,
  actionLabel,
  onAction,
  pending = false,
  pendingLabel,
}: {
  styles: PlacesStyles
  colors: ThemedColors
  icon: React.ComponentProps<typeof Feather>['name']
  title: string
  description: string
  actionLabel: string
  onAction: () => void
  pending?: boolean
  pendingLabel?: string
}) {
  return (
    <View style={styles.stateBlock}>
      <View style={styles.stateIconWrap}>
        <Feather name={icon} size={28} color={colors.textMuted} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{description}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: pending, busy: pending }}
        disabled={pending}
        onPress={onAction}
        style={({ pressed }) => [
          styles.stateAction,
          pending && styles.stateActionPending,
          pressed && !pending && PRESSED_OPACITY,
        ]}
      >
        {pending ? (
          <View style={styles.stateActionPendingRow}>
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
            <Text style={styles.stateActionText}>{pendingLabel ?? actionLabel}</Text>
          </View>
        ) : (
          <Text style={styles.stateActionText}>{actionLabel}</Text>
        )}
      </Pressable>
    </View>
  )
}
