import React, { Suspense } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { NotFoundContent } from '@/components/screens/NotFoundContent'
import { useThemedColors } from '@/hooks/useTheme'
import { isAiAssistantEnabled } from '@/utils/aiAssistantConfig'

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
