import React, { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { HomePageSkeleton } from '@/components/home/HomePageSkeleton'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

// Слой скелетона главной — только native. На web ветка `shouldShowSkeleton` в
// `app/(tabs)/index.tsx` недостижима (первый экран держит SSG-шелл), поэтому
// web-вариант `HomeSkeletonLayer.web.tsx` пустой и не тянет в бандл главной ни
// разметку скелетона, ни подсказку медленной загрузки (#2087).

// If the home skeleton stays up longer than SLOW_LOAD_MS, surface a gentle
// "Загружаем…" hint so a slow device doesn't feel frozen. The component is only
// mounted while the skeleton layer is shown, so the timer is torn down as soon
// as content becomes ready.
const SLOW_LOAD_MS = 4500

const SlowLoadHint = React.memo<{ colors: ReturnType<typeof useThemedColors> }>(({ colors }) => {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setShow(true), SLOW_LOAD_MS)
    return () => clearTimeout(id)
  }, [])

  if (!show) return null

  return (
    <View style={styles.hintWrap} pointerEvents="none">
      <View style={[styles.hintPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.primaryDark} />
        <Text style={[styles.hintText, { color: colors.textMuted }]}>{i18nT('home:app.tabs.index.zagruzhaem_4bc2d2f4')}</Text>
      </View>
    </View>
  )
})
SlowLoadHint.displayName = 'SlowLoadHint'

export function HomeSkeletonLayer({ colors }: { colors: ReturnType<typeof useThemedColors> }) {
  return (
    <View style={styles.layer} testID="home-skeleton-layer">
      <HomePageSkeleton />
      <SlowLoadHint colors={colors} />
    </View>
  )
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  hintWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 120,
  },
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  hintText: {
    fontSize: 14,
    fontWeight: '600',
  },
})
