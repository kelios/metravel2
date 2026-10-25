import { useIsFocused } from 'expo-router'

import BecomeAuthorScreen from '@/components/author/BecomeAuthorScreen'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import { useTranslation } from '@/i18n/LocaleProvider'
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo'
import { staticRouteMetadata } from '@/utils/seoRoutes/routeMetadata'

export default function BecomeAuthorRoute() {
  const isFocused = useIsFocused()
  const { t } = useTranslation()

  return (
    <>
      {isFocused && (
        <InstantSEO
          headKey="become-author"
          title={t('seoStatic:root.becomeAuthor.title')}
          description={t('seoStatic:root.becomeAuthor.description')}
          canonical={buildCanonicalUrl('/become-author')}
          image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
          ogType="website"
          robots="index, follow"
        />
      )}
      <BecomeAuthorScreen />
    </>
  )
}

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); значения — общая таблица
// utils/seoRoutes/staticRoutes.js, та же, что у SSG-генератора.
export function generateMetadata() {
  return staticRouteMetadata('/become-author')
}
