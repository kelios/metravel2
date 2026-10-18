import React, { Suspense, useMemo } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import CustomHeader from '@/components/layout/CustomHeader'
import FreezeWhenBlurred from '@/components/layout/FreezeWhenBlurred'
import StandaloneScreen from '@/components/layout/StandaloneScreen'
import { useThemedColors } from '@/hooks/useTheme'
import { parseQuestLocaleRoute } from '@/utils/questLocaleRouting'

// Explicit source extensions prevent platform resolution from re-entering this
// adapter. Native keeps the original catch-all and its existing error handling.
const NotFoundContent = require('./[...missing].tsx').NotFoundContent as React.ComponentType

// Lazy on purpose (#2389): a static import made the whole quest screen part of
// this catch-all's module graph, and the shared-chunk split then shipped it as
// eager JS on unrelated routes (userpoints, messages, cookies, user, trip plan).
// The quest screen loads only once the path is a locale quest route.
const loadQuestScreen = () => import('@/app/(tabs)/quests/[city]/[questId]')
const QuestByIdScreen = React.lazy(loadQuestScreen)
// Start the chunk with this module on a locale quest URL instead of on first
// render, so it overlaps the catch-all's own render; other catch-all paths skip it.
if (typeof window !== 'undefined' && parseQuestLocaleRoute(window.location.pathname)) {
  void loadQuestScreen()
}

function QuestScreenFallback() {
  const colors = useThemedColors()
  return (
    <View style={styles.fallback}>
      <ActivityIndicator color={colors.primaryDark} />
    </View>
  )
}

export default function QuestLocaleRouteScreen() {
  // The card's own segments, not the global pathname: a hidden stack card must
  // keep its address when a language link pushes the same quest in another
  // locale (#2464).
  const { missing } = useLocalSearchParams<{ missing?: string | string[] }>()
  const ownPath = `/${([] as string[]).concat(missing ?? []).join('/')}`
  const route = useMemo(() => parseQuestLocaleRoute(ownPath), [ownPath])
  if (!route) return <StandaloneScreen><NotFoundContent /></StandaloneScreen>

  // CustomHeader owns the top inset for this root Stack route, as on contact.
  return (
    <FreezeWhenBlurred>
      <View style={styles.root}>
        <CustomHeader />
        <Suspense fallback={<QuestScreenFallback />}>
          <QuestByIdScreen key={route.path} route={route} />
        </Suspense>
      </View>
    </FreezeWhenBlurred>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
