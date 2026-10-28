import { useEffect, useState } from 'react'

import {
  MINSK_CARD_DISTANCE_ORIGIN,
  type CardDistanceOrigin,
} from './travelCardDecisionMeta'

type LatLng = { lat: number; lng: number }

const isUsable = (point: LatLng | null): point is LatLng =>
  !!point &&
  Number.isFinite(point.lat) &&
  Number.isFinite(point.lng) &&
  point.lat >= -90 &&
  point.lat <= 90 &&
  point.lng >= -180 &&
  point.lng <= 180

let originPromise: Promise<CardDistanceOrigin> | null = null

/** Первый кадр — Минск, чтобы SSR и клиент совпали. Смена только на уже известную точку. */
export function useTravelCardDistanceOriginState(
  readPosition: () => Promise<LatLng | null>,
): CardDistanceOrigin {
  const [origin, setOrigin] = useState<CardDistanceOrigin>(MINSK_CARD_DISTANCE_ORIGIN)

  useEffect(() => {
    let live = true
    if (!originPromise) {
      originPromise = readPosition()
        .then((point) => (isUsable(point) ? { ...point, kind: 'user' as const } : MINSK_CARD_DISTANCE_ORIGIN))
        .catch(() => MINSK_CARD_DISTANCE_ORIGIN)
    }
    originPromise.then((next) => {
      if (live && next.kind === 'user') setOrigin(next)
    })
    return () => {
      live = false
    }
  }, [readPosition])

  return origin
}
