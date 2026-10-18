import React, { Suspense } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { useThemedColors } from '@/hooks/useTheme'
import { isAiAssistantEnabled } from '@/utils/aiAssistantConfig'

// Явное расширение: web-вариант `[...missing].web.tsx` — адаптер без
// `NotFoundContent`, а экран «не найдено» нужен один на обеих платформах.
const NotFoundContent = require('../[...missing].tsx').NotFoundContent as React.ComponentType

// #2460: экран грузится отложенным чанком и только под флагом — в сборке с
// выключенным ассистентом (прод) его код на страницу не попадает.
const AssistantScreen = React.lazy(() => import('@/components/screens/assistant/AssistantScreen'))

function AssistantFallback() {
  const colors = useThemedColors()
  return (
    <View style={styles.fallback}>
      <ActivityIndicator color={colors.primaryDark} />
    </View>
  )
}

export default function AssistantRoute() {
  if (!isAiAssistantEnabled()) return <NotFoundContent />
  return (
    <Suspense fallback={<AssistantFallback />}>
      <AssistantScreen />
    </Suspense>
  )
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
