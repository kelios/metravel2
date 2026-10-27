import React, { useMemo } from 'react'
import { useLoaderData } from 'expo-router'
import TravelDetailsContainer from './TravelDetailsContainer'
import { TravelLoaderDataContext, type TravelLoaderPayload } from './travelLoaderData'
import { getTravelDetailsSeoViewModel } from './hooks/travelDetailsContainerViewModel'
import { jsonLdScript } from '@/components/seo/jsonLdScript'
import { TRAVEL_ROUTER_SSR_STYLES } from './travelRouterSsrStyles'
import { buildTravelArticleStructuredData, buildTravelBreadcrumbStructuredData } from '@/utils/travelArticleJsonLd'
import { DEFAULT_LOCALE } from '@/i18n/config'

export default function TravelLoaderScreen() {
  const loaded = useLoaderData() as TravelLoaderPayload
  const payload = useMemo(() => {
    if (!loaded?.serverDescriptionSanitized) return loaded
    return {
      ...loaded,
      travel: {
        ...loaded.travel,
        rich_text: {
          ...loaded.travel.rich_text,
          description: { safe_html: loaded.travel.description, plain_text: '' },
        },
      },
    }
  }, [loaded])
  const structuredData = useMemo(() => {
    if (!payload?.travel) return null
    const seo = getTravelDetailsSeoViewModel(payload.travel, payload.routeKey)
    const faq = payload.faqJsonLd ?? null
    const article = buildTravelArticleStructuredData({
      headline: payload.travel.name,
      description: seo.readyDesc,
      canonical: seo.canonicalUrl,
      image: seo.readyImage,
      travel: payload.travel,
      language: DEFAULT_LOCALE,
    })
    const breadcrumb = buildTravelBreadcrumbStructuredData({ headline: payload.travel.name, canonical: seo.canonicalUrl })
    return { '@context': 'https://schema.org', '@graph': [article, breadcrumb, faq].filter(Boolean) }
  }, [payload])
  return (
    <TravelLoaderDataContext.Provider value={payload}>
      {payload ? <style>{TRAVEL_ROUTER_SSR_STYLES}</style> : null}
      {structuredData ? jsonLdScript(structuredData, { marker: 'travel-article' }) : null}
      <TravelDetailsContainer />
    </TravelLoaderDataContext.Provider>
  )
}
