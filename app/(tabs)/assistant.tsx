import React, { Suspense } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'

import { NotFoundContent } from '@/components/screens/NotFoundContent'
import { rememberPrehydrationInput } from '@/hooks/usePrehydrationInputValue'
import { useThemedColors } from '@/hooks/useTheme'
import { ASSISTANT_INPUT_TEST_ID, isAiAssistantEnabled } from '@/utils/aiAssistantConfig'
import { translate as i18nT } from '@/i18n'
import { ASSISTANT_SEO } from '@/components/screens/assistant/assistantSeo'
import { lazyHydratedInPlace } from '@/utils/lazyHydratedInPlace'
import { notFoundRouteMetadata, routeMetadata } from '@/utils/seoRoutes/routeMetadata'

type AssistantScreenProps = { sourceParam: string | string[] | null }

// #2460: экран грузится отложенным чанком и только под флагом — в сборке с
// выключенным ассистентом (прод) его код на страницу не попадает.
// #2738: и в сборку тоже — условие литералом `process.env` (см. aiAssistantConfig).
// #3370: экран есть в статическом HTML, и его чанк стоит в тегах <script> этого роута
// (`ROUTE_EAGER_LAZY_SCREENS` в scripts/lib/granularChunkMerge.js) — к гидрации модуль уже
// исполнен, экран рисуется сразу и граница гидрируется на месте: поле вопроса, фокус в
// нём и набранные символы остаются теми же узлами.
const AssistantScreen = lazyHydratedInPlace<AssistantScreenProps>(
  () => (process.env.EXPO_PUBLIC_AI_ASSISTANT
    ? import('@/components/screens/assistant/AssistantScreen')
    : Promise.resolve({ default: NotFoundContent })),
  // #3346: узел поля запоминается, пока серверная разметка цела; композер заберёт из него
  // набранное до гидрации. Нужно в обоих исходах: на месте первый повторный рендер
  // контролируемого поля записал бы пустой state поверх набранного, а если чанк экрана не
  // готов (сбой загрузки тега), React заменит разметку вместе с полем.
  () => rememberPrehydrationInput(ASSISTANT_INPUT_TEST_ID),
)

function AssistantFallback() {
  const colors = useThemedColors()
  return (
    <View style={styles.fallback}>
      <ActivityIndicator color={colors.primaryDark} />
    </View>
  )
}

export default function AssistantRoute() {
  // #2897: `?source=travel:816` / `quest:<id>` — контекстный вход со страницы
  // статьи или квеста; разбирает экран (роут не подключает `api/aiAssist`, #2738).
  const { source } = useLocalSearchParams<{ source?: string | string[] }>()
  if (!isAiAssistantEnabled()) return <NotFoundContent />
  return (
    <Suspense fallback={<AssistantFallback />}>
      <AssistantScreen sourceParam={source ?? null} />
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
