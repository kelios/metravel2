import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'

import InstantSEO from '@/components/seo/LazyInstantSEO'
import { ResponsiveContainer } from '@/components/layout'
import { useScreenHeader } from '@/components/layout/ScreenHeaderContext'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { ADVENT_ROUTE } from '@/constants/advent'
import { useAdventCampaign, type AdventDoorView } from '@/hooks/useAdventCampaign'
import { useAdventCampaignQuery, useAdventServerSync } from '@/hooks/useAdventApi'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { SCREEN_CONTENT_FIRST_PROPS } from '@/utils/screenContentMarker'
import { buildCanonicalUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo'
import { webTouchScrollStyle } from '@/utils'
import AdventHeader from './AdventHeader'
import AdventGrid from './AdventGrid'
import AdventDoorSheet from './AdventDoorSheet'
import AdventShareCard from './AdventShareCard'

// Отдельным чанком: тост тянет весь контур значков, а статический импорт
// перекраивал общие чанки сайта (бюджет начальных запросов `/search`).
const BadgeUnlockToast = lazy(() => import('@/components/achievements/BadgeUnlockToast'))

/** Экран `/advent`: 27 дверец, прогресс и серия, лист дверцы (#2861). */
export default function AdventScreen() {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const { width } = useResponsive()
  const serverCampaign = useAdventCampaignQuery()
  const campaign = useAdventCampaign({ serverCampaign })
  const { doors, ready, isAuthenticated, openDoor, completeTask } = campaign
  const sync = useAdventServerSync({
    ownerKey: campaign.ownerKey,
    localProgress: campaign.progress,
    enabled: campaign.hydrated,
  })
  // Серия считается сервером по датам открытия (#2864); до синхронизации — локальная.
  const streak = sync.serverStreak ?? campaign.streak
  const params = useLocalSearchParams<{ day?: string }>()
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  useScreenHeader({
    title: i18nT('adventStatic:page.title'),
    info: [i18nT('adventStatic:page.intro'), i18nT('adventStatic:page.rules')],
  })

  const selectedDoor = useMemo(() => doors.find((door) => door.day === selectedDay) ?? null, [doors, selectedDay])

  const handlePressDoor = useCallback(
    (door: AdventDoorView) => {
      if (door.state === 'locked' || !ready) return
      if (door.state === 'available') {
        sendAnalyticsEvent('Advent_DoorOpen', { day: door.day, kind: door.kind, guest: !isAuthenticated })
        openDoor(door.day, campaign.now)
        // Дверца-подарок без действия засчитывается самим открытием — только аккаунту.
        if (door.task.type === 'open' && isAuthenticated) completeTask(door.day, campaign.now)
      }
      setSelectedDay(door.day)
    },
    [ready, isAuthenticated, openDoor, completeTask, campaign.now],
  )

  // Возврат после входа гостя (`/advent?day=N`): один раз открываем ту же дверцу.
  const handledDayParam = useRef<string | null>(null)
  useEffect(() => {
    const raw = typeof params.day === 'string' ? params.day : null
    if (!ready || !campaign.hydrated || !raw || handledDayParam.current === raw) return
    handledDayParam.current = raw
    const door = doors.find((item) => item.day === Number(raw))
    // Тот же путь, что и тап по плитке: дверца открывается и зачитывается новому владельцу.
    if (door) handlePressDoor(door)
  }, [ready, campaign.hydrated, params.day, doors, handlePressDoor])

  const handleCompleteTask = useCallback(
    (day: number) => {
      completeTask(day, campaign.now)
    },
    [completeTask, campaign.now],
  )

  return (
    <View style={styles.root} {...SCREEN_CONTENT_FIRST_PROPS}>
      <InstantSEO
        headKey="advent"
        title={i18nT('seoStatic:root.advent.title')}
        description={i18nT('seoStatic:root.advent.description')}
        canonical={buildCanonicalUrl(ADVENT_ROUTE)}
        image={DEFAULT_OG_IMAGE_PATH}
      />
      <ScrollView style={webTouchScrollStyle} contentContainerStyle={styles.scroll} testID="advent-screen">
        <ResponsiveContainer maxWidth="xl" padding>
          <View style={styles.stack}>
            <Text style={styles.intro}>{i18nT('adventStatic:page.intro')}</Text>
            <AdventHeader
              openedCount={campaign.openedCount}
              doneCount={campaign.doneCount}
              streak={streak}
              nextDoor={campaign.nextDoor}
              now={campaign.now}
              hydrated={campaign.hydrated}
              syncState={sync.state}
            />
            {campaign.hydrated && campaign.openedCount > 0 ? (
              <AdventShareCard openedCount={campaign.openedCount} streak={streak} year={campaign.campaign.year} />
            ) : null}
            <AdventGrid doors={doors} width={width} disabled={!ready || !campaign.hydrated} onPressDoor={handlePressDoor} />
            <Text style={styles.rules}>{i18nT('adventStatic:page.rules')}</Text>
          </View>
        </ResponsiveContainer>
      </ScrollView>
      <AdventDoorSheet
        door={selectedDoor}
        isAuthenticated={isAuthenticated}
        creditedDays={sync.creditedDays}
        campaignYear={campaign.campaign.year}
        onClose={() => setSelectedDay(null)}
        onCompleteTask={handleCompleteTask}
      />
      {/* Значки адвента выдаёт сервер после синхронизации (#2864) — тост как в квестах. */}
      {isAuthenticated ? (
        <Suspense fallback={null}>
          <BadgeUnlockToast enabled />
        </Suspense>
      ) : null}
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    scroll: { paddingVertical: DESIGN_TOKENS.spacing.md, paddingBottom: DESIGN_TOKENS.spacing.xl },
    stack: { gap: DESIGN_TOKENS.spacing.md },
    intro: { fontSize: 15, lineHeight: 22, color: colors.textSecondary },
    rules: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  })
