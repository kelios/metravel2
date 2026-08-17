// components/quests/questStepDistance.ts
// Длина перегона до следующей точки квеста и решение «эта точка далеко».
//
// Пороги выбраны по распределению перегонов всех опубликованных квестов
// (прод, 983 пеших перегона в 134 квестах): медиана 204 м, p75 380 м,
// p90 706 м, p95 1024 м. Абсолютный порог 800 м один даёт 83 перегона в 44
// квестах, но метит и маршруты, у которых длинный перегон — норма
// (hel-jurata-amber с медианой 3,5 км, zakopane/karpacz с медианой 0,7–0,9 км):
// там «необязательным» стал бы весь квест. Поэтому порог составной —
// абсолютный И кратность медианному перегону этого же квеста: 38 перегонов в
// 32 квестах (3,9 %), городские 100–350 м не задеваются вовсе.
import { haversineKm } from '@/utils/geo'
import { calculateTravelTime } from '@/utils/distanceCalculator'

import type { QuestRouteMode } from './questRouteGeometry'

export type QuestGeoPoint = {
  id: string
  lat: number
  lng: number
}

/** Перегон, с которого игрока честно предупреждают о расстоянии. */
const LEG_NOTICE_MIN_METERS: Record<QuestRouteMode, number> = { foot: 600, bike: 2000 }

/** Абсолютный пол «очень далеко»: ниже него точка не становится необязательной. */
const FAR_LEG_MIN_METERS: Record<QuestRouteMode, number> = { foot: 800, bike: 3000 }

/** Во сколько раз перегон должен превышать медианный перегон этого квеста. */
const FAR_LEG_MEDIAN_RATIO = 3

export type QuestLegInfo = {
  meters: number
  km: number
  walkMinutes: number
  mode: QuestRouteMode
  /** Перегон стоит показать игроку заранее. */
  notable: boolean
  /** Перегон настолько длинный, что точка за ним становится необязательной. */
  far: boolean
}

const hasCoords = (point: QuestGeoPoint | undefined): point is QuestGeoPoint =>
  !!point &&
  Number.isFinite(point.lat) &&
  Number.isFinite(point.lng) &&
  !(point.lat === 0 && point.lng === 0)

const metersBetween = (from: QuestGeoPoint, to: QuestGeoPoint): number =>
  haversineKm(from.lat, from.lng, to.lat, to.lng) * 1000

/** Медиана перегонов маршрута — характер квеста, а не абсолютная величина. */
export function questMedianLegMeters(points: QuestGeoPoint[]): number {
  const legs: number[] = []
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1]
    const to = points[i]
    if (hasCoords(from) && hasCoords(to)) legs.push(metersBetween(from, to))
  }
  if (!legs.length) return 0
  legs.sort((a, b) => a - b)
  const middle = Math.floor(legs.length / 2)
  return legs.length % 2 === 0 ? (legs[middle - 1] + legs[middle]) / 2 : legs[middle]
}

export function describeQuestLeg(
  meters: number,
  medianMeters: number,
  mode: QuestRouteMode,
): QuestLegInfo {
  const km = meters / 1000
  return {
    meters,
    km,
    walkMinutes: calculateTravelTime(km, mode),
    mode,
    notable: meters >= LEG_NOTICE_MIN_METERS[mode],
    far:
      meters >= FAR_LEG_MIN_METERS[mode] &&
      (medianMeters <= 0 || meters >= medianMeters * FAR_LEG_MEDIAN_RATIO),
  }
}

export type QuestFarStepModel = {
  /** Путь от точки, где игрок стоит, до показанного шага. */
  approach: QuestLegInfo | null
  /** Показанный шаг за длинным перегоном — его можно не проходить. */
  currentIsFar: boolean
  /** Все ещё не отвеченные точки лежат за длинным перегоном. */
  canFinishHere: boolean
  /** Путь от пройденного шага к следующему — предупреждение до выхода. */
  nextLeg: QuestLegInfo | null
}

const EMPTY_MODEL: QuestFarStepModel = {
  approach: null,
  currentIsFar: false,
  canFinishHere: false,
  nextLeg: null,
}

/**
 * Расстояние считается от точки, где игрок реально стоит (последняя отвеченная),
 * а не от предыдущей по порядку: пропустив далёкую точку, он остаётся там же, и
 * следующая за ней точка тоже оказывается за тем же километром.
 */
export function buildQuestFarStepModel(params: {
  points: QuestGeoPoint[]
  answers: Record<string, string>
  currentIndex: number
  medianMeters: number
  mode: QuestRouteMode
}): QuestFarStepModel {
  const { points, answers, currentIndex, medianMeters, mode } = params
  const current = points[currentIndex]
  if (!hasCoords(current)) return EMPTY_MODEL

  let anchor: QuestGeoPoint | null = null
  for (let i = currentIndex - 1; i >= 0; i -= 1) {
    const point = points[i]
    if (hasCoords(point) && answers[point.id]) {
      anchor = point
      break
    }
  }

  const currentAnswered = !!answers[current.id]

  if (currentAnswered) {
    const next = points[currentIndex + 1]
    if (!hasCoords(next) || answers[next.id]) return EMPTY_MODEL
    return {
      ...EMPTY_MODEL,
      nextLeg: describeQuestLeg(metersBetween(current, next), medianMeters, mode),
    }
  }

  if (!anchor) return EMPTY_MODEL

  const approach = describeQuestLeg(metersBetween(anchor, current), medianMeters, mode)
  if (!approach.far) return { ...EMPTY_MODEL, approach }

  const anchorPoint = anchor
  const canFinishHere = points.every((point, index) => {
    if (index === currentIndex || answers[point.id] || !hasCoords(point)) return true
    return describeQuestLeg(metersBetween(anchorPoint, point), medianMeters, mode).far
  })

  return { approach, currentIsFar: true, canFinishHere, nextLeg: null }
}
