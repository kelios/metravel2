import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { Link, type Href } from 'expo-router'

import type { ThemedColors } from '@/hooks/useTheme'
import type { HeroHighlight, HeroHighlightPressEvent } from './homeHeroContent'

type Styles = any

// #2901: плашка — ссылка (`<a href>` на web), hover/focus как у чипов настроения.
// Прямой ребёнок `Link asChild` получает ОДИН плоский объект стиля: Slot сливает
// стили спредом, и функция `({ pressed, hovered }) => [...]` схлопнулась бы в `{}` —
// плашка потеряла бы рамку, фон и раскладку (тот же приём, что в #2830).
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
  const cardStyle = StyleSheet.flatten([
    styles.tabletFeatureCard,
    (pressed || hovered) && styles.tabletFeatureCardHover,
    Platform.OS === 'web' && focused && {
      outlineWidth: 2,
      outlineStyle: 'solid' as const,
      outlineColor: colors.primary,
      outlineOffset: 2,
    },
  ])

  return (
    <Link href={item.route as Href} onPress={(event) => onHighlightPress(item, event)} asChild>
      <Pressable
        testID={`home-hero-highlight-${item.id}`}
        accessibilityRole="link"
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
      </Pressable>
    </Link>
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
