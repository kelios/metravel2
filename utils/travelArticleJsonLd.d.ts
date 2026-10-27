export type TravelArticleStructuredDataInput = {
  headline: string
  description?: string | null
  canonical?: string | null
  /** Image URL is normalized by the caller's shared social-preview helper. */
  image?: string | null
  /** Editorial content language, independent of the reader's interface locale. */
  language?: string
  travel?: unknown
}
export function buildTravelArticleStructuredData(input: TravelArticleStructuredDataInput): Record<string, unknown> | null
export function buildTravelBreadcrumbStructuredData(input: Pick<TravelArticleStructuredDataInput, 'headline' | 'canonical'>): Record<string, unknown> | null
