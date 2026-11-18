export const CONTENT_UPDATED_AT_FIELD: 'content_updated_at'
export function readTravelContentUpdatedAt(travel: object | null | undefined): string | null
export function readExactPublishedAt(travel: object | null | undefined): string | null
export function readTravelArticleDates(travel: object | null | undefined): {
  datePublished: string | null
  dateModified: string | null
}
