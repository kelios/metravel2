import { memo, useCallback, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ResponsiveContainer } from '@/components/layout'
import AdventWindowCrop from '@/components/advent/AdventWindowCrop'
import Button from '@/components/ui/Button'
import { ADVENT_MAIN_DOORS, ADVENT_ROUTE, isoDateToLocalMidnight } from '@/constants/advent'
import { ADVENT_ART_COLORS } from '@/constants/adventVisuals'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useAdventCampaign } from '@/hooks/useAdventCampaign'
import { useResponsive } from '@/hooks/useResponsive'
import { formatDate, formatInteger } from '@/i18n/format'
import { translate as i18nT } from '@/i18n'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { isPhoneLayout } from '@/utils/phoneLayout'

/**
 * Баннер адвент-календаря на главной (#2866): виден в окне кампании
 * 01.12–07.01 по местной дате клиента и независимо от выбранного оформления.
 * В анонсе до старта (#3481) зовёт заглянуть в календарь: дата первой дверцы, без прогресса.
 * Живёт в отложенных секциях главной — на LCP не влияет. Оформление —
 * маленькое окно того же дома (#3482): кроп фасада на ночной подложке, цвета
 * иллюстрации не зависят от темы интерфейса.
 */
function HomeAdventPromoSection({ enabled = true, topGap }: { enabled?: boolean; topGap?: number | string }) {
  const router = useRouter()
  const { width, isPhone, isLargePhone } = useResponsive()
  const isMobile = isPhoneLayout({ width, isPhone, isLargePhone })
  const styles = useMemo(() => createStyles(isMobile), [isMobile])
  const { isInWindow, isAnnounce, todayDoor, nextDoor, openedCount } = useAdventCampaign()

  const handleOpen = useCallback(() => {
    sendAnalyticsEvent('HomeClick_Advent', { day: todayDoor?.day ?? null, announce: isAnnounce })
    router.push(ADVENT_ROUTE as never)
  }, [router, todayDoor?.day, isAnnounce])

  if (!enabled || (!isInWindow && !isAnnounce)) return null

  const door = todayDoor ?? nextDoor
  const doorLine = isAnnounce
    ? nextDoor
      ? i18nT('adventStatic:home.announce', {
          value1: formatDate(isoDateToLocalMidnight(nextDoor.date), { day: 'numeric', month: 'long' }),
        })
      : null
    : door
      ? i18nT('adventStatic:home.today', {
          value1: door.day,
          value2: door.secret && door.state === 'locked' ? i18nT('adventStatic:tile.secret') : door.gift.title,
        })
      : null

  return (
    <View style={[styles.band, topGap !== undefined ? { marginTop: topGap as number } : null]} testID="home-advent-promo">
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.card}>
          <AdventWindowCrop
            day={isAnnounce ? null : door?.day}
            aspectRatio={isMobile ? 2.2 : 3 / 4}
            style={styles.window}
            testID="home-advent-window"
          />
          <View style={styles.textCol}>
            <Text style={styles.title}>{i18nT('adventStatic:page.title')}</Text>
            {doorLine ? <Text style={styles.doorLine}>{doorLine}</Text> : null}
            <Text style={styles.subtitle}>{i18nT('adventStatic:home.subtitle')}</Text>
            {isAnnounce ? null : (
              <Text style={styles.progress}>
                {i18nT('adventStatic:home.progress', { value1: formatInteger(openedCount), value2: formatInteger(ADVENT_MAIN_DOORS) })}
              </Text>
            )}
          </View>
          <View style={styles.ctaCol}>
            <Button
              label={i18nT(isAnnounce ? 'adventStatic:home.ctaAnnounce' : 'adventStatic:home.cta')}
              onPress={handleOpen}
              size={isMobile ? 'sm' : 'md'}
              fullWidth={isMobile}
              testID="home-advent-cta"
            />
          </View>
        </View>
      </ResponsiveContainer>
    </View>
  )
}

const createStyles = (isMobile: boolean) =>
  StyleSheet.create({
    band: { paddingVertical: isMobile ? DESIGN_TOKENS.spacing.sm : DESIGN_TOKENS.spacing.lg },
    card: {
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'stretch' : 'center',
      gap: DESIGN_TOKENS.spacing.md,
      padding: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 2,
      borderColor: ADVENT_ART_COLORS.gold,
      backgroundColor: ADVENT_ART_COLORS.night,
    },
    window: {
      width: isMobile ? '100%' : 120,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: ADVENT_ART_COLORS.goldDeep,
    },
    textCol: { flex: 1, gap: DESIGN_TOKENS.spacing.xxs },
    title: { fontSize: isMobile ? 18 : 20, fontWeight: '700', color: ADVENT_ART_COLORS.nightText, lineHeight: 26 },
    doorLine: { fontSize: 15, lineHeight: 22, fontWeight: '700', color: ADVENT_ART_COLORS.gold },
    subtitle: { fontSize: 14, lineHeight: 20, color: ADVENT_ART_COLORS.nightTextMuted },
    progress: { fontSize: 13, lineHeight: 18, color: ADVENT_ART_COLORS.nightTextMuted },
    ctaCol: { flexShrink: 0, minWidth: isMobile ? undefined : 200 },
  })

export default memo(HomeAdventPromoSection)
