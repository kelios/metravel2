import { stringifyJsonLd } from '@/utils/jsonLd'

type JsonLdScriptOptions = {
  key?: string
  id?: string
}

/**
 * JSON-LD tag for expo-router/head. Helmet reads script innerHTML only from a
 * string child; dangerouslySetInnerHTML is dropped (SEO-JSONLD-HEAD-DROP-001).
 */
export function jsonLdScript(data: unknown, options?: JsonLdScriptOptions) {
  return (
    <script key={options?.key} id={options?.id} type="application/ld+json">
      {stringifyJsonLd(data)}
    </script>
  )
}
