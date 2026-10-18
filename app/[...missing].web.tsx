import React, { Suspense, useMemo, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import CustomHeader from '@/components/layout/CustomHeader'
import FreezeWhenBlurred from '@/components/layout/FreezeWhenBlurred'
import StandaloneScreen from '@/components/layout/StandaloneScreen'
import { useThemedColors } from '@/hooks/useTheme'
import { parseQuestLocaleRoute } from '@/utils/questLocaleRouting'
import { readSyncImport } from '@/utils/syncImport'

// Explicit source extensions prevent platform resolution from re-entering this
// adapter. Native keeps the original catch-all and its existing error handling.
const NotFoundContent = require('./[...missing].tsx').NotFoundContent as React.ComponentType

// Lazy on purpose (#2389): a static import made the whole quest screen part of
// this catch-all's module graph, and the shared-chunk split then shipped it as
// eager JS on unrelated routes (userpoints, messages, cookies, user, trip plan).
// The quest screen loads only once the path is a locale quest route.
type QuestScreenModule = typeof import('@/app/(tabs)/quests/[city]/[questId]')
// #2465: once the module is in, render it directly. React.lazy suspends on its
// first render even for a resolved import, and the reveal of that Suspense
// retry is throttled 300 ms after the last fallback commit — on a translated
// member, whose document ships the chunk, that held the quest screen back.
// This module is evaluated inside the route's first render: only the module
// Metro hands over synchronously (`readSyncImport`) is in time for it.
let loadedQuestScreen: QuestScreenModule['default'] | null = null
const loadQuestScreen = () => {
  const pending = import('@/app/(tabs)/quests/[city]/[questId]')
  loadedQuestScreen = readSyncImport(pending)?.default ?? loadedQuestScreen
  return pending.then((module) => {
    loadedQuestScreen = module.default
    return module
  })
}
const LazyQuestByIdScreen = React.lazy(loadQuestScreen)
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
  // One component type for the life of this mount: switching lazy → loaded
  // after a commit would remount the whole quest screen.
  const [QuestByIdScreen] = useState(() => loadedQuestScreen ?? LazyQuestByIdScreen)
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
