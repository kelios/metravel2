import { Platform, StyleSheet, View } from 'react-native'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { useTheme } from '@/hooks/useTheme'
import { webDataSetProps } from '@/utils/webProps'

type Props = { variant: 'hat' | 'tree' }

const SOURCES = {
  hat: require('@/assets/seasonal/christmas-hat.png'),
  tree: require('@/assets/seasonal/christmas-tree.png'),
} as const

/** Small decorative marks only; never import the advent house/artwork pack here. */
export default function ChristmasLogoDecoration({ variant }: Props) {
  const { activeSeasonalTheme } = useTheme()
  return (
    <View
      testID={`christmas-logo-${variant}`}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...(Platform.OS === 'web' ? webDataSetProps({ christmasLogoDecoration: variant }) : undefined)}
      style={[styles[variant], activeSeasonalTheme !== 'christmas' && styles.hidden]}
    >
      <ImageCardMedia
        source={SOURCES[variant]}
        borderRadius={0}
        fit="contain"
        loading="eager"
        priority="low"
        showImmediately
        showLoadingIndicator={false}
        placeholderColor="#00000000"
        style={styles.media}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  hidden: { display: 'none' },
  hat: {
    position: 'absolute',
    left: '6%',
    top: '-22%',
    width: '55%',
    height: '36%',
    transform: [{ rotate: '-12deg' }],
    zIndex: 2,
    overflow: 'visible',
  },
  tree: { width: 24, height: 32, marginLeft: 2, flexShrink: 0 },
  media: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', backgroundColor: 'transparent' },
})
