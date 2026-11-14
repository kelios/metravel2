/**
 * Климатические нормы для признака сезона (#3357, решение G): NASA POWER, API климатологии — без
 * учётной записи и ключа. Данные проекта POWER (источник — реанализ MERRA-2, сетка 0,5° × 0,625°)
 * распространяются без ограничений на использование, с просьбой ссылаться на проект:
 * https://registry.opendata.aws/nasa-power/ (поле License), общая политика данных NASA —
 * https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance.
 *
 * Ответ точки несёт среднюю высоту ячейки сетки: температура приводится к высоте маршрута в `season.ts`.
 * Запрос идёт по центру ячейки — соседние точки маршрута и разные маршруты одной долины делят один ответ.
 */
import path from 'node:path'

import { fetchCached, type NetStats } from './net.ts'

export const POWER_ENDPOINT = 'https://power.larc.nasa.gov/api/temporal/climatology/point'
export const POWER_PAUSE_MS = 1000
/** Шаг сетки MERRA-2 по широте и долготе, градусы. */
export const POWER_GRID = { lat: 0.5, lon: 0.625 } as const

const MONTH_KEYS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const

export interface ClimateNormals {
  /** Центр ячейки сетки. */
  lat: number
  lon: number
  /** Средняя высота ячейки над уровнем моря, м. */
  elevation_m: number
  /** Средняя температура воздуха на 2 м по месяцам, °C (январь — первый). */
  t2m: number[]
  /** Осадки по месяцам, мм в сутки. */
  precip_mm_day: number[]
  /** Период норм, как его называет ответ службы. */
  period: string
}

/** Центр ячейки сетки, в которую попадает точка. */
export function gridCell(lat: number, lon: number): { lat: number; lon: number } {
  const snap = (value: number, step: number): number => Math.round((Math.round(value / step) * step) * 1000) / 1000
  return { lat: Math.max(-90, Math.min(90, snap(lat, POWER_GRID.lat))), lon: snap(lon, POWER_GRID.lon) }
}

interface PowerResponse {
  geometry?: { coordinates?: number[] }
  properties?: { parameter?: Record<string, Record<string, number>> }
  header?: { range?: string; fill_value?: number }
}

/** Разбор ответа службы; `null` — в ответе нет высоты или хотя бы одного месяца (значение-заглушка −999). */
export function parseNormals(body: string, cell: { lat: number; lon: number }): ClimateNormals | null {
  const parsed = JSON.parse(body) as PowerResponse
  const fill = parsed.header?.fill_value ?? -999
  const series = (name: string): number[] | null => {
    const values = MONTH_KEYS.map((key) => parsed.properties?.parameter?.[name]?.[key])
    return values.every((value): value is number => typeof value === 'number' && Number.isFinite(value) && value !== fill) ? values : null
  }
  const elevation = parsed.geometry?.coordinates?.[2]
  const t2m = series('T2M')
  const precip = series('PRECTOTCORR')
  if (typeof elevation !== 'number' || !Number.isFinite(elevation) || elevation === fill || !t2m || !precip) return null
  return { ...cell, elevation_m: elevation, t2m, precip_mm_day: precip, period: parsed.header?.range ?? '' }
}

export interface ClimateFetch {
  rawDir: string
  stats?: NetStats
  log?: (line: string) => void
}

export async function fetchNormals(lat: number, lon: number, options: ClimateFetch): Promise<ClimateNormals | null> {
  const cell = gridCell(lat, lon)
  const query = new URLSearchParams({ parameters: 'T2M,PRECTOTCORR', community: 'AG', latitude: String(cell.lat), longitude: String(cell.lon), format: 'JSON' })
  const body = await fetchCached(`${POWER_ENDPOINT}?${query}`, {
    cacheFile: path.join(options.rawDir, 'climate', `power-${cell.lat}_${cell.lon}.json`),
    pauseMs: POWER_PAUSE_MS,
    stats: options.stats,
    log: options.log,
  })
  return body ? parseNormals(body.toString('utf8'), cell) : null
}
