import { memo } from 'react'
import {
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { MoodCard } from './homeHeroContent'
import type { QuickFilterParams } from './homeHeroShared'
import EdgeFadeScrollRow from '@/components/ui/EdgeFadeScrollRow'
import { translate as i18nT } from '@/i18n'


type HomeHeroMoodRailProps = {
  colors: {
    textMuted?: string
    primary?: string
    background?: string
  }
  styles: any
  isMobile: boolean
  isWeb: boolean
  moodCards: readonly MoodCard[]
  onQuickFilterPress: (
    label: string,
    filters?: QuickFilterParams,
    route?: string,
  ) => void
}

const renderMoodChip = (
  card: MoodCard,
  colors: HomeHeroMoodRailProps['colors'],
  styles: any,
  onQuickFilterPress: HomeHeroMoodRailProps['onQuickFilterPress'],
  flexible = false,
) => (
  <Pressable
    key={card.title}
    onPress={() => onQuickFilterPress(card.title, card.filters, card.route)}
    style={({ pressed, hovered, focused }: any) => [
      styles.moodChip,
      flexible && styles.moodChipWrapItem,
      (pressed || hovered) && styles.moodChipHover,
      Platform.OS === 'web' && focused && {
        outlineWidth: 2,
        outlineStyle: 'solid',
        outlineColor: colors.primary,
        outlineOffset: 2,
      },
    ]}
    accessibilityRole="button"
    accessibilityLabel={i18nT('home:components.home.HomeHeroMoodRail.value1_ideya_poezdki_c416349a', { value1: card.title })}
  >
    <Feather
      name={card.icon}
      size={19}
      color={colors.textMuted}
      {...({ 'aria-hidden': true, focusable: false } as any)}
    />
    <Text style={styles.moodChipTitle}>{card.title}</Text>
  </Pressable>
)

const webScrollStyle =
  Platform.OS === 'web'
    ? ({
        touchAction: 'pan-x pan-y',
        WebkitOverflowScrolling: 'touch',
        overflowX: 'auto',
        overflowY: 'hidden',
        overscrollBehaviorX: 'contain',
      } as const)
    : undefined

function HomeHeroMoodRail({
  colors,
  styles,
  isMobile,
  isWeb,
  moodCards,
  onQuickFilterPress,
}: HomeHeroMoodRailProps) {
  return (
    <View style={styles.moodChipsContainer}>
      {isMobile ? (
        <View style={styles.moodChipsWrap}>
          {moodCards.map((card) =>
            renderMoodChip(card, colors, styles, onQuickFilterPress, true),
          )}
        </View>
      ) : (
        <EdgeFadeScrollRow
          style={isWeb ? webScrollStyle : undefined}
          contentContainerStyle={styles.moodChipsScrollContent}
          // Ряд лежит прямо на фоне героя (`warmBg` в `homeHeroStyles` — это
          // `colors.background`), а не на карточной `surface`: затухание в
          // дефолтный цвет рисовало бы у края полосу другого оттенка.
          fadeColor={colors.background}
        >
          {moodCards.map((card) =>
            renderMoodChip(card, colors, styles, onQuickFilterPress),
          )}
        </EdgeFadeScrollRow>
      )}
    </View>
  )
}

export default memo(HomeHeroMoodRail)
