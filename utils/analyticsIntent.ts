/** Local observation of a requested event, independent of provider delivery. */
export const ANALYTICS_INTENT_EVENT = 'metravel:analytics-intent'

export type AnalyticsIntent = {
  name: string
  params: Record<string, unknown>
}
