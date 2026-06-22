import { memo } from 'react'
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { MoodCard } from './homeHeroContent'
import type { QuickFilterParams } from './homeHeroShared'

type HomeHeroMoodRailProps = {
  colors: {
    textMuted?: string
    primary?: string
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
    accessibilityLabel={`${card.title}. Идея поездки`}
  >
    <Feather
      name={card.icon as any}
      size={19}
      color={colors.textMuted}
      {...({ 'aria-hidden': true, focusable: false } as any)}
    />
    <Text style={styles.moodChipTitle}>{card.title}</Text>
  </Pressable>
)

const webMaskStyle =
  Platform.OS === 'web'
    ? ({
        WebkitMaskImage:
          'linear-gradient(to right, transparent 0px, black 16px, black calc(100% - 16px), transparent 100%)',
        maskImage:
          'linear-gradient(to right, transparent 0px, black 16px, black calc(100% - 16px), transparent 100%)',
        overflow: 'hidden',
      } as const)
    : undefined

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
        <View style={isWeb ? webMaskStyle : undefined}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={isWeb ? webScrollStyle : undefined}
            contentContainerStyle={styles.moodChipsScrollContent}
          >
            {moodCards.map((card) =>
              renderMoodChip(card, colors, styles, onQuickFilterPress),
            )}
          </ScrollView>
        </View>
      )}
    </View>
  )
}

export default memo(HomeHeroMoodRail)
