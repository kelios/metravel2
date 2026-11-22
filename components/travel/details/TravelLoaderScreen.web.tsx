import React, { useMemo } from 'react'
import { useLoaderData } from 'expo-router'
import TravelDetailsContainer from './TravelDetailsContainer'
import { TravelLoaderDataContext, type TravelLoaderPayload } from './travelLoaderData'
import { getTravelDetailsSeoMetadata } from './hooks/travelDetailsContainerViewModel'
import { jsonLdScript } from '@/components/seo/jsonLdScript'
import { buildTravelArticleStructuredData, buildTravelBreadcrumbStructuredData } from '@/utils/travelArticleJsonLd'
import { DEFAULT_LOCALE } from '@/i18n/config'

function TravelArticleJsonLd({ payload }: { payload: NonNullable<TravelLoaderPayload> }) {
  const seo = getTravelDetailsSeoMetadata(payload.travel, payload.routeKey)
  const faq = payload.faqJsonLd ?? null
  const article = buildTravelArticleStructuredData({
    headline: payload.travel.name,
    description: seo.readyDesc,
    canonical: seo.canonicalUrl,
    image: seo.readyImage,
    travel: payload.travel,
    language: DEFAULT_LOCALE,
    authorSameAs: payload.authorSameAs,
  })
  const breadcrumb = buildTravelBreadcrumbStructuredData({ headline: payload.travel.name, canonical: seo.canonicalUrl })
  const structuredData = { '@context': 'https://schema.org', '@graph': [article, breadcrumb, faq].filter(Boolean) }
  return jsonLdScript(structuredData, { marker: 'travel-article' })
}

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
  // Keep the server's JSON-LD script available to crawlers while a tap first
  // hydrates the article. Only a new loader payload changes the metadata.
  const structuredData = useMemo(() => payload?.travel ? (
    <React.Suspense fallback={null}>
      <TravelArticleJsonLd payload={payload} />
    </React.Suspense>
  ) : null, [payload])
  return (
    <TravelLoaderDataContext.Provider value={payload}>
      {structuredData}
      <TravelDetailsContainer />
    </TravelLoaderDataContext.Provider>
  )
}
