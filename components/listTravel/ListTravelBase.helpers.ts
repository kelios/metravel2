import { useQueryClient } from '@tanstack/react-query'

export const normalizeNamedOptions = (items: unknown): Array<{ id: string; name: string }> => {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => {
      if (typeof item === 'string' || typeof item === 'number') {
        const value = String(item)
        return { id: value, name: value }
      }
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>
        const rawId = record.id
        const rawName = record.name
        if ((typeof rawId === 'string' || typeof rawId === 'number') && typeof rawName === 'string') {
          return { id: String(rawId), name: rawName }
        }
      }
      return null
    })
    .filter((item): item is { id: string; name: string } => item !== null)
}

export const normalizeCountryOptions = (items: unknown): Array<{ country_id?: number; id?: string | number; title_ru?: string; name?: string }> => {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => {
      if (typeof item === 'string' || typeof item === 'number') {
        const value = String(item)
        return {
          id: value,
          name: value,
          title_ru: value,
        } as { country_id?: number; id?: string | number; title_ru?: string; name?: string }
      }
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>
        const countryId = typeof record.country_id === 'number' ? record.country_id : undefined
        const id = typeof record.id === 'string' || typeof record.id === 'number' ? record.id : undefined
        const titleRu = typeof record.title_ru === 'string' ? record.title_ru : undefined
        const name = typeof record.name === 'string' ? record.name : undefined
        if (countryId !== undefined || id !== undefined || titleRu || name) {
          return { country_id: countryId, id, title_ru: titleRu, name } as {
            country_id?: number
            id?: string | number
            title_ru?: string
            name?: string
          }
        }
      }
      return null
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
}

export const removeTravelFromInfiniteTravelsCache = (
  queryClient: Pick<ReturnType<typeof useQueryClient>, 'setQueriesData'>,
  travelId: number
) => {
  queryClient.setQueriesData({ queryKey: ['travels'] }, (oldData: any) => {
    if (!oldData?.pages || !Array.isArray(oldData.pages)) {
      return oldData
    }

    let removed = false
    const pages = oldData.pages.map((page: any) => {
      if (!page || typeof page !== 'object') {
        return page
      }

      const nextPage = { ...page }
      const previousDataLength = Array.isArray(nextPage.data) ? nextPage.data.length : null
      const previousItemsLength = Array.isArray(nextPage.items) ? nextPage.items.length : null

      if (Array.isArray(nextPage.data)) {
        nextPage.data = nextPage.data.filter((item: any) => Number(item?.id) !== travelId)
      }

      if (Array.isArray(nextPage.items)) {
        nextPage.items = nextPage.items.filter((item: any) => Number(item?.id) !== travelId)
      }

      const dataRemoved = previousDataLength !== null && nextPage.data.length !== previousDataLength
      const itemsRemoved = previousItemsLength !== null && nextPage.items.length !== previousItemsLength

      if (!dataRemoved && !itemsRemoved) {
        return page
      }

      removed = true

      if (typeof nextPage.total === 'number') {
        nextPage.total = Math.max(0, nextPage.total - 1)
      } else if (typeof nextPage.total !== 'undefined') {
        const parsedTotal = Number(nextPage.total)
        nextPage.total = Number.isFinite(parsedTotal) ? Math.max(0, parsedTotal - 1) : nextPage.total
      }

      if (typeof nextPage.count === 'number') {
        nextPage.count = Math.max(0, nextPage.count - 1)
      } else if (typeof nextPage.count !== 'undefined') {
        const parsedCount = Number(nextPage.count)
        nextPage.count = Number.isFinite(parsedCount) ? Math.max(0, parsedCount - 1) : nextPage.count
      }

      return nextPage
    })

    if (!removed) {
      return oldData
    }

    return {
      ...oldData,
      pages,
    }
  })
}
