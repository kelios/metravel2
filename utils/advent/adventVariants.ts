// Региональные варианты дверцы адвента (#3486): «Беларусь» и «Польша».
// Вариант подменяет подарок и задание, а день, дата, награда и зачёт остаются
// общими — дверца засчитывается любым вариантом.
import type { AdventDoor, AdventDoorVariant, AdventRegion } from '@/types/advent'

export const ADVENT_REGIONS: readonly AdventRegion[] = ['by', 'pl']

export const isAdventRegion = (value: unknown): value is AdventRegion => value === 'by' || value === 'pl'

/** Регион по умолчанию до первого выбора: польский интерфейс — Польша, остальные — Беларусь. */
export const defaultAdventRegion = (locale: string | null | undefined): AdventRegion =>
  String(locale || '').toLowerCase().startsWith('pl') ? 'pl' : 'by'

/**
 * Вариант, который можно показать. Серверный payload проверяется по минимуму
 * (`isValidAdventCampaign`), и битый вариант уронил бы лист на `gift.title`.
 */
const isRenderableVariant = (variant: AdventDoorVariant | null | undefined): variant is AdventDoorVariant =>
  !!variant &&
  isAdventRegion(variant.region) &&
  typeof variant.gift?.title === 'string' &&
  typeof variant.gift.text === 'string' &&
  typeof variant.task?.type === 'string' &&
  typeof variant.task.text === 'string'

/** Регионы, между которыми можно переключаться в этой дверце; пусто — переключателя нет. */
export function adventDoorRegions(door: AdventDoor): AdventRegion[] {
  if (!isAdventRegion(door.region) || !Array.isArray(door.variants)) return []
  const regions = [door.region, ...door.variants.filter(isRenderableVariant).map((variant) => variant.region)]
  const unique = ADVENT_REGIONS.filter((region) => regions.includes(region))
  return unique.length > 1 ? unique : []
}

/**
 * Дверца глазами выбранного региона: подарок и задание варианта, остальное — общее.
 * Без вариантов или без совпадения возвращает ту же дверцу.
 */
export function resolveAdventDoor<T extends AdventDoor>(door: T, region: AdventRegion): T {
  if (!isAdventRegion(door.region) || !Array.isArray(door.variants) || door.region === region) return door
  const variant = door.variants.find((item) => isRenderableVariant(item) && item.region === region)
  if (!variant) return door
  // Серверный зачёт — правило дверцы, а не варианта: бэкенд помечает только основное
  // задание, а собственный флаг варианта (нормализатор его не видит) не учитывается.
  const { serverCredited: _ignored, ...variantTask } = variant.task
  const task = door.task.serverCredited === true ? { ...variantTask, serverCredited: true } : variantTask
  return { ...door, gift: variant.gift, task, region: variant.region }
}
