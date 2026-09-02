import { memo, useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import { ResponsiveContainer } from '@/components/layout'
import QuestForCityCard from '@/components/quests/QuestForCityCard'
import { useQuestsPreview } from '@/hooks/useQuestsApi'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { translate as i18nT } from '@/i18n'


const IS_WEB = Platform.OS === 'web'
// Одним запросом (?page_size=N) забираем ровно столько карточек, сколько
// показываем: через полный useQuestsList блок тянул весь каталог квестов ради
// нескольких плиток. 6 хватает на сетку 2×3 на десктопе; мобайл показывает 4,
// чтобы секция сразу после hero осталась в пределах первых экранов прокрутки.
const MAX_QUESTS = 6
const MAX_QUESTS_MOBILE = 4
const SCENARIO_ROUTE = '/quests/scenario'

function HomeQuestsPromoSection({ enabled = true }: { enabled?: boolean }) {
  const router = useRouter()
  const colors = useThemedColors()
  const { isPhone, isLargePhone } = useResponsive()
  const isMobile = isPhone || isLargePhone
  const { quests: previewQuests, loading } = useQuestsPreview(MAX_QUESTS, { enabled })
  const [hovered, setHovered] = useState(false)
  const [scenarioHovered, setScenarioHovered] = useState(false)

  const styles = useMemo(() => createStyles(colors, isMobile), [colors, isMobile])

  const visibleQuests = useMemo(
    () => previewQuests.slice(0, isMobile ? MAX_QUESTS_MOBILE : MAX_QUESTS),
    [previewQuests, isMobile],
  )

  const handleViewAll = useCallback(() => {
    sendAnalyticsEvent('HomeClick_ViewAllQuests', { count: visibleQuests.length })
    router.push('/quests' as any)
  }, [router, visibleQuests.length])

  const handleScenario = useCallback(() => {
    sendAnalyticsEvent('HomeClick_QuestScenario', { source: 'home_quests' })
    router.push(SCENARIO_ROUTE as any)
  }, [router])

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

        {/* Подарочный сценарий-вход: отдельный CTA под подбор «квест в подарок». */}
        <Pressable
          onPress={handleScenario}
          accessibilityRole={IS_WEB ? ('link' as any) : 'button'}
          accessibilityLabel={i18nT('quests:components.home.HomeQuestsPromoSection.scenarioAria')}
          style={[styles.scenarioCard, scenarioHovered && styles.scenarioCardHover]}
          {...(IS_WEB
            ? ({
                onMouseEnter: () => setScenarioHovered(true),
                onMouseLeave: () => setScenarioHovered(false),
              } as any)
            : {})}
        >
          <View style={styles.scenarioIcon}>
            <Feather name="gift" size={20} color={colors.primaryDark} />
          </View>
          <View style={styles.scenarioBody}>
            <Text style={styles.scenarioTitle} numberOfLines={1}>
              {i18nT('quests:components.home.HomeQuestsPromoSection.scenarioTitle')}
            </Text>
            <Text style={styles.scenarioSubtitle} numberOfLines={2}>
              {i18nT('quests:components.home.HomeQuestsPromoSection.scenarioSubtitle')}
            </Text>
          </View>
          {/* #1563-adjacent: на native скрытый через `display:'none'` узел никогда
              не проходит layout (YogaLayoutableShadowNode.cpp:731 не спускается в
              display:none), его `hasNewLayout` остаётся непотреблённым и переживает
              поколение клонов — дальше Yoga ловит владельца от прошлой ревизии
              родителя. На устройстве это давало аборт на главной. Поэтому вне web
              узел не создаём вовсе; на web раскладка остаётся прежней, CSS-скрытием. */}
          {Platform.OS !== 'web' && isMobile ? null : (
            <View style={styles.scenarioCta}>
              <Text style={styles.scenarioCtaText}>
                {i18nT('quests:components.home.HomeQuestsPromoSection.scenarioCta')}
              </Text>
              <Feather name="arrow-right" size={16} color={colors.primaryDark} />
            </View>
          )}
        </Pressable>

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
    scenarioCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isMobile ? 12 : 16,
      marginTop: isMobile ? 16 : 24,
      paddingVertical: isMobile ? 12 : 16,
      paddingHorizontal: isMobile ? 14 : 20,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.primarySoft,
      ...(IS_WEB
        ? ({
            cursor: 'pointer',
            transition: 'border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease',
          } as any)
        : null),
    },
    scenarioCardHover: {
      borderColor: colors.primary,
      ...Platform.select({
        web: {
          boxShadow: '0 10px 28px rgba(15, 23, 42, 0.12)',
          transform: 'translateY(-2px)',
        } as any,
      }),
    },
    scenarioIcon: {
      width: 44,
      height: 44,
      flexShrink: 0,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    scenarioBody: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    scenarioTitle: {
      fontSize: isMobile ? 16 : 18,
      fontWeight: '800',
      color: colors.text,
    },
    scenarioSubtitle: {
      fontSize: isMobile ? 13 : 14,
      color: colors.textMuted,
      lineHeight: isMobile ? 18 : 20,
    },
    scenarioCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
      // На узком мобайле длинную подпись оставляем сверху, а стрелку-CTA
      // прячем: тап по всей карточке всё равно ведёт на сценарий.
      ...(isMobile ? { display: 'none' as const } : null),
    },
    scenarioCtaText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.primaryText,
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
