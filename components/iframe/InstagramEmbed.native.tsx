import React, { useCallback, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
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
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const target = useMemo(() => resolveInstagramTarget(url), [url])

  const openInInstagram = useCallback(() => {
    if (target) void openExternalUrl(target.canonicalUrl)
  }, [target])

  if (!target) return null

  return (
    <View style={styles.frame}>
      <Pressable
        testID="travel-instagram-link-card"
        onPress={openInInstagram}
        accessibilityRole="link"
        accessibilityLabel={target.subtitle}
        style={styles.card}
      >
        <Text style={styles.eyebrow}>Instagram</Text>
        <Text style={styles.title}>{target.title}</Text>
        <Text style={styles.caption}>{target.subtitle}</Text>
      </Pressable>
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    frame: {
      width: '100%',
      maxWidth: 430,
      minHeight: 96,
      alignSelf: 'center',
      marginVertical: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    card: {
      paddingHorizontal: 18,
      paddingVertical: DESIGN_TOKENS.spacing.md,
      gap: DESIGN_TOKENS.spacing.xs,
      justifyContent: 'center',
    },
    eyebrow: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.textMuted,
    },
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      fontWeight: '600',
      color: colors.primaryText,
    },
    caption: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
    },
  })

export default React.memo(InstagramEmbed)
