import React from 'react'
import Head from 'expo-router/head'

import InstantSEO from '@/components/seo/LazyInstantSEO'

type TravelDetailsSeoBlockProps = {
  backgroundColor: string
  canonicalUrl?: string
  headKey: string
  jsonLd?: Record<string, unknown> | null
  readyDesc: string
  readyImage: string
  readyTitle: string
}

export default function TravelDetailsSeoBlock({
  backgroundColor,
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
        additionalTags={<meta name="theme-color" content={backgroundColor} />}
      />
      {jsonLd && (
        <Head key={`${headKey}-article-jsonld`}>
          <script
            key="travel-article-jsonld"
            id="travel-article-jsonld"
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(jsonLd),
            }}
          />
        </Head>
      )}
    </>
  )
}
