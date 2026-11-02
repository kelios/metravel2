import { useEffect } from 'react'

import { translate as i18nT } from '@/i18n'
import { getTravelStatus, loadTravelStatus, setTravelStatus } from '@/stores/travelStatusStore'
import { consumeGuestPlanIntent } from '@/utils/guestPlanIntent'
import { showToast } from '@/utils/toast'

/**
 * #2898: завершает отложенное «Добавить в план» гостя после входа или
 * регистрации — маршрут попадает в план со статусом «Хочу поехать» (`wishlist`: «Планирую» требует даты) и человек видит
 * тост. Если маршрут уже есть в календаре с любым статусом, ничего не трогаем:
 * выбор пользователя важнее отложенного намерения. Сразу после входа кэш
 * статусов этого пользователя ещё пуст (его грузят только календарь и профиль),
 * поэтому сначала догружаем серверные статусы — иначе upsert затёр бы, например,
 * «Был» на «В плане».
 */
export function useGuestPlanIntentCompletion(isAuthenticated: boolean, userId: string | null | undefined) {
  useEffect(() => {
    if (!isAuthenticated || !userId) return
    let cancelled = false
    void (async () => {
      const intent = await consumeGuestPlanIntent()
      if (!intent || cancelled) return
      // Статусы пользователя ещё не загружены сразу после входа: без серверного
      // списка неизвестно, нет ли у маршрута «Был». Не загрузились — не пишем
      // (редкий сбой сети: потерять отложенное «в план» безопаснее, чем перетереть статус).
      const loaded = await loadTravelStatus(userId)
      if (cancelled || !loaded || getTravelStatus(userId, intent.id)) return
      await setTravelStatus(
        {
          id: intent.id,
          type: 'travel',
          title: intent.title,
          url: intent.url ?? '',
          imageUrl: intent.imageUrl,
          country: intent.country,
          city: intent.city,
          travelYear: intent.travelYear,
          travelMonth: intent.travelMonth,
          travelMonthName: intent.travelMonthName,
          // «Планирую» сервер принимает только с датой (`planned_date is required for
          // planned status`, проверено на проде 02.11.2026) — гость дату не выбирал.
          // Без даты в плане живёт «Хочу поехать»; дату человек добавит в календаре.
          status: 'wishlist',
        },
        userId,
      )
      void showToast({
        type: 'success',
        text1: i18nT('authStatic:authScreen.intentDone.calendar', { title: intent.title }),
        position: 'bottom',
        visibilityTime: 2500,
      })
    })().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, userId])
}
