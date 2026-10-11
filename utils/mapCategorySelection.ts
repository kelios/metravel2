export type MapCategoryDictionaryState = 'loading' | 'ready' | 'error'

export interface MapCategoryOption {
  id: string | number
  name: string
}

export interface MapCategorySelection {
  /** Registered names replace URL IDs; unregistered tokens stay available. */
  tokens: string[]
  ids: number[]
  localNames: string[]
  unresolvedTokens: string[]
  hasSelection: boolean
  hasCompleteCoverage: boolean
}

const categoryKey = (value: string): string => value.trim().toLowerCase()
// Preserve the full selection locally when the existing radius transport's
// 50-category limit cannot represent it; never send a truncated OR subset.
const MAX_SERVER_CATEGORY_IDS = 50

const registeredId = (value: string | number): number | null => {
  if (!/^\d+$/.test(String(value).trim())) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/** One selection contract for radius, clusters, route and the offline index. */
export function resolveMapCategorySelection(
  selected: readonly string[] | null | undefined,
  dictionary: readonly MapCategoryOption[] = [],
  state: MapCategoryDictionaryState = 'ready',
): MapCategorySelection {
  const byName = new Map<string, MapCategoryOption>()
  const byId = new Map<number, MapCategoryOption>()
  for (const category of dictionary) {
    if (!category?.name?.trim()) continue
    byName.set(categoryKey(category.name), category)
    const id = registeredId(category.id)
    if (id !== null) byId.set(id, category)
  }

  const tokens: string[] = []
  const localNames: string[] = []
  const ids = new Set<number>()
  const unresolvedTokens: string[] = []
  const seen = new Set<string>()
  for (const raw of selected ?? []) {
    const token = String(raw ?? '').trim()
    if (!token) continue
    const numericId = registeredId(token)
    const match = (numericId === null ? undefined : byId.get(numericId)) ?? byName.get(categoryKey(token))
    const name = match?.name.trim() || token
    const key = categoryKey(name)
    if (seen.has(key)) continue
    seen.add(key)
    tokens.push(name)
    localNames.push(name)
    const id = match ? registeredId(match.id) : null
    if (id === null) unresolvedTokens.push(token)
    else ids.add(id)
  }

  return {
    tokens,
    ids: [...ids],
    localNames,
    unresolvedTokens,
    hasSelection: tokens.length > 0,
    hasCompleteCoverage: state === 'ready' && unresolvedTokens.length === 0 && ids.size <= MAX_SERVER_CATEGORY_IDS,
  }
}

/** Preserve the full OR selection when no endpoint can apply every member. */
export function filterMapPointsByCategory<T extends { categoryName?: string }>(
  points: T[],
  selection: MapCategorySelection,
): T[] {
  if (!selection.hasSelection) return points
  const names = new Set(selection.localNames.map(categoryKey))
  return points.filter((point) =>
    String(point.categoryName ?? '').split(',').some((name) => names.has(categoryKey(name))),
  )
}
