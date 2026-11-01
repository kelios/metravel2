import { useEffect, useState } from 'react'

import { useLocaleRevision } from '@/i18n/useLocaleRevision'
import { getLoadedAdventOverlay, loadAdventOverlay } from '@/services/advent/campaignOverlay'
import type { AdventCampaignOverlay } from '@/types/advent'

/**
 * Переводы контента дверец для активной локали (#2883). Пока чанк не загружен —
 * `null`, и экран показывает RU-источник (совпадает со статическим HTML).
 */
export function useAdventContentOverlay(enabled = true): AdventCampaignOverlay | null {
  const activeLocale = useLocaleRevision()
  // Счётчикам (карточка профиля) переводы не нужны — чанк накладки не грузится.
  const locale = enabled ? activeLocale : 'ru'
  const [state, setState] = useState<{ locale: string; overlay: AdventCampaignOverlay | null }>(() => ({
    locale,
    overlay: getLoadedAdventOverlay(locale) ?? null,
  }))

  useEffect(() => {
    const ready = getLoadedAdventOverlay(locale)
    if (ready !== undefined) {
      setState((previous) => (previous.locale === locale && previous.overlay === ready ? previous : { locale, overlay: ready }))
      return undefined
    }
    let alive = true
    void loadAdventOverlay(locale).then((overlay) => {
      if (alive) setState({ locale, overlay })
    })
    return () => {
      alive = false
    }
  }, [locale])

  return state.locale === locale ? state.overlay : (getLoadedAdventOverlay(locale) ?? null)
}
