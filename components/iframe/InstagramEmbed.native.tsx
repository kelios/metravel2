import React, { useCallback, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import ExternalContentLinkCard from '@/components/ui/ExternalContentLinkCard'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { openExternalUrl } from '@/utils/externalLinks'
import { resolveInstagramTarget } from '@/utils/instagramRichText'

interface InstagramEmbedProps {
  url: string
}

/**
 * Instagram-пост внутри native rich-text — карточка-ссылка, без WebView (#2135).
 *
 * Встроенная страница `instagram.com/…/embed/` — код Meta внутри приложения: она
 * несёт собственное cookie-согласие (`shouldShowCookieBanner`,
 * `should_show_consent_dialog` в ответе для EU) и логирование рекламной компании.
 * В приложении без cookies согласие не сохраняется и всплывало бы на каждом
 * посте, а cookie-запрос веб-контента App Review считает трекингом без ATT
 * (5.1.2(i)). Поэтому пост открывается в приложении Instagram или системном
 * браузере тем же текстом, что и web-facade; web (`buildInstagramFacadeHtml`) не
 * меняется.
 */
const InstagramEmbed: React.FC<InstagramEmbedProps> = ({ url }) => {
  const target = useMemo(() => resolveInstagramTarget(url), [url])

  const openInInstagram = useCallback(() => {
    if (target) void openExternalUrl(target.canonicalUrl)
  }, [target])

  if (!target) return null

  return (
    <View style={styles.frame}>
      <ExternalContentLinkCard
        testID="travel-instagram-link-card"
        eyebrow="Instagram"
        title={target.title}
        caption={target.subtitle}
        onPress={openInInstagram}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    marginVertical: DESIGN_TOKENS.spacing.md,
  },
})

export default React.memo(InstagramEmbed)
