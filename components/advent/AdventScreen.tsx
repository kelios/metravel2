import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'

import InstantSEO from '@/components/seo/LazyInstantSEO'
import { ResponsiveContainer } from '@/components/layout'
import Button from '@/components/ui/Button'
import { useScreenHeader } from '@/components/layout/ScreenHeaderContext'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { ADVENT_ROUTE } from '@/constants/advent'
import { useAdventAdminPreview } from '@/hooks/useAdventAdminPreview'
import { useAdventCampaign, type AdventDoorView } from '@/hooks/useAdventCampaign'
import { useAdventCampaignQuery, useAdventServerSync } from '@/hooks/useAdventApi'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useTranslation } from '@/i18n/LocaleProvider'
import { translate as i18nT } from '@/i18n'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { SCREEN_CONTENT_FIRST_PROPS } from '@/utils/screenContentMarker'
import { buildCanonicalUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo'
import { webTouchScrollStyle } from '@/utils'
import { selectServerCreditedDays } from '@/utils/advent/adventCalendar'
import AdventHeader from './AdventHeader'
import AdventGrid from './AdventGrid'
import AdventDoorSheet from './AdventDoorSheet'
import AdventShareCard from './AdventShareCard'
import { formatDoorDate } from './AdventDoorTile'
import { ADVENT_HOUSE_MAX_WIDTH } from './adventHouseLayout'

// Отдельным чанком: тост тянет весь контур значков, а статический импорт
// перекраивал общие чанки сайта (бюджет начальных запросов `/search`).
const BadgeUnlockToast = lazy(() => import('@/components/achievements/BadgeUnlockToast'))

/** Экран `/advent`: 27 дверец, прогресс и серия, лист дверцы (#2861). */
export default function AdventScreen() {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const serverCampaign = useAdventCampaignQuery()
  const campaign = useAdventCampaign({ serverCampaign })
  const { doors, ready, isAuthenticated, openDoor, completeTask } = campaign
  const preview = useAdventAdminPreview(doors, campaign.hydrated, campaign.now)
  const serverCreditedDays = useMemo(() => selectServerCreditedDays(campaign.campaign.doors), [campaign.campaign])
  const sync = useAdventServerSync({
    ownerKey: campaign.ownerKey,
    localProgress: campaign.progress,
    enabled: campaign.hydrated && !preview.active,
    serverCreditedDays,
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
      if (door.state === 'locked' || !ready || !campaign.hydrated) return
      if (door.state === 'available') {
        sendAnalyticsEvent('Advent_DoorOpen', { day: door.day, kind: door.kind, guest: !isAuthenticated })
        openDoor(door.day, campaign.now)
        // Дверца-подарок без действия засчитывается самим открытием — только аккаунту.
        if (door.task.type === 'open' && isAuthenticated) completeTask(door.day, campaign.now)
      }
      setSelectedDay(door.day)
    },
    [ready, isAuthenticated, openDoor, completeTask, campaign.now, campaign.hydrated],
  )

  // Возврат после входа гостя (`/advent?day=N`): один раз открываем ту же дверцу.
  const handledDayParam = useRef<string | null>(null)
  useEffect(() => {
    const raw = typeof params.day === 'string' ? params.day : null
    if (preview.active || !ready || !campaign.hydrated || !raw || handledDayParam.current === raw) return
    handledDayParam.current = raw
    const door = doors.find((item) => item.day === Number(raw))
    // Тот же путь, что и тап по плитке: дверца открывается и зачитывается новому владельцу.
    if (door) handlePressDoor(door)
  }, [ready, campaign.hydrated, params.day, doors, handlePressDoor, preview.active])

  const handleCompleteTask = useCallback(
    (day: number) => {
      completeTask(day, campaign.now)
    },
    [completeTask, campaign.now],
  )

  const pressDoor = preview.active ? (door: AdventDoorView) => preview.selectDay(door.day) : handlePressDoor

  return (
    <View style={styles.root} {...SCREEN_CONTENT_FIRST_PROPS}>
      <InstantSEO
        headKey="advent"
        title={i18nT('seoStatic:root.advent.title')}
        description={i18nT('seoStatic:root.advent.description')}
        canonical={buildCanonicalUrl(ADVENT_ROUTE)}
        image={DEFAULT_OG_IMAGE_PATH}
      />
      {preview.allowed ? (
        <View style={styles.previewControls}>
          <Button
            label={t(preview.active ? 'adventStatic:preview.exit' : 'adventStatic:preview.enter')}
            onPress={() => {
              setSelectedDay(null)
              preview.toggle()
            }}
            variant="outline"
            testID="advent-preview-toggle"
          />
          {preview.active ? <Text style={styles.previewDescription}>{t('adventStatic:preview.description')}</Text> : null}
        </View>
      ) : null}
      <ScrollView style={webTouchScrollStyle} contentContainerStyle={styles.scroll} testID="advent-screen">
        <ResponsiveContainer maxWidth="xl" padding>
          <View style={styles.stack}>
            <Text style={styles.intro}>{i18nT('adventStatic:page.intro')}</Text>
            {campaign.todayDoor ? (
              <View style={styles.todayCard} testID="advent-today-action">
                <Text style={styles.todayDate}>{formatDoorDate(campaign.todayDoor.date)}</Text>
                <Text style={styles.todayTitle}>
                  {i18nT('adventStatic:home.today', {
                    value1: campaign.todayDoor.day,
                    value2: campaign.todayDoor.secret && campaign.todayDoor.state !== 'opened' && campaign.todayDoor.state !== 'done'
                      ? i18nT('adventStatic:tile.secret')
                      : campaign.todayDoor.gift.title,
                  })}
                </Text>
                <Button
                  label={campaign.todayDoor.state === 'available' ? i18nT('adventStatic:home.cta') : i18nT('adventStatic:profile.cta')}
                  disabled={!ready || !campaign.hydrated || campaign.todayDoor.state === 'locked'}
                  onPress={() => { if (campaign.todayDoor) pressDoor(campaign.todayDoor) }}
                  testID="advent-today-open"
                  labelNumberOfLines={2}
                  fullWidth
                />
              </View>
            ) : null}
            <AdventHeader
              openedCount={campaign.openedCount}
              doneCount={campaign.doneCount}
              streak={streak}
              nextDoor={campaign.nextDoor}
              now={campaign.now}
              hydrated={campaign.hydrated}
              syncState={sync.state}
            />
            <AdventGrid doors={preview.doors} todayDay={campaign.todayDoor?.day} disabled={!ready || !campaign.hydrated} onPressDoor={pressDoor} />
            {!preview.active && campaign.hydrated && campaign.openedCount > 0 ? (
              <AdventShareCard openedCount={campaign.openedCount} streak={streak} year={campaign.campaign.year} />
            ) : null}
            <Text style={styles.rules}>{i18nT('adventStatic:page.rules')}</Text>
          </View>
        </ResponsiveContainer>
      </ScrollView>
      <AdventDoorSheet
        door={preview.active ? preview.selectedDoor : selectedDoor}
        preview={preview.active}
        isAuthenticated={isAuthenticated}
        creditedDays={preview.active ? undefined : sync.creditedDays}
        campaignYear={campaign.campaign.year}
        onClose={() => preview.active ? preview.selectDay(null) : setSelectedDay(null)}
        onCompleteTask={preview.active ? preview.completeTask : handleCompleteTask}
      />
      {/* Значки адвента выдаёт сервер после синхронизации (#2864) — тост как в квестах. */}
      {isAuthenticated && !preview.active ? (
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
    previewControls: {
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      padding: DESIGN_TOKENS.spacing.sm,
    },
    previewDescription: { color: colors.textSecondary, textAlign: 'center' },
    scroll: { paddingVertical: DESIGN_TOKENS.spacing.md, paddingBottom: DESIGN_TOKENS.spacing.xl },
    stack: { gap: DESIGN_TOKENS.spacing.md, maxWidth: ADVENT_HOUSE_MAX_WIDTH, width: '100%', alignSelf: 'center' },
    intro: { fontSize: 15, lineHeight: 22, color: colors.textSecondary },
    todayCard: { padding: DESIGN_TOKENS.spacing.md, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primarySoft, borderRadius: DESIGN_TOKENS.radii.lg, gap: DESIGN_TOKENS.spacing.xs },
    todayDate: { fontSize: 13, lineHeight: 18, color: colors.primaryDark, fontWeight: '600' },
    todayTitle: { fontSize: 18, lineHeight: 25, color: colors.text, fontWeight: '700' },
    rules: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  })
