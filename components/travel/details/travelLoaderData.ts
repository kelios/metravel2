import { createContext, useContext } from 'react'
import type { Travel } from '@/types/types'
import type { TravelLinkGraphResult } from '@/utils/travelLinkGraph'

export type TravelLoaderPayload = {
  travel: Travel
  routeKey: string
  mediaPartial: boolean
  serverDescriptionSanitized: boolean
  /** FAQPage from the author's description before sanitizing strips data-faq/itemprop. */
  faqJsonLd?: Record<string, unknown> | null
  linkGraph?: TravelLinkGraphResult
  /** #3237: соцсети автора из публичного профиля для `author.sameAs`. */
  authorSameAs?: string[]
} | null

export const TravelLoaderDataContext = createContext<TravelLoaderPayload>(null)

export function useTravelLoaderPayload(): TravelLoaderPayload {
  return useContext(TravelLoaderDataContext)
}
