import { useState } from 'react'
import { Platform, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import type { Href } from 'expo-router'

import LinkPressable from '@/components/ui/LinkPressable'
import type { ThemedColors } from '@/hooks/useTheme'
import type { HeroHighlight, HeroHighlightPressEvent } from './homeHeroContent'

type Styles = any

// #2901: плашка — ссылка (`<a href>` на web), hover/focus как у чипов настроения.
// Стиль не может зависеть от `({ pressed, hovered })` (Slot сливает спредом, #2830),
// поэтому наведение и нажатие живут в state.
function TabletFeatureLink({
  colors,
  item,
  onHighlightPress,
  styles,
}: {
  colors: ThemedColors
  item: HeroHighlight
  onHighlightPress: (item: HeroHighlight, event: HeroHighlightPressEvent) => void
  styles: Styles
}) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [focused, setFocused] = useState(false)
  const cardStyle = [
    styles.tabletFeatureCard,
    (pressed || hovered) && styles.tabletFeatureCardHover,
    Platform.OS === 'web' && focused && {
      outlineWidth: 2,
      outlineStyle: 'solid' as const,
      outlineColor: colors.primary,
      outlineOffset: 2,
    },
  ]

  return (
    <LinkPressable
      href={item.route as Href}
      onPress={(event) => onHighlightPress(item, event)}
      testID={`home-hero-highlight-${item.id}`}
      accessibilityLabel={`${item.title}: ${item.subtitle}`}
      style={cardStyle}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <View style={styles.tabletFeatureIconWrap}>
        <Feather name={item.icon} size={16} color={colors.textOnPrimary} />
      </View>
      <View style={styles.tabletFeatureTextWrap}>
        <Text style={styles.tabletFeatureTitle}>{item.title}</Text>
        <Text style={styles.tabletFeatureSubtitle}>{item.subtitle}</Text>
      </View>
    </LinkPressable>
  )
}

export default function HomeHeroFeatureGrid({
  colors,
  heroHighlights,
  onHighlightPress,
  styles,
}: {
  colors: ThemedColors
  heroHighlights: readonly HeroHighlight[]
  onHighlightPress: (item: HeroHighlight, event: HeroHighlightPressEvent) => void
  styles: Styles
}) {
  return (
    <View style={styles.tabletFeatureGrid}>
      {heroHighlights.map((item) => (
        <TabletFeatureLink
          key={item.id}
          colors={colors}
          item={item}
          onHighlightPress={onHighlightPress}
          styles={styles}
        />
      ))}
    </View>
  )
}
