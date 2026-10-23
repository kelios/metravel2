import { useIsFocused } from 'expo-router'

import BecomeAuthorScreen from '@/components/author/BecomeAuthorScreen'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import { useTranslation } from '@/i18n/LocaleProvider'
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo'

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
