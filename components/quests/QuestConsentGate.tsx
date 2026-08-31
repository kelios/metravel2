import React, { useMemo, useState } from 'react'
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Button from '@/components/ui/Button'
import ConsentCheckbox from '@/components/legal/ConsentCheckbox'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { LAYOUT } from '@/constants/layout'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'


type Colors = ReturnType<typeof useThemedColors>

// Мобильный BottomDock — оверлей поверх экрана (`--mt-dock-h` = 0px на desktop),
// поэтому скролл обязан зарезервировать его высоту. Без резерва кнопка
// «Начать квест» остаётся под доком, а контент помещается во вьюпорт целиком —
// скроллить нечего, и квест невозможно начать.
const WEB_BOTTOM_RESERVE = 'calc(var(--mt-dock-h, 0px) + 24px)' as unknown as number

interface QuestConsentGateProps {
  title: string
  coverUrl?: string
  onAccept: () => void
  testID?: string
  /** Readonly-рейтинг под заголовком */
  ratingSlot?: React.ReactNode
  /** Бейдж «Пройден» + «Пройдено N раз» под заголовком */
  completionSlot?: React.ReactNode
}

/**
 * Экран обязательного согласия перед первым стартом квеста.
 * Кнопка «Начать квест» заблокирована, пока чекбокс не отмечен.
 */
export default function QuestConsentGate({ title, coverUrl, onAccept, testID, ratingSlot, completionSlot }: QuestConsentGateProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()
  const [checked, setChecked] = useState(false)
  const contentStyle = useMemo(
    () => [
      styles.content,
      {
        paddingBottom:
          Platform.OS === 'web'
            ? WEB_BOTTOM_RESERVE
            : (LAYOUT?.tabBarHeight ?? 56) + insets.bottom + DESIGN_TOKENS.spacing.xl,
      },
    ],
    [insets.bottom, styles.content],
  )

  const handleStart = () => {
    if (!checked) return
    onAccept()
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={contentStyle} testID={testID}>
      {coverUrl ? (
        <ImageCardMedia
          src={coverUrl}
          alt={title}
          fit="contain"
          height={200}
          borderRadius={16}
          style={styles.cover}
        />
      ) : null}

      {/* Экран согласия рендерится вместо визарда, поэтому H1 страницы здесь его. */}
      <Text
        style={styles.title}
        accessibilityRole="header"
        {...({ 'aria-level': 1 } as Record<string, unknown>)}
      >
        {title}
      </Text>
      {ratingSlot}
      {completionSlot}

      <View style={styles.card}>
        <Text style={styles.lead}>{i18nT('quests:components.quests.QuestConsentGate.pered_nachalom_kvesta_podtverdite_soglasie_s_38fb802c')}</Text>

        <ConsentCheckbox
          checked={checked}
          onToggle={setChecked}
          testID="quest-consent-checkbox"
          accessibilityLabel={i18nT('quests:components.quests.QuestConsentGate.soglasie_s_pravilami_i_otkazom_ot_otvetstven_2f6c5dbf')}
        >
          {i18nT('quests:components.quests.QuestConsentGate.ya_ponimayu_chto_prohozhu_kvest_samostoyatel_3d348cd7')}</ConsentCheckbox>

        <View style={styles.linksRow}>
          <Link href={'/disclaimer' as any} style={styles.link}>
            {i18nT('quests:components.quests.QuestConsentGate.otkaz_ot_otvetstvennosti_1dc9bbb2')}</Link>
          <Text style={styles.linkSep}>·</Text>
          <Link href={'/community-rules' as any} style={styles.link}>
            {i18nT('quests:components.quests.QuestConsentGate.pravila_soobschestva_ffacfe0c')}</Link>
        </View>

        <Button
          variant="primary"
          fullWidth
          label={i18nT('quests:components.quests.QuestConsentGate.nachat_kvest_d3b974ac')}
          onPress={handleStart}
          disabled={!checked}
          testID="quest-consent-start"
          style={styles.buttonSpacingTop}
        />
      </View>
    </ScrollView>
  )
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 16,
      maxWidth: 640,
      width: '100%',
      alignSelf: 'center',
      gap: 16,
    },
    cover: {
      width: '100%',
    },
    title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '900',
    },
    card: {
      gap: 14,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    lead: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    linksRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    link: {
      color: colors.primaryText,
      fontSize: 13,
      fontWeight: '600',
    },
    linkSep: {
      color: colors.textMuted,
    },
    buttonSpacingTop: {
      marginTop: 4,
    },
  })
