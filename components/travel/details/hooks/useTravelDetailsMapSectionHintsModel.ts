import { useMemo } from 'react'

import type { Travel } from '@/types/types'
import { translate as i18nT } from '@/i18n'


export function useTravelDetailsMapSectionHintsModel(travel: Travel) {
  const hasEmbeddedCoords = (travel.coordsMeTravel?.length ?? 0) > 0
  const hasTravelAddressPoints = (travel.travelAddress?.length ?? 0) > 0

  const placeHints = useMemo(() => {
    const points = Array.isArray(travel?.travelAddress) ? travel.travelAddress : []
    return points
      .map((point: any) => {
        const coord = String(point?.coord ?? '').trim()
        if (!coord) return null
        const name = String(point?.name ?? point?.address ?? '').trim()
        if (!name) return null
        return { name, coord }
      })
      .filter((item): item is { name: string; coord: string } => Boolean(item))
  }, [travel?.travelAddress])

  const transportHints = useMemo(() => {
    const raw =
      (travel as any)?.transports ??
      (travel as any)?.transportsTravel ??
      (travel as any)?.transportMode ??
      null
    const values = Array.isArray(raw) ? raw : raw != null ? [raw] : []
    const includesLocalizedToken = (token: string, key: Parameters<typeof i18nT>[0]) =>
      i18nT(key)
        .split('|')
        .map((part) => part.trim().toLocaleLowerCase())
        .filter(Boolean)
        .some((part) => token.includes(part))
    const labels = values
      .map((value) => String(value ?? '').toLowerCase().trim())
      .map((token) => {
        if (!token) return ''
        if (token.includes('car') || includesLocalizedToken(token, 'travel:components.travel.details.hooks.useTravelDetailsMapSectionHintsModel.carTokens')) return i18nT('travel:components.travel.details.hooks.useTravelDetailsMapSectionHintsModel.mashina_f182c544')
        if (token.includes('bike') || includesLocalizedToken(token, 'travel:components.travel.details.hooks.useTravelDetailsMapSectionHintsModel.bikeTokens')) return i18nT('travel:components.travel.details.hooks.useTravelDetailsMapSectionHintsModel.velosiped_6b66f61b')
        if (token.includes('foot') || token.includes('walk') || includesLocalizedToken(token, 'travel:components.travel.details.hooks.useTravelDetailsMapSectionHintsModel.walkTokens')) return i18nT('travel:components.travel.details.hooks.useTravelDetailsMapSectionHintsModel.peshkom_7ac67a67')
        return String(token).charAt(0).toUpperCase() + String(token).slice(1)
      })
      .filter(Boolean)

    return Array.from(new Set(labels))
  }, [travel])

  return {
    hasEmbeddedCoords,
    hasTravelAddressPoints,
    placeHints,
    transportHints,
  }
}
