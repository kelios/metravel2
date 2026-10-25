import React, { Suspense } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { NotFoundContent } from '@/components/screens/NotFoundContent'
import { useThemedColors } from '@/hooks/useTheme'
import { isAiAssistantEnabled } from '@/utils/aiAssistantConfig'
import { translate as i18nT } from '@/i18n'
import { ASSISTANT_SEO } from '@/components/screens/assistant/assistantSeo'
import { notFoundRouteMetadata, routeMetadata } from '@/utils/seoRoutes/routeMetadata'

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

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); строки те же, что у экрана
export function generateMetadata() {
  // Без флага экран отдаёт NotFoundContent — статический head говорит то же.
  if (!isAiAssistantEnabled()) return notFoundRouteMetadata()
  return routeMetadata({
    title: i18nT(ASSISTANT_SEO.titleKey),
    description: i18nT(ASSISTANT_SEO.descriptionKey),
    canonical: ASSISTANT_SEO.path,
    robots: 'noindex, nofollow',
  })
}
