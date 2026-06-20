// components/quests/QuestPioneerBlock.tsx
// Hero-блок первопроходца на финале квеста (#364). Рендерится только когда
// текущий авторизованный пользователь — первый, кто прошёл этот квест.
// Триггерит unlock-тост достижения через существующий механизм: инвалидирует
// achievementsMe, чтобы BadgeUnlockToast подхватил recentlyEarned значок.

import React, { memo, useEffect, useMemo, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useAuth } from '@/context/AuthContext'
import { useQuestPioneerMeta } from '@/hooks/useQuestPioneerMeta'
import { useThemedColors } from '@/hooks/useTheme'

type Props = {
  questId: string
  questNumericId: number | undefined
}

function QuestPioneerBlock({ questId, questNumericId }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const { userId, isAuthenticated } = useAuth()
  const pioneer = useQuestPioneerMeta(questId, questNumericId)
  const queryClient = useQueryClient()

  const isPioneer =
    isAuthenticated &&
    pioneer != null &&
    userId != null &&
    String(pioneer.id) === String(userId)

  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(12)).current
  const scale = useRef(new Animated.Value(0.92)).current
  const triggeredRef = useRef(false)

  useEffect(() => {
    if (!isPioneer) return
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 14 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 12 }),
    ]).start()
  }, [isPioneer, opacity, translateY, scale])

  useEffect(() => {
    if (!isPioneer || triggeredRef.current) return
    triggeredRef.current = true
    void queryClient.invalidateQueries({ queryKey: queryKeys.achievementsMe() })
  }, [isPioneer, queryClient])

  if (!isPioneer) return null

  return (
    <Animated.View
      style={[styles.card, { opacity, transform: [{ translateY }, { scale }] }]}
      accessibilityRole="summary"
      accessibilityLabel="Вы первый, кто прошёл этот квест"
    >
      <View style={styles.medal}>
        <Feather name="award" size={30} color={colors.textOnPrimary} />
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.title}>Первопроходец!</Text>
        <Text style={styles.subtitle}>Вы первый, кто прошёл этот квест</Text>
      </View>
    </Animated.View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.md,
      alignSelf: 'stretch',
      maxWidth: 460,
      marginTop: DESIGN_TOKENS.spacing.sm,
      paddingVertical: DESIGN_TOKENS.spacing.md,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.surfaceElevated,
    },
    medal: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 4,
    },
    textBlock: { flexShrink: 1, minWidth: 0 },
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      fontWeight: '900',
      color: colors.primary,
    },
    subtitle: {
      marginTop: 2,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '600',
      color: colors.text,
    },
  })

export default memo(QuestPioneerBlock)
