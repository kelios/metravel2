import { memo, useCallback, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { ResponsiveContainer } from '@/components/layout'
import { useThemedColors } from '@/hooks/useTheme'
import { useResponsive } from '@/hooks/useResponsive'
import { translate as i18nT } from '@/i18n'


const IS_WEB = Platform.OS === 'web'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

type FaqItem = { q: string; a: string }

const FAQ_ITEMS: readonly FaqItem[] = [
  {
    get q() { return i18nT('homeStatic:faq.free.question') },
    get a() { return i18nT('homeStatic:faq.free.answer') },
  },
  {
    get q() { return i18nT('homeStatic:faq.registration.question') },
    get a() { return i18nT('homeStatic:faq.registration.answer') },
  },
  {
    get q() { return i18nT('homeStatic:faq.book.question') },
    get a() { return i18nT('homeStatic:faq.book.answer') },
  },
  {
    get q() { return i18nT('homeStatic:faq.privacy.question') },
    get a() { return i18nT('homeStatic:faq.privacy.answer') },
  },
  {
    get q() { return i18nT('homeStatic:faq.print.question') },
    get a() { return i18nT('homeStatic:faq.print.answer') },
  },
]

function FAQItemCard({
  colors,
  index,
  isOpen,
  item,
  onToggle,
  styles,
}: {
  colors: ReturnType<typeof useThemedColors>
  index: number
  isOpen: boolean
  item: FaqItem
  onToggle: () => void
  styles: Record<string, any>
}) {
  return (
    <View style={[styles.item, isOpen && styles.itemOpen]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={item.q}
        accessibilityState={{ expanded: isOpen }}
        accessibilityHint={isOpen ? i18nT('home:components.home.HomeFAQSection.svernut_otvet_defd85e4') : i18nT('home:components.home.HomeFAQSection.razvernut_otvet_e5327dd9')}
        {...(IS_WEB
          ? ({
              'aria-expanded': isOpen,
              'aria-controls': `faq-answer-${index}`,
              id: `faq-question-${index}`,
            } as any)
          : {})}
        style={({ pressed, hovered, focused }: any) => [
          styles.itemHeader,
          isOpen && styles.itemHeaderOpen,
          IS_WEB && !isOpen && (pressed || hovered) && styles.itemHeaderHover,
          IS_WEB && focused && styles.itemHeaderFocused,
        ]}
      >
        <View style={styles.questionWrap}>
          <View style={styles.questionMetaRow}>
            <Text style={styles.questionMeta}>{i18nT('home:components.home.HomeFAQSection.vopros_8958223d')}{index + 1}</Text>
          </View>
          <Text style={[styles.question, isOpen && styles.questionOpen]}>{item.q}</Text>
        </View>
        <View style={[styles.toggleWrap, isOpen && styles.toggleWrapOpen]}>
          <Feather
            name={isOpen ? 'minus' : 'plus'}
            size={16}
            color={isOpen ? colors.textOnPrimary : colors.textMuted}
          />
        </View>
      </Pressable>

      {IS_WEB ? (
        <View
          style={[styles.answerWrap, !isOpen && styles.answerWrapCollapsed]}
          {...({
            id: `faq-answer-${index}`,
            role: 'region',
            'aria-labelledby': `faq-question-${index}`,
            'aria-hidden': !isOpen,
          } as any)}
        >
          <Text style={styles.answer}>{item.a}</Text>
        </View>
      ) : (
        isOpen && (
          <View style={styles.answerWrap}>
            <Text style={styles.answer}>{item.a}</Text>
          </View>
        )
      )}
    </View>
  )
}

function HomeFAQSection() {
  const colors = useThemedColors()
  const { isSmallPhone, isPhone } = useResponsive()
  const isMobile = isSmallPhone || isPhone

  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const toggleItem = useCallback((idx: number) => {
    if (!IS_WEB) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    }
    setOpenIndex((prev) => (prev === idx ? null : idx))
  }, [])

  const styles = useMemo(() => createStyles(colors, isMobile), [colors, isMobile])

  return (
    <View style={styles.band} testID="home-faq">
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.header}>
          <View style={styles.eyebrow}>
            <Feather
              name="help-circle"
              size={14}
              color={colors.primaryDark}
              {...({ 'aria-hidden': true, focusable: false } as any)}
            />
            <Text style={styles.eyebrowText}>{i18nT('home:components.home.HomeFAQSection.faq_c6699415')}</Text>
          </View>
          <Text style={styles.title} accessibilityRole="header" {...({ 'aria-level': 2 } as any)}>
            {i18nT('home:components.home.HomeFAQSection.vse_chto_nuzhno_znat_396085b8')}</Text>
          <Text style={styles.subtitle}>{i18nT('home:components.home.HomeFAQSection.otvety_na_samye_chastye_voprosy_o_servise_89a8f45a')}</Text>
        </View>

        <View style={styles.inner}>
          <View style={styles.list}>
            {FAQ_ITEMS.map((item, idx) => (
              <FAQItemCard
                key={item.q}
                colors={colors}
                index={idx}
                isOpen={openIndex === idx}
                item={item}
                onToggle={() => toggleItem(idx)}
                styles={styles}
              />
            ))}
          </View>
        </View>
      </ResponsiveContainer>
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>, isMobile: boolean) =>
  StyleSheet.create({
    band: {
      width: '100%',
      alignSelf: 'stretch',
      paddingTop: isMobile ? 36 : 64,
      paddingBottom: isMobile ? 32 : 56,
      backgroundColor: colors.backgroundSecondary,
      ...Platform.select({
        web: {
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.borderLight,
          backgroundImage: `linear-gradient(180deg, ${colors.background} 0%, ${colors.backgroundSecondary} 30%)`,
        },
      }),
    },
    inner: { maxWidth: 680, alignSelf: 'center', width: '100%' },
    header: { alignItems: 'center', marginBottom: isMobile ? 24 : 40, gap: 10 },
    eyebrow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: DESIGN_TOKENS.radii.full,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      paddingHorizontal: 14,
      paddingVertical: 6,
      ...Platform.select({ web: { boxShadow: `0 1px 6px ${colors.primary}14` } }),
    },
    eyebrowText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primaryText,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: isMobile ? 24 : 38,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: isMobile ? -0.6 : -1.0,
      textAlign: 'center',
      lineHeight: isMobile ? 30 : 48,
    },
    subtitle: {
      fontSize: isMobile ? 14 : 16,
      lineHeight: isMobile ? 21 : 25,
      color: colors.textMuted,
      textAlign: 'center',
      maxWidth: 440,
      letterSpacing: 0.1,
    },
    list: { gap: isMobile ? 8 : 10 },
    item: {
      width: '100%',
      borderRadius: DESIGN_TOKENS.radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          transition: 'border-color 0.22s ease, box-shadow 0.22s ease',
          boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
        },
      }),
    },
    itemOpen: {
      borderColor: colors.primaryAlpha40,
      ...Platform.select({
        web: { boxShadow: '0 4px 24px rgba(0,0,0,0.07), 0 1px 6px rgba(0,0,0,0.04)' },
      }),
    },
    itemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: isMobile ? 16 : 22,
      paddingHorizontal: isMobile ? 18 : 28,
      minHeight: 62,
      gap: 16,
      ...Platform.select({
        web: { transition: 'background-color 0.18s ease', cursor: 'pointer' } as any,
      }),
    },
    itemHeaderHover: { backgroundColor: colors.primarySoft },
    itemHeaderOpen: { backgroundColor: colors.primarySoft },
    itemHeaderFocused: Platform.select({
      web: {
        outlineWidth: 2,
        outlineStyle: 'solid',
        outlineColor: colors.primary,
        outlineOffset: 2,
      } as any,
      default: {},
    }) as any,
    question: {
      fontSize: isMobile ? 15 : 17,
      fontWeight: '700',
      color: colors.text,
      lineHeight: isMobile ? 22 : 26,
      letterSpacing: -0.3,
    },
    questionWrap: { flex: 1, gap: 6 },
    questionMetaRow: { flexDirection: 'row', alignItems: 'center' },
    questionMeta: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.9,
      color: colors.textSubtle,
    },
    questionOpen: { color: colors.primaryText },
    toggleWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.borderLight,
      flexShrink: 0,
      ...Platform.select({
        web: { transition: 'background-color 0.18s ease, border-color 0.18s ease' },
      }),
    },
    toggleWrapOpen: { backgroundColor: colors.primary, borderColor: colors.primary },
    answerWrap: {
      paddingHorizontal: isMobile ? 18 : 28,
      paddingBottom: isMobile ? 18 : 24,
      paddingTop: 2,
      ...Platform.select({
        web: {
          overflow: 'hidden',
          maxHeight: 300,
          opacity: 1,
          transition:
            'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease, padding 0.3s ease',
        },
      }),
    },
    answerWrapCollapsed: {
      ...Platform.select({
        web: { maxHeight: 0, opacity: 0, paddingBottom: 0, paddingTop: 0 },
      }),
    },
    answer: {
      fontSize: isMobile ? 14 : 15,
      lineHeight: isMobile ? 22 : 26,
      color: colors.textMuted,
      letterSpacing: 0.1,
    },
  })

export default memo(HomeFAQSection)
