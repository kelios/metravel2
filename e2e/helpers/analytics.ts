import type { Page } from '@playwright/test'
import { ANALYTICS_INTENT_EVENT, type AnalyticsIntent } from '../../utils/analyticsIntent'

const COLLECTION_KEY = '__metravelAnalyticsIntents'

/** Install before navigation. This observes intent and never enables counters. */
export async function installAnalyticsIntentRecorder(page: Page): Promise<void> {
  await page.addInitScript(({ eventName, key }) => {
    const w = window as unknown as Record<string, unknown>
    if (Array.isArray(w[key])) return
    const events: AnalyticsIntent[] = []
    w[key] = events
    window.addEventListener(eventName, (event) => {
      const intent = (event as CustomEvent<AnalyticsIntent>).detail
      if (typeof intent?.name !== 'string' || !intent.params || typeof intent.params !== 'object') return
      events.push({ name: intent.name, params: { ...intent.params } })
    })
  }, { eventName: ANALYTICS_INTENT_EVENT, key: COLLECTION_KEY })
}

export async function readAnalyticsIntents(page: Page, name: string): Promise<AnalyticsIntent[]> {
  return page.evaluate(({ key, eventName }) => {
    const events = (window as unknown as Record<string, unknown>)[key]
    if (!Array.isArray(events)) throw new Error('Analytics intent recorder was not installed before navigation')
    return (events as AnalyticsIntent[]).filter((event) => event.name === eventName)
  }, { key: COLLECTION_KEY, eventName: name })
}
