/**
 * Фильтр карты из ответа `/ai/intent` (#2887): JSON по схеме
 * `scripts/ai-train/osm_filter_schema.json` → что именно применить на `/map`.
 *
 * Чистый модуль без React Native: его читает и строка «Опишите, что ищете»
 * (`components/MapPage/MapIntentRow.tsx`), и тесты маппинга.
 *
 * Категории схемы — это категории слоя POI (`OsmPoiCategory`), а не словарь типов
 * мест фильтра `categoryTravelAddress`, поэтому они идут в
 * `mapUiApi.setOsmPoiCategories`; радиус — в фильтр `radius` ближайшим значением
 * `RADIUS_OPTIONS`; `center.name` геокодится панелью. Ограничения (`constraints`)
 * у карты фильтров не имеют — панель называет их посетителю, а не теряет молча.
 */
import { RADIUS_OPTIONS } from '@/constants/mapConfig'
import { OSM_POI_CATEGORY_IDS, type OsmPoiCategory } from '@/utils/overpass/buildOverpassQuery'

export const MAP_INTENT_CONSTRAINT_KEYS = ['dogs', 'camper', 'kids', 'free'] as const
export type MapIntentConstraint = (typeof MAP_INTENT_CONSTRAINT_KEYS)[number]

/** Ответ службы после нормализации: только известные карте значения. */
export interface MapIntent {
  categories: OsmPoiCategory[]
  radius_km: number | null
  center: { name: string } | null
  constraints: Partial<Record<MapIntentConstraint, boolean>>
}

/** Что панель применяет к карте и показывает чипами «Понял так». */
export interface MapIntentFilters {
  osmCategories: OsmPoiCategory[]
  /** id из `RADIUS_OPTIONS`; `null` — радиус в ответе не было. */
  radius: string | null
  centerName: string | null
  /** Пожелания, под которые у карты нет фильтра (только `true`). */
  unsupportedConstraints: MapIntentConstraint[]
}

const isCategory = (value: unknown): value is OsmPoiCategory =>
  typeof value === 'string' && (OSM_POI_CATEGORY_IDS as readonly string[]).includes(value)

const isConstraint = (value: string): value is MapIntentConstraint =>
  (MAP_INTENT_CONSTRAINT_KEYS as readonly string[]).includes(value)

/**
 * Сырой JSON службы → `MapIntent`; `null` — тело не объект или ни одной категории
 * (неизвестные категории и ограничения отбрасываются, а не роняют ответ).
 */
export function normalizeMapIntent(raw: unknown): MapIntent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const input = raw as Record<string, unknown>
  const categories = Array.isArray(input.categories)
    ? input.categories.filter(isCategory).filter((category, index, all) => all.indexOf(category) === index)
    : []
  if (!categories.length) return null
  const radius = typeof input.radius_km === 'number' && Number.isFinite(input.radius_km) && input.radius_km > 0 ? input.radius_km : null
  const centerRaw = input.center
  const centerName =
    centerRaw && typeof centerRaw === 'object' && typeof (centerRaw as { name?: unknown }).name === 'string'
      ? (centerRaw as { name: string }).name.trim()
      : ''
  const constraints: Partial<Record<MapIntentConstraint, boolean>> = {}
  if (input.constraints && typeof input.constraints === 'object' && !Array.isArray(input.constraints)) {
    for (const [key, value] of Object.entries(input.constraints as Record<string, unknown>)) {
      if (isConstraint(key) && typeof value === 'boolean') constraints[key] = value
    }
  }
  return { categories, radius_km: radius, center: centerName ? { name: centerName } : null, constraints }
}

/** Ближайший радиус карты к значению модели (при равном расстоянии — меньший). */
export function nearestRadiusOption(radiusKm: number, options: ReadonlyArray<{ id: string }> = RADIUS_OPTIONS): string {
  let best = options[0].id
  let bestDistance = Number.POSITIVE_INFINITY
  for (const option of options) {
    const distance = Math.abs(Number(option.id) - radiusKm)
    if (distance < bestDistance) {
      best = option.id
      bestDistance = distance
    }
  }
  return best
}

export function mapIntentToFilters(intent: MapIntent, options: ReadonlyArray<{ id: string }> = RADIUS_OPTIONS): MapIntentFilters {
  return {
    osmCategories: [...intent.categories],
    radius: intent.radius_km === null ? null : nearestRadiusOption(intent.radius_km, options),
    centerName: intent.center?.name ?? null,
    unsupportedConstraints: MAP_INTENT_CONSTRAINT_KEYS.filter((key) => intent.constraints[key] === true),
  }
}
