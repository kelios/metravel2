// components/trips/planning/tripPlanDeferredSections.tsx
// #1543: единая точка подключения тех секций экрана планировщика, которые на
// первом кадре не рендерятся — вкладки «люди»/«экспорт»/«ещё» и панель
// редактирования владельца. Здесь (native и тесты) они подключены синхронно:
// платформенный сплит нужен только web-бандлу, где каждая такая секция уезжает
// отдельным async-чанком (см. ./tripPlanDeferredSections.web.tsx).
// Канон тот же, что у главной (`components/home/homeDeferredSections*`).
import PhotoUploadWithPreviewDefault from '@/components/travel/PhotoUploadWithPreview'
import TripChatPanelDefault from '@/components/trips/chat/TripChatPanel'
import TripTelegramGroupCardDefault from '@/components/trips/communication/TripTelegramGroupCard'
import TripInvitePanelDefault from '@/components/trips/planning/TripInvitePanel'
import TripParticipantsListDefault from '@/components/trips/planning/TripParticipantsList'
import TripRatingPanelDefault from '@/components/trips/planning/TripRatingPanel'
import TripReportFormDefault from '@/components/trips/planning/TripReportForm'
import TripRouteExportMenuDefault from '@/components/trips/planning/TripRouteExportMenu'
import TripRsvpControlDefault from '@/components/trips/planning/TripRsvpControl'
import TripSuggestPointFormDefault from '@/components/trips/planning/TripSuggestPointForm'
import TripSuggestionsPanelDefault from '@/components/trips/planning/TripSuggestionsPanel'

export const PhotoUploadWithPreview = PhotoUploadWithPreviewDefault
export const TripChatPanel = TripChatPanelDefault
export const TripInvitePanel = TripInvitePanelDefault
export const TripParticipantsList = TripParticipantsListDefault
export const TripRatingPanel = TripRatingPanelDefault
export const TripReportForm = TripReportFormDefault
export const TripRouteExportMenu = TripRouteExportMenuDefault
export const TripRsvpControl = TripRsvpControlDefault
export const TripSuggestPointForm = TripSuggestPointFormDefault
export const TripSuggestionsPanel = TripSuggestionsPanelDefault
export const TripTelegramGroupCard = TripTelegramGroupCardDefault
