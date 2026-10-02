import { useCallback, useEffect, useRef } from 'react'
import { Platform } from 'react-native'

import { useAuth } from '@/context/AuthContext'
import { useFavorites, type FavoriteItem } from '@/context/FavoritesContext'
import { translate as i18nT } from '@/i18n'
import { useActionFeedback } from '@/hooks/useActionFeedback'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { saveGuestFavoriteIntent } from '@/utils/guestFavoriteIntent'
import { trackFavoriteIntentGuest } from '@/utils/growthFunnelAnalytics'
import { showToast } from '@/utils/toast'

/**
 * Единственный путь к addFavorite/removeFavorite из UI (#2103; guard —
 * __tests__/config/action-feedback-governance.test.ts). Сердечко в каталоге,
 * на карточке места, в списке карты, на странице маршрута и «Хочу поехать» в
 * статье идут через него, поэтому отклик у всех одинаковый: состояние сразу,
 * тост с «Отменить», haptic, анонс для скринридера, лист входа для гостя.
 */

export type FavoriteTarget = {
  id: string | number
  type: FavoriteItem['type']
  title: string
  url: string
  imageUrl?: string
  country?: string
  city?: string
  /** Откуда нажали — для воронки гостевого намерения. */
  source?: string
}

export type FavoriteToggleOutcome = 'success' | 'error' | 'busy' | 'auth' | 'deferred' | 'invalid'

export const favoriteKey = (id: string | number, type: FavoriteItem['type']) => `favorite:${type}:${id}`

export function useFavoriteToggle() {
  const { isAuthenticated, authReady } = useAuth()
  const { isFavorite, addFavorite, removeFavorite } = useFavorites()
  const { requireAuth } = useRequireAuth({ intent: 'favorite' })
  const feedback = useActionFeedback()
  const { run } = feedback

  // Касание до готовности авторизации не теряется: ждёт authReady и повторяется.
  const deferredRef = useRef<FavoriteTarget | null>(null)
  const toggleRef = useRef<(target: FavoriteTarget) => Promise<FavoriteToggleOutcome>>(
    async () => 'invalid',
  )

  const toggle = useCallback(
    async (target: FavoriteTarget): Promise<FavoriteToggleOutcome> => {
      if (authReady === false) {
        deferredRef.current = target
        return 'deferred'
      }

      // Android-гость сохраняет локально (устройство), остальные гости идут на вход.
      const isAndroidGuest = Platform.OS === 'android' && !isAuthenticated
      if (!isAuthenticated && !isAndroidGuest) {
        trackFavoriteIntentGuest({
          itemType: target.type,
          itemId: target.id,
          source: target.source ?? 'favorite_button',
          url: target.url,
        })
        void saveGuestFavoriteIntent({
          id: String(target.id),
          type: target.type,
          title: target.title,
          url: target.url,
          imageUrl: target.imageUrl,
          source: target.source ?? 'favorite_button',
        })
        void showToast({
          type: 'info',
          text1: i18nT('common:feedback.signInToSave'),
          position: 'bottom',
          visibilityTime: 3000,
        })
        requireAuth()
        return 'auth'
      }

      const wasFavorite = isFavorite(target.id, target.type)
      if (!wasFavorite && !target.url) return 'invalid'

      const add = () =>
        addFavorite({
          id: target.id,
          type: target.type,
          title: target.title,
          url: target.url,
          imageUrl: target.imageUrl,
          country: target.country,
          city: target.city,
        })
      const remove = () => removeFavorite(target.id, target.type)

      const message = wasFavorite
        ? isAndroidGuest
          ? i18nT('travel:components.travel.FavoriteButton.udaleno_s_etogo_ustroystva_42b53da4')
          : i18nT('common:feedback.favoriteRemoved')
        : isAndroidGuest
          ? i18nT('travel:components.travel.FavoriteButton.sohraneno_na_etom_ustroystve_cdc5e362')
          : i18nT('common:feedback.favoriteAdded')

      const result = await run({
        key: favoriteKey(target.id, target.type),
        haptic: wasFavorite ? 'light' : 'medium',
        commit: wasFavorite ? remove : add,
        success: {
          message,
          description:
            isAndroidGuest && !wasFavorite
              ? i18nT('travel:components.travel.FavoriteButton.voydite_chtoby_sinhronizirovat_hochu_poehat_f0f4f24d')
              : undefined,
          type: wasFavorite ? 'info' : 'success',
          undo: { commit: wasFavorite ? add : remove },
        },
        error: { message: i18nT('common:feedback.favoriteError') },
      })
      return result.status
    },
    [addFavorite, authReady, isAuthenticated, isFavorite, removeFavorite, requireAuth, run],
  )

  toggleRef.current = toggle

  useEffect(() => {
    if (authReady === false || !deferredRef.current) return
    const target = deferredRef.current
    deferredRef.current = null
    void toggleRef.current(target)
  }, [authReady])

  return { toggle, isFavorite, pending: feedback.pending, isPending: feedback.isPending }
}
