import { StyleSheet, View } from 'react-native'

import { useThemedColors } from '@/hooks/useTheme'

type Props = {
  ratio: number
  color: string
  label: string
}

export default function AppStatsMeter({ ratio, color, label }: Props) {
  const colors = useThemedColors()
  const width = `${Math.max(0, Math.min(100, Math.round(ratio * 100)))}%`
  return (
    <View
      accessibilityLabel={label}
      style={[styles.track, { backgroundColor: colors.backgroundSecondary }]}
    >
      <View style={[styles.fill, { width, backgroundColor: color }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    height: '100%',
  },
})
