import Head from 'expo-router/head'

import InstantSEO from '@/components/seo/LazyInstantSEO'
import { stringifyJsonLd } from '@/utils/jsonLd'

type TravelDetailsSeoBlockProps = {
  canonicalUrl?: string
  headKey: string
  jsonLd?: Record<string, unknown> | null
  readyDesc: string
  readyImage: string
  readyTitle: string
}

export default function TravelDetailsSeoBlock({
  canonicalUrl,
  headKey,
  jsonLd,
  readyDesc,
  readyImage,
  readyTitle,
}: TravelDetailsSeoBlockProps) {
  return (
    <>
      <InstantSEO
        headKey={headKey}
        title={readyTitle}
        description={readyDesc}
        canonical={canonicalUrl}
        image={readyImage}
        imageAlt={readyTitle}
        imageWidth={readyImage ? 1200 : undefined}
        imageHeight={readyImage ? 630 : undefined}
        ogType="article"
      />
      {jsonLd && (
        <Head key={`${headKey}-article-jsonld`}>
          <script
            key="travel-article-jsonld"
            id="travel-article-jsonld"
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: stringifyJsonLd(jsonLd),
            }}
          />
        </Head>
      )}
    </>
  )
}
