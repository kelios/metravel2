import React, { useMemo } from 'react'
import { usePathname } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import CustomHeader from '@/components/layout/CustomHeader'
import StandaloneScreen from '@/components/layout/StandaloneScreen'
import QuestByIdScreen from '@/app/(tabs)/quests/[city]/[questId]'
import { parseQuestLocaleRoute } from '@/utils/questLocaleRouting'

// Explicit source extensions prevent platform resolution from re-entering this
// adapter. Native keeps the original catch-all and its existing error handling.
const NotFoundContent = require('./[...missing].tsx').NotFoundContent as React.ComponentType

export default function QuestLocaleRouteScreen() {
  const pathname = usePathname()
  const route = useMemo(() => parseQuestLocaleRoute(pathname), [pathname])
  if (!route) return <StandaloneScreen><NotFoundContent /></StandaloneScreen>

  // CustomHeader owns the top inset for this root Stack route, as on contact.
  return (
    <View style={styles.root}>
      <CustomHeader />
      <QuestByIdScreen key={route.path} route={route} />
    </View>
  )
}

const styles = StyleSheet.create({ root: { flex: 1 } })
