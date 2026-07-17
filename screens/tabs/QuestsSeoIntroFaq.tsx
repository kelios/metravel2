import { memo, useCallback, useMemo, useState } from 'react'
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
  type ViewStyle,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useResponsive } from '@/hooks/useResponsive'
import { translate as i18nT } from '@/i18n'

const IS_WEB = Platform.OS === 'web'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

export type QuestFaqItem = { q: string; a: string }
type QuestSeoStyles = ReturnType<typeof createStyles>
type WebPressableState = { pressed: boolean; hovered?: boolean }
type WebViewStyle = ViewStyle & { transition?: string }

const webViewStyle = (style: WebViewStyle): ViewStyle => (IS_WEB ? style : {})

// Explicit string-literal keys (not template literals) so the web babel plugin
// inlines every FAQ string into the eager bundle — otherwise the key would leak
// to the user on web (see __tests__/i18n/webCompileTime.test.ts).
/** Source of truth for the /quests FAQ (visible copy + FAQPage JSON-LD). */
export function getQuestFaqItems(): QuestFaqItem[] {
  return [
    { q: i18nT('quests:screens.tabs.QuestsSeoIntroFaq.q1'), a: i18nT('quests:screens.tabs.QuestsSeoIntroFaq.a1') },
    { q: i18nT('quests:screens.tabs.QuestsSeoIntroFaq.q2'), a: i18nT('quests:screens.tabs.QuestsSeoIntroFaq.a2') },
    { q: i18nT('quests:screens.tabs.QuestsSeoIntroFaq.q3'), a: i18nT('quests:screens.tabs.QuestsSeoIntroFaq.a3') },
    { q: i18nT('quests:screens.tabs.QuestsSeoIntroFaq.q4'), a: i18nT('quests:screens.tabs.QuestsSeoIntroFaq.a4') },
    { q: i18nT('quests:screens.tabs.QuestsSeoIntroFaq.q5'), a: i18nT('quests:screens.tabs.QuestsSeoIntroFaq.a5') },
    { q: i18nT('quests:screens.tabs.QuestsSeoIntroFaq.q6'), a: i18nT('quests:screens.tabs.QuestsSeoIntroFaq.a6') },
    { q: i18nT('quests:screens.tabs.QuestsSeoIntroFaq.q7'), a: i18nT('quests:screens.tabs.QuestsSeoIntroFaq.a7') },
    { q: i18nT('quests:screens.tabs.QuestsSeoIntroFaq.q8'), a: i18nT('quests:screens.tabs.QuestsSeoIntroFaq.a8') },
  ]
}

function FaqCard({
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
  item: QuestFaqItem
  onToggle: () => void
  styles: QuestSeoStyles
}) {
  return (
    <View style={[styles.item, isOpen && styles.itemOpen]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={item.q}
        accessibilityState={{ expanded: isOpen }}
        accessibilityHint={isOpen ? i18nT('quests:screens.tabs.QuestsSeoIntroFaq.collapse') : i18nT('quests:screens.tabs.QuestsSeoIntroFaq.expand')}
        {...(IS_WEB
          ? ({
              'aria-expanded': isOpen,
              'aria-controls': `quests-faq-answer-${index}`,
              id: `quests-faq-question-${index}`,
            } as Record<string, unknown>)
          : {})}
        style={({ pressed, hovered }: WebPressableState) => [
          styles.itemHeader,
          IS_WEB && !isOpen && (pressed || hovered) && styles.itemHeaderHover,
        ]}
      >
        <Text style={[styles.question, isOpen && styles.questionOpen]}>{item.q}</Text>
        <View style={[styles.toggleWrap, isOpen && styles.toggleWrapOpen]}>
          <Feather
            name={isOpen ? 'minus' : 'plus'}
            size={15}
            color={isOpen ? colors.textOnPrimary : colors.textMuted}
          />
        </View>
      </Pressable>

      {IS_WEB ? (
        <View
          style={[styles.answerWrap, !isOpen && styles.answerWrapCollapsed]}
          {...({
            id: `quests-faq-answer-${index}`,
            role: 'region',
            'aria-labelledby': `quests-faq-question-${index}`,
            'aria-hidden': !isOpen,
          } as Record<string, unknown>)}
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

function QuestsSeoIntroFaq({ variant = 'both' }: { variant?: 'intro' | 'faq' | 'both' }) {
  const colors = useThemedColors()
  const { isSmallPhone, isPhone } = useResponsive()
  const isMobile = isSmallPhone || isPhone
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const items = useMemo(() => getQuestFaqItems(), [])
  const styles = useMemo(() => createStyles(colors, isMobile), [colors, isMobile])

  const toggleItem = useCallback((idx: number) => {
    if (!IS_WEB) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    }
    setOpenIndex((prev) => (prev === idx ? null : idx))
  }, [])

  return (
    <View style={styles.wrap} testID="quests-seo-intro-faq">
      {variant !== 'faq' && (
        <View style={styles.intro}>
          <View style={styles.eyebrow}>
            <Feather
              name="compass"
              size={13}
              color={colors.primaryDark}
              aria-hidden
            />
            <Text style={styles.eyebrowText}>{i18nT('quests:screens.tabs.QuestsSeoIntroFaq.eyebrow')}</Text>
          </View>
          <Text style={styles.lead}>{i18nT('quests:screens.tabs.QuestsSeoIntroFaq.lead')}</Text>
        </View>
      )}

      {variant !== 'intro' && (
        <View style={styles.faq}>
          <Text
            style={styles.faqTitle}
            accessibilityRole="header"
            {...({ 'aria-level': 2 } as Record<string, unknown>)}
          >
            {i18nT('quests:screens.tabs.QuestsSeoIntroFaq.faqTitle')}
          </Text>
          <View style={styles.list}>
            {items.map((item, idx) => (
              <FaqCard
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
      )}
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>, isMobile: boolean) =>
  StyleSheet.create({
    wrap: {
      width: '100%',
      // Читаемая ширина колонки текста, но по ЛЕВОМУ краю: блок живёт в одной
      // колонке с шапкой и сеткой квестов, которые прижаты влево. При
      // alignSelf:'center' интро и FAQ уезжали вправо от карточек и заголовка.
      maxWidth: 760,
      alignSelf: 'flex-start',
      gap: isMobile ? 20 : 28,
    },
    intro: {
      gap: 10,
      paddingVertical: isMobile ? 12 : 16,
    },
    eyebrow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      alignSelf: 'flex-start',
      borderRadius: DESIGN_TOKENS.radii.full,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    eyebrowText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primaryText,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    lead: {
      fontSize: isMobile ? 14 : 16,
      lineHeight: isMobile ? 22 : 26,
      color: colors.textMuted,
      letterSpacing: 0.1,
    },
    faq: {
      gap: isMobile ? 12 : 16,
      paddingBottom: isMobile ? 8 : 12,
    },
    faqTitle: {
      fontSize: isMobile ? 19 : 24,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.4,
    },
    list: { gap: isMobile ? 8 : 10 },
    item: {
      width: '100%',
      borderRadius: DESIGN_TOKENS.radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      overflow: 'hidden',
      ...webViewStyle({ transition: 'border-color 0.22s ease' }),
    },
    itemOpen: { borderColor: colors.primaryAlpha40 },
    itemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: isMobile ? 14 : 18,
      paddingHorizontal: isMobile ? 16 : 22,
      gap: 14,
      ...webViewStyle({ transition: 'background-color 0.18s ease', cursor: 'pointer' }),
    },
    itemHeaderHover: { backgroundColor: colors.primarySoft },
    question: {
      flex: 1,
      fontSize: isMobile ? 15 : 16,
      fontWeight: '700',
      color: colors.text,
      lineHeight: isMobile ? 21 : 24,
      letterSpacing: -0.2,
    },
    questionOpen: { color: colors.primaryText },
    toggleWrap: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.borderLight,
      flexShrink: 0,
      ...webViewStyle({ transition: 'background-color 0.18s ease, border-color 0.18s ease' }),
    },
    toggleWrapOpen: { backgroundColor: colors.primary, borderColor: colors.primary },
    answerWrap: {
      paddingHorizontal: isMobile ? 16 : 22,
      paddingBottom: isMobile ? 16 : 20,
      paddingTop: 2,
      ...webViewStyle({
        overflow: 'hidden',
        maxHeight: 400,
        opacity: 1,
        transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease, padding 0.3s ease',
      }),
    },
    answerWrapCollapsed: {
      ...webViewStyle({ maxHeight: 0, opacity: 0, paddingBottom: 0, paddingTop: 0 }),
    },
    answer: {
      fontSize: isMobile ? 14 : 15,
      lineHeight: isMobile ? 22 : 25,
      color: colors.textMuted,
      letterSpacing: 0.1,
    },
  })

export default memo(QuestsSeoIntroFaq)
