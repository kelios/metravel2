import { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { usePathname, useIsFocused } from 'expo-router'

import InstantSEO from '@/components/seo/LazyInstantSEO'
import { useThemedColors } from '@/hooks/useTheme'
import { webTouchScrollStyle } from '@/utils'

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
  /** Пометка о том, что финальные формулировки на юр-проверке (owner). */
  draftNotice?: boolean
}

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
  draftNotice,
}: LegalPageProps) {
  const pathname = usePathname()
  const isFocused = useIsFocused()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
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
      <ScrollView style={webTouchScrollStyle} contentContainerStyle={styles.container}>
        {Platform.OS === 'web' && <h1 style={hiddenWebHeadingStyle as any}>{seoTitle}</h1>}
        <Text style={styles.heading}>{pageTitle}</Text>

        {effectiveDate ? (
          <Text style={styles.paragraph}>Дата вступления в силу: {effectiveDate}</Text>
        ) : null}

        {draftNotice ? (
          <View style={styles.draftBox}>
            <Text style={styles.draftText}>
              Предварительная редакция. Финальные формулировки проходят юридическую проверку и
              могут быть уточнены.
            </Text>
          </View>
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
      paddingVertical: 24,
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
    draftBox: {
      marginTop: 4,
      marginBottom: 12,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.warning,
      backgroundColor: colors.surfaceMuted,
    },
    draftText: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.text,
    },
  })
