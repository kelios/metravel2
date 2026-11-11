import { useMemo } from 'react'

import { jsonLdScript } from '@/components/seo/jsonLdScript'
import { buildAppDownloadJsonLd } from '@/utils/appDownloadJsonLd'

type AppDownloadJsonLdProps = { description: string; pageUrl: string }

/** #3231: MobileApplication в серверном HTML /app — тег в теле, как у книги (#2950). */
export default function AppDownloadJsonLd({ description, pageUrl }: AppDownloadJsonLdProps) {
  const data = useMemo(() => buildAppDownloadJsonLd({ description, pageUrl }), [description, pageUrl])
  return jsonLdScript(data, { marker: 'app-download' })
}
