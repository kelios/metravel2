import { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { usePathname, useIsFocused } from 'expo-router'

import InstantSEO from '@/components/seo/LazyInstantSEO'
import { BOTTOM_DOCK_HEIGHT } from '@/components/layout/bottomDockModel'
import { useResponsive } from '@/hooks/useResponsive'
import { useSafeAreaInsetsSafe } from '@/hooks/useSafeAreaInsetsSafe'
import { useThemedColors } from '@/hooks/useTheme'
import { webTouchScrollStyle } from '@/utils'
import { translate as i18nT } from '@/i18n'


type Colors = ReturnType<typeof useThemedColors>

export interface LegalSection {
  heading?: string
  paragraphs: string[]
}

interface LegalPageProps {
  headKey: string
  seoTitle: string
  seoDescription: string
  /** Заголовок страницы (H1). */
  pageTitle: string
  effectiveDate?: string
  intro?: string[]
  sections: LegalSection[]
}

/** Базовый вертикальный отступ контента; снизу к нему добавляется высота дока. */
const CONTENT_VERTICAL_PADDING = 24

const hiddenWebHeadingStyle = {
  position: 'absolute' as const,
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden' as const,
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap' as const,
  borderWidth: 0,
}

/**
 * Каркас юридической страницы (Disclaimer / Соглашение / Правила).
 * Повторяет структуру app/(tabs)/privacy.tsx, чтобы тексты были консистентны
 * и переиспользуемы между страницами.
 */
export default function LegalPage({
  headKey,
  seoTitle,
  seoDescription,
  pageTitle,
  effectiveDate,
  intro,
  sections,
}: LegalPageProps) {
  const pathname = usePathname()
  const isFocused = useIsFocused()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const { isDesktop } = useResponsive()
  const insets = useSafeAreaInsetsSafe()
  // Док перекрывает низ экрана везде, кроме desktop web — условие повторяет
  // BottomDock. Без компенсации последняя секция уходит под таб-бар (#1277).
  const hasBottomDock = Platform.OS !== 'web' ? true : !isDesktop
  const contentBottomPadding = useMemo(() => {
    if (!hasBottomDock) return CONTENT_VERTICAL_PADDING
    const safeBottom = Platform.OS === 'web' ? 0 : Math.max(0, insets?.bottom ?? 0)
    return CONTENT_VERTICAL_PADDING + BOTTOM_DOCK_HEIGHT + safeBottom
  }, [hasBottomDock, insets?.bottom])
  const { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } = require('@/utils/seo')
  const canonical = buildCanonicalUrl(pathname || '/')

  return (
    <View style={styles.root}>
      {isFocused && (
        <InstantSEO
          headKey={headKey}
          title={seoTitle}
          description={seoDescription}
          canonical={canonical}
          image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
          ogType="website"
        />
      )}
      <ScrollView
        style={webTouchScrollStyle}
        contentContainerStyle={[styles.container, { paddingBottom: contentBottomPadding }]}
        {...(Platform.OS === 'web' ? ({ tabIndex: 0 } as any) : {})}
      >
        {Platform.OS === 'web' && <h1 style={hiddenWebHeadingStyle as any}>{seoTitle}</h1>}
        <Text style={styles.heading}>{pageTitle}</Text>

        {effectiveDate ? (
          <Text style={styles.paragraph}>{i18nT('shared:components.legal.LegalPage.data_vstupleniya_v_silu_32c18af2')}{effectiveDate}</Text>
        ) : null}

        {intro?.map((paragraph, index) => (
          <Text key={`intro-${index}`} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}

        {sections.map((section, sectionIndex) => (
          <View key={`section-${sectionIndex}`}>
            {section.heading ? <Text style={styles.subheading}>{section.heading}</Text> : null}
            {section.paragraphs.map((paragraph, paragraphIndex) => (
              <Text key={`section-${sectionIndex}-p-${paragraphIndex}`} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      paddingHorizontal: 16,
      // Нижний отступ переопределяется инлайном: под доком его надо увеличить
      // на высоту таб-бара, иначе хвост контента недостижим (#1277).
      paddingVertical: CONTENT_VERTICAL_PADDING,
      maxWidth: 900,
      alignSelf: 'center',
    },
    heading: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    subheading: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginTop: 20,
      marginBottom: 8,
    },
    paragraph: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
      marginBottom: 8,
    },
  })
