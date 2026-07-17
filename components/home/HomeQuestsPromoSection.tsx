import { memo, useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import { ResponsiveContainer } from '@/components/layout'
import QuestForCityCard from '@/components/quests/QuestForCityCard'
import { useQuestsList } from '@/hooks/useQuestsApi'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { translate as i18nT } from '@/i18n'


const IS_WEB = Platform.OS === 'web'
const MAX_QUESTS = 2

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
          <View
            style={styles.titleWrap}
            accessibilityRole="header"
            {...({ 'aria-level': 2 } as any)}
          >
            <Text style={styles.title}>{i18nT('quests:components.home.HomeQuestsPromoSection.gorodskie_kvesty_6436f91c')}</Text>
          </View>
          <Text style={styles.subtitle}>
            {i18nT('quests:components.home.HomeQuestsPromoSection.peshie_marshruty_po_legendam_i_zagadkam_prya_84e2c2fb')}</Text>
        </View>

        <View style={styles.grid}>
          {visibleQuests.map((quest) => (
            <View key={quest.id} style={[styles.cardSlot, isMobile && styles.cardSlotMobile]}>
              <QuestForCityCard
                quest={quest}
                imageLoading="lazy"
                analyticsSource="home_quests"
                analyticsContextId="home"
              />
            </View>
          ))}
        </View>

        <View style={styles.ctaRow}>
          <Pressable
            onPress={handleViewAll}
            accessibilityRole={IS_WEB ? ('link' as any) : 'button'}
            accessibilityLabel={i18nT('quests:components.home.HomeQuestsPromoSection.otkryt_vse_gorodskie_kvesty_24fef732')}
            style={[styles.ctaButton, hovered && styles.ctaButtonHover]}
            {...(IS_WEB
              ? ({
                  onMouseEnter: () => setHovered(true),
                  onMouseLeave: () => setHovered(false),
                } as any)
              : {})}
          >
            <Text style={styles.ctaText}>{i18nT('quests:components.home.HomeQuestsPromoSection.vse_kvesty_db15d13b')}</Text>
            <Feather name="arrow-right" size={16} color={colors.primaryDark} />
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
    titleWrap: {
      alignItems: 'center',
    },
    title: {
      fontSize: isMobile ? 24 : 34,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: isMobile ? 14 : 16,
      color: colors.textMuted,
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
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.surface,
      ...(IS_WEB ? { cursor: 'pointer' } : null),
    },
    ctaButtonHover: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    ctaText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.primaryText,
    },
  })
}

export default memo(HomeQuestsPromoSection)
