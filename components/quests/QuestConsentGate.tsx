import React, { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Link } from 'expo-router'

import ConsentCheckbox from '@/components/legal/ConsentCheckbox'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { useThemedColors } from '@/hooks/useTheme'

type Colors = ReturnType<typeof useThemedColors>

interface QuestConsentGateProps {
  title: string
  coverUrl?: string
  onAccept: () => void
  testID?: string
  /** Блок первопроходца под заголовком */
  pioneerSlot?: React.ReactNode
  /** Readonly-рейтинг под заголовком */
  ratingSlot?: React.ReactNode
  /** Бейдж «Пройден» + «Пройдено N раз» под заголовком */
  completionSlot?: React.ReactNode
}

/**
 * Экран обязательного согласия перед первым стартом квеста.
 * Кнопка «Начать квест» заблокирована, пока чекбокс не отмечен.
 */
export default function QuestConsentGate({ title, coverUrl, onAccept, testID, pioneerSlot, ratingSlot, completionSlot }: QuestConsentGateProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [checked, setChecked] = useState(false)

  const handleStart = () => {
    if (!checked) return
    onAccept()
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} testID={testID}>
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

      <Text style={styles.title}>{title}</Text>
      {pioneerSlot}
      {ratingSlot}
      {completionSlot}

      <View style={styles.card}>
        <Text style={styles.lead}>Перед началом квеста подтвердите согласие с условиями.</Text>

        <ConsentCheckbox
          checked={checked}
          onToggle={setChecked}
          testID="quest-consent-checkbox"
          accessibilityLabel="Согласие с правилами и отказом от ответственности перед стартом квеста"
        >
          Я понимаю, что прохожу квест самостоятельно и на собственный риск, информация может быть
          неактуальной, и принимаю правила и отказ от ответственности.
        </ConsentCheckbox>

        <View style={styles.linksRow}>
          <Link href={'/disclaimer' as any} style={styles.link}>
            Отказ от ответственности
          </Link>
          <Text style={styles.linkSep}>·</Text>
          <Link href={'/community-rules' as any} style={styles.link}>
            Правила сообщества
          </Link>
        </View>

        <Pressable
          onPress={handleStart}
          disabled={!checked}
          style={[styles.startButton, !checked && styles.startButtonDisabled]}
          testID="quest-consent-start"
          accessibilityRole="button"
          accessibilityState={{ disabled: !checked }}
        >
          <Text style={styles.startButtonText}>Начать квест</Text>
        </Pressable>
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
      paddingBottom: 32,
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
    startButton: {
      marginTop: 4,
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    startButtonDisabled: {
      opacity: 0.45,
    },
    startButtonText: {
      color: colors.textOnPrimary,
      fontWeight: '800',
      fontSize: 15,
    },
  })
