import React, { Suspense, useMemo, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import CustomHeader from '@/components/layout/CustomHeader'
import FreezeWhenBlurred from '@/components/layout/FreezeWhenBlurred'
import { useThemedColors } from '@/hooks/useTheme'
import { parseQuestLocaleRoute } from '@/utils/questLocaleRouting'
import { readSyncImport } from '@/utils/syncImport'
import { useDocumentRouteRegistration } from '@/components/layout/documentView'

// Явное расширение: без него платформенное разрешение вернуло бы этот же адаптер.
// Нативный catch-all остаётся в том же web-чанке — `scripts/lib/expoStaticShell.js`
// (`onlyChunk`) ждёт ровно один чанк `[...missing]` для boot-скриптов переводной детали.
import NotFoundScreen from './[...missing].tsx'
import { notFoundRouteMetadata } from '@/utils/seoRoutes/routeMetadata'
import type { ImmutableRequest } from 'expo-server'
import QuestPublicLoaderScreen from '@/components/quests/runtime/QuestPublicLoaderScreen.web'

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
  const registrationOnly = useDocumentRouteRegistration()
  // The card's own segments, not the global pathname: a hidden stack card must
  // keep its address when a language link pushes the same quest in another
  // locale (#2464).
  const { missing } = useLocalSearchParams<{ missing?: string | string[] }>()
  const ownPath = `/${([] as string[]).concat(missing ?? []).join('/')}`
  const route = useMemo(() => parseQuestLocaleRoute(ownPath), [ownPath])
  // One component type for the life of this mount: switching lazy → loaded
  // after a commit would remount the whole quest screen.
  const [QuestByIdScreen] = useState(() => loadedQuestScreen ?? LazyQuestByIdScreen)
  if (registrationOnly) return null
  if (!route) return <NotFoundScreen />
  const gameplay = <Suspense fallback={<QuestScreenFallback />}>
    <QuestByIdScreen key={route.path} route={route} />
  </Suspense>

  // CustomHeader owns the top inset for this root Stack route, as on contact.
  return (
    <FreezeWhenBlurred>
      <View style={styles.root}>
        <CustomHeader />
        {process.env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR === 'true'
          ? <QuestPublicLoaderScreen fallback={gameplay} /> : gameplay}
      </View>
    </FreezeWhenBlurred>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); строки те же, что у экрана
export async function loader(request: ImmutableRequest | undefined, params: Record<string, string | string[]>) {
  const { loadQuestPublicRoute } = await import('@/components/quests/runtime/questRouteLoader')
  return loadQuestPublicRoute(request, params)
}

export async function generateMetadata(request: ImmutableRequest | undefined, params: Record<string, string | string[]>) {
  const { loadQuestPublicRoute } = await import('@/components/quests/runtime/questRouteLoader')
  const data = await loadQuestPublicRoute(request, params)
  if (!data) return notFoundRouteMetadata()
  const { questPublicRouteMetadata } = await import('@/components/quests/runtime/questPublicSeo')
  return questPublicRouteMetadata(request, params)
}
