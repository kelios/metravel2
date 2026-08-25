// components/trips/planning/tripPlanDeferredSections.web.tsx
// #1543: web-половина сплита. Экран планировщика открывается на вкладке
// `route`, поэтому вкладки «люди»/«экспорт»/«ещё» и панель редактирования
// владельца (isOwner && isEditing) на первом кадре не рендерятся, а их деревья
// всё равно ехали eager-чанками маршрута. Каждая секция получает собственную
// async-границу; синхронного двойника в этом файле нет — иначе Metro оставил бы
// ребро в графе и `React.lazy` не сэкономил бы ни байта (класс дефекта #1499).
// `safeLazy`, а не сырой `React.lazy`: он переживает транзиентный отказ
// Metro async-require при гидратации и не оставляет пустую панель.
import { safeLazy } from '@/components/layout/safeLazy'

export const PhotoUploadWithPreview = safeLazy(
  () => import('@/components/travel/PhotoUploadWithPreview'),
  'PhotoUploadWithPreview',
  { retries: 1 },
)
export const TripChatPanel = safeLazy(
  () => import('@/components/trips/chat/TripChatPanel'),
  'TripChatPanel',
  { retries: 1 },
)
export const TripInvitePanel = safeLazy(
  () => import('@/components/trips/planning/TripInvitePanel'),
  'TripInvitePanel',
  { retries: 1 },
)
export const TripParticipantsList = safeLazy(
  () => import('@/components/trips/planning/TripParticipantsList'),
  'TripParticipantsList',
  { retries: 1 },
)
export const TripRatingPanel = safeLazy(
  () => import('@/components/trips/planning/TripRatingPanel'),
  'TripRatingPanel',
  { retries: 1 },
)
export const TripReportForm = safeLazy(
  () => import('@/components/trips/planning/TripReportForm'),
  'TripReportForm',
  { retries: 1 },
)
export const TripRouteExportMenu = safeLazy(
  () => import('@/components/trips/planning/TripRouteExportMenu'),
  'TripRouteExportMenu',
  { retries: 1 },
)
export const TripRsvpControl = safeLazy(
  () => import('@/components/trips/planning/TripRsvpControl'),
  'TripRsvpControl',
  { retries: 1 },
)
export const TripSuggestPointForm = safeLazy(
  () => import('@/components/trips/planning/TripSuggestPointForm'),
  'TripSuggestPointForm',
  { retries: 1 },
)
export const TripSuggestionsPanel = safeLazy(
  () => import('@/components/trips/planning/TripSuggestionsPanel'),
  'TripSuggestionsPanel',
  { retries: 1 },
)
export const TripTelegramGroupCard = safeLazy(
  () => import('@/components/trips/communication/TripTelegramGroupCard'),
  'TripTelegramGroupCard',
  { retries: 1 },
)
