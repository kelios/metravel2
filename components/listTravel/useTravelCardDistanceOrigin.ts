import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

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

function readWebGrantedPosition(): Promise<LatLng | null> {
  if (typeof navigator === 'undefined' || typeof navigator.permissions?.query !== 'function') {
    return Promise.resolve(null)
  }
  if (typeof navigator.geolocation?.getCurrentPosition !== 'function') {
    return Promise.resolve(null)
  }
  return navigator.permissions
    .query({ name: 'geolocation' })
    .then((status) => {
      if (status.state !== 'granted') return null
      return new Promise<LatLng | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            })
          },
          () => resolve(null),
          { maximumAge: 10 * 60 * 1000, timeout: 1500, enableHighAccuracy: false },
        )
      })
    })
    .catch(() => null)
}

async function readNativeGrantedPosition(): Promise<LatLng | null> {
  // Карточка стоит в каждом ряду каталога. В unit-тестах не трогаем нативный
  // модуль геолокации: он либо шумит, либо ждёт разрешение.
  if (process.env.NODE_ENV === 'test') return null
  const Location = await import('expo-location')
  const permission = await Location.getForegroundPermissionsAsync()
  if (permission.status !== 'granted') return null
  const last = await Location.getLastKnownPositionAsync()
  if (!last) return null
  return { lat: last.coords.latitude, lng: last.coords.longitude }
}

let originPromise: Promise<CardDistanceOrigin> | null = null

function loadTravelCardDistanceOrigin(): Promise<CardDistanceOrigin> {
  if (!originPromise) {
    const read = Platform.OS === 'web' ? readWebGrantedPosition() : readNativeGrantedPosition()
    originPromise = read
      .then((point) => (isUsable(point) ? { ...point, kind: 'user' as const } : MINSK_CARD_DISTANCE_ORIGIN))
      .catch(() => MINSK_CARD_DISTANCE_ORIGIN)
  }
  return originPromise
}

/** Точка отсчёта расстояния на карточке. Первый кадр — Минск, чтобы SSR и клиент совпали. */
export function useTravelCardDistanceOrigin(): CardDistanceOrigin {
  const [origin, setOrigin] = useState<CardDistanceOrigin>(MINSK_CARD_DISTANCE_ORIGIN)

  useEffect(() => {
    let live = true
    loadTravelCardDistanceOrigin().then((next) => {
      if (live && next.kind === 'user') setOrigin(next)
    })
    return () => {
      live = false
    }
  }, [])

  return origin
}
