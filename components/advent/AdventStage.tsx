import { memo, useCallback, useState, type ReactNode } from 'react'
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { webStyle } from '@/utils/webProps'
import { ADVENT_HOUSE_ASPECT_RATIO, ADVENT_HOUSE_MAX_WIDTH } from './adventHouseLayout'

type Props = { children: ReactNode }

/**
 * Свободная область экрана, в которую дом вписан целиком: ширина дома —
 * min(ширина области, высота × 2/3). На web это чистый CSS (container query units):
 * статический HTML уже верного размера, без замера и сдвига после гидратации.
 * На native размеры области приходят из `onLayout`.
 */
function AdventStage({ children }: Props) {
  const [nativeWidth, setNativeWidth] = useState<number | null>(null)
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    const inner = DESIGN_TOKENS.spacing.md * 2
    setNativeWidth(Math.max(0, Math.min(width - inner, (height - inner) * ADVENT_HOUSE_ASPECT_RATIO)))
  }, [])

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.stage, WEB_STAGE]} testID="advent-stage">
        <View style={[styles.fit, WEB_FIT]}>{children}</View>
      </View>
    )
  }

  return (
    <View style={styles.stage} onLayout={handleLayout} testID="advent-stage">
      {/* До первого замера — прежняя ширина по области: окна доступны сразу, без пустого кадра. */}
      <View style={[styles.fit, { width: nativeWidth ?? '100%' }]}>{children}</View>
    </View>
  )
}

// `container-type: size` берёт размер области у раскладки, а не у содержимого — поэтому
// `cqh` в ширине дома не создаёт цикла.
const WEB_STAGE = webStyle({ containerType: 'size' })
const WEB_FIT = webStyle({ width: `min(100cqw, calc(100cqh * ${ADVENT_HOUSE_ASPECT_RATIO}))` as unknown as number })

const styles = StyleSheet.create({
  stage: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 0,
    padding: DESIGN_TOKENS.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fit: { maxWidth: ADVENT_HOUSE_MAX_WIDTH },
})

export default memo(AdventStage)
