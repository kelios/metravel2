/**
 * Единый источник SEO маршрута `/assistant` (#2740): им пользуются и экран
 * (`AssistantScreen`), и `generateMetadata()` в `app/(tabs)/assistant.tsx`. Отдельный
 * модуль — чтобы роут не тянул за константами отложенный чанк экрана (#2460).
 */
export const ASSISTANT_SEO = {
  titleKey: 'aiAssistStatic:ask.seoTitle',
  descriptionKey: 'aiAssistStatic:ask.seoDescription',
  path: '/assistant',
} as const
