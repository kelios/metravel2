import { memo, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { DESIGN_TOKENS } from '@/constants/designSystem'

type Props = { src: string; alt: string }

/** The sheet keys this component by door + URL, so a failed gift never hides the next one's image. */
function AdventGiftMedia({ src, alt }: Props) {
  const [failed, setFailed] = useState(false)
  if (failed) return null

  return (
    <View style={styles.frame} testID="advent-gift-media">
      <ImageCardMedia
        src={src}
        alt={alt}
        fit="contain"
        borderRadius={DESIGN_TOKENS.radii.md}
        style={styles.image}
        onTerminalError={() => setFailed(true)}
        testID="advent-gift-image"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 16 / 9 },
  image: { width: '100%', height: '100%' },
})

export default memo(AdventGiftMedia)
