import React, { useMemo } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

export type ExternalContentLinkCardProps = {
  testID: string
  /** Источник контента: бренд или домен (`Instagram`, `belkraj.by`). */
  eyebrow: string
  title: string
  /** Что произойдёт по нажатию — читает и VoiceOver/TalkBack как подпись ссылки. */
  caption: string
  onPress: () => void
}

/**
 * Карточка-ссылка вместо стороннего веб-контента в native-приложении (#2135, App
 * Review 5.1.2(i)). Чужая страница с cookie-согласием, тег-менеджером или
 * рекламными пикселями не грузится в WebView приложения — пользователь
 * открывает её во внешнем браузере или приложении сервиса. Обработчик
 * `onPress` вызывающий берёт из `utils/externalLinks.ts`.
 *
 * Карточка занимает ширину родителя и сама держит высоту зоны нажатия
 * (`minHeight: 96`); ширину и отступы задаёт контейнер вызывающего, а не `style`
 * карточки.
 */
function ExternalContentLinkCard({ testID, eyebrow, title, caption, onPress }: ExternalContentLinkCardProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={caption}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.caption}>{caption}</Text>
    </Pressable>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    card: {
      width: '100%',
      minHeight: 96,
      paddingHorizontal: 18,
      paddingVertical: DESIGN_TOKENS.spacing.md,
      gap: DESIGN_TOKENS.spacing.xs,
      justifyContent: 'center',
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    cardPressed: {
      opacity: 0.85,
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

export default React.memo(ExternalContentLinkCard)
