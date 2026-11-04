import type { StorageValue } from 'zustand/middleware'

export type ListDensity = 'comfortable' | 'compact'
export type PersistedListView = { density: ListDensity }

export const DEFAULT_LIST_DENSITY: ListDensity = 'comfortable'
export const LIST_VIEW_PERSISTENCE = { name: 'list-view-storage', version: 0 }

export function hasDefaultListDensity(storage: Pick<Storage, 'getItem'>): boolean {
  const raw = storage.getItem(LIST_VIEW_PERSISTENCE.name)
  if (raw === null) return true

  const value: StorageValue<PersistedListView> | null = JSON.parse(raw)
  return value?.version === LIST_VIEW_PERSISTENCE.version &&
    value.state?.density === DEFAULT_LIST_DENSITY &&
    Object.keys(value.state).length === 1
}
