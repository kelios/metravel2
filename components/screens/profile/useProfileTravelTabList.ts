import { useCallback, useEffect, useRef } from 'react'

import type { ProfileTabKey } from '@/components/profile/ProfileTabs'
import { useMyTravels, type UseMyTravelsResult } from '@/hooks/useMyTravels'
import type { Travel } from '@/types/types'
import {
  DRAFT_PUBLICATION_STATUSES,
  PUBLISHED_PUBLICATION_STATUSES,
} from '@/utils/travelPublicationStatus'

type UseProfileTravelTabListInput = {
  activeTab: ProfileTabKey
  userId?: string | null
  perPage: number
  /** Общий список автора: источник для всех вкладок, кроме срезов по статусу. */
  allTravels: UseMyTravelsResult
  /** Счётчики профиля живут в общем списке — после удаления в срезе он устарел. */
  onAfterRemove: () => void
}

export type ProfileTravelListSource = {
  /** true — на экране серверный срез по статусу, а не общий список автора. */
  isFiltered: boolean
  travels: Travel[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: string | null
  removingTravelId: number | null
  reload: () => Promise<void>
  loadMore: () => Promise<void>
  remove: (travelId: number) => Promise<void>
}

const isStatusTab = (tab: ProfileTabKey) => tab === 'publishedTravels' || tab === 'draftTravels'

// #1833: вкладки «Опубл.» и «Черновики» были клиентским срезом общего списка, и
// ради полноты фильтра профиль догружал весь каталог автора (365 маршрутов —
// ~18 запросов подряд). Теперь у каждой из них свой пагинированный запрос с
// `where.publication_status`, а общий список остаётся тем вкладкам, которым он
// действительно нужен целиком: «Страны», «Карта», метрики и счётчики.
export function useProfileTravelTabList({
  activeTab,
  userId,
  perPage,
  allTravels,
  onAfterRemove,
}: UseProfileTravelTabListInput): ProfileTravelListSource {
  // Свой экземпляр на каждый статус, а не один с меняющимся фильтром: иначе
  // переключение вкладок туда-обратно каждый раз перезапрашивало бы страницу 1,
  // а между сменой фильтра и загрузкой на экране был бы чужой срез.
  const published = useMyTravels({
    userId,
    perPage,
    includeDrafts: true,
    publicationStatus: PUBLISHED_PUBLICATION_STATUSES,
  })
  const drafts = useMyTravels({
    userId,
    perPage,
    includeDrafts: true,
    publicationStatus: DRAFT_PUBLICATION_STATUSES,
  })

  const filtered = activeTab === 'publishedTravels'
    ? published
    : activeTab === 'draftTravels'
      ? drafts
      : null

  const loadedTabsRef = useRef<Set<ProfileTabKey>>(new Set())
  // Смена пользователя обнуляет память о загруженных вкладках раньше, чем
  // сработает загрузчик ниже: у нового аккаунта свои срезы.
  useEffect(() => {
    loadedTabsRef.current = new Set()
  }, [userId])

  const loadPublished = published.load
  const loadDrafts = drafts.load
  useEffect(() => {
    // Срез читается по первому открытию своей вкладки: возврат на уже открытую
    // не должен стоить ещё одного запроса. Ретрай после ошибки идёт мимо guard
    // через reload, как и у общего списка.
    if (!userId || !isStatusTab(activeTab)) return
    if (loadedTabsRef.current.has(activeTab)) return
    loadedTabsRef.current.add(activeTab)
    void (activeTab === 'publishedTravels' ? loadPublished() : loadDrafts())
  }, [activeTab, loadDrafts, loadPublished, userId])

  const source = filtered ?? allTravels
  const activeStatusTab = filtered ? activeTab : null
  const loadSource = source.load
  const removeFromSource = source.remove

  // Данные профиля изменились — соседний срез о них не знает и показал бы
  // удалённый или устаревший маршрут. Активный перечитывается тут же, поэтому
  // остаётся отмеченным загруженным.
  const markOtherTabsStale = useCallback(() => {
    loadedTabsRef.current = new Set(activeStatusTab ? [activeStatusTab] : [])
  }, [activeStatusTab])

  const reload = useCallback(async () => {
    markOtherTabsStale()
    await loadSource()
  }, [loadSource, markOtherTabsStale])

  const remove = useCallback(async (travelId: number) => {
    const removed = await removeFromSource(travelId)
    if (!removed) return
    markOtherTabsStale()
    // Срез перечитал сам себя, но счётчики вкладок и «Маршруты» считает общий
    // список — без его перезагрузки они остались бы с удалённым маршрутом.
    if (activeStatusTab) onAfterRemove()
  }, [activeStatusTab, markOtherTabsStale, onAfterRemove, removeFromSource])

  return {
    isFiltered: activeStatusTab !== null,
    travels: source.myTravels,
    isLoading: source.isLoading,
    isLoadingMore: source.isLoadingMore,
    hasMore: source.hasMore,
    error: source.error,
    removingTravelId: source.removingTravelId,
    reload,
    loadMore: source.loadMore,
    remove,
  }
}
