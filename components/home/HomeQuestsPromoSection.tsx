import React, { memo, useCallback, useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import { ResponsiveContainer } from '@/components/layout'
import QuestForCityCard from '@/components/quests/QuestForCityCard'
import { useQuestsList } from '@/hooks/useQuestsApi'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { sendAnalyticsEvent } from '@/utils/analytics'

const IS_WEB = Platform.OS === 'web'
const MAX_QUESTS = 6

function HomeQuestsPromoSection() {
  const router = useRouter()
  const colors = useThemedColors()
  const { isPhone, isLargePhone } = useResponsive()
  const isMobile = isPhone || isLargePhone
  const { quests, loading } = useQuestsList()
  const [hovered, setHovered] = useState(false)

  const visibleQuests = useMemo(() => quests.slice(0, MAX_QUESTS), [quests])
  const styles = useMemo(() => createStyles(colors, isMobile), [colors, isMobile])

  const handleViewAll = useCallback(() => {
    sendAnalyticsEvent('HomeClick_ViewAllQuests', { count: visibleQuests.length })
    router.push('/quests' as any)
  }, [router, visibleQuests.length])

  // Без скелетонов: пока грузится или пусто — секции на главной нет (бережём LCP).
  if (loading || visibleQuests.length === 0) return null

  return (
    <View style={[styles.band, isMobile && styles.bandMobile]}>
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.header}>
          <View style={styles.badge}>
            <Feather name="map" size={13} color={colors.primary} />
            <Text style={styles.badgeText}>Городские квесты</Text>
          </View>
          <View
            style={styles.titleWrap}
            accessibilityRole="header"
            {...({ 'aria-level': 2 } as any)}
          >
            <Text style={styles.title}>Городские квесты</Text>
          </View>
          <Text style={styles.subtitle}>
            Пешие маршруты по легендам и загадкам — прямо со смартфона
          </Text>
        </View>

        <View style={styles.grid}>
          {visibleQuests.map((quest) => (
            <View key={quest.id} style={[styles.cardSlot, isMobile && styles.cardSlotMobile]}>
              <QuestForCityCard quest={quest} />
            </View>
          ))}
        </View>

        <View style={styles.ctaRow}>
          <Pressable
            onPress={handleViewAll}
            accessibilityRole={IS_WEB ? ('link' as any) : 'button'}
            accessibilityLabel="Открыть все городские квесты"
            style={[styles.ctaButton, hovered && styles.ctaButtonHover]}
            {...(IS_WEB
              ? ({
                  onMouseEnter: () => setHovered(true),
                  onMouseLeave: () => setHovered(false),
                } as any)
              : {})}
          >
            <Text style={styles.ctaText}>Все квесты</Text>
            <Feather name="arrow-right" size={16} color={colors.primary} />
          </Pressable>
        </View>
      </ResponsiveContainer>
    </View>
  )
}

function createStyles(colors: ThemedColors, isMobile: boolean) {
  return StyleSheet.create({
    band: {
      paddingVertical: 24,
    },
    bandMobile: {
      paddingVertical: 12,
    },
    header: {
      alignItems: 'center',
      gap: isMobile ? 6 : 10,
      marginBottom: isMobile ? 20 : 32,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.primarySoft ?? 'rgba(245,132,44,0.10)',
      borderWidth: 1,
      borderColor: colors.primaryAlpha30 ?? 'rgba(245,132,44,0.30)',
    },
    badgeText: {
      color: colors.primaryText ?? colors.primary ?? '#f5842c',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    titleWrap: {
      alignItems: 'center',
    },
    title: {
      fontSize: isMobile ? 24 : 34,
      fontWeight: '800',
      color: colors.text ?? '#1a1a1a',
      textAlign: 'center',
    },
    subtitle: {
      fontSize: isMobile ? 14 : 16,
      color: colors.textMuted ?? '#6b7280',
      textAlign: 'center',
      maxWidth: 560,
    },
    grid: {
      flexDirection: isMobile ? 'column' : 'row',
      flexWrap: 'wrap',
      gap: 16,
    },
    cardSlot: {
      width: IS_WEB ? ('calc(50% - 8px)' as any) : '100%',
    },
    cardSlotMobile: {
      width: '100%',
    },
    ctaRow: {
      alignItems: 'center',
      marginTop: isMobile ? 16 : 24,
    },
    ctaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30 ?? 'rgba(245,132,44,0.30)',
      backgroundColor: colors.surface ?? '#fff',
      ...(IS_WEB ? { cursor: 'pointer' } : null),
    },
    ctaButtonHover: {
      backgroundColor: colors.primarySoft ?? 'rgba(245,132,44,0.10)',
      borderColor: colors.primary ?? '#f5842c',
    },
    ctaText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.primary ?? '#f5842c',
    },
  })
}

export default memo(HomeQuestsPromoSection)
